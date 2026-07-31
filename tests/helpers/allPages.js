const request = require("supertest");
const { extractCsrfToken } = require("./extractCsrfToken");
const { queueTestResponses } = require("../../src/services/routeApplicationFlow");

// Shared person details for every journey below - only the fields a given
// step needs are read, so re-using one object keeps each helper short.
const PERSON = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  "dateOfBirth-day": "27",
  "dateOfBirth-month": "3",
  "dateOfBirth-year": "1985",
};

// GETs `path` (to pick up a fresh CSRF token) then posts `fields` to it.
async function postForm(agent, path, fields) {
  const page = await agent.get(path);
  const token = extractCsrfToken(page.text);
  return agent
    .post(path)
    .type("form")
    .send({ _csrf: token, ...fields });
}

function extractReference(text) {
  const match = text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);
  return match ? match[1] : null;
}

// -- Apply (general application) journey --

function submitApplyDetails(agent, overrides = {}) {
  return postForm(agent, "/apply/details", { ...PERSON, ...overrides });
}

async function reachApplyPreferences(agent, detailsOverrides) {
  await submitApplyDetails(agent, detailsOverrides);
  return agent.get("/apply/preferences");
}

async function reachApplyCheckAnswers(agent, { detailsOverrides, preferences } = {}) {
  await reachApplyPreferences(agent, detailsOverrides);
  await postForm(agent, "/apply/preferences", preferences ? { preferences } : {});
  return agent.get("/apply/check-answers");
}

async function reachApplyConfirmation(agent, opts) {
  await reachApplyCheckAnswers(agent, opts);
  await postForm(agent, "/apply/check-answers", {});
  return agent.get("/apply/confirmation");
}

// -- Apply for housing journey --

function submitHousingDetails(agent, overrides = {}) {
  return postForm(agent, "/apply-housing/details", { ...PERSON, ...overrides });
}

async function reachHousingSituation(agent) {
  await submitHousingDetails(agent);
  return agent.get("/apply-housing/situation");
}

async function reachHousingCheckAnswers(agent, { situation = "renting-privately" } = {}) {
  await reachHousingSituation(agent);
  await postForm(agent, "/apply-housing/situation", { situation });
  return agent.get("/apply-housing/check-answers");
}

async function reachHousingConfirmation(agent) {
  await reachHousingCheckAnswers(agent);
  await postForm(agent, "/apply-housing/check-answers", {});
  return agent.get("/apply-housing/confirmation");
}

// -- Apply for Housing Benefit (disability) journey --

function submitHousingBenefitDetails(agent, overrides = {}) {
  return postForm(agent, "/apply-housing-benefit/details", { ...PERSON, ...overrides });
}

async function reachHousingBenefitDisabilityDetails(agent) {
  await submitHousingBenefitDetails(agent);
  return agent.get("/apply-housing-benefit/disability-details");
}

async function reachHousingBenefitCheckAnswers(
  agent,
  { disabilityDetails = "I use a wheelchair and need step-free access." } = {},
) {
  await reachHousingBenefitDisabilityDetails(agent);
  await postForm(agent, "/apply-housing-benefit/disability-details", { disabilityDetails });
  return agent.get("/apply-housing-benefit/check-answers");
}

async function reachHousingBenefitConfirmation(agent) {
  await reachHousingBenefitCheckAnswers(agent);
  await postForm(agent, "/apply-housing-benefit/check-answers", {});
  return agent.get("/apply-housing-benefit/confirmation");
}

// -- Pay council tax journey --

function submitCouncilTaxDetails(agent) {
  return postForm(agent, "/pay-council-tax/details", PERSON);
}

async function reachCouncilTaxAccount(agent) {
  await submitCouncilTaxDetails(agent);
  return agent.get("/pay-council-tax/account");
}

async function reachCouncilTaxCheckAnswers(agent, { accountNumber = "12345678" } = {}) {
  await reachCouncilTaxAccount(agent);
  await postForm(agent, "/pay-council-tax/account", { accountNumber });
  return agent.get("/pay-council-tax/check-answers");
}

