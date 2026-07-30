const express = require("express");

const { validateDetails } = require("../validation/applyValidation");

const router = express.Router();

function detailsViewModel(overrides = {}) {
  const answers = overrides.values || {};
  return {
    values: answers,
    errors: overrides.errors || [],
    fieldErrors: overrides.fieldErrors || {},
    dateErrorParts: overrides.dateErrorParts || {},
  };
}

router.get("/details", (req, res) => {
  const savedAnswers = req.session.gardenWastePayment && req.session.gardenWastePayment.answers;
  res.render("pay-garden-waste/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("pay-garden-waste/details.njk", detailsViewModel(result));
  }

  const existingAnswers =
    (req.session.gardenWastePayment && req.session.gardenWastePayment.answers) || {};
  req.session.gardenWastePayment = { answers: { ...existingAnswers, ...result.values } };
  return res.redirect("/pay-garden-waste/subscription");
});

module.exports = router;
