const request = require("supertest");
const createApp = require("../src/app");
const applications = require("../src/db/applications");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

describe("housing benefit (disability) application journey - happy path", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("completes details -> disability-details -> check answers -> confirmation", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    expect(detailsPage.status).toBe(200);
    const detailsToken = extractCsrfToken(detailsPage.text);
    expect(detailsToken).toBeTruthy();

    const submitDetails = await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });
    expect(submitDetails.status).toBe(302);
    expect(submitDetails.headers.location).toBe("/apply-housing-benefit/disability-details");

    const checkAnswersBeforeDisabilityDetails = await agent.get(
      "/apply-housing-benefit/check-answers",
    );
    expect(checkAnswersBeforeDisabilityDetails.status).toBe(302);
    expect(checkAnswersBeforeDisabilityDetails.headers.location).toBe(
      "/apply-housing-benefit/disability-details",
    );

    const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
    expect(disabilityDetailsPage.status).toBe(200);
    const disabilityDetailsToken = extractCsrfToken(disabilityDetailsPage.text);

    const disabilityText =
      "I use a wheelchair and need step-free access and a wetroom adapted bathroom.";
    const submitDisabilityDetails = await agent
      .post("/apply-housing-benefit/disability-details")
      .type("form")
      .send({ _csrf: disabilityDetailsToken, disabilityDetails: disabilityText });
    expect(submitDisabilityDetails.status).toBe(302);
    expect(submitDisabilityDetails.headers.location).toBe("/apply-housing-benefit/check-answers");

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace");
    expect(checkAnswers.text).toContain("ada@example.com");
    expect(checkAnswers.text).toContain("27/03/1985");
    expect(checkAnswers.text).toContain(disabilityText);
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);

    const submitFinal = await agent
      .post("/apply-housing-benefit/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });
    expect(submitFinal.status).toBe(302);
    expect(submitFinal.headers.location).toBe("/apply-housing-benefit/confirmation");

    const confirmation = await agent.get("/apply-housing-benefit/confirmation");
    expect(confirmation.status).toBe(200);
    const referenceMatch = confirmation.text.match(/[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3}/);
    expect(referenceMatch).toBeTruthy();

    const reference = referenceMatch[0];
    const stored = await applications.get(reference);
    expect(stored).toBeTruthy();
    expect(stored.flow).toBe("housing-benefit-disability");
    expect(stored.flow_answer).toBe(disabilityText);
    expect(stored.full_name).toBe("Ada Lovelace");
    expect(stored.email).toBe("ada@example.com");

    const backToCheckAnswers = await agent.get("/apply-housing-benefit/check-answers");
    expect(backToCheckAnswers.status).toBe(302);
    expect(backToCheckAnswers.headers.location).toBe("/apply-housing-benefit/details");
  });
});

describe("housing benefit (disability) application journey - guards", () => {
  it("blocks disability-details, check-answers and confirmation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const disabilityDetails = await agent.get("/apply-housing-benefit/disability-details");
    expect(disabilityDetails.status).toBe(302);
    expect(disabilityDetails.headers.location).toBe("/apply-housing-benefit/details");

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply-housing-benefit/details");

    const confirmation = await agent.get("/apply-housing-benefit/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks check-answers without completing the disability-details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply-housing-benefit/disability-details");
  });

  it("keeps this journey's session key independent from the existing /apply journey", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply-housing-benefit/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    // The existing /apply journey has its own session key and must not see
    // the answers just entered for the housing benefit journey.
    const applyCheckAnswers = await agent.get("/apply/check-answers");
    expect(applyCheckAnswers.status).toBe(302);
    expect(applyCheckAnswers.headers.location).toBe("/apply/details");
  });
});

describe("housing benefit (disability) application journey - validation", () => {
  it("shows the error summary and per-field errors for invalid details input", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply-housing-benefit/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply-housing-benefit/details").type("form").send({
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

  it("rejects an empty disability details submission, since it is the substance of the application", async () => {
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
    const token = extractCsrfToken(disabilityDetailsPage.text);

    const response = await agent
      .post("/apply-housing-benefit/disability-details")
      .type("form")
      .send({ _csrf: token, disabilityDetails: "" });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain(
      "Tell us about your disability and how it affects your housing needs",
    );

    const checkAnswers = await agent.get("/apply-housing-benefit/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply-housing-benefit/disability-details");
  });

  it("rejects a disability details submission over the maximum length", async () => {
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
    const token = extractCsrfToken(disabilityDetailsPage.text);

    const response = await agent
      .post("/apply-housing-benefit/disability-details")
      .type("form")
      .send({ _csrf: token, disabilityDetails: "a".repeat(1001) });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Disability details must be 1000 characters or fewer");
  });
});
