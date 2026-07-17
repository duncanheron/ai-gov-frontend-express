const request = require("supertest");
const createApp = require("../src/app");
const applications = require("../src/db/applications");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

describe("housing application journey - happy path", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("completes start -> details -> situation -> check answers -> confirmation", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing/details");
    expect(detailsPage.status).toBe(200);
    expect(detailsPage.text).toContain("Your details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    expect(detailsToken).toBeTruthy();

    const submitDetails = await agent.post("/apply-housing/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
    expect(submitDetails.status).toBe(302);
    expect(submitDetails.headers.location).toBe("/apply-housing/situation");

    const checkAnswersBeforeSituation = await agent.get("/apply-housing/check-answers");
    expect(checkAnswersBeforeSituation.status).toBe(302);
    expect(checkAnswersBeforeSituation.headers.location).toBe("/apply-housing/situation");

    const situationPage = await agent.get("/apply-housing/situation");
    expect(situationPage.status).toBe(200);
    expect(situationPage.text).toContain("your current housing situation?");
    const situationToken = extractCsrfToken(situationPage.text);

    const submitSituation = await agent.post("/apply-housing/situation").type("form").send({
      _csrf: situationToken,
      situation: "renting-privately",
    });
    expect(submitSituation.status).toBe(302);
    expect(submitSituation.headers.location).toBe("/apply-housing/check-answers");

    const checkAnswers = await agent.get("/apply-housing/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace");
    expect(checkAnswers.text).toContain("ada@example.com");
    expect(checkAnswers.text).toContain("27/03/1985");
    expect(checkAnswers.text).toContain("Renting privately");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    const submitFinal = await agent
      .post("/apply-housing/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    expect(submitFinal.status).toBe(302);
    expect(submitFinal.headers.location).toBe("/apply-housing/confirmation");

    const confirmation = await agent.get("/apply-housing/confirmation");
    expect(confirmation.status).toBe(200);
    expect(confirmation.text).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3}/);

    const referenceMatch = confirmation.text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);
    const reference = referenceMatch[1];

    const stored = await applications.get(reference);
    expect(stored).not.toBeNull();
    expect(stored.flow).toBe("housing");
    expect(stored.flow_answer).not.toBeNull();
    expect(stored.flow_answer).toBe("Renting privately");

    const backToCheckAnswers = await agent.get("/apply-housing/check-answers");
    expect(backToCheckAnswers.status).toBe(302);
    expect(backToCheckAnswers.headers.location).toBe("/apply-housing/details");
  });
});

describe("housing application journey - guards and validation", () => {
  it("shows the error summary and per-field errors for invalid details", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply-housing/details").type("form").send({
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

  it("shows an error when no housing situation is selected", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    const situationPage = await agent.get("/apply-housing/situation");
    const situationToken = extractCsrfToken(situationPage.text);

    const response = await agent
      .post("/apply-housing/situation")
      .type("form")
      .send({ _csrf: situationToken });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain("Select your current housing situation");
  });

  it("blocks check-answers and confirmation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const checkAnswers = await agent.get("/apply-housing/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply-housing/details");

    const confirmation = await agent.get("/apply-housing/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks situation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const situation = await agent.get("/apply-housing/situation");
    expect(situation.status).toBe(302);
    expect(situation.headers.location).toBe("/apply-housing/details");
  });

  it("blocks check-answers without completing the situation step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/apply-housing/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply-housing/situation");
  });

  it("keeps the housing journey session independent from the standard apply journey", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    // The standard /apply journey should still require its own details step,
    // proving req.session.housingApplication and req.session.application
    // are entirely separate.
    const standardCheckAnswers = await agent.get("/apply/check-answers");
    expect(standardCheckAnswers.status).toBe(302);
    expect(standardCheckAnswers.headers.location).toBe("/apply/details");
  });
});
