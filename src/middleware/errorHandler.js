function notFoundHandler(req, res) {
  res.status(404).render("errors/404.njk");
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (req.log) {
    req.log.error({ err }, "Unhandled error");
  }
  res.status(err.status || 500).render("errors/500.njk");
}

module.exports = { notFoundHandler, errorHandler };
