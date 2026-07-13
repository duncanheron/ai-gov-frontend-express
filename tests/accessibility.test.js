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
});