async function reachCouncilTaxConfirmation(agent) {
  await reachCouncilTaxCheckAnswers(agent);
  await postForm(agent, "/pay-council-tax/check-answers", {});
  return agent.get("/pay-council-tax/confirmation");
}

// -- Pay for garden waste journey --

function submitGardenWasteDetails(agent) {
  return postForm(agent, "/pay-garden-waste/details", PERSON);
}

async function reachGardenWasteSubscription(agent) {
  await submitGardenWasteDetails(agent);
  return agent.get("/pay-garden-waste/subscription");
}

async function reachGardenWasteCheckAnswers(agent, { bins = "2" } = {}) {
  await reachGardenWasteSubscription(agent);
  await postForm(agent, "/pay-garden-waste/subscription", { bins });
  return agent.get("/pay-garden-waste/check-answers");
}

async function reachGardenWasteConfirmation(agent) {
  await reachGardenWasteCheckAnswers(agent);
  await postForm(agent, "/pay-garden-waste/check-answers", {});
  return agent.get("/pay-garden-waste/confirmation");
}

// -- Choose service (AI picker) journey --

async function reachChooseServiceClarify(agent) {
  queueTestResponses({
    decided: false,
    flow: null,
    clarifyingQuestion: "Does anyone in your household have a registered disability?",
    noServiceMessage: null,
  });
  await postForm(agent, "/choose-service", { description: "I need some help" });
  return agent.get("/choose-service");
}

async function reachChooseServiceResult(agent) {
  queueTestResponses({
    decided: true,
    flow: "housing",
    clarifyingQuestion: null,
    noServiceMessage: null,
  });
  await postForm(agent, "/choose-service", { description: "I want to apply for housing" });
  return agent.get("/choose-service");
}

/**
 * The canonical list of every page this service serves, including the
 * session-gated ones reached only partway through a journey. Both the
 * accessibility suite and the structural-invariants suite iterate this same
 * list, so a new page gets both kinds of check with no test edit - see
 * CBLT-114.
 *
 * Each entry's `get()` builds its own fresh agent/session and returns the
 * supertest response for that page. Calling `get()` more than once repeats
 * the underlying journey; that is deliberate so pages can be reused safely
 * across independent test files/cases.
 *
 * `expectedStatus` defaults to 200 and only needs setting for the handful of
 * pages that are deliberately not 200 by design (the 404 pages, and the
 * "with validation errors" re-renders, which this app returns as 400).
 */
