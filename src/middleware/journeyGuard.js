function requireDetails(req, res, next) {
  if (!req.session.application || !req.session.application.answers) {
    return res.redirect("/apply/details");
  }
  return next();
}

function requirePreferences(req, res, next) {
  if (!req.session.application || !Array.isArray(req.session.application.answers?.preferences)) {
    return res.redirect("/apply/preferences");
  }
  return next();
}

function requireSubmission(req, res, next) {
  if (!req.session.application || !req.session.application.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = { requireDetails, requirePreferences, requireSubmission };
