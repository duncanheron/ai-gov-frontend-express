const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

describe("application journey - validation", () => {
  it("shows the error summary and per-field errors for invalid input", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply/details").type("form").send({
      _csrf: token,
      fullName: "",
      email: "not-an-email",
      "dateOfBirth-day": "31",
      "dateOfBirth-month": "2",
      "dateOfBirth-year": "2020",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain("Enter your full name");
    expect(response.text).toContain("Enter an email address in the correct format");
    expect(response.text).toContain("Date of birth must be a real date");
  });

  it("blocks check-answers and confirmation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply/details");

    const confirmation = await agent.get("/apply/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks preferences without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const preferences = await agent.get("/apply/preferences");
    expect(preferences.status).toBe(302);
    expect(preferences.headers.location).toBe("/apply/details");
  });

  it("blocks check-answers without completing the preferences step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply/preferences");
  });

  it("accepts a single checked preference sent as a plain string, not an array", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    const submitPreferences = await agent
      .post("/apply/preferences")
      .type("form")
      .send({ _csrf: preferencesToken, preferences: "animals" });
    expect(submitPreferences.status).toBe(302);
    expect(submitPreferences.headers.location).toBe("/apply/check-answers");

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.text).toContain("Animals");
  });

  it("does not wipe a previously submitted preferences answer when re-editing details", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    await agent
      .post("/apply/preferences")
      .type("form")
      .send({ _csrf: preferencesToken, preferences: "animals" });

    const detailsAgain = await agent.get("/apply/details");
    const detailsTokenAgain = extractCsrfToken(detailsAgain.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsTokenAgain,
      fullName: "Ada Lovelace-Updated",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace-Updated");
    expect(checkAnswers.text).toContain("Animals");
  });

  it("returns 404 for an unknown route", async () => {
    const app = createApp();
    const response = await request(app).get("/not-a-real-page");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Page not found");
  });
});
