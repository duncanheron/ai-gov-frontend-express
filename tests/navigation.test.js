const request = require("supertest");
const createApp = require("../src/app");

describe("header navigation", () => {
  it("homepage shows the service name linking to the homepage, and no external gov.uk logo link", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.text).toContain('<a href="/" class="govuk-service-navigation__link">');
    expect(response.text).not.toContain("//gov.uk");
  });

  it("homepage has a link to the applications list", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/applications">',
    );
    expect(response.text).toContain("Applications");
  });

  it("shows all five nav items on every page", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/applications">',
    );
    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply/details">',
    );
    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing/details">',
    );
    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing-benefit/details">',
    );
    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/choose-service">',
    );
    expect(response.text).toContain("Apply for housing");
    expect(response.text).toContain("Apply for Housing Benefit (disability)");
    expect(response.text).toContain("Not sure which service you need?");
  });

  it("does not mark the applications nav link as current on the homepage or apply journey", async () => {
    const app = createApp();

    const home = await request(app).get("/");
    expect(home.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
    );

    const details = await request(app).get("/apply/details");
    expect(details.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
    );
  });

  it("marks the applications nav link as current on the applications list page", async () => {
    const app = createApp();
    const response = await request(app).get("/applications");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
    );
  });

  it("marks the applications nav link as current on an applications detail page", async () => {
    const app = createApp();
    const response = await request(app).get("/applications/DOES-NOT-EXIST");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
    );
  });

  it("marks the apply nav link as current on the apply journey, and no others", async () => {
    const app = createApp();
    const response = await request(app).get("/apply/details");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing-benefit/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/choose-service" aria-current="page">',
    );
  });

  it("marks the apply-housing nav link as current on the housing journey, and no others", async () => {
    const app = createApp();
    const response = await request(app).get("/apply-housing/details");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing-benefit/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/choose-service" aria-current="page">',
    );
  });

  it("marks the apply-housing-benefit nav link as current on the housing benefit journey, and no others", async () => {
    const app = createApp();
    const response = await request(app).get("/apply-housing-benefit/details");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing-benefit/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/choose-service" aria-current="page">',
    );
  });

  it("marks the choose-service nav link as current on the choose-service page, and no others", async () => {
    const app = createApp();
    const response = await request(app).get("/choose-service");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/choose-service" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing/details" aria-current="page">',
    );
    expect(response.text).not.toContain(
      '<a class="govuk-service-navigation__link" href="/apply-housing-benefit/details" aria-current="page">',
    );
  });

  it("homepage lists and links to all four application flows", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.text).toContain('href="/apply/details"');
    expect(response.text).toContain(">Apply<");

    expect(response.text).toContain('href="/apply-housing/details"');
    expect(response.text).toContain("Apply for housing");

    expect(response.text).toContain('href="/apply-housing-benefit/details"');
    expect(response.text).toContain("Apply for Housing Benefit (disability)");

    expect(response.text).toContain('href="/choose-service"');
    expect(response.text).toContain("Not sure which service you need?");
  });
});
