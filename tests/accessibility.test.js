const fs = require("node:fs");
const request = require("supertest");
const { JSDOM } = require("jsdom");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function expectNoViolations(html) {
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  dom.window.eval(axeSource);
  const results = await dom.window.axe.run();
  dom.window.close();

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`)
      .join("\n");
    throw new Error(`Accessibility violations found:\n${summary}`);
  }
}

describe("accessibility", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("homepage has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/");
    await expectNoViolations(response.text);
  });

  it("applications list page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/applications");
    await expectNoViolations(response.text);
  });

  it("details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/apply/details");
    await expectNoViolations(response.text);
  });

  it("details page with validation errors has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply/details").type("form").send({ _csrf: token });
    await expectNoViolations(response.text);
  });

  it("preferences page (empty) has no automatically detectable accessibility violations", async () => {
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
    await expectNoViolations(preferencesPage.text);
  });

  it("check answers and confirmation pages have no automatically detectable accessibility violations", async () => {
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
      .send({ _csrf: preferencesToken, preferences: ["food", "ai"] });

    const checkAnswers = await agent.get("/apply/check-answers");
    await expectNoViolations(checkAnswers.text);
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    await agent.post("/apply/check-answers").type("form").send({ _csrf: checkAnswersToken });
    const confirmation = await agent.get("/apply/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("404 page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/not-a-real-page");
    await expectNoViolations(response.text);
  });

  it("applications list page (with rows) has no automatically detectable accessibility violations", async () => {
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
    await agent.post("/apply/preferences").type("form").send({ _csrf: preferencesToken });

    const checkAnswers = await agent.get("/apply/check-answers");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);
    await agent.post("/apply/check-answers").type("form").send({ _csrf: checkAnswersToken });

    const response = await agent.get("/applications");
    await expectNoViolations(response.text);
  });

  it("application detail page has no automatically detectable accessibility violations", async () => {
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
    await agent.post("/apply/preferences").type("form").send({ _csrf: preferencesToken });

    const checkAnswers = await agent.get("/apply/check-answers");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);
    await agent.post("/apply/check-answers").type("form").send({ _csrf: checkAnswersToken });
    const confirmation = await agent.get("/apply/confirmation");
    const [, reference] = confirmation.text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);

    const response = await agent.get(`/applications/${reference}`);
    await expectNoViolations(response.text);
  });

  it("application detail page 404 has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/applications/DOES-NOT-EXIST");
    await expectNoViolations(response.text);
  });

  it("housing details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/apply-housing/details");
    await expectNoViolations(response.text);
  });

  it("housing details page with validation errors has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    const detailsPage = await agent.get("/apply-housing/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply-housing/details").type("form").send({ _csrf: token });
    await expectNoViolations(response.text);
  });

  it("housing situation page (empty) has no automatically detectable accessibility violations", async () => {
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

    const situationPage = await agent.get("/apply-housing/situation");
    await expectNoViolations(situationPage.text);
  });

  it("housing situation page with validation errors has no automatically detectable accessibility violations", async () => {
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

    const situationPage = await agent.get("/apply-housing/situation");
    const situationToken = extractCsrfToken(situationPage.text);
    const response = await agent
      .post("/apply-housing/situation")
      .type("form")
      .send({ _csrf: situationToken });
    await expectNoViolations(response.text);
  });

  it("housing check answers page has no automatically detectable accessibility violations", async () => {
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

    const situationPage = await agent.get("/apply-housing/situation");
    const situationToken = extractCsrfToken(situationPage.text);
    await agent
      .post("/apply-housing/situation")
      .type("form")
      .send({ _csrf: situationToken, situation: "renting-privately" });

    const checkAnswers = await agent.get("/apply-housing/check-answers");
    await expectNoViolations(checkAnswers.text);
  });

  it("housing confirmation page has no automatically detectable accessibility violations", async () => {
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

    const situationPage = await agent.get("/apply-housing/situation");
    const situationToken = extractCsrfToken(situationPage.text);
    await agent
      .post("/apply-housing/situation")
      .type("form")
      .send({ _csrf: situationToken, situation: "renting-privately" });

    const checkAnswers = await agent.get("/apply-housing/check-answers");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);
    await agent
      .post("/apply-housing/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });

    const confirmation = await agent.get("/apply-housing/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("housing benefit details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/apply-housing-benefit/details");
    await expectNoViolations(response.text);
  });

  it("housing benefit details page with validation errors has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent
      .post("/apply-housing-benefit/details")
      .type("form")
      .send({ _csrf: token });
    await expectNoViolations(response.text);
  });

  it("housing benefit disability details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
    await expectNoViolations(disabilityDetailsPage.text);
  });

  it("housing benefit disability details page with validation errors has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
    const disabilityDetailsToken = extractCsrfToken(disabilityDetailsPage.text);
    const response = await agent
      .post("/apply-housing-benefit/disability-details")
      .type("form")
      .send({ _csrf: disabilityDetailsToken, disabilityDetails: "" });
    await expectNoViolations(response.text);
  });

  it("housing benefit check answers page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
    const disabilityDetailsToken = extractCsrfToken(disabilityDetailsPage.text);
    await agent.post("/apply-housing-benefit/disability-details").type("form").send({
      _csrf: disabilityDetailsToken,
      disabilityDetails: "I use a wheelchair and need step-free access.",
    });

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    await expectNoViolations(checkAnswers.text);
  });

  it("housing benefit confirmation page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
    const disabilityDetailsToken = extractCsrfToken(disabilityDetailsPage.text);
    await agent.post("/apply-housing-benefit/disability-details").type("form").send({
      _csrf: disabilityDetailsToken,
      disabilityDetails: "I use a wheelchair and need step-free access.",
    });

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);
    await agent
      .post("/apply-housing-benefit/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });

    const confirmation = await agent.get("/apply-housing-benefit/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("choose service ask page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/choose-service");
    await expectNoViolations(response.text);
  });

  it("choose service clarifying question page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need some help" });

    const clarifyPage = await agent.get("/choose-service");
    await expectNoViolations(clarifyPage.text);
  });

  it("choose service result page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });

    const resultPage = await agent.get("/choose-service");
    await expectNoViolations(resultPage.text);
  });
});
