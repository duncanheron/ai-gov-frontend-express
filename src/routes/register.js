const express = require("express");

const { validateDetails } = require("../validation/registerValidation");
const { generateReference } = require("../utils/reference");
const { requireDetails, requireSubmission } = require("../middleware/journeyGuard");
const registrations = require("../db/registrations");

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
  const savedAnswers = req.session.registration && req.session.registration.answers;
  res.render("register/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("register/details.njk", detailsViewModel(result));
  }

  req.session.registration = { answers: result.values };
  return res.redirect("/register/check-answers");
});

router.get("/check-answers", requireDetails, (req, res) => {
  const { answers } = req.session.registration;
  const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

  res.render("register/check-answers.njk", { answers, dobFormatted });
});

router.post("/check-answers", requireDetails, async (req, res) => {
  const { answers } = req.session.registration;
  const reference = generateReference();
  const submittedAt = new Date();

  await registrations.create({
    fullName: answers.fullName,
    email: answers.email,
    dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
    reference,
    submittedAt,
  });

  req.session.registration = {
    reference,
    submittedAt: submittedAt.toISOString(),
  };
  res.redirect("/register/confirmation");
});

router.get("/confirmation", requireSubmission, (req, res) => {
  res.render("register/confirmation.njk", {
    reference: req.session.registration.reference,
  });
});

module.exports = router;
