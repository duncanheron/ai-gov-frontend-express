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
    href: "/apply-housing/details",
  },
  "housing-benefit-disability": {
    label: "Housing Benefit (disability)",
    summary:
      "For people applying for housing benefit specifically because of a disability - for " +
      "example if you or someone in your household has a registered disability that affects " +
      "your housing needs.",
    href: "/apply-housing-benefit/details",
  },
  "council-tax": {
    label: "Council Tax",
    summary:
      "For paying council tax - the compulsory annual property tax every household owes the " +
      "council, regardless of which services they use.",
    href: "/pay-council-tax/details",
  },
  "garden-waste": {
    label: "Garden Waste",
    summary:
      "For paying the garden waste subscription - an optional paid service for collecting " +
      "garden and green waste from an extra bin, renewed each year.",
    href: "/pay-garden-waste/details",
  },
};

const ROUTING_SCHEMA = z.object({
  decided: z.boolean(),
  flow: z.enum(Object.keys(FLOW_DEFINITIONS)).nullable(),
  clarifyingQuestion: z.string().nullable(),
  noServiceMessage: z.string().nullable(),
});

// Once a conversation has had more user turns than this, the model is told it
// must conclude now rather than ask another clarifying question. This is a
// safety-net backstop, not the target experience - the system prompt below is
// what should make the model conclude as soon as it's actually confident.
// Relax this further later for fully open-ended multi-turn chat.
const MAX_CLARIFICATION_ROUNDS = 5;

// Exported so tests can exercise the round cap directly; the test stub returns
// scripted responses and never reaches this.
function shouldForceDecision(messages) {
  const userTurns = messages.filter((message) => message.role === "user").length;
  return userTurns > MAX_CLARIFICATION_ROUNDS;
}

function buildSystemPrompt(mustDecide) {
  const instruction = mustDecide
    ? "You must conclude now: decide the closer-matching flow if there's any reasonable match, " +
      "or say no service is available if truly none fits. Do not ask another question."
    : "Decide the flow if you're confident it matches one of the services below. If you're not " +
      "sure, ask exactly one clarifying question. If the user's need clearly doesn't match any " +
      "service, say so honestly rather than forcing a guess.";

  const disabilityGuidance =
    "For housing enquiries, whether the applicant or anyone in their household has a " +
    "registered disability affecting their housing needs is the key thing that distinguishes " +
    '"housing" from "housing-benefit-disability" - do not assume either way just because a ' +
    "message sounds housing-related. Unless disability status has already been addressed " +
    "earlier in the conversation, ask about it before deciding, even when everything else " +
    'points at "housing". This does not apply to council tax or garden waste - a payment ' +
    "query is never about disability status.";

  const paymentGuidance =
    "Council tax and garden waste are both ways of paying the council, but are different " +
    "services: council tax is the compulsory annual property tax bill, while garden waste is " +
    "an optional paid subscription for garden/green bin collection. Where a message only says " +
    "the user wants to pay the council, without saying which, ask which service they mean " +
    "rather than guessing.";

  const noServiceGuidance =
    "If none of the services below fit, name all of them in your reply so the user knows " +
    "what's actually on offer, rather than just saying no.";

  const serviceList = Object.entries(FLOW_DEFINITIONS)
    .map(([id, { summary }]) => `- "${id}": ${summary}`)
    .join("\n");

  return `${instruction}

${disabilityGuidance}

${paymentGuidance}

${noServiceGuidance}

Available services:
${serviceList}`;
}

// Test-only: one scripted response per expected call, FIFO, so a test can
// script a multi-round conversation. Push an Error instance to make that call
// throw. Tests script the response rather than this module re-deriving a
// decision, so their intent lives in the test file.
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
  ROUTING_SCHEMA,
  queueTestResponses,
  resetTestResponses,
  buildSystemPrompt,
  shouldForceDecision,
  MAX_CLARIFICATION_ROUNDS,
};
