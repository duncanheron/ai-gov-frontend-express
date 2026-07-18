const { z } = require("zod");
const config = require("../config");

// Single source of truth for what each flow actually covers - fed into the
// AI's system prompt below (so it has real criteria instead of guessing from
// the bare enum identifiers) and reused by chooseService.js for the "result"
// screen's copy, so the AI prompt and the UI never drift apart.
const FLOW_DEFINITIONS = {
  housing: {
    label: "Housing",
    summary:
      "For general housing applications - for example applying for social housing, or needing " +
      "help because you're homeless or at risk of homelessness. No disability information needed.",
  },
  "housing-benefit-disability": {
    label: "Housing Benefit (disability)",
    summary:
      "For people applying for housing benefit specifically because of a disability - for " +
      "example if you or someone in your household has a registered disability that affects " +
      "your housing needs.",
  },
};

const ROUTING_SCHEMA = z.object({
  decided: z.boolean(),
  flow: z.enum(["housing", "housing-benefit-disability"]).nullable(),
  clarifyingQuestion: z.string().nullable(),
  noServiceMessage: z.string().nullable(),
});

// Once a conversation has had more user turns than this, the model is told it
// must conclude now rather than ask another clarifying question. This is a
// safety-net backstop, not the target experience - the system prompt below is
// what should make the model conclude as soon as it's actually confident.
// Relax this further later for fully open-ended multi-turn chat.
const MAX_CLARIFICATION_ROUNDS = 5;

function buildSystemPrompt(mustDecide) {
  const instruction = mustDecide
    ? "You must conclude now: decide the closer-matching flow if there's any reasonable match, " +
      "or say no service is available if truly neither fits. Do not ask another question."
    : "Decide the flow if you're confident it matches one of the services below. If you're not " +
      "sure, ask exactly one clarifying question. If the user's need clearly doesn't match " +
      "either service, say so honestly rather than forcing a guess.";

  return `${instruction}

Available services:
- "housing": ${FLOW_DEFINITIONS.housing.summary}
- "housing-benefit-disability": ${FLOW_DEFINITIONS["housing-benefit-disability"].summary}`;
}

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
      return {
        decided: true,
        flow: "housing-benefit-disability",
        clarifyingQuestion: null,
        noServiceMessage: null,
      };
    }
    if (/hous|home|rent/i.test(lastUserMessage)) {
      return { decided: true, flow: "housing", clarifyingQuestion: null, noServiceMessage: null };
    }

    // Clearly outside anything on offer: say so honestly instead of forcing a
    // guess into one of the two real flows.
    if (/parking|passport|driving licen[cs]e/i.test(lastUserMessage)) {
      return {
        decided: true,
        flow: null,
        clarifyingQuestion: null,
        noServiceMessage:
          "We don't currently offer an online service for that. We can help with general " +
          "housing applications, or housing benefit if you or your household has a registered " +
          "disability.",
      };
    }

    // Genuinely ambiguous (matches neither flow's keywords, and isn't clearly
    // out of scope either): keep asking, up to the round cap, then force a
    // decision - mirroring the real branch's MAX_CLARIFICATION_ROUNDS/
    // mustDecide behaviour.
    if (userTurns <= MAX_CLARIFICATION_ROUNDS) {
      return {
        decided: false,
        flow: null,
        clarifyingQuestion:
          "Are you applying because of a disability, or is this a general housing application?",
        noServiceMessage: null,
      };
    }

    return { decided: true, flow: "housing", clarifyingQuestion: null, noServiceMessage: null };
  }

  const userTurns = messages.filter((message) => message.role === "user").length;
  const mustDecide = userTurns > MAX_CLARIFICATION_ROUNDS;

  // Imported lazily: "ai" ships ESM-only with no CommonJS build, which Jest's
  // default transform can't parse. Importing it here (rather than at module
  // load time) means this line is only ever reached outside config.isTest,
  // so the test suite never has to load it. A dynamic import (rather than
  // require) is required for this to actually work in Vercel's Function
  // runtime, which doesn't support require()-ing an ESM-only package even
  // though a plain local Node process does.
  const { generateText, Output } = await import("ai");

  const { output } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    output: Output.object({ schema: ROUTING_SCHEMA }),
    system: buildSystemPrompt(mustDecide),
    messages,
  });

  return output;
}

module.exports = { routeApplicationFlow, FLOW_DEFINITIONS };
