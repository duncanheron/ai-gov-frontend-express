const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const money = require("../src/lib/money");

describe("money helper", () => {
  it("exports the epic amount constants", () => {
    expect(money.COUNCIL_TAX_AMOUNT_PENCE).toBe(15000);
    expect(money.GARDEN_WASTE_PENCE_PER_BIN_PER_YEAR).toBe(4500);
  });

  it("formats a fixed amount of pence as a GBP string", () => {
    expect(money.formatPence(15000)).toBe("£150.00");
  });

  it("formats a smaller round amount of pence as a GBP string", () => {
    expect(money.formatPence(4500)).toBe("£45.00");
  });

  it("formats zero pence as £0.00", () => {
    expect(money.formatPence(0)).toBe("£0.00");
  });

  it("formats a non-round amount of pence, keeping both decimal places", () => {
    expect(money.formatPence(12345)).toBe("£123.45");
  });
});

describe("pay council tax - details step", () => {
  it("shows the Your details form", async () => {
    const app = createApp();
    const response = await request(app).get("/pay-council-tax/details");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Your details");
  });

  it("stores valid details in the session and redirects to the account step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-council-tax/details");
    const token = extractCsrfToken(detailsPage.text);

    const submit = await agent.post("/pay-council-tax/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/pay-council-tax/account");

    // The account step doesn't exist yet (sub-issue 4) - a 404 there is
    // expected and acceptable at this stage. Assert the redirect location
    // only, do not follow it.
    const savedDetailsPage = await agent.get("/pay-council-tax/details");
    expect(savedDetailsPage.text).toContain('value="Ada Lovelace"');
  });

  it("shows the error summary and per-field errors for invalid details", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-council-tax/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/pay-council-tax/details").type("form").send({
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

  it("does not 500 when details are submitted as duplicated parameters, and takes the first value", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-council-tax/details");
    const token = extractCsrfToken(detailsPage.text);

    const submit = await agent
      .post("/pay-council-tax/details")
      .type("form")
      .send({
        _csrf: token,
        fullName: ["Ada Lovelace", "Ignored Duplicate"],
        email: ["ada@example.com", "ignored@example.com"],
        "dateOfBirth-day": ["27", "1"],
        "dateOfBirth-month": ["3", "1"],
        "dateOfBirth-year": ["1985", "2000"],
      });

    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/pay-council-tax/account");

    const savedDetailsPage = await agent.get("/pay-council-tax/details");
    expect(savedDetailsPage.text).toContain('value="Ada Lovelace"');
    expect(savedDetailsPage.text).not.toContain('value="Ignored Duplicate"');
  });
});

describe("pay for garden waste - details step", () => {
  it("shows the Your details form", async () => {
    const app = createApp();
    const response = await request(app).get("/pay-garden-waste/details");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Your details");
  });

  it("stores valid details in the session and redirects to the subscription step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-garden-waste/details");
    const token = extractCsrfToken(detailsPage.text);

    const submit = await agent.post("/pay-garden-waste/details").type("form").send({
      _csrf: token,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/pay-garden-waste/subscription");

    const savedDetailsPage = await agent.get("/pay-garden-waste/details");
    expect(savedDetailsPage.text).toContain('value="Grace Hopper"');
  });

  it("shows the error summary and per-field errors for invalid details", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-garden-waste/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/pay-garden-waste/details").type("form").send({
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

  it("does not 500 when details are submitted as duplicated parameters, and takes the first value", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/pay-garden-waste/details");
    const token = extractCsrfToken(detailsPage.text);

    const submit = await agent
      .post("/pay-garden-waste/details")
      .type("form")
      .send({
        _csrf: token,
        fullName: ["Grace Hopper", "Ignored Duplicate"],
        email: ["grace@example.com", "ignored@example.com"],
        "dateOfBirth-day": ["9", "1"],
        "dateOfBirth-month": ["12", "1"],
        "dateOfBirth-year": ["1906", "2000"],
      });

    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/pay-garden-waste/subscription");

    const savedDetailsPage = await agent.get("/pay-garden-waste/details");
    expect(savedDetailsPage.text).toContain('value="Grace Hopper"');
    expect(savedDetailsPage.text).not.toContain('value="Ignored Duplicate"');
  });
});

describe("session isolation between the two payment flows", () => {
  it("keeps councilTaxPayment and gardenWastePayment independent, mirroring housingApplication's shape", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const councilTaxDetailsPage = await agent.get("/pay-council-tax/details");
    const councilTaxToken = extractCsrfToken(councilTaxDetailsPage.text);
    await agent.post("/pay-council-tax/details").type("form").send({
      _csrf: councilTaxToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    // The garden waste flow's own details step must not see council tax's
    // answers - they are stored under separate session keys
    // (councilTaxPayment vs gardenWastePayment), not shared state.
    const gardenWasteDetailsPage = await agent.get("/pay-garden-waste/details");
    expect(gardenWasteDetailsPage.text).not.toContain('value="Ada Lovelace"');

    const gardenWasteToken = extractCsrfToken(gardenWasteDetailsPage.text);
    await agent.post("/pay-garden-waste/details").type("form").send({
      _csrf: gardenWasteToken,
      fullName: "Grace Hopper",
      email: "grace@example.com",
      "dateOfBirth-day": "9",
      "dateOfBirth-month": "12",
      "dateOfBirth-year": "1906",
    });

    // And council tax's own saved answers must still be there afterwards,
    // untouched by the garden waste submission.
    const councilTaxAgain = await agent.get("/pay-council-tax/details");
    expect(councilTaxAgain.text).toContain('value="Ada Lovelace"');
    expect(councilTaxAgain.text).not.toContain('value="Grace Hopper"');
  });
});

describe("navigation and homepage", () => {
  it("lists both payment flows on the homepage, linking to their details steps", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    // Match the homepage body link markup specifically (govuk-link), not
    // just any occurrence of the href - the header nav also links to these
    // paths, which would let a broken homepage body link go unnoticed.
    expect(response.text).toContain(
      '<a class="govuk-link" href="/pay-council-tax/details">Pay council tax</a>',
    );
    expect(response.text).toContain(
      '<a class="govuk-link" href="/pay-garden-waste/details">Pay for garden waste</a>',
    );
  });

  it("adds nav items for both payment flows, each marked current only on its own page", async () => {
    const app = createApp();

    const councilTaxPage = await request(app).get("/pay-council-tax/details");
    expect(councilTaxPage.text).toContain(
      '<a class="govuk-service-navigation__link" href="/pay-council-tax/details" aria-current="page">',
    );
    expect(councilTaxPage.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/pay-garden-waste/details" aria-current="page">',
    );

    const gardenWastePage = await request(app).get("/pay-garden-waste/details");
    expect(gardenWastePage.text).toContain(
      '<a class="govuk-service-navigation__link" href="/pay-garden-waste/details" aria-current="page">',
    );
    expect(gardenWastePage.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/pay-council-tax/details" aria-current="page">',
    );

    const home = await request(app).get("/");
    expect(home.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/pay-council-tax/details" aria-current="page">',
    );
    expect(home.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/pay-garden-waste/details" aria-current="page">',
    );
  });
});
