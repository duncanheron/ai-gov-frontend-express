const { Writable } = require("node:stream");
const express = require("express");
const pino = require("pino");
const pinoHttp = require("pino-http");
const request = require("supertest");

const { pinoHttpOptions } = require("../src/app");

/**
 * These tests prove request logging is safe by capturing what pino actually
 * writes, rather than asserting on the `redact` config array in isolation
 * (a config assertion would keep passing even if redaction silently stopped
 * working). The app's own logger is silenced in the test environment
 * (src/config/logger.js), so a small Express app is built here using the
 * exact same `pinoHttpOptions` object exported from src/app.js, wired to a
 * real (non-silent) pino instance that writes to an in-memory stream we can
 * inspect.
 */
function buildLoggedApp() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  const logger = pino({ level: "info" }, stream);
  const app = express();
  app.use(pinoHttp({ logger, ...pinoHttpOptions }));
  app.get("/ping", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.get("/boom", (req, res) => {
    res.status(500).json({ status: "error" });
  });

  const getLogEntries = () =>
    lines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  return { app, getLogEntries };
}

describe("request logging redaction", () => {
  it("redacts the Cookie header from the completed-request log line", async () => {
    const { app, getLogEntries } = buildLoggedApp();
    const sessionCookie = "sessionId=s%3AsuperSecretSessionValue.signature";

    await request(app).get("/ping").set("Cookie", sessionCookie).expect(200);

    const entries = getLogEntries();
    const completed = entries.find((entry) => entry.msg === "request completed");

    expect(completed).toBeTruthy();
    expect(completed.req.headers.cookie).toBe("[Redacted]");

    const rawOutput = JSON.stringify(entries);
    expect(rawOutput).not.toContain("superSecretSessionValue");
    expect(rawOutput).not.toContain(sessionCookie);
  });

  // An applicant's name reaches the logs through the URL, not a header - pino-http's
  // default serializer emits both `req.url` and `req.query`, so the term has to be
  // redacted in both or it survives in one of them.
  it("redacts an applicant's name from the search URL it was typed into", async () => {
    const { app, getLogEntries } = buildLoggedApp();

    await request(app).get("/ping?name=Ada%20Lovelace&service=housing").expect(200);

    const entries = getLogEntries();
    const completed = entries.find((entry) => entry.msg === "request completed");

    expect(completed).toBeTruthy();
    // The service is a fixed value from our own list, so it stays - it identifies nobody
    // and it is what makes a log line useful.
    expect(completed.req.query.service).toBe("housing");
    expect(JSON.stringify(entries)).not.toContain("Ada");
  });

  it("redacts the Authorization header from the completed-request log line", async () => {
    const { app, getLogEntries } = buildLoggedApp();
    const bearerToken = "Bearer super-secret-token-value";

    await request(app).get("/ping").set("Authorization", bearerToken).expect(200);

    const entries = getLogEntries();
    const completed = entries.find((entry) => entry.msg === "request completed");

    expect(completed).toBeTruthy();
    expect(completed.req.headers.authorization).toBe("[Redacted]");

    const rawOutput = JSON.stringify(entries);
    expect(rawOutput).not.toContain("super-secret-token-value");
  });

  it("leaves normal request logging (method, path, status, duration) unchanged", async () => {
    const { app, getLogEntries } = buildLoggedApp();

    await request(app).get("/ping").set("Cookie", "sessionId=s%3AsomeValue").expect(200);

    const entries = getLogEntries();
    const completed = entries.find((entry) => entry.msg === "request completed");

    expect(completed).toBeTruthy();
    expect(completed.req.method).toBe("GET");
    expect(completed.req.url).toBe("/ping");
    expect(completed.res.statusCode).toBe(200);
    expect(typeof completed.responseTime).toBe("number");
  });

  it("still logs failed requests with an unredacted status code", async () => {
    const { app, getLogEntries } = buildLoggedApp();

    await request(app).get("/boom").expect(500);

    const entries = getLogEntries();
    const errored = entries.find((entry) => entry.res && entry.res.statusCode === 500);

    expect(errored).toBeTruthy();
    expect(errored.req.method).toBe("GET");
    expect(errored.req.url).toBe("/boom");
  });
});
