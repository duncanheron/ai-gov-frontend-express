const { randomUUID } = require("node:crypto");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");

// Runs before any worker exists, so the connection string is in process.env before the eager
// pool singleton is required. Stashed on `global` because globalTeardown - the only other thing
// that runs in this same orchestrating process - has no other channel to read it back from.
module.exports = async function globalSetup() {
  const container = await new PostgreSqlContainer("postgres:17-alpine")
    .withPassword(randomUUID())
    .start();

  global.__PG_TEST_CONTAINER__ = container;
  process.env.TEST_DATABASE_ADMIN_URL = container.getConnectionUri();
};