function buildAllPages(getServer) {
  const freshAgent = () => request.agent(getServer());

  return [
    { name: "homepage", get: () => request(getServer()).get("/") },
    {
      name: "applications list page (empty)",
      get: () => request(getServer()).get("/applications"),
    },
    { name: "details page (empty)", get: () => request(getServer()).get("/apply/details") },
    {
      name: "details page with validation errors",
      expectedStatus: 400,
      get: () => postForm(freshAgent(), "/apply/details", { favouriteAnimal: "a".repeat(101) }),
    },
    {
      name: "preferences page (empty)",
      get: () => reachApplyPreferences(freshAgent()),
    },
    {
      name: "check answers page (apply)",
      get: () => reachApplyCheckAnswers(freshAgent(), { preferences: ["food", "ai"] }),
    },
    {
      name: "confirmation page (apply)",
      get: () => reachApplyConfirmation(freshAgent(), { preferences: ["food", "ai"] }),
    },
    {
      name: "404 page",
      expectedStatus: 404,
      get: () => request(getServer()).get("/not-a-real-page"),
    },
    {
      name: "applications list page (with rows)",
      get: async () => {
        const agent = freshAgent();
        await reachApplyConfirmation(agent);
        return agent.get("/applications");
      },
    },
    {
      name: "application detail page",
      get: async () => {
        const agent = freshAgent();
        const confirmation = await reachApplyConfirmation(agent, {
          detailsOverrides: { favouriteAnimal: "Otter" },
        });
        return agent.get(`/applications/${extractReference(confirmation.text)}`);
      },
    },
    {
      name: "application detail page 404",
      expectedStatus: 404,
      get: () => request(getServer()).get("/applications/DOES-NOT-EXIST"),
    },
    {
      name: "housing details page (empty)",
      get: () => request(getServer()).get("/apply-housing/details"),
    },
    {
      name: "housing details page with validation errors",
      expectedStatus: 400,
      get: () => postForm(freshAgent(), "/apply-housing/details", {}),
    },
    { name: "housing situation page (empty)", get: () => reachHousingSituation(freshAgent()) },
    {
      name: "housing situation page with validation errors",
      expectedStatus: 400,
      get: async () => {
        const agent = freshAgent();
        await reachHousingSituation(agent);
        return postForm(agent, "/apply-housing/situation", {});
      },
    },
    { name: "housing check answers page", get: () => reachHousingCheckAnswers(freshAgent()) },
    { name: "housing confirmation page", get: () => reachHousingConfirmation(freshAgent()) },
    {
      name: "housing benefit details page (empty)",
      get: () => request(getServer()).get("/apply-housing-benefit/details"),
    },
    {
      name: "housing benefit details page with validation errors",
      expectedStatus: 400,
      get: () => postForm(freshAgent(), "/apply-housing-benefit/details", {}),
    },
    {
      name: "housing benefit disability details page (empty)",
      get: () => reachHousingBenefitDisabilityDetails(freshAgent()),
    },
    {
      name: "housing benefit disability details page with validation errors",
      expectedStatus: 400,
      get: async () => {
        const agent = freshAgent();
        await reachHousingBenefitDisabilityDetails(agent);
        return postForm(agent, "/apply-housing-benefit/disability-details", {
          disabilityDetails: "",
        });
      },
    },
    {
      name: "housing benefit check answers page",
      get: () => reachHousingBenefitCheckAnswers(freshAgent()),
    },
    {
      name: "housing benefit confirmation page",
      get: () => reachHousingBenefitConfirmation(freshAgent()),
    },
    { name: "choose service ask page", get: () => request(getServer()).get("/choose-service") },
    {
      name: "choose service clarifying question page",
      get: () => reachChooseServiceClarify(freshAgent()),
    },
    { name: "choose service result page", get: () => reachChooseServiceResult(freshAgent()) },
    {
      name: "council tax details page (empty)",
      get: () => request(getServer()).get("/pay-council-tax/details"),
    },
    { name: "council tax account page (empty)", get: () => reachCouncilTaxAccount(freshAgent()) },
    {
      name: "council tax account page with a validation error",
      expectedStatus: 400,
      get: async () => {
        const agent = freshAgent();
        await reachCouncilTaxAccount(agent);
        return postForm(agent, "/pay-council-tax/account", { accountNumber: "" });
      },
    },
    {
      name: "council tax check answers page",
      get: () => reachCouncilTaxCheckAnswers(freshAgent()),
    },
    { name: "council tax confirmation page", get: () => reachCouncilTaxConfirmation(freshAgent()) },
    {
      name: "garden waste details page (empty)",
      get: () => request(getServer()).get("/pay-garden-waste/details"),
    },
    {
      name: "garden waste subscription page (empty)",
      get: () => reachGardenWasteSubscription(freshAgent()),
    },
    {
      name: "garden waste subscription page with a validation error",
      expectedStatus: 400,
      get: async () => {
        const agent = freshAgent();
        await reachGardenWasteSubscription(agent);
        return postForm(agent, "/pay-garden-waste/subscription", { bins: "" });
      },
    },
    {
      name: "garden waste check answers page",
      get: () => reachGardenWasteCheckAnswers(freshAgent()),
    },
    {
      name: "garden waste confirmation page",
      get: () => reachGardenWasteConfirmation(freshAgent()),
    },
    {
      name: "council tax application detail page (flow answer)",
      get: async () => {
        const agent = freshAgent();
        const confirmation = await reachCouncilTaxConfirmation(agent);
        return request(getServer()).get(`/applications/${extractReference(confirmation.text)}`);
      },
    },
    {
      name: "garden waste application detail page (flow answer)",
      get: async () => {
        const agent = freshAgent();
        const confirmation = await reachGardenWasteConfirmation(agent);
        return request(getServer()).get(`/applications/${extractReference(confirmation.text)}`);
      },
    },
  ];
}

module.exports = {
  buildAllPages,
  extractReference,
  reachCouncilTaxConfirmation,
  reachGardenWasteConfirmation,
};
