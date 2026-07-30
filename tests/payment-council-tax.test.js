const request = require("supertest");
const applications = require("../src/db/applications");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

async function submitDetails(agent) {
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

describe("council tax payment journey - happy path", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("completes start -> details -> account -> check answers -> confirmation", async () => {
    const agent = request.agent(getServer());

    const submitDetailsResponse = await submitDetails(agent);
    expect(submitDetailsResponse.status).toBe(302);
    expect(submitDetailsResponse.headers.location).toBe("/pay-council-tax/account");

    const checkAnswersBeforeAccount = await agent.get("/pay-council-tax/check-answers");
    expect(checkAnswersBeforeAccount.status).toBe(302);
    expect(checkAnswersBeforeAccount.headers.location).toBe("/pay-council-tax/account");

    const accountPage = await agent.get("/pay-council-tax/account");
    expect(accountPage.status).toBe(200);
    expect(accountPage.text).toContain("Your council tax account number");
    const accountToken = extractCsrfToken(accountPage.text);

    const submitAccount = await agent.post("/pay-council-tax/account").type("form").send({
      _csrf: accountToken,
      accountNumber: "12345678",
    });
    expect(submitAccount.status).toBe(302);
    expect(submitAccount.headers.location).toBe("/pay-council-tax/check-answers");

    const checkAnswers = await agent.get("/pay-council-tax/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace");
    expect(checkAnswers.text).toContain("ada@example.com");
    expect(checkAnswers.text).toContain("27/03/1985");
    expect(checkAnswers.text).toContain("12345678");
    expect(checkAnswers.text).toContain("£150.00");
    expect(checkAnswers.text).toContain("This is a demo service. No payment will be taken.");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    const submitFinal = await agent
      .post("/pay-council-tax/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    expect(submitFinal.status).toBe(302);
    expect(submitFinal.headers.location).toBe("/pay-council-tax/confirmation");

    const confirmation = await agent.get("/pay-council-tax/confirmation");
    expect(confirmation.status).toBe(200);
    expect(confirmation.text).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3}/);
    expect(confirmation.text).toContain("This is a demo service. No payment will be taken.");

    const referenceMatch = confirmation.text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);
    const reference = referenceMatch[1];

    const stored = await applications.get(reference);
    expect(stored).not.toBeNull();
    expect(stored.flow).toBe("council-tax");
    expect(stored.flow_answer).toBe("Council tax - account 12345678, £150.00");

    const backToCheckAnswers = await agent.get("/pay-council-tax/check-answers");
    expect(backToCheckAnswers.status).toBe(302);
    expect(backToCheckAnswers.headers.location).toBe("/pay-council-tax/details");
  });
});

describe("council tax payment journey - guards and validation", () => {
  it("shows the error summary and per-field error for an empty account number", async () => {
    const agent = request.agent(getServer());

    await submitDetails(agent);
    const accountPage = await agent.get("/pay-council-tax/account");
    const token = extractCsrfToken(accountPage.text);

    const response = await agent
      .post("/pay-council-tax/account")
      .type("form")
      .send({ _csrf: token, accountNumber: "" });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain("Enter your council tax account number");
  });

  it.each(["1234567", "123456789", "1234567a"])(
    "rejects %s as not 8 digits",
    async (accountNumber) => {
      const agent = request.agent(getServer());

      await submitDetails(agent);
      const accountPage = await agent.get("/pay-council-tax/account");
      const token = extractCsrfToken(accountPage.text);

      const response = await agent
        .post("/pay-council-tax/account")
        .type("form")
        .send({ _csrf: token, accountNumber });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Council tax account number must be 8 digits");
    },
  );

  it("does not 500 when the account number is submitted as a duplicated parameter, and takes the first value", async () => {
    const agent = request.agent(getServer());

    await submitDetails(agent);
    const accountPage = await agent.get("/pay-council-tax/account");
    const token = extractCsrfToken(accountPage.text);

    const submitAccount = await agent
      .post("/pay-council-tax/account")
      .type("form")
      .send({ _csrf: token, accountNumber: ["12345678", "99999999"] });
    expect(submitAccount.status).toBe(302);
    expect(submitAccount.headers.location).toBe("/pay-council-tax/check-answers");

    const checkAnswers = await agent.get("/pay-council-tax/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("12345678");
    expect(checkAnswers.text).not.toContain("99999999");
  });

  it("blocks check-answers and confirmation without completing the details step", async () => {
    const agent = request.agent(getServer());

    const checkAnswers = await agent.get("/pay-council-tax/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/pay-council-tax/details");

    const confirmation = await agent.get("/pay-council-tax/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks account without completing the details step", async () => {
    const agent = request.agent(getServer());

    const account = await agent.get("/pay-council-tax/account");
    expect(account.status).toBe(302);
    expect(account.headers.location).toBe("/pay-council-tax/details");
  });

  it("blocks check-answers without completing the account step", async () => {
    const agent = request.agent(getServer());

    await submitDetails(agent);

    const checkAnswers = await agent.get("/pay-council-tax/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/pay-council-tax/account");
  });
});
