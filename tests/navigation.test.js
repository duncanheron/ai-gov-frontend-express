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

  it("applications list page also shows the applications nav link", async () => {
    const app = createApp();
    const response = await request(app).get("/applications");

    expect(response.text).toContain(
      '<a class="govuk-service-navigation__link" href="/applications">',
    );
  });
});
