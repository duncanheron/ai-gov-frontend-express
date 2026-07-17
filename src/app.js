const path = require("node:path");
const express = require("express");
const nunjucks = require("nunjucks");
const pinoHttp = require("pino-http");

const config = require("./config");
const logger = require("./config/logger");
const navigation = require("./config/navigation");
const sessionMiddleware = require("./middleware/session");
const {
  cspNonce,
  helmetMiddleware,
  csrfProtection,
  generateCsrfToken,
} = require("./middleware/security");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const indexRouter = require("./routes/index");
const applyRouter = require("./routes/apply");
const applyHousingRouter = require("./routes/applyHousing");
const applyHousingBenefitRouter = require("./routes/applyHousingBenefit");
const chooseServiceRouter = require("./routes/chooseService");
const applicationsRouter = require("./routes/applications");

function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  const viewsPath = path.join(__dirname, "views");
  const govukFrontendPath = path.join(__dirname, "..", "node_modules", "govuk-frontend", "dist");
  const nunjucksEnv = nunjucks.configure([viewsPath, govukFrontendPath], {
    autoescape: true,
    express: app,
    watch: !config.isProduction && !config.isTest,
  });
  nunjucksEnv.addGlobal("serviceName", "Submit your application");
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
    res.locals.navigationItems = navigation.forCurrentPath(req.path);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/", indexRouter);
  app.use("/apply", applyRouter);
  app.use("/apply-housing", applyHousingRouter);
  app.use("/apply-housing-benefit", applyHousingBenefitRouter);
  app.use("/choose-service", chooseServiceRouter);
  app.use("/applications", applicationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
