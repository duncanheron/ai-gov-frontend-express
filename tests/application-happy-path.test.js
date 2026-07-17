const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

describe("application journey - happy path", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("completes start -> details -> preferences -> check answers -> confirmation", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const home = await agent.get("/");
    expect(home.status).toBe(200);
    expect(home.text).toContain('href="/apply/details"');

    const detailsPage = await agent.get("/apply/details");
    expect(detailsPage.status).toBe(200);
    const detailsToken = extractCsrfToken(detailsPage.text);
    expect(detailsToken).toBeTruthy();

    const submitDetails = await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
    expect(submitDetails.status).toBe(302);
    expect(submitDetails.headers.location).toBe("/apply/check-answers");

    const checkAnswersBeforePreferences = await agent.get("/apply/check-answers");
    expect(checkAnswersBeforePreferences.status).toBe(302);
    expect(checkAnswersBeforePreferences.headers.location).toBe("/apply/preferences");

    const preferencesPage = await agent.get("/apply/preferences");
    expect(preferencesPage.status).toBe(200);
    const preferencesToken = extractCsrfToken(preferencesPage.text);

    const submitPreferences = await agent
      .post("/apply/preferences")
      .type("form")
      .send({
        _csrf: preferencesToken,
        preferences: ["food", "ai"],
      });
    expect(submitPreferences.status).toBe(302);
    expect(submitPreferences.headers.location).toBe("/apply/check-answers");

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace");
    expect(checkAnswers.text).toContain("ada@example.com");
    expect(checkAnswers.text).toContain("27/03/1985");
    expect(checkAnswers.text).toContain("Food, Artificial intelligence (AI)");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    const submitFinal = await agent
      .post("/apply/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    expect(submitFinal.status).toBe(302);
    expect(submitFinal.headers.location).toBe("/apply/confirmation");

    const confirmation = await agent.get("/apply/confirmation");
    expect(confirmation.status).toBe(200);
    expect(confirmation.text).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3}/);

    const backToCheckAnswers = await agent.get("/apply/check-answers");
    expect(backToCheckAnswers.status).toBe(302);
    expect(backToCheckAnswers.headers.location).toBe("/apply/details");
  });

  it("completes the journey with no preferences selected, showing None selected", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    await agent.post("/apply/preferences").type("form").send({ _csrf: preferencesToken });

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("None selected");
  });
});
