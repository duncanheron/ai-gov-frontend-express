// Vercel's zero-config Express detection scans candidate entry files for a
// literal `require("express")`; src/app.js also matches its candidate
// pattern, so without this it can wire requests to that file's factory
// export instead of this server, causing every request to hang.
// eslint-disable-next-line no-unused-vars
const express = require("express");
const createApp = require("./src/app");
const config = require("./src/config");
const logger = require("./src/config/logger");

const app = createApp();

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });
}

module.exports = app;
