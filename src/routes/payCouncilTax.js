const express = require("express");

const { validateDetails } = require("../validation/applyValidation");
const { validateAccountNumber } = require("../validation/councilTaxValidation");
const { formatPence, COUNCIL_TAX_AMOUNT_PENCE } = require("../lib/money");
const { generateReference } = require("../utils/reference");
const {
  requireCouncilTaxDetails,
  requireCouncilTaxAccount,
  requireCouncilTaxSubmission,
} = require("../middleware/councilTaxJourneyGuard");
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

router.get("/details", (req, res) => {
  const savedAnswers = req.session.councilTaxPayment && req.session.councilTaxPayment.answers;
  res.render("pay-council-tax/details.njk", detailsViewModel({ values: savedAnswers || {} }));
});

router.post("/details", (req, res) => {
  const result = validateDetails(req.body);

  if (!result.isValid) {
    return res.status(400).render("pay-council-tax/details.njk", detailsViewModel(result));
  }

  const existingAnswers =
    (req.session.councilTaxPayment && req.session.councilTaxPayment.answers) || {};
  req.session.councilTaxPayment = { answers: { ...existingAnswers, ...result.values } };
  return res.redirect("/pay-council-tax/account");
});

router.get("/account", requireCouncilTaxDetails, (req, res) => {
  const { accountNumber } = req.session.councilTaxPayment.answers;
  res.render("pay-council-tax/account.njk", {
    values: { accountNumber },
    errors: [],
    fieldErrors: {},
  });
});

router.post("/account", requireCouncilTaxDetails, (req, res) => {
  const result = validateAccountNumber(req.body);

  if (!result.isValid) {
    return res.status(400).render("pay-council-tax/account.njk", {
      values: result.values,
      errors: result.errors,
      fieldErrors: result.fieldErrors,
    });
  }

  req.session.councilTaxPayment.answers = {
    ...req.session.councilTaxPayment.answers,
    accountNumber: result.values.accountNumber,
  };
  return res.redirect("/pay-council-tax/check-answers");
});

router.get("/check-answers", requireCouncilTaxDetails, requireCouncilTaxAccount, (req, res) => {
  const { answers } = req.session.councilTaxPayment;
  const dobFormatted = `${answers.dobDay.padStart(2, "0")}/${answers.dobMonth.padStart(2, "0")}/${answers.dobYear}`;

  res.render("pay-council-tax/check-answers.njk", {
    answers,
    dobFormatted,
    amountToPay: formatPence(COUNCIL_TAX_AMOUNT_PENCE),
  });
});

router.post(
  "/check-answers",
  requireCouncilTaxDetails,
  requireCouncilTaxAccount,
  async (req, res) => {
    const { answers } = req.session.councilTaxPayment;
    const reference = generateReference();
    const submittedAt = new Date();
    const amountToPay = formatPence(COUNCIL_TAX_AMOUNT_PENCE);

    await applications.create({
      fullName: answers.fullName,
      email: answers.email,
      dateOfBirth: `${answers.dobYear}-${answers.dobMonth.padStart(2, "0")}-${answers.dobDay.padStart(2, "0")}`,
      reference,
      submittedAt,
      flow: "council-tax",
      flowAnswer: `Council tax - account ${answers.accountNumber}, ${amountToPay}`,
    });

    req.session.councilTaxPayment = {
      reference,
      submittedAt: submittedAt.toISOString(),
    };
    res.redirect("/pay-council-tax/confirmation");
  },
);

router.get("/confirmation", requireCouncilTaxSubmission, (req, res) => {
  res.render("pay-council-tax/confirmation.njk", {
    reference: req.session.councilTaxPayment.reference,
  });
});

module.exports = router;
