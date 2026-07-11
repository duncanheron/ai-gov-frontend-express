const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

describe("registration journey - happy path", () => {
  it("completes start -> details -> check answers -> confirmation", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const home = await agent.get("/");
    expect(home.status).toBe(200);
    expect(home.text).toContain("Start now");

    const detailsPage = await agent.get("/register/details");
    expect(detailsPage.status).toBe(200);
    const detailsToken = extractCsrfToken(detailsPage.text);
    expect(detailsToken).toBeTruthy();

    const submitDetails = await agent.post("/register/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
    expect(submitDetails.status).toBe(302);
    expect(submitDetails.headers.location).toBe("/register/check-answers");

    const checkAnswers = await agent.get("/register/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace");
    expect(checkAnswers.text).toContain("ada@example.com");
    expect(checkAnswers.text).toContain("27/03/1985");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    const submitFinal = await agent
      .post("/register/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    expect(submitFinal.status).toBe(302);
    expect(submitFinal.headers.location).toBe("/register/confirmation");

    const confirmation = await agent.get("/register/confirmation");
    expect(confirmation.status).toBe(200);
    expect(confirmation.text).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3}/);

    const backToCheckAnswers = await agent.get("/register/check-answers");
    expect(backToCheckAnswers.status).toBe(302);
    expect(backToCheckAnswers.headers.location).toBe("/register/details");
  });
});
