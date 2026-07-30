const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const { queueTestResponses, resetTestResponses } = require("../src/services/routeApplicationFlow");

// These tests drive /choose-service against routeApplicationFlow's scripted
// test double: each test queues exactly the response(s) it wants the router
// to return, rather than relying on message content to derive a decision.
// What's under test here is the route/session/view behaviour built on top of
// routeApplicationFlow's output - the multi-round clarification journey, the
// decided outcome, the no-service outcome, and the failure path - not the
// real system prompt's reasoning (see tests/services/routeApplicationFlow.test.js
// and this ticket's PR description for how that was proven separately).

describe("choose service (AI picker)", () => {
  afterEach(() => {
    resetTestResponses();
  });

  it("shows the initial free-text question", async () => {
    const app = createApp();
    const response = await request(app).get("/choose-service");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Not sure which service you need");
  });

  it("shows the clarifying question when the router hasn't decided yet", async () => {
    const app = createApp();
    const agent = request.agent(app);

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
    const app = createApp();
    const agent = request.agent(app);

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
    const app = createApp();
    const agent = request.agent(app);

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

    const app = createApp();
    const agent = request.agent(app);

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
    const app = createApp();
    const agent = request.agent(app);

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
    const app = createApp();
    const agent = request.agent(app);

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
    const app = createApp();
    const agent = request.agent(app);

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

  it("honestly renders a no-service outcome, with a way forward", async () => {
    const app = createApp();
    const agent = request.agent(app);

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
});
