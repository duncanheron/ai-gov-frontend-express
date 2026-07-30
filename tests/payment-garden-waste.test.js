const request = require("supertest");
const createApp = require("../src/app");
const applications = require("../src/db/applications");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

async function submitDetails(agent, overrides = {}) {
  const detailsPage = await agent.get("/pay-garden-waste/details");
  const token = extractCsrfToken(detailsPage.text);
  return agent
    .post("/pay-garden-waste/details")
    .type("form")
    .send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      ...overrides,
    });
}

describe("garden waste payment journey - happy path", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it.each([
    ["1", "£45.00", "Garden waste - 1 bin, £45.00 per year"],
    ["2", "£90.00", "Garden waste - 2 bins, £90.00 per year"],
    ["3", "£135.00", "Garden waste - 3 bins, £135.00 per year"],
  ])(
    "completes details -> subscription -> check answers -> confirmation for %s bin(s)",
    async (bins, amount, expectedFlowAnswer) => {
      const app = createApp();
      const agent = request.agent(app);

      const detailsPage = await agent.get("/pay-garden-waste/details");
      expect(detailsPage.status).toBe(200);
      expect(detailsPage.text).toContain("Your details");

      const submitDetailsResponse = await submitDetails(agent);
      expect(submitDetailsResponse.status).toBe(302);
      expect(submitDetailsResponse.headers.location).toBe("/pay-garden-waste/subscription");

      const checkAnswersBeforeSubscription = await agent.get("/pay-garden-waste/check-answers");
      expect(checkAnswersBeforeSubscription.status).toBe(302);
      expect(checkAnswersBeforeSubscription.headers.location).toBe(
        "/pay-garden-waste/subscription",
      );

      const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
      expect(subscriptionPage.status).toBe(200);
      expect(subscriptionPage.text).toContain("How many garden waste bins do you need?");
      const subscriptionToken = extractCsrfToken(subscriptionPage.text);

      const submitSubscription = await agent
        .post("/pay-garden-waste/subscription")
        .type("form")
        .send({ _csrf: subscriptionToken, bins });
      expect(submitSubscription.status).toBe(302);
      expect(submitSubscription.headers.location).toBe("/pay-garden-waste/check-answers");

      const checkAnswers = await agent.get("/pay-garden-waste/check-answers");
      expect(checkAnswers.status).toBe(200);
      expect(checkAnswers.text).toContain("Ada Lovelace");
      expect(checkAnswers.text).toContain("ada@example.com");
      expect(checkAnswers.text).toContain("27/03/1985");
      expect(checkAnswers.text).toContain(amount);
      expect(checkAnswers.text).toContain("This is a demo service. No payment will be taken.");
      const checkAnswersToken = extractCsrfToken(checkAnswers.text);

      const submitFinal = await agent
        .post("/pay-garden-waste/check-answers")
        .type("form")
        .send({ _csrf: checkAnswersToken });
      expect(submitFinal.status).toBe(302);
      expect(submitFinal.headers.location).toBe("/pay-garden-waste/confirmation");

      const confirmation = await agent.get("/pay-garden-waste/confirmation");
      expect(confirmation.status).toBe(200);
      expect(confirmation.text).toContain("This is a demo service. No payment will be taken.");

      const referenceMatch = confirmation.text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);
      const reference = referenceMatch[1];

      const stored = await applications.get(reference);
      expect(stored).not.toBeNull();
      expect(stored.flow).toBe("garden-waste");
      expect(stored.flow_answer).toBe(expectedFlowAnswer);

      const backToCheckAnswers = await agent.get("/pay-garden-waste/check-answers");
      expect(backToCheckAnswers.status).toBe(302);
      expect(backToCheckAnswers.headers.location).toBe("/pay-garden-waste/details");
    },
  );
});

describe("garden waste payment journey - guards and validation", () => {
  it("shows an error when no bin count is selected", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await submitDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    const token = extractCsrfToken(subscriptionPage.text);

    const response = await agent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: token });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain("Select how many garden waste bins you need");
  });

  it("shows an error when the bin count is outside the option list", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await submitDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    const token = extractCsrfToken(subscriptionPage.text);

    const response = await agent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: token, bins: "4" });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Select how many garden waste bins you need");
  });

  it("does not 500 when bins is submitted as a duplicated parameter, and takes the first value", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await submitDetails(agent);

    const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
    const token = extractCsrfToken(subscriptionPage.text);

    const submitSubscription = await agent
      .post("/pay-garden-waste/subscription")
      .type("form")
      .send({ _csrf: token, bins: ["1", "3"] });
    expect(submitSubscription.status).toBe(302);
    expect(submitSubscription.headers.location).toBe("/pay-garden-waste/check-answers");

    const checkAnswers = await agent.get("/pay-garden-waste/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("£45.00");
    expect(checkAnswers.text).not.toContain("£135.00");
  });

  it("blocks check-answers and confirmation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const checkAnswers = await agent.get("/pay-garden-waste/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/pay-garden-waste/details");

    const confirmation = await agent.get("/pay-garden-waste/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks subscription without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const subscription = await agent.get("/pay-garden-waste/subscription");
    expect(subscription.status).toBe(302);
    expect(subscription.headers.location).toBe("/pay-garden-waste/details");
  });

  it("blocks check-answers without completing the subscription step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await submitDetails(agent);

    const checkAnswers = await agent.get("/pay-garden-waste/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/pay-garden-waste/subscription");
  });

  it("keeps the garden waste journey session independent from the housing journey", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await submitDetails(agent);

    const housingCheckAnswers = await agent.get("/apply-housing/check-answers");
    expect(housingCheckAnswers.status).toBe(302);
    expect(housingCheckAnswers.headers.location).toBe("/apply-housing/details");
  });
});
