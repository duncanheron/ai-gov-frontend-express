const { toStr } = require("./applyValidation");

const BINS_OPTIONS = [
  { value: "1", text: "1 bin" },
  { value: "2", text: "2 bins" },
  { value: "3", text: "3 bins" },
];

// A single required radio question, same as housingValidation's situation
// field - "no bin count" isn't a meaningful answer, so we require exactly
// one selection from the known values.
function validateBins(body) {
  const value = toStr(body.bins);
  const isKnownValue = BINS_OPTIONS.some((option) => option.value === value);

  if (!isKnownValue) {
    return {
      values: { bins: "" },
      errors: [{ text: "Select how many garden waste bins you need", href: "#bins" }],
      fieldErrors: { bins: "Select how many garden waste bins you need" },
      isValid: false,
    };
  }

  return {
    values: { bins: value },
    errors: [],
    fieldErrors: {},
    isValid: true,
  };
}

function binsLabel(value) {
  const option = BINS_OPTIONS.find((item) => item.value === value);
  return option ? option.text : value;
}

module.exports = { BINS_OPTIONS, validateBins, binsLabel };
