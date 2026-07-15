const express = require("express");

const {
  validateDetails,
  validatePreferences,
  PREFERENCE_OPTIONS,
  preferenceLabels,
} = require("../validation/applyValidation");
const { generateReference } = require("../utils/reference");
const {
  requireDetails,
  requirePreferences,
  requireSubmission,
} = require("../middleware/journeyGuard");
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

function preferenceCheckboxItems(selected = []) {
  return PREFERENCE_OPTIONS.map((option) => ({
    value: option.value,
    text: option.text,
    checked: selected.includes(option.value),
  }));
}

router.get("/details", (req, res) => {
  const savedAnswers = req.session.application && req.session.application.answers;
  res.render("apply/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("apply/details.njk", detailsViewModel(result));
  }

  const existingAnswers = (req.session.application && req.session.application.answers) || {};
  req.session.application = { answers: { ...existingAnswers, ...result.values } };
  return res.redirect("/apply/check-answers");
});

router.get("/preferences", requireDetails, (req, res) => {
  const { preferences } = req.session.application.answers;
  res.render("apply/preferences.njk", { items: preferenceCheckboxItems(preferences) });
});

router.post("/preferences", requireDetails, (req, res) => {
  const result = validatePreferences(req.body);

  req.session.application.answers = {
    ...req.session.application.answers,
    preferences: result.values.preferences,
  };
  return res.redirect("/apply/check-answers");
});

router.get("/check-answers", requireDetails, requirePreferences, (req, res) => {
  const { answers } = req.session.application;
  const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

  res.render("apply/check-answers.njk", {
    answers,
    dobFormatted,
    preferencesLabel: preferenceLabels(answers.preferences),
  });
});

router.post("/check-answers", requireDetails, requirePreferences, async (req, res) => {
  const { answers } = req.session.application;
  const reference = generateReference();
  const submittedAt = new Date();

  await applications.create({
    fullName: answers.fullName,
    email: answers.email,
    dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
    reference,
    submittedAt,
    preferences: answers.preferences,
  });

  req.session.application = {
    reference,
    submittedAt: submittedAt.toISOString(),
  };
  res.redirect("/apply/confirmation");
});

router.get("/confirmation", requireSubmission, (req, res) => {
  res.render("apply/confirmation.njk", {
    reference: req.session.application.reference,
  });
});

module.exports = router;
