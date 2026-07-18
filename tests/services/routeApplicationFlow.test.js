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

  it("routes a disability-flavoured message to the housing-benefit-disability flow immediately", async () => {
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

  it("still decides immediately from multi-turn conversations when the last message mentions disability", async () => {
    // A disability keyword match on the final user message always decides
    // immediately, regardless of how many rounds have already happened -
    // this confirms the module doesn't crash on multi-turn history and still
    // keys off the final user message rather than the whole conversation.
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

  it("asks about disability before deciding for a bare housing-flavoured message", async () => {
    // "I am homeless" (or similar) says nothing about disability either way,
    // so it isn't enough on its own to safely pick between the two flows -
    // this is the regression this ticket fixes.
    const result = await routeApplicationFlow([{ role: "user", content: "I am homeless" }]);

    expect(result.decided).toBe(false);
    expect(result.flow).toBeNull();
    expect(result.clarifyingQuestion).toEqual(expect.any(String));
    expect(result.clarifyingQuestion.toLowerCase()).toContain("disab");
    expect(result.noServiceMessage).toBeNull();
  });

  it("decides housing once disability has been denied after the initial housing-flavoured message", async () => {
    const roundOne = await routeApplicationFlow([
      { role: "user", content: "I need help applying for social housing" },
    ]);
    expect(roundOne.decided).toBe(false);

    const roundTwo = await routeApplicationFlow([
      { role: "user", content: "I need help applying for social housing" },
      { role: "assistant", content: roundOne.clarifyingQuestion },
      { role: "user", content: "No, nobody in my household has a disability" },
    ]);

    expect(roundTwo).toEqual({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("decides housing-benefit-disability once a later housing-flavoured message follows an earlier disability affirmation", async () => {
    // The disability question doesn't have to come from the app's own
    // canned clarifying question - if the user mentions it unprompted in an
    // earlier round, that's enough for a later housing-flavoured message to
    // decide immediately, correctly still routing to the disability flow
    // since that's what the earlier round established.
    const messages = [
      { role: "user", content: "I have a disability" },
      { role: "assistant", content: "Can you tell me more?" },
      { role: "user", content: "just a regular housing application" },
    ];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    });
  });

  it("asks a clarifying question for a message matching neither flow's keywords", async () => {
    const result = await routeApplicationFlow([{ role: "user", content: "I need some help" }]);

    expect(result.decided).toBe(false);
    expect(result.flow).toBeNull();
    expect(result.clarifyingQuestion).toEqual(expect.any(String));
    expect(result.noServiceMessage).toBeNull();
  });

  it("keeps asking across multiple ambiguous rounds, then asks about disability once a housing signal appears", async () => {
    // MAX_CLARIFICATION_ROUNDS is 5, so a second ambiguous round should still
    // ask rather than being forced to decide - proving the raised cap
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
    // A housing signal with no disability addressed yet asks about
    // disability, rather than deciding - it doesn't just decide "housing"
    // the moment a keyword appears.
    expect(roundThree.decided).toBe(false);
    expect(roundThree.clarifyingQuestion.toLowerCase()).toContain("disab");

    const roundFour = await routeApplicationFlow([
      { role: "user", content: "I need some help" },
      { role: "assistant", content: roundOne.clarifyingQuestion },
      { role: "user", content: "I'm still not sure" },
      { role: "assistant", content: roundTwo.clarifyingQuestion },
      { role: "user", content: "just a regular housing application" },
      { role: "assistant", content: roundThree.clarifyingQuestion },
      { role: "user", content: "no disability involved" },
    ]);
    expect(roundFour).toEqual({
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
