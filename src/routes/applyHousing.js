const express = require("express");

const { validateDetails } = require("../validation/applyValidation");
const {
  SITUATION_OPTIONS,
  validateSituation,
  situationLabel,
} = require("../validation/housingValidation");
const { generateReference } = require("../utils/reference");
const {
  requireHousingDetails,
  requireHousingSituation,
  requireHousingSubmission,
} = require("../middleware/housingJourneyGuard");
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

function situationRadioItems(selected) {
  return SITUATION_OPTIONS.map((option) => ({
    value: option.value,
    text: option.text,
    checked: option.value === selected,
  }));
}

router.get("/details", (req, res) => {
  const savedAnswers = req.session.housingApplication && req.session.housingApplication.answers;
  res.render("apply-housing/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("apply-housing/details.njk", detailsViewModel(result));
  }

  const existingAnswers =
    (req.session.housingApplication && req.session.housingApplication.answers) || {};
  req.session.housingApplication = { answers: { ...existingAnswers, ...result.values } };
  return res.redirect("/apply-housing/situation");
});

router.get("/situation", requireHousingDetails, (req, res) => {
  const { situation } = req.session.housingApplication.answers;
  res.render("apply-housing/situation.njk", {
    items: situationRadioItems(situation),
    errors: [],
    fieldErrors: {},
  });
});

router.post("/situation", requireHousingDetails, (req, res) => {
  const result = validateSituation(req.body);

  if (!result.isValid) {
    return res.status(400).render("apply-housing/situation.njk", {
      items: situationRadioItems(result.values.situation),
      errors: result.errors,
      fieldErrors: result.fieldErrors,
    });
  }

  req.session.housingApplication.answers = {
    ...req.session.housingApplication.answers,
    situation: result.values.situation,
  };
  return res.redirect("/apply-housing/check-answers");
});

router.get("/check-answers", requireHousingDetails, requireHousingSituation, (req, res) => {
  const { answers } = req.session.housingApplication;
  const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

  res.render("apply-housing/check-answers.njk", {
    answers,
    dobFormatted,
    situationLabel: situationLabel(answers.situation),
  });
});

router.post("/check-answers", requireHousingDetails, requireHousingSituation, async (req, res) => {
  const { answers } = req.session.housingApplication;
  const reference = generateReference();
  const submittedAt = new Date();

  await applications.create({
    fullName: answers.fullName,
    email: answers.email,
    dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
    reference,
    submittedAt,
    flow: "housing",
    flowAnswer: situationLabel(answers.situation),
  });

  req.session.housingApplication = {
    reference,
    submittedAt: submittedAt.toISOString(),
  };
  res.redirect("/apply-housing/confirmation");
});

router.get("/confirmation", requireHousingSubmission, (req, res) => {
  res.render("apply-housing/confirmation.njk", {
    reference: req.session.housingApplication.reference,
  });
});

module.exports = router;
