function requireDetails(req, res, next) {
  if (!req.session.registration || !req.session.registration.answers) {
    return res.redirect("/register/details");
  }
  return next();
}

function requireSubmission(req, res, next) {
  if (!req.session.registration || !req.session.registration.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = { requireDetails, requireSubmission };
