const express = require("express");

const { validateDetails } = require("../validation/applyValidation");
const { validateDisabilityDetails } = require("../validation/housingBenefitValidation");
const { generateReference } = require("../utils/reference");
const {
  requireHousingBenefitDetails,
  requireDisabilityDetails,
  requireHousingBenefitSubmission,
} = require("../middleware/housingBenefitJourneyGuard");
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

function disabilityDetailsViewModel(overrides = {}) {
  const answers = overrides.values || {};
  return {
    values: answers,
    errors: overrides.errors || [],
    fieldErrors: overrides.fieldErrors || {},
  };
}

router.get("/details", (req, res) => {
  const savedAnswers =
    req.session.housingBenefitApplication && req.session.housingBenefitApplication.answers;
  res.render("apply-housing-benefit/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("apply-housing-benefit/details.njk", detailsViewModel(result));
  }

  const existingAnswers =
    (req.session.housingBenefitApplication && req.session.housingBenefitApplication.answers) || {};
  req.session.housingBenefitApplication = {
    answers: { ...existingAnswers, ...result.values },
  };
  return res.redirect("/apply-housing-benefit/disability-details");
});

router.get("/disability-details", requireHousingBenefitDetails, (req, res) => {
  const savedAnswers = req.session.housingBenefitApplication.answers;
  res.render(
    "apply-housing-benefit/disability-details.njk",
    disabilityDetailsViewModel({ values: savedAnswers }),
  );
});

router.post("/disability-details", requireHousingBenefitDetails, (req, res) => {
  const result = validateDisabilityDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render(
      "apply-housing-benefit/disability-details.njk",
      disabilityDetailsViewModel({
        values: { ...req.session.housingBenefitApplication.answers, ...result.values },
        errors: result.errors,
        fieldErrors: result.fieldErrors,
      }),
    );
  }

  req.session.housingBenefitApplication.answers = {
    ...req.session.housingBenefitApplication.answers,
    disabilityDetails: result.values.disabilityDetails,
  };
  return res.redirect("/apply-housing-benefit/check-answers");
});

router.get("/check-answers", requireHousingBenefitDetails, requireDisabilityDetails, (req, res) => {
  const { answers } = req.session.housingBenefitApplication;
  const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

  res.render("apply-housing-benefit/check-answers.njk", { answers, dobFormatted });
});

router.post(
  "/check-answers",
  requireHousingBenefitDetails,
  requireDisabilityDetails,
  async (req, res) => {
    const { answers } = req.session.housingBenefitApplication;
    const reference = generateReference();
    const submittedAt = new Date();

    await applications.create({
      fullName: answers.fullName,
      email: answers.email,
      dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
      reference,
      submittedAt,
      flow: "housing-benefit-disability",
      flowAnswer: answers.disabilityDetails,
    });

    req.session.housingBenefitApplication = {
      reference,
      submittedAt: submittedAt.toISOString(),
    };
    res.redirect("/apply-housing-benefit/confirmation");
  },
);

router.get("/confirmation", requireHousingBenefitSubmission, (req, res) => {
  res.render("apply-housing-benefit/confirmation.njk", {
    reference: req.session.housingBenefitApplication.reference,
  });
});

module.exports = router;
