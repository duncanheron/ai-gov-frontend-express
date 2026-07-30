function requireGardenWasteDetails(req, res, next) {
  if (!req.session.gardenWastePayment || !req.session.gardenWastePayment.answers) {
    return res.redirect("/pay-garden-waste/details");
  }
  return next();
}

function requireGardenWasteSubscription(req, res, next) {
  if (!req.session.gardenWastePayment || !req.session.gardenWastePayment.answers?.bins) {
    return res.redirect("/pay-garden-waste/subscription");
  }
  return next();
}

function requireGardenWasteSubmission(req, res, next) {
  if (!req.session.gardenWastePayment || !req.session.gardenWastePayment.reference) {
    return res.redirect("/");
  }
  return next();
}

module.exports = {
  requireGardenWasteDetails,
  requireGardenWasteSubscription,
  requireGardenWasteSubmission,
};
