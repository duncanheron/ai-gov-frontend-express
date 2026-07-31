const request = require("supertest");
const { JSDOM } = require("jsdom");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const {
  queueTestResponses,
  resetTestResponses,
  FLOW_DEFINITIONS,
} = require("../src/services/routeApplicationFlow");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

// Each test queues the router's response, so what's under test is the
// route/session/view behaviour, not the real prompt's reasoning.

describe("choose service (AI picker)", () => {
  afterEach(() => {
    resetTestResponses();
  });

  it("shows the initial free-text question", async () => {
    const response = await request(getServer()).get("/choose-service");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Not sure which service you need");
  });

  it("shows the clarifying question when the router hasn't decided yet", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: false,
      flow: null,
      clarifyingQuestion: "Does anyone in your household have a registered disability?",
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    const submit = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });
    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/choose-service");

    const clarifyPage = await agent.get("/choose-service");
    expect(clarifyPage.status).toBe(200);
    expect(clarifyPage.text).not.toContain("We recommend");
    expect(clarifyPage.text).toContain(
      "Does anyone in your household have a registered disability?",
    );
  });

  it("renders the decided outcome with a working link, once the router decides", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: false,
      flow: null,
      clarifyingQuestion: "Does anyone in your household have a registered disability?",
      noServiceMessage: null,
    });
    queueTestResponses({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });

    const clarifyPage = await agent.get("/choose-service");
    const clarifyToken = extractCsrfToken(clarifyPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: clarifyToken, description: "No, nobody in my household has a disability" });

    const result = await agent.get("/choose-service");
    expect(result.status).toBe(200);
    expect(result.text).toContain("We recommend: Housing");
    expect(result.text).toContain('href="/apply-housing/details"');
    expect(result.text).toContain("For general housing applications");
  });

  it("renders the Housing Benefit (disability) decided outcome with a working link", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need housing benefit because of my disability" });

    const result = await agent.get("/choose-service");
    expect(result.status).toBe(200);
    expect(result.text).toContain("Housing Benefit (disability)");
    expect(result.text).toContain('href="/apply-housing-benefit/details"');
  });

  it("carries a multi-round clarification journey through several rounds before deciding", async () => {
    queueTestResponses(
      {
        decided: false,
        flow: null,
        clarifyingQuestion: "Are you applying because of a disability, or in general?",
        noServiceMessage: null,
      },
      {
        decided: false,
        flow: null,
        clarifyingQuestion: "Does anyone in your household have a registered disability?",
        noServiceMessage: null,
      },
      {
        decided: true,
        flow: "housing",
        clarifyingQuestion: null,
        noServiceMessage: null,
      },
    );

    const agent = request.agent(getServer());

    const askPage = await agent.get("/choose-service");
    const token1 = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token1, description: "I need some help" });

    const clarifyPage = await agent.get("/choose-service");
    expect(clarifyPage.status).toBe(200);
    expect(clarifyPage.text).toContain("Are you applying because of a disability, or in general?");
    const token2 = extractCsrfToken(clarifyPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token2, description: "just a regular housing application" });

    const disabilityCheckPage = await agent.get("/choose-service");
    expect(disabilityCheckPage.status).toBe(200);
    expect(disabilityCheckPage.text).toContain(
      "Does anyone in your household have a registered disability?",
    );
    const token3 = extractCsrfToken(disabilityCheckPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token3, description: "No, nobody has a disability" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("We recommend: Housing");
    expect(result.text).toContain('href="/apply-housing/details"');
  });

  it("shows a plain error message and no crash when the router throws, with a way forward", async () => {
    const agent = request.agent(getServer());

    queueTestResponses(new Error("Simulated AI Gateway failure (test-only trigger)"));

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    const submit = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "anything" });

    expect(submit.status).toBe(503);
    expect(submit.text).toContain("Sorry, there is a problem");
    expect(submit.text).toContain('href="/choose-service/start-again"');
    expect(submit.text).toContain('href="/"');
  });

  it("lets you start again after reaching a decision, and reach an independent new recommendation", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent.post("/choose-service").type("form").send({
      _csrf: token,
      description: "I want general housing, no disability involved",
    });

    const firstResult = await agent.get("/choose-service");
    expect(firstResult.text).toContain("We recommend: Housing");
    expect(firstResult.text).toContain('href="/choose-service/start-again"');

    const startAgain = await agent.get("/choose-service/start-again");
    expect(startAgain.status).toBe(302);
    expect(startAgain.headers.location).toBe("/choose-service");

    const freshAskPage = await agent.get("/choose-service");
    expect(freshAskPage.status).toBe(200);
    expect(freshAskPage.text).toContain("Not sure which service you need");
    const freshToken = extractCsrfToken(freshAskPage.text);

    queueTestResponses({
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: freshToken, description: "I need housing benefit because of my disability" });

    const secondResult = await agent.get("/choose-service");
    expect(secondResult.text).toContain("Housing Benefit (disability)");
    expect(secondResult.text).toContain('href="/apply-housing-benefit/details"');
  });

  it("recovers via start-again from a router failure that happened after an earlier decision", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);
    await agent.post("/choose-service").type("form").send({
      _csrf: token,
      description: "I want general housing, no disability involved",
    });

    const decided = await agent.get("/choose-service");
    expect(decided.text).toContain("We recommend: Housing");

    queueTestResponses(new Error("Simulated AI Gateway failure (test-only trigger)"));

    // The "result" view has no form of its own (just a "Continue" button and
    // links), so there's no fresh CSRF token to scrape from it - reuse the
    // token from the initial ask page, which stays valid for the session.
    const failedRetry = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "anything" });
    expect(failedRetry.status).toBe(503);
    expect(failedRetry.text).toContain('href="/choose-service/start-again"');

    const startAgain = await agent.get("/choose-service/start-again");
    expect(startAgain.status).toBe(302);

    const freshAskPage = await agent.get("/choose-service");
    expect(freshAskPage.text).toContain("Not sure which service you need");
    expect(freshAskPage.text).not.toContain("We recommend");
  });

  it("decides `council-tax` for a council tax bill message, without clarification", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "council-tax",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need to pay my council tax bill" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("We recommend: Council Tax");
    expect(result.text).not.toContain("registered disability");
  });

  it("decides `garden-waste` for a green bin collection message, without clarification", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "garden-waste",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need to pay for my green bin collection" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("We recommend: Garden Waste");
  });

  it("asks a clarifying question for an ambiguous 'pay the council' message before deciding between the payment services", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: false,
      flow: null,
      clarifyingQuestion: "Is this for your council tax bill, or a garden waste subscription?",
      noServiceMessage: null,
    });
    queueTestResponses({
      decided: true,
      flow: "garden-waste",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to pay the council" });

    const clarifyPage = await agent.get("/choose-service");
    expect(clarifyPage.text).toContain(
      "Is this for your council tax bill, or a garden waste subscription?",
    );
    const clarifyToken = extractCsrfToken(clarifyPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: clarifyToken, description: "Garden waste" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("We recommend: Garden Waste");
  });

  it("still gates a housing decision on disability status once payment services are also available", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: false,
      flow: null,
      clarifyingQuestion: "Does anyone in your household have a registered disability?",
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for housing" });

    const clarifyPage = await agent.get("/choose-service");
    expect(clarifyPage.text).toContain(
      "Does anyone in your household have a registered disability?",
    );
    expect(clarifyPage.text).not.toContain("We recommend");
  });

  it("never asks about disability for a payment message", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "council-tax",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to pay my council tax" });

    const result = await agent.get("/choose-service");
    expect(result.text).not.toContain("registered disability");
    expect(result.text).toContain("We recommend: Council Tax");
  });

  it("honestly renders a no-service outcome naming all four services, with a way forward", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: null,
      clarifyingQuestion: null,
      noServiceMessage:
        "We don't currently offer an online service for that. We can help with general housing " +
        "applications, housing benefit if you or your household has a registered disability, " +
        "paying your council tax, or paying for a garden waste subscription.",
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for a parking permit" });

    const result = await agent.get("/choose-service");
    expect(result.text).toContain("general housing applications");
    expect(result.text).toContain("housing benefit");
    expect(result.text).toContain("council tax");
    expect(result.text).toContain("garden waste");
  });

  it("honestly renders a no-service outcome, with a way forward", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: null,
      clarifyingQuestion: null,
      noServiceMessage:
        "We don't currently offer an online service for that. We can help with general " +
        "housing applications, or housing benefit if you or your household has a registered " +
        "disability.",
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    const submit = await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I want to apply for a parking permit" });
    expect(submit.status).toBe(302);
    expect(submit.headers.location).toBe("/choose-service");

    const result = await agent.get("/choose-service");
    expect(result.status).toBe(200);
    expect(result.text).toContain("We don't currently offer an online service for that");
    expect(result.text).toContain("We can help with general housing applications");
    expect(result.text).toContain('href="/choose-service/start-again"');
    expect(result.text).toContain('href="/"');
    expect(result.text).not.toContain("We recommend");
  });

  // Parameterised straight from FLOW_DEFINITIONS itself, rather than a fixed
  // list of flow ids, so a fifth flow added without an href fails here with no
  // test edit needed.
  describe.each(Object.keys(FLOW_DEFINITIONS))('the decided "%s" flow\'s result screen', (flow) => {
    it("renders a real, followable continue link rather than an inert control", async () => {
      const agent = request.agent(getServer());

      queueTestResponses({
        decided: true,
        flow,
        clarifyingQuestion: null,
        noServiceMessage: null,
      });

      const askPage = await agent.get("/choose-service");
      const token = extractCsrfToken(askPage.text);

      const submit = await agent
        .post("/choose-service")
        .type("form")
        .send({ _csrf: token, description: "anything" });
      expect(submit.status).toBe(302);

      const result = await agent.get("/choose-service");
      expect(result.status).toBe(200);

      const dom = new JSDOM(result.text);
      const continueLink = dom.window.document.querySelector("a.govuk-button");
      const continueButton = dom.window.document.querySelector("button.govuk-button");

      expect(continueLink).not.toBeNull();
      expect(continueLink.tagName).toBe("A");
      const href = continueLink.getAttribute("href");
      expect(typeof href).toBe("string");
      expect(href.length).toBeGreaterThan(0);
      expect(href.startsWith("/")).toBe(true);
      expect(continueLink.textContent.trim()).toBe(`Continue to ${FLOW_DEFINITIONS[flow].label}`);
      expect(continueButton).toBeNull();

      // The "can actually proceed" assertion: the start URL must be the
      // journey's own first step, not merely a URL that isn't a 404 - a
      // journey guard would redirect (302) if session state were required
      // and missing.
      const destination = await agent.get(href);
      expect(destination.status).toBe(200);
    });
  });

  it("fails loudly rather than rendering an inert control, when a decided flow has no start href", async () => {
    const agent = request.agent(getServer());

    queueTestResponses({
      decided: true,
      flow: "council-tax",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });

    const askPage = await agent.get("/choose-service");
    const token = extractCsrfToken(askPage.text);

    await agent
      .post("/choose-service")
      .type("form")
      .send({ _csrf: token, description: "I need to pay my council tax bill" });

    const originalHref = FLOW_DEFINITIONS["council-tax"].href;
    delete FLOW_DEFINITIONS["council-tax"].href;
    try {
      const result = await agent.get("/choose-service");
      expect(result.status).toBe(500);
    } finally {
      FLOW_DEFINITIONS["council-tax"].href = originalHref;
    }
  });
});
