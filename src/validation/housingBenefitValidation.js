const DISABILITY_DETAILS_MAX_LENGTH = 1000;

// Unlike the existing /apply preferences step (which deliberately allows an
// empty answer), the disability details answer IS the substance of a
// Housing Benefit (disability) application - an empty submission would mean
// there is nothing for a caseworker to assess, so it is required here.
function validateDisabilityDetails(body) {
  const values = {
    disabilityDetails: (body.disabilityDetails || "").trim(),
  };

  const errors = [];
  const fieldErrors = {};

  if (!values.disabilityDetails) {
    errors.push({
      text: "Tell us about your disability and how it affects your housing needs",
      href: "#disabilityDetails",
    });
    fieldErrors.disabilityDetails =
      "Tell us about your disability and how it affects your housing needs";
  } else if (values.disabilityDetails.length > DISABILITY_DETAILS_MAX_LENGTH) {
    errors.push({
      text: `Disability details must be ${DISABILITY_DETAILS_MAX_LENGTH} characters or fewer`,
      href: "#disabilityDetails",
    });
    fieldErrors.disabilityDetails = `Disability details must be ${DISABILITY_DETAILS_MAX_LENGTH} characters or fewer`;
  }

  return { values, errors, fieldErrors, isValid: errors.length === 0 };
}

module.exports = { validateDisabilityDetails, DISABILITY_DETAILS_MAX_LENGTH };
