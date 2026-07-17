function requireHousingDetails(req, res, next) {
  if (!req.session.housingApplication || !req.session.housingApplication.answers) {
    return res.redirect("/apply-housing/details");
  }
  return next();
}

function requireHousingSituation(req, res, next) {
  if (!req.session.housingApplication || !req.session.housingApplication.answers?.situation) {
    return res.redirect("/apply-housing/situation");
  }
  return next();
}

function requireHousingSubmission(req, res, next) {
  if (!req.session.housingApplication || !req.session.housingApplication.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = { requireHousingDetails, requireHousingSituation, requireHousingSubmission };
