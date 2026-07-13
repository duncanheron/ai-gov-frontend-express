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

  it("does not mark the applications nav link as current on the homepage or apply journey", async () => {
    const app = createApp();

    const home = await request(app).get("/");
    expect(home.text).not.toContain('aria-current="page"');

    const details = await request(app).get("/apply/details");
    expect(details.text).not.toContain('aria-current="page"');
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
});
