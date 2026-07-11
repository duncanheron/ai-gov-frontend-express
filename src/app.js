const path = require("node:path");
const express = require("express");
const nunjucks = require("nunjucks");
const pinoHttp = require("pino-http");

const config = require("./config");
const logger = require("./config/logger");
const sessionMiddleware = require("./middleware/session");
const {
  cspNonce,
  helmetMiddleware,
  csrfProtection,
  generateCsrfToken,
} = require("./middleware/security");

function createApp() {
  const app = express();

  const viewsPath = path.join(__dirname, "views");
  const govukFrontendPath = path.join(__dirname, "..", "node_modules", "govuk-frontend", "dist");
  nunjucks.configure([viewsPath, govukFrontendPath], {
    autoescape: true,
    express: app,
    watch: !config.isProduction && !config.isTest,
  });
  app.set("view engine", "njk");

  app.use(pinoHttp({ logger }));
  app.use(cspNonce);
  app.use(helmetMiddleware);
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(express.urlencoded({ extended: false }));
  app.use(sessionMiddleware);
  app.use(csrfProtection);

  app.use((req, res, next) => {
    res.locals.csrfToken = generateCsrfToken(req);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}

module.exports = createApp;
