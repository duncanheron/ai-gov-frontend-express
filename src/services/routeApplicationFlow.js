const { z } = require("zod");
const config = require("../config");

const ROUTING_SCHEMA = z.object({
  decided: z.boolean(),
  flow: z.enum(["housing", "housing-benefit-disability"]).nullable(),
  clarifyingQuestion: z.string().nullable(),
});

// Once a conversation has had more user turns than this, the model is told it
// must decide now rather than ask another clarifying question. Relax this
// later for open-ended multi-turn chat.
const MAX_CLARIFICATION_ROUNDS = 1;

// All AI-provider-specific code (model string, generateText, Output.object)
// must live only in this file - nothing else in the codebase should import
// from "ai" or know about providers. This keeps a future provider swap (e.g.
// to Azure OpenAI via @ai-sdk/azure) a one-file change.
async function routeApplicationFlow(messages) {
  if (config.isTest) {
    const lastUserMessage = messages[messages.length - 1].content;
    const userTurns = messages.filter((message) => message.role === "user").length;

    // Test-only trigger for simulating an AI Gateway failure (e.g. from the
    // choose-service route's error-handling tests) - not a real phrase a user
    // would type.
    if (/^simulate-ai-failure$/i.test(lastUserMessage.trim())) {
      throw new Error("Simulated AI Gateway failure (test-only trigger)");
    }

    if (/disab/i.test(lastUserMessage)) {
      return { decided: true, flow: "housing-benefit-disability", clarifyingQuestion: null };
    }
    if (/hous|home|rent/i.test(lastUserMessage)) {
      return { decided: true, flow: "housing", clarifyingQuestion: null };
    }

    // Genuinely ambiguous (matches neither flow's keywords): ask a clarifying
    // question once, mirroring the real branch's MAX_CLARIFICATION_ROUNDS
    // behaviour, then force a decision.
    if (userTurns <= MAX_CLARIFICATION_ROUNDS) {
      return {
        decided: false,
        flow: null,
        clarifyingQuestion:
          "Are you applying because of a disability, or is this a general housing application?",
      };
    }

    return { decided: true, flow: "housing", clarifyingQuestion: null };
  }

  const userTurns = messages.filter((message) => message.role === "user").length;
  const mustDecide = userTurns > MAX_CLARIFICATION_ROUNDS;

  // Required lazily: "ai" ships ESM-only with no CommonJS build, which Jest's
  // default transform can't parse. Requiring it here (rather than at module
  // load time) means this line is only ever reached outside config.isTest,
  // so the test suite never has to load it.
  const { generateText, Output } = require("ai");

  const { output } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    output: Output.object({ schema: ROUTING_SCHEMA }),
    system: mustDecide
      ? "You must decide now. Pick whichever flow more closely matches, even if uncertain."
      : "Decide the flow if you're confident. Otherwise ask exactly one clarifying question.",
    messages,
  });

  return output;
}

module.exports = { routeApplicationFlow };
