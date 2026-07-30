function requireCouncilTaxDetails(req, res, next) {
  if (!req.session.councilTaxPayment || !req.session.councilTaxPayment.answers) {
    return res.redirect("/pay-council-tax/details");
  }
  return next();
}

function requireCouncilTaxAccount(req, res, next) {
  if (!req.session.councilTaxPayment || !req.session.councilTaxPayment.answers?.accountNumber) {
    return res.redirect("/pay-council-tax/account");
  }
  return next();
}

function requireCouncilTaxSubmission(req, res, next) {
  if (!req.session.councilTaxPayment || !req.session.councilTaxPayment.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = {
  requireCouncilTaxDetails,
  requireCouncilTaxAccount,
  requireCouncilTaxSubmission,
};
