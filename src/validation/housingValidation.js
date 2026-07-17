const SITUATION_OPTIONS = [
  { value: "renting-privately", text: "Renting privately" },
  { value: "living-with-family", text: "Living with family or friends" },
  { value: "homeless-or-at-risk", text: "Homeless or at risk of homelessness" },
  { value: "other", text: "Other" },
];

// Unlike the preferences checkboxes on the /apply journey (where selecting
// nothing is a valid answer), this is a single required radio question -
// "no housing situation" isn't a meaningful answer, so we require exactly
// one selection.
function validateSituation(body) {
  const value = (body.situation || "").trim();
  const isKnownValue = SITUATION_OPTIONS.some((option) => option.value === value);

  if (!isKnownValue) {
    return {
      values: { situation: "" },
      errors: [{ text: "Select your current housing situation", href: "#situation" }],
      fieldErrors: { situation: "Select your current housing situation" },
      isValid: false,
    };
  }

  return {
    values: { situation: value },
    errors: [],
    fieldErrors: {},
    isValid: true,
  };
}

function situationLabel(value) {
  const option = SITUATION_OPTIONS.find((item) => item.value === value);
  return option ? option.text : value;
}

module.exports = { SITUATION_OPTIONS, validateSituation, situationLabel };
