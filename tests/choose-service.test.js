const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

describe("choose service (AI picker)", () => {
  it("shows the initial free-text question", async () => {
    const app = createApp();
    const response = await request(app).get("/choose-service");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Not sure which service you need");
  });

  it("recommends Housing for a clearly housing-flavoured description, with a working link", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    const submit = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });
    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/choose-service");

    const result = await agent.get("/choose-service");
    expect(result.status).toBe(200);
    expect(result.text).toContain("Housing");
    expect(result.text).toContain('href="/apply-housing/details"');
  });

  it("recommends Housing Benefit (disability) for a clearly disability-flavoured description, with a working link", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need housing benefit because of my disability" });

    const result = await agent.get("/choose-service");
    expect(result.status).toBe(200);
    expect(result.text).toContain("Housing Benefit (disability)");
    expect(result.text).toContain('href="/apply-housing-benefit/details"');
  });

  it("asks a clarifying question for an ambiguous description, then decides on the next submission", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token1 = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token1, description: "I need some help" });

    const clarifyPage = await agent.get("/choose-service");
    expect(clarifyPage.status).toBe(200);
    expect(clarifyPage.text).toContain("disability");
    const token2 = extractCsrfToken(clarifyPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token2, description: "just a regular housing application" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("Housing");
    expect(result.text).toContain('href="/apply-housing/details"');
  });

  it("shows a plain error message and no crash when the AI call fails, with a way forward", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    const submit = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "simulate-ai-failure" });

    expect(submit.status).toBe(503);
    expect(submit.text).toContain("Sorry, there is a problem");
    expect(submit.text).toContain('href="/choose-service/start-again"');
    expect(submit.text).toContain('href="/"');
  });

  it("lets you start again after reaching a decision, and reach an independent new recommendation", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });

    const firstResult = await agent.get("/choose-service");
    expect(firstResult.text).toContain("Housing");
    expect(firstResult.text).toContain('href="/choose-service/start-again"');

    const startAgain = await agent.get("/choose-service/start-again");
    expect(startAgain.status).toBe(302);
    expect(startAgain.headers.location).toBe("/choose-service");

    const freshAskPage = await agent.get("/choose-service");
    expect(freshAskPage.status).toBe(200);
    expect(freshAskPage.text).toContain("Not sure which service you need");
    const freshToken = extractCsrfToken(freshAskPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: freshToken, description: "I need housing benefit because of my disability" });

    const secondResult = await agent.get("/choose-service");
    expect(secondResult.text).toContain("Housing Benefit (disability)");
    expect(secondResult.text).toContain('href="/apply-housing-benefit/details"');
  });

  it("recovers via start-again from an AI failure that happened after an earlier decision", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });

    const decided = await agent.get("/choose-service");
    expect(decided.text).toContain("Housing");

    // The "result" view has no form of its own (just a "Continue" button and
    // links), so there's no fresh CSRF token to scrape from it - reuse the
    // token from the initial ask page, which stays valid for the session.
    const failedRetry = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "simulate-ai-failure" });
    expect(failedRetry.status).toBe(503);
    expect(failedRetry.text).toContain('href="/choose-service/start-again"');

    const startAgain = await agent.get("/choose-service/start-again");
    expect(startAgain.status).toBe(302);

    const freshAskPage = await agent.get("/choose-service");
    expect(freshAskPage.text).toContain("Not sure which service you need");
    expect(freshAskPage.text).not.toContain("We recommend");
  });
});
