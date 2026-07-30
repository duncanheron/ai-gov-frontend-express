const express = require("express");

const { validateDetails } = require("../validation/applyValidation");
const { BINS_OPTIONS, validateBins, binsLabel } = require("../validation/gardenWasteValidation");
const { formatPence, GARDEN_WASTE_PENCE_PER_BIN_PER_YEAR } = require("../lib/money");
const { generateReference } = require("../utils/reference");
const {
  requireGardenWasteDetails,
  requireGardenWasteSubscription,
  requireGardenWasteSubmission,
} = require("../middleware/gardenWasteJourneyGuard");
const applications = require("../db/applications");

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

function binsRadioItems(selected) {
  return BINS_OPTIONS.map((option) => ({
    value: option.value,
    text: option.text,
    checked: option.value === selected,
  }));
}

function annualFeeFor(bins) {
  return Number.parseInt(bins, 10) * GARDEN_WASTE_PENCE_PER_BIN_PER_YEAR;
}

function flowAnswerFor(bins) {
  return `Garden waste - ${binsLabel(bins)}, ${formatPence(annualFeeFor(bins))} per year`;
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

router.get("/subscription", requireGardenWasteDetails, (req, res) => {
  const { bins } = req.session.gardenWastePayment.answers;
  res.render("pay-garden-waste/subscription.njk", {
    items: binsRadioItems(bins),
    errors: [],
    fieldErrors: {},
  });
});

router.post("/subscription", requireGardenWasteDetails, (req, res) => {
  const result = validateBins(req.body);

  if (!result.isValid) {
    return res.status(400).render("pay-garden-waste/subscription.njk", {
      items: binsRadioItems(result.values.bins),
      errors: result.errors,
      fieldErrors: result.fieldErrors,
    });
  }

  req.session.gardenWastePayment.answers = {
    ...req.session.gardenWastePayment.answers,
    bins: result.values.bins,
  };
  return res.redirect("/pay-garden-waste/check-answers");
});

router.get(
  "/check-answers",
  requireGardenWasteDetails,
  requireGardenWasteSubscription,
  (req, res) => {
    const { answers } = req.session.gardenWastePayment;
    const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

    res.render("pay-garden-waste/check-answers.njk", {
      answers,
      dobFormatted,
      binsLabel: binsLabel(answers.bins),
      amountToPay: formatPence(annualFeeFor(answers.bins)),
    });
  },
);

router.post(
  "/check-answers",
  requireGardenWasteDetails,
  requireGardenWasteSubscription,
  async (req, res) => {
    const { answers } = req.session.gardenWastePayment;
    const reference = generateReference();
    const submittedAt = new Date();

    await applications.create({
      fullName: answers.fullName,
      email: answers.email,
      dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
      reference,
      submittedAt,
      flow: "garden-waste",
      flowAnswer: flowAnswerFor(answers.bins),
    });

    req.session.gardenWastePayment = {
      reference,
      submittedAt: submittedAt.toISOString(),
    };
    res.redirect("/pay-garden-waste/confirmation");
  },
);

router.get("/confirmation", requireGardenWasteSubmission, (req, res) => {
  res.render("pay-garden-waste/confirmation.njk", {
    reference: req.session.gardenWastePayment.reference,
  });
});

module.exports = router;
