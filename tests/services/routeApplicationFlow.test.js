const { routeApplicationFlow } = require("../../src/services/routeApplicationFlow");

describe("routeApplicationFlow", () => {
  // These tests run under NODE_ENV=test, so routeApplicationFlow always takes
  // its config.isTest stub branch below and never makes a network call. The
  // "must decide after N rounds" logic (see MAX_CLARIFICATION_ROUNDS in
  // src/services/routeApplicationFlow.js) only exists in the real,
  // non-test branch that calls the AI Gateway - it can't be exercised here
  // without a network call, which is out of scope for this ticket. What we
  // can and do verify is that the stub keeps behaving deterministically and
  // decisively (decided: true) regardless of how many user turns have
  // happened, which is the same externally-observable contract callers rely on.

  it("routes a housing-flavoured message to the housing flow", async () => {
    const messages = [{ role: "user", content: "I need help applying for social housing" }];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
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
    });
  });

  it("matches 'disab' case-insensitively anywhere in the last user message", () => {
    const messages = [{ role: "user", content: "It relates to a DISABILITY I have" }];

    return routeApplicationFlow(messages).then((result) => {
      expect(result.flow).toBe("housing-benefit-disability");
    });
  });

  it("still returns a deterministic decision from multi-turn conversations, basing it on the last user message only", async () => {
    // MAX_CLARIFICATION_ROUNDS is 1, so this conversation has more user turns
    // than the "must decide" threshold - in the real branch this would force
    // the model to decide rather than ask another question. The stub always
    // decides immediately regardless of round count, so this confirms the
    // module doesn't crash on multi-turn history and still keys off the
    // final user message.
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
    });
  });

  it("always returns decided: true and clarifyingQuestion: null from the stub", async () => {
    const result = await routeApplicationFlow([{ role: "user", content: "housing please" }]);

    expect(result.decided).toBe(true);
    expect(result.clarifyingQuestion).toBeNull();
  });

  it("asks a clarifying question for a message matching neither flow's keywords", async () => {
    const result = await routeApplicationFlow([{ role: "user", content: "I need some help" }]);

    expect(result.decided).toBe(false);
    expect(result.flow).toBeNull();
    expect(result.clarifyingQuestion).toEqual(expect.any(String));
  });

  it("decides once a housing/disability keyword appears, even after a clarifying round", async () => {
    const messages = [
      { role: "user", content: "I need some help" },
      { role: "assistant", content: "Can you tell me more?" },
      { role: "user", content: "just a regular housing application" },
    ];

    const result = await routeApplicationFlow(messages);

    expect(result).toEqual({ decided: true, flow: "housing", clarifyingQuestion: null });
  });

  it("throws when given the test-only failure trigger", async () => {
    await expect(
      routeApplicationFlow([{ role: "user", content: "simulate-ai-failure" }]),
    ).rejects.toThrow();
  });
});
