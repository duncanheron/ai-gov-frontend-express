const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

const getServer = useSharedServer();

beforeAll(() => prepareTestDatabase());

const VALID_PERSON = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  "dateOfBirth-day": "27",
  "dateOfBirth-month": "3",
  "dateOfBirth-year": "1985",
};

async function submitDetails(agent, journeyPath) {
  const detailsPage = await agent.get(`${journeyPath}/details`);
  const token = extractCsrfToken(detailsPage.text);
  return agent
    .post(`${journeyPath}/details`)
    .type("form")
    .send({ _csrf: token, ...VALID_PERSON });
}

// Each getPage() drives the session to the target page via valid form
// submissions, the same way accessibility.test.js does - these routes only
// render once their prerequisite session state exists.
const PAGES = [
  { path: "/apply/details", getPage: (agent) => agent.get("/apply/details") },
  {
    path: "/apply/preferences",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply");
      return agent.get("/apply/preferences");
    },
  },
  {
    path: "/apply/check-answers",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply");
      const preferencesPage = await agent.get("/apply/preferences");
      const token = extractCsrfToken(preferencesPage.text);
      await agent
        .post("/apply/preferences")
        .type("form")
        .send({ _csrf: token, preferences: ["food"] });
      return agent.get("/apply/check-answers");
    },
  },
  { path: "/apply-housing/details", getPage: (agent) => agent.get("/apply-housing/details") },
  {
    path: "/apply-housing/situation",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply-housing");
      return agent.get("/apply-housing/situation");
    },
  },
  {
    path: "/apply-housing/check-answers",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply-housing");
      const situationPage = await agent.get("/apply-housing/situation");
      const token = extractCsrfToken(situationPage.text);
      await agent
        .post("/apply-housing/situation")
        .type("form")
        .send({ _csrf: token, situation: "renting-privately" });
      return agent.get("/apply-housing/check-answers");
    },
  },
  {
    path: "/apply-housing-benefit/details",
    getPage: (agent) => agent.get("/apply-housing-benefit/details"),
  },
  {
    path: "/apply-housing-benefit/disability-details",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply-housing-benefit");
      return agent.get("/apply-housing-benefit/disability-details");
    },
  },
  {
    path: "/apply-housing-benefit/check-answers",
    getPage: async (agent) => {
      await submitDetails(agent, "/apply-housing-benefit");
      const disabilityDetailsPage = await agent.get("/apply-housing-benefit/disability-details");
      const token = extractCsrfToken(disabilityDetailsPage.text);
      await agent
        .post("/apply-housing-benefit/disability-details")
        .type("form")
        .send({ _csrf: token, disabilityDetails: "Uses a wheelchair." });
      return agent.get("/apply-housing-benefit/check-answers");
    },
  },
  { path: "/pay-council-tax/details", getPage: (agent) => agent.get("/pay-council-tax/details") },
  {
    path: "/pay-council-tax/account",
    getPage: async (agent) => {
      await submitDetails(agent, "/pay-council-tax");
      return agent.get("/pay-council-tax/account");
    },
  },
  {
    path: "/pay-council-tax/check-answers",
    getPage: async (agent) => {
      await submitDetails(agent, "/pay-council-tax");
      const accountPage = await agent.get("/pay-council-tax/account");
      const token = extractCsrfToken(accountPage.text);
      await agent
        .post("/pay-council-tax/account")
        .type("form")
        .send({ _csrf: token, accountNumber: "12345678" });
      return agent.get("/pay-council-tax/check-answers");
    },
  },
  { path: "/pay-garden-waste/details", getPage: (agent) => agent.get("/pay-garden-waste/details") },
  {
    path: "/pay-garden-waste/subscription",
    getPage: async (agent) => {
      await submitDetails(agent, "/pay-garden-waste");
      return agent.get("/pay-garden-waste/subscription");
    },
  },
  {
    path: "/pay-garden-waste/check-answers",
    getPage: async (agent) => {
      await submitDetails(agent, "/pay-garden-waste");
      const subscriptionPage = await agent.get("/pay-garden-waste/subscription");
      const token = extractCsrfToken(subscriptionPage.text);
      await agent
        .post("/pay-garden-waste/subscription")
        .type("form")
        .send({ _csrf: token, bins: "2" });
      return agent.get("/pay-garden-waste/check-answers");
    },
  },
];

// Matches the rendered back-link anchor (govuk-frontend's back-link template
// emits `href` before `class`) and captures its href and visible text, so a
// page missing the component entirely has nothing to match - unlike
// `toContain("govuk-back-link")` on the whole page, which would still pass if
// some *other* page's fixture text leaked in, or if only the CSS class (and
// not a real anchor) were present.
const BACK_LINK_PATTERN = /<a href="([^"]*)" class="govuk-back-link[^"]*"[^>]*>([^<]*)<\/a>/;

describe("back links", () => {
  describe.each(PAGES)("$path", ({ getPage }) => {
    it("renders a back link reading 'Back' or 'Choose a different service' - not just any occurrence of the class", async () => {
      const agent = request.agent(getServer());
      const response = await getPage(agent);

      const match = response.text.match(BACK_LINK_PATTERN);

      expect(match).not.toBeNull();
      expect(["Back", "Choose a different service"]).toContain(match[2]);
    });

    it('places the back link before <main id="main-content">, so the skip link can bypass it', async () => {
      const agent = request.agent(getServer());
      const response = await getPage(agent);

      const backLinkIndex = response.text.search(BACK_LINK_PATTERN);
      const mainIndex = response.text.indexOf('id="main-content"');

      expect(backLinkIndex).toBeGreaterThan(-1);
      expect(mainIndex).toBeGreaterThan(-1);
      expect(backLinkIndex).toBeLessThan(mainIndex);
    });
  });

  describe("the five journey entry points", () => {
    it.each([
      "/apply/details",
      "/apply-housing/details",
      "/apply-housing-benefit/details",
      "/pay-council-tax/details",
      "/pay-garden-waste/details",
    ])("%s reads 'Choose a different service' and points at the homepage", async (path) => {
      const response = await request(getServer()).get(path);
      const match = response.text.match(BACK_LINK_PATTERN);

      expect(match).not.toBeNull();
      expect(match[1]).toBe("/");
      expect(match[2]).toBe("Choose a different service");
    });
  });

  describe("the ten later journey steps keep their existing hrefs", () => {
    it.each([
      ["/apply/preferences", "/apply/details"],
      ["/apply/check-answers", "/apply/preferences"],
      ["/apply-housing/situation", "/apply-housing/details"],
      ["/apply-housing/check-answers", "/apply-housing/situation"],
      ["/apply-housing-benefit/disability-details", "/apply-housing-benefit/details"],
      ["/apply-housing-benefit/check-answers", "/apply-housing-benefit/disability-details"],
      ["/pay-council-tax/account", "/pay-council-tax/details"],
      ["/pay-council-tax/check-answers", "/pay-council-tax/account"],
      ["/pay-garden-waste/subscription", "/pay-garden-waste/details"],
      ["/pay-garden-waste/check-answers", "/pay-garden-waste/subscription"],
    ])("%s reads 'Back' and points to %s", async (path, expectedHref) => {
      const page = PAGES.find((candidate) => candidate.path === path);
      const agent = request.agent(getServer());
      const response = await page.getPage(agent);
      const match = response.text.match(BACK_LINK_PATTERN);

      expect(match).not.toBeNull();
      expect(match[2]).toBe("Back");
      expect(match[1]).toBe(expectedHref);
    });
  });
});
