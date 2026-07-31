const { PostgreSqlContainer } = require("@testcontainers/postgresql");

// Runs once in Jest's orchestrating process, before any worker or test file exists, so the
// connection string is in `process.env` before `src/db/pool.js` (an eager singleton) is ever
// required. Stashed on `global` rather than returned, because globalTeardown is the only other
// place that can read it back - Jest runs both in this same process.
module.exports = async function globalSetup() {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();

  global.__PG_TEST_CONTAINER__ = container;
  process.env.TEST_DATABASE_ADMIN_URL = container.getConnectionUri();
};
