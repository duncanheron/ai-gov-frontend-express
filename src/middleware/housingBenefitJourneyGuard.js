function requireHousingBenefitDetails(req, res, next) {
  if (!req.session.housingBenefitApplication || !req.session.housingBenefitApplication.answers) {
    return res.redirect("/apply-housing-benefit/details");
  }
  return next();
}

function requireDisabilityDetails(req, res, next) {
  if (
    !req.session.housingBenefitApplication ||
    !req.session.housingBenefitApplication.answers?.disabilityDetails
  ) {
    return res.redirect("/apply-housing-benefit/disability-details");
  }
  return next();
}

function requireHousingBenefitSubmission(req, res, next) {
  if (!req.session.housingBenefitApplication || !req.session.housingBenefitApplication.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = {
  requireHousingBenefitDetails,
  requireDisabilityDetails,
  requireHousingBenefitSubmission,
};
