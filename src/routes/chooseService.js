const express = require("express");

const { routeApplicationFlow } = require("../services/routeApplicationFlow");

const router = express.Router();

const FLOW_DETAILS = {
  housing: { label: "Housing", href: "/apply-housing/details" },
  "housing-benefit-disability": {
    label: "Housing Benefit (disability)",
    href: "/apply-housing-benefit/details",
  },
};

function chooseServiceViewModel(state) {
  if (!state) {
    return { view: "ask" };
  }

  if (state.decided) {
    return { view: "result", ...FLOW_DETAILS[state.flow] };
  }

  const lastAssistantMessage = [...state.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (lastAssistantMessage) {
    return { view: "clarify", question: lastAssistantMessage.content };
  }

  return { view: "ask" };
}

router.get("/", (req, res) => {
  res.render("choose-service.njk", chooseServiceViewModel(req.session.chooseService));
});

router.post("/", async (req, res) => {
  const description = (req.body.description || "").trim();
  const existingState = req.session.chooseService;
  const previousMessages = existingState && !existingState.decided ? existingState.messages : [];
  const messages = [...previousMessages, { role: "user", content: description }];

  let result;
  try {
    result = await routeApplicationFlow(messages);
  } catch (err) {
    req.log.error({ err }, "routeApplicationFlow failed");
    return res.status(503).render("choose-service.njk", { view: "error" });
  }

  if (result.decided) {
    req.session.chooseService = { messages, decided: true, flow: result.flow };
  } else {
    req.session.chooseService = {
      messages: [...messages, { role: "assistant", content: result.clarifyingQuestion }],
      decided: false,
    };
  }

  res.redirect("/choose-service");
});

module.exports = router;
