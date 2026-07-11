const crypto = require("node:crypto");
const helmet = require("helmet");
const { csrfSync } = require("csrf-sync");

function cspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      fontSrc: ["'self'"],
    },
  },
});

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body && req.body._csrf,
});

module.exports = {
  cspNonce,
  helmetMiddleware,
  csrfProtection: csrfSynchronisedProtection,
  generateCsrfToken: generateToken,
};
