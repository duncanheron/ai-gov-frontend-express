const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");

const getServer = useSharedServer();

// Scoped to the <title> tag so it can't be satisfied by the service-name bar,
// which renders the same text elsewhere on every page.
function getTitle(html) {
  return html.match(/<title>(.*?)<\/title>/s)[1];
}

describe("header navigation", () => {
  describe("pages with navigation", () => {
    it("homepage shows the service name linking to the homepage, and no external gov.uk logo link", async () => {
      const response = await request(getServer()).get("/");

      expect(response.text).toContain('<a href="/" class="govuk-service-navigation__link">');
      expect(response.text).not.toContain("//gov.uk");
    });

    it("homepage shows the default service name and exactly the two navigation items", async () => {
      const response = await request(getServer()).get("/");

      expect(response.text).toContain("Apply and pay for council services");
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/applications">',
      );
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/choose-service">',
      );
      expect(response.text).toContain("Not sure which service you need?");
    });

    it("choose-service page shows the default service name and exactly the two navigation items", async () => {
      const response = await request(getServer()).get("/choose-service");

      expect(response.text).toContain("Apply and pay for council services");
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/applications">',
      );
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/choose-service" aria-current="page">',
      );
    });

    it("applications list page shows the default service name and the navigation, with Applications current", async () => {
      const response = await request(getServer()).get("/applications");

      expect(response.text).toContain("Apply and pay for council services");
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
      );
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/choose-service">',
      );
    });

    it("an applications detail page shows the default service name and the navigation, with Applications current", async () => {
      const response = await request(getServer()).get("/applications/DOES-NOT-EXIST");

      expect(response.text).toContain("Apply and pay for council services");
      expect(response.text).toContain(
        '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
      );
    });

    it("shows exactly two navigation items on the homepage - no more, no fewer", async () => {
      const response = await request(getServer()).get("/");
      const itemCount = response.text.split('class="govuk-service-navigation__item').length - 1;

      expect(itemCount).toBe(2);
    });

    it("shows the mobile menu toggle on a page that has navigation", async () => {
      const response = await request(getServer()).get("/");

      expect(response.text).toContain("govuk-js-service-navigation-toggle");
    });

    it("does not mark the applications nav link as current on the homepage or choose-service page", async () => {
      const home = await request(getServer()).get("/");
      expect(home.text).not.toContain(
        '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
      );

      const chooseService = await request(getServer()).get("/choose-service");
      expect(chooseService.text).not.toContain(
        '<a class="govuk-service-navigation__link" href="/applications" aria-current="page">',
      );
    });
  });

  describe("journey pages have no navigation", () => {
    it.each([
      ["/apply/details", "Submit a general application"],
      ["/apply-housing/details", "Apply for housing"],
      ["/apply-housing-benefit/details", "Apply for Housing Benefit (disability)"],
      ["/pay-council-tax/details", "Pay council tax"],
      ["/pay-garden-waste/details", "Pay for garden waste"],
    ])(
      "%s shows its own service name and no service-navigation list",
      async (path, serviceName) => {
        const response = await request(getServer()).get(path);

        expect(getTitle(response.text)).toContain(serviceName);
        expect(response.text).not.toContain("govuk-service-navigation__list");
        expect(response.text).not.toContain("govuk-js-service-navigation-toggle");
      },
    );

    // The ordering bug: "/apply" is a text-prefix of "/apply-housing", so a
    // naive match run in the wrong order would resolve this page to the
    // general application journey instead - wrong, but plausible.
    it("/apply-housing/details shows Apply for housing, never Submit a general application", async () => {
      const response = await request(getServer()).get("/apply-housing/details");

      expect(response.text).toContain("Apply for housing");
      expect(response.text).not.toContain("Submit a general application");
    });
  });

  describe("page titles follow the GOV.UK 'Page name - Service name - GOV.UK' convention", () => {
    it.each([
      ["/apply/details", "Submit a general application"],
      ["/apply-housing/details", "Apply for housing"],
      ["/apply-housing-benefit/details", "Apply for Housing Benefit (disability)"],
      ["/pay-council-tax/details", "Pay council tax"],
      ["/pay-garden-waste/details", "Pay for garden waste"],
    ])(
      "%s's title ends with its own service name, not just the page name",
      async (path, serviceName) => {
        const response = await request(getServer()).get(path);

        expect(getTitle(response.text)).toBe(`Your details - ${serviceName} - GOV.UK`);
      },
    );

    it("homepage title is page-specific and does not contain the service name twice", async () => {
      const response = await request(getServer()).get("/");
      const title = getTitle(response.text);

      expect(title).toContain("Apply and pay for council services");
      expect(title.split("Apply and pay for council services").length - 1).toBe(1);
    });

    it("/applications title includes the default service name", async () => {
      const response = await request(getServer()).get("/applications");

      expect(getTitle(response.text)).toContain("Apply and pay for council services");
    });

    it("an error state keeps the Error: prefix and still includes the service name", async () => {
      const agent = request.agent(getServer());

      const detailsPage = await agent.get("/apply-housing/details");
      const token = extractCsrfToken(detailsPage.text);

      const response = await agent.post("/apply-housing/details").type("form").send({
        _csrf: token,
        fullName: "",
        email: "not-an-email",
        "dateOfBirth-day": "31",
        "dateOfBirth-month": "2",
        "dateOfBirth-year": "2020",
      });

      expect(response.status).toBe(400);
      expect(getTitle(response.text)).toBe("Error: Your details - Apply for housing - GOV.UK");
    });
  });

  describe("homepage links to every journey and the picker", () => {
    it("lists and links to all five journeys plus the picker", async () => {
      const response = await request(getServer()).get("/");

      expect(response.text).toContain('href="/apply/details"');
      expect(response.text).toContain(">Submit a general application<");

      expect(response.text).toContain('href="/apply-housing/details"');
      expect(response.text).toContain("Apply for housing");

      expect(response.text).toContain('href="/apply-housing-benefit/details"');
      expect(response.text).toContain("Apply for Housing Benefit (disability)");

      expect(response.text).toContain('href="/pay-council-tax/details"');
      expect(response.text).toContain("Pay council tax");

      expect(response.text).toContain('href="/pay-garden-waste/details"');
      expect(response.text).toContain("Pay for garden waste");

      expect(response.text).toContain('href="/choose-service"');
      expect(response.text).toContain("Not sure which service you need?");
    });
  });
});
