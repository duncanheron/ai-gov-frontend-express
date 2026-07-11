const createApp = require("./src/app");
const config = require("./src/config");
const logger = require("./src/config/logger");

const app = createApp();

app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});
