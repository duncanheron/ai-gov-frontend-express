const { routeApplicationFlow } = require("../../src/services/routeApplicationFlow");

describe("routeApplicationFlow", () => {
  // These tests run under NODE_ENV=test, so routeApplicationFlow always takes
  // its config.isTest stub branch below and never makes a network call. The
  // stub is a deterministic double for the surrounding app code (routes,
  // sessions, views) to exercise against in CI - it is not a re-implementation
  // of the real branch's actual reasoning. The real branch's system prompt
  // (see src/services/routeApplicationFlow.js) is what does the nuanced,
  // non-scripted work of asking sensible follow-up questions; that can only
  // be verified by talking to the real model (see this ticket's manual
  // smoke-test acceptance criterion), not by this stub.

  it("routes a housing-flavoured message to the housing flow", async () => {
    const messages = [{ role: "user", content: "I need help applying for social housing" }];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("routes a disability/housing-benefit-flavoured message to the housing-benefit-disability flow", async () => {
    const messages = [
      { role: "user", content: "I want to claim housing benefit due to my disability" },
    ];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("matches 'disab' case-insensitively anywhere in the last user message", () => {
    const messages = [{ role: "user", content: "It relates to a DISABILITY I have" }];

    return routeApplicationFlow(messages).then((result) => {
      expect(result.flow).toBe("housing-benefit-disability");
    });
  });

  it("still returns a deterministic decision from multi-turn conversations, basing it on the last user message only", async () => {
    // A keyword match on the final user message always decides immediately,
    // regardless of how many rounds have already happened - this confirms
    // the module doesn't crash on multi-turn history and still keys off the
    // final user message rather than the whole conversation.
    const messages = [
      { role: "user", content: "I need somewhere to live" },
      { role: "assistant", content: "Can you tell me more about your situation?" },
      { role: "user", content: "I have a disability and need support with housing" },
    ];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("always returns decided: true and clarifyingQuestion: null from a keyword-matched stub response", async () => {
    const result = await routeApplicationFlow([{ role: "user", content: "housing please" }]);

    expect(result.decided).toBe(true);
    expect(result.clarifyingQuestion).toBeNull();
  });

  it("asks a clarifying question for a message matching neither flow's keywords", async () => {
    const result = await routeApplicationFlow([{ role: "user", content: "I need some help" }]);

    expect(result.decided).toBe(false);
    expect(result.flow).toBeNull();
    expect(result.clarifyingQuestion).toEqual(expect.any(String));
    expect(result.noServiceMessage).toBeNull();
  });

  it("decides once a housing/disability keyword appears, even after a clarifying round", async () => {
    const messages = [
      { role: "user", content: "I need some help" },
      { role: "assistant", content: "Can you tell me more?" },
      { role: "user", content: "just a regular housing application" },
    ];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("keeps asking across multiple ambiguous rounds before a keyword match decides", async () => {
    // MAX_CLARIFICATION_ROUNDS is now 5, so a second ambiguous round should
    // still ask rather than being forced to decide - proving the raised cap
    // actually allows more than one round of back-and-forth.
    const roundOne = await routeApplicationFlow([{ role: "user", content: "I need some help" }]);
    expect(roundOne.decided).toBe(false);

    const roundTwo = await routeApplicationFlow([
      { role: "user", content: "I need some help" },
      { role: "assistant", content: roundOne.clarifyingQuestion },
      { role: "user", content: "I'm still not sure" },
    ]);
    expect(roundTwo.decided).toBe(false);
    expect(roundTwo.clarifyingQuestion).toEqual(expect.any(String));

    const roundThree = await routeApplicationFlow([
      { role: "user", content: "I need some help" },
      { role: "assistant", content: roundOne.clarifyingQuestion },
      { role: "user", content: "I'm still not sure" },
      { role: "assistant", content: roundTwo.clarifyingQuestion },
      { role: "user", content: "just a regular housing application" },
    ]);
    expect(roundThree).toEqual({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("forces a decision once the round cap is exceeded, even without a keyword match", async () => {
    const messages = [{ role: "user", content: "I need some help" }];
    for (let round = 0; round < 6; round += 1) {
      messages.push({ role: "assistant", content: "Can you tell me more?" });
      messages.push({ role: "user", content: "still not sure" });
    }

    const result = await routeApplicationFlow(messages);

    expect(result.decided).toBe(true);
    expect(result.flow).toBe("housing");
    expect(result.noServiceMessage).toBeNull();
  });

  it("returns a no-service outcome for a request clearly outside both flows", async () => {
    const result = await routeApplicationFlow([
      { role: "user", content: "I want to apply for a parking permit" },
    ]);

    expect(result.decided).toBe(true);
    expect(result.flow).toBeNull();
    expect(result.clarifyingQuestion).toBeNull();
    expect(result.noServiceMessage).toEqual(expect.any(String));
  });

  it("throws when given the test-only failure trigger", async () => {
    await expect(
      routeApplicationFlow([{ role: "user", content: "simulate-ai-failure" }]),
    ).rejects.toThrow();
  });
});
