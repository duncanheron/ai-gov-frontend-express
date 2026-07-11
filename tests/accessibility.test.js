const fs = require("node:fs");
const request = require("supertest");
const { JSDOM } = require("jsdom");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

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
  it("homepage has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/");
    await expectNoViolations(response.text);
  });

  it("details page (empty) has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/register/details");
    await expectNoViolations(response.text);
  });

  it("details page with validation errors has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);
    const detailsPage = await agent.get("/register/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/register/details").type("form").send({ _csrf: token });
    await expectNoViolations(response.text);
  });

  it("check answers and confirmation pages have no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/register/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/register/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/register/check-answers");
    await expectNoViolations(checkAnswers.text);
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    await agent.post("/register/check-answers").type("form").send({ _csrf: checkAnswersToken });
    const confirmation = await agent.get("/register/confirmation");
    await expectNoViolations(confirmation.text);
  });

  it("404 page has no automatically detectable accessibility violations", async () => {
    const app = createApp();
    const response = await request(app).get("/not-a-real-page");
    await expectNoViolations(response.text);
  });
});
