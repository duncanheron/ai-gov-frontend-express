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

    const response = await agent
      .post("/apply/details")
      .type("form")
      .send({ _csrf: token, favouriteAnimal: "a".repeat(101) });
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
      favouriteAnimal: "Otter",
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
    expect(response.text).toContain("Favourite animal");
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

  async function submitCouncilTaxDetails(agent) {
    const detailsPage = await agent.get("/pay-council-tax/details");
    const token = extractCsrfToken(detailsPage.text);
    return agent.post("/pay-council-tax/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
  }

  async function submitGardenWasteDetails(agent) {
    const detailsPage = await agent.get("/pay-garden-waste/details");
    const token = extractCsrfToken(detailsPage.text);
    return agent.post("/pay-garden-waste/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
  }

  it("council tax details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/pay-council-tax/details");
    await expectNoViolations(response.text);
  });

  it("council tax account page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitCouncilTaxDetails(agent);

    const accountPage = await agent.get("/pay-council-tax/account");
    await expectNoViolations(accountPage.text);
  });

  it("council tax account page with a validation error has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitCouncilTaxDetails(agent);

    const accountPage = await agent.get("/pay-council-tax/account");
    const token = extractCsrfToken(accountPage.text);
    const response = await agent
      .post("/pay-council-tax/account")
      .type("form")
      .send({ _csrf: token, accountNumber: "" });
    await expectNoViolations(response.text);
  });

  it("council tax check answers and confirmation pages have no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitCouncilTaxDetails(agent);

    const accountPage = await agent.get("/pay-council-tax/account");
    const accountToken = extractCsrfToken(accountPage.text);
    await agent
      .post("/pay-council-tax/account")
      .type("form")
      .send({ _csrf: accountToken, accountNumber: "12345678" });

    const checkAnswers = await agent.get("/pay-council-tax/check-answers");
    await expectNoViolations(checkAnswers.text);
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    await agent
      .post("/pay-council-tax/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    const confirmation = await agent.get("/pay-council-tax/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("garden waste details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/pay-garden-waste/details");
    await expectNoViolations(response.text);
  });

  it("garden waste subscription page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitGardenWasteDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    await expectNoViolations(subscriptionPage.text);
  });

  it("garden waste subscription page with a validation error has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitGardenWasteDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    const token = extractCsrfToken(subscriptionPage.text);
    const response = await agent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: token, bins: "" });
    await expectNoViolations(response.text);
  });

  it("garden waste check answers and confirmation pages have no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await submitGardenWasteDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    const subscriptionToken = extractCsrfToken(subscriptionPage.text);
    await agent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: subscriptionToken, bins: "2" });

    const checkAnswers = await agent.get("/pay-garden-waste/check-answers");
    await expectNoViolations(checkAnswers.text);
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    await agent
      .post("/pay-garden-waste/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    const confirmation = await agent.get("/pay-garden-waste/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("council tax and garden waste applications both render their flow answer on the caseworker detail page and appear in the list", async () => {
    const app = createApp();

    const councilTaxAgent = request.agent(app);
    await submitCouncilTaxDetails(councilTaxAgent);
    const councilTaxAccountPage = await councilTaxAgent.get("/pay-council-tax/account");
    const councilTaxAccountToken = extractCsrfToken(councilTaxAccountPage.text);
    await councilTaxAgent
      .post("/pay-council-tax/account")
      .type("form")
      .send({ _csrf: councilTaxAccountToken, accountNumber: "12345678" });
    const councilTaxCheckAnswers = await councilTaxAgent.get("/pay-council-tax/check-answers");
    const councilTaxCheckAnswersToken = extractCsrfToken(councilTaxCheckAnswers.text);
    await councilTaxAgent
      .post("/pay-council-tax/check-answers")
      .type("form")
      .send({ _csrf: councilTaxCheckAnswersToken });
    const councilTaxConfirmation = await councilTaxAgent.get("/pay-council-tax/confirmation");
    const [, councilTaxReference] = councilTaxConfirmation.text.match(
      /([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/,
    );

    const gardenWasteAgent = request.agent(app);
    await submitGardenWasteDetails(gardenWasteAgent);
    const subscriptionPage = await gardenWasteAgent.get("/pay-garden-waste/subscription");
    const subscriptionToken = extractCsrfToken(subscriptionPage.text);
    await gardenWasteAgent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: subscriptionToken, bins: "3" });
    const gardenWasteCheckAnswers = await gardenWasteAgent.get("/pay-garden-waste/check-answers");
    const gardenWasteCheckAnswersToken = extractCsrfToken(gardenWasteCheckAnswers.text);
    await gardenWasteAgent
      .post("/pay-garden-waste/check-answers")
      .type("form")
      .send({ _csrf: gardenWasteCheckAnswersToken });
    const gardenWasteConfirmation = await gardenWasteAgent.get("/pay-garden-waste/confirmation");
    const [, gardenWasteReference] = gardenWasteConfirmation.text.match(
      /([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/,
    );

    const councilTaxDetail = await request(app).get(`/applications/${councilTaxReference}`);
    expect(councilTaxDetail.text).toContain("Council tax payment");
    expect(councilTaxDetail.text).toContain("Council tax - account 12345678, £150.00");
    await expectNoViolations(councilTaxDetail.text);

    const gardenWasteDetail = await request(app).get(`/applications/${gardenWasteReference}`);
    expect(gardenWasteDetail.text).toContain("Garden waste payment");
    expect(gardenWasteDetail.text).toContain("Garden waste - 3 bins, £135.00 per year");
    await expectNoViolations(gardenWasteDetail.text);

    const list = await request(app).get("/applications");
    expect(list.text).toContain(councilTaxReference);
    expect(list.text).toContain(gardenWasteReference);
  });
});
