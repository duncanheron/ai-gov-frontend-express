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
      "help because you're homeless or at risk of homelessness. This is the right service when " +
      "a disability isn't affecting your housing needs.",
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

// Counts user turns and reports whether the round cap requires the model to
// conclude now rather than ask another clarifying question. Pulled out into
// its own function (rather than inlined where it's used below) purely so
// tests can exercise the round-counting mechanics directly - the config.isTest
// stub below returns scripted responses and never calls this itself, so
// MAX_CLARIFICATION_ROUNDS behaviour would otherwise be untestable under CI.
function shouldForceDecision(messages) {
  const userTurns = messages.filter((message) => message.role === "user").length;
  return userTurns > MAX_CLARIFICATION_ROUNDS;
}

function buildSystemPrompt(mustDecide) {
  const instruction = mustDecide
    ? "You must conclude now: decide the closer-matching flow if there's any reasonable match, " +
      "or say no service is available if truly neither fits. Do not ask another question."
    : "Decide the flow if you're confident it matches one of the services below. If you're not " +
      "sure, ask exactly one clarifying question. If the user's need clearly doesn't match " +
      "either service, say so honestly rather than forcing a guess.";

  const disabilityGuidance =
    "Whether the applicant or anyone in their household has a registered disability affecting " +
    "their housing needs is the key thing that distinguishes these two services - do not assume " +
    "either way just because a message otherwise sounds clearly housing-related (for example, " +
    "being homeless or needing to rent says nothing about disability either way). Unless " +
    "disability status has already been addressed earlier in the conversation, ask about it " +
    'before deciding, even when everything else about the situation points at "housing".';

  return `${instruction}

${disabilityGuidance}

Available services:
- "housing": ${FLOW_DEFINITIONS.housing.summary}
- "housing-benefit-disability": ${FLOW_DEFINITIONS["housing-benefit-disability"].summary}`;
}

// Test-only scripted response queue -----------------------------------------
//
// Tests script routeApplicationFlow's return value directly, rather than this
// module re-deriving a decision from message content. A hand-rolled keyword
// stub is a different brain to the real system prompt: CBLT-88 fixed a real
// production bug (the model deciding "housing" too readily without checking
// disability status) that the old regex stub didn't share, so the full Jest
// suite stayed green while production was wrong. Scripting the response
// instead means a test's intent lives in the test file, not re-implemented
// here.
//
// Push one scripted response per expected call, in order (FIFO) - multiple
// pushes let a test script a multi-round conversation (e.g. clarify, then
// decide). Push an Error instance to make that call throw instead of
// returning - this is also how choose-service's AI-failure tests are
// covered now, replacing the old "simulate-ai-failure" magic string.
let testResponseQueue = [];

function queueTestResponses(...responses) {
  testResponseQueue.push(...responses);
}

function resetTestResponses() {
  testResponseQueue = [];
}

// All AI-provider-specific code (model string, generateText, Output.object)
// must live only in this file - nothing else in the codebase should import
// from "ai" or know about providers. This keeps a future provider swap (e.g.
// to Azure OpenAI via @ai-sdk/azure) a one-file change.
async function routeApplicationFlow(messages) {
  if (config.isTest) {
    if (testResponseQueue.length === 0) {
      throw new Error(
        "routeApplicationFlow stub called with no scripted response queued - call " +
          "queueTestResponses({ decided, flow, clarifyingQuestion, noServiceMessage }) " +
          "(or an Error, to make this call throw) before exercising code that calls " +
          "routeApplicationFlow.",
      );
    }

    const next = testResponseQueue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }

  const mustDecide = shouldForceDecision(messages);

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

module.exports = {
  routeApplicationFlow,
  FLOW_DEFINITIONS,
  queueTestResponses,
  resetTestResponses,
  buildSystemPrompt,
  shouldForceDecision,
  MAX_CLARIFICATION_ROUNDS,
};
