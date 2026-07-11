const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

describe("registration journey - validation", () => {
  it("shows the error summary and per-field errors for invalid input", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/register/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/register/details").type("form").send({
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

    const checkAnswers = await agent.get("/register/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/register/details");

    const confirmation = await agent.get("/register/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("returns 404 for an unknown route", async () => {
    const app = createApp();
    const response = await request(app).get("/not-a-real-page");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Page not found");
  });
});
