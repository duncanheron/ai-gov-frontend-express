const express = require("express");

const { routeApplicationFlow, FLOW_DEFINITIONS } = require("../services/routeApplicationFlow");

const router = express.Router();

const FLOW_HREFS = {
  housing: "/apply-housing/details",
  "housing-benefit-disability": "/apply-housing-benefit/details",
};

function chooseServiceViewModel(state) {
  if (!state) {
    return { view: "ask" };
  }

  if (state.decided && state.flow) {
    return { view: "result", ...FLOW_DEFINITIONS[state.flow], href: FLOW_HREFS[state.flow] };
  }

  if (state.decided) {
    return { view: "unavailable", noServiceMessage: state.noServiceMessage };
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

router.get("/start-again", (req, res) => {
  delete req.session.chooseService;
  res.redirect("/choose-service");
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

  if (result.decided && result.flow) {
    req.session.chooseService = { messages, decided: true, flow: result.flow };
  } else if (result.decided) {
    req.session.chooseService = {
      messages,
      decided: true,
      flow: null,
      noServiceMessage: result.noServiceMessage,
    };
  } else {
    req.session.chooseService = {
      messages: [...messages, { role: "assistant", content: result.clarifyingQuestion }],
      decided: false,
    };
  }

  res.redirect("/choose-service");
});

module.exports = router;
