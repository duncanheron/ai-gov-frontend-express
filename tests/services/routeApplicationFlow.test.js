const {
  routeApplicationFlow,
  queueTestResponses,
  resetTestResponses,
  buildSystemPrompt,
  shouldForceDecision,
  MAX_CLARIFICATION_ROUNDS,
} = require("../../src/services/routeApplicationFlow");

describe("routeApplicationFlow", () => {
  // Under NODE_ENV=test the router always takes its stub branch and never makes
  // a network call. The real prompt's reasoning can only be checked against the
  // real model.

  afterEach(() => {
    resetTestResponses();
  });

  it("returns exactly the response that was queued", async () => {
    const response = {
      decided: true,
      flow: "housing",
      clarifyingQuestion: null,
      noServiceMessage: null,
    };
    queueTestResponses(response);

    const result = await routeApplicationFlow([{ role: "user", content: "anything" }]);

    expect(result).toEqual(response);
  });

  it("consumes multiple queued responses in order, one per call - a scripted multi-round conversation", async () => {
    const clarify = {
      decided: false,
      flow: null,
      clarifyingQuestion: "Can you tell me more?",
      noServiceMessage: null,
    };
    const decide = {
      decided: true,
      flow: "housing-benefit-disability",
      clarifyingQuestion: null,
      noServiceMessage: null,
    };
    queueTestResponses(clarify, decide);

    const roundOne = await routeApplicationFlow([{ role: "user", content: "first message" }]);
    expect(roundOne).toEqual(clarify);

    const roundTwo = await routeApplicationFlow([
      { role: "user", content: "first message" },
      { role: "assistant", content: clarify.clarifyingQuestion },
      { role: "user", content: "second message" },
    ]);
    expect(roundTwo).toEqual(decide);
  });

  it("throws the queued error instead of returning, when an Error is queued", async () => {
    queueTestResponses(new Error("Simulated AI Gateway failure"));

    await expect(routeApplicationFlow([{ role: "user", content: "anything" }])).rejects.toThrow(
      "Simulated AI Gateway failure",
    );
  });

  it("throws a clear error when called with nothing queued, rather than silently guessing", async () => {
    await expect(routeApplicationFlow([{ role: "user", content: "anything" }])).rejects.toThrow(
      /no scripted response queued/,
    );
  });

  describe("shouldForceDecision", () => {
    it("is false when user turns are within the round cap", () => {
      const messages = Array.from({ length: MAX_CLARIFICATION_ROUNDS }, () => ({
        role: "user",
        content: "still not sure",
      }));

      expect(shouldForceDecision(messages)).toBe(false);
    });

    it("is true once user turns exceed the round cap", () => {
      const messages = Array.from({ length: MAX_CLARIFICATION_ROUNDS + 1 }, () => ({
        role: "user",
        content: "still not sure",
      }));

      expect(shouldForceDecision(messages)).toBe(true);
    });

    it("only counts user-role messages, ignoring assistant turns", () => {
      const messages = [
        { role: "user", content: "one" },
        { role: "assistant", content: "reply" },
        { role: "user", content: "two" },
        { role: "assistant", content: "reply" },
      ];

      expect(shouldForceDecision(messages)).toBe(false);
    });
  });

  describe("buildSystemPrompt", () => {
    it("instructs the model it may still ask a clarifying question when not forced to decide", () => {
      const prompt = buildSystemPrompt(false);

      expect(prompt).toContain("ask exactly one clarifying question");
      expect(prompt).not.toContain("must conclude now");
    });

    it("instructs the model to conclude now, without asking another question, once forced to decide", () => {
      const prompt = buildSystemPrompt(true);

      expect(prompt).toContain("must conclude now");
      expect(prompt).toContain("Do not ask another question");
    });
  });
});
