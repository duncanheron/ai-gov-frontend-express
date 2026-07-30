const { toStr } = require("./applyValidation");

const ACCOUNT_NUMBER_PATTERN = /^\d{8}$/;

function validateAccountNumber(body) {
  const accountNumber = toStr(body.accountNumber);

  if (!accountNumber) {
    return {
      values: { accountNumber },
      errors: [{ text: "Enter your council tax account number", href: "#accountNumber" }],
      fieldErrors: { accountNumber: "Enter your council tax account number" },
      isValid: false,
    };
  }

  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    return {
      values: { accountNumber },
      errors: [{ text: "Council tax account number must be 8 digits", href: "#accountNumber" }],
      fieldErrors: { accountNumber: "Council tax account number must be 8 digits" },
      isValid: false,
    };
  }

  return { values: { accountNumber }, errors: [], fieldErrors: {}, isValid: true };
}

module.exports = { validateAccountNumber };
