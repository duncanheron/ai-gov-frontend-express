const { randomUUID } = require("node:crypto");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { createAndMigrateWorkerDatabase } = require("../helpers/testDatabaseAdmin");

// Runs before any worker exists, so the connection string is in process.env before the eager
// pool singleton is required. Stashed on `global` because globalTeardown - the only other thing
// that runs in this same orchestrating process - has no other channel to read it back from.
//
// Every worker's database is created and migrated here too, once per run, in parallel - not by
// each test file's own beforeAll. A per-file `process.env` memo was tried instead, but writes to
// process.env do not survive Jest's per-file module registry reset, so it only ever skipped an
// intra-file second call: every file still paid for its own CREATE DATABASE and migrate
// subprocess. Worker IDs run 1..maxWorkers, plus "0" for the --runInBand case where
// JEST_WORKER_ID is unset (see tests/setup/setWorkerDatabaseUrl.js).
module.exports = async function globalSetup(globalConfig) {
  const container = await new PostgreSqlContainer("postgres:17-alpine")
    .withPassword(randomUUID())
    .start();

  const adminUrl = container.getConnectionUri();
  const workerIds = ["0"];
  for (let id = 1; id <= globalConfig.maxWorkers; id += 1) {
    workerIds.push(String(id));
  }

  await Promise.all(workerIds.map((id) => createAndMigrateWorkerDatabase(adminUrl, id)));

  global.__PG_TEST_CONTAINER__ = container;
  process.env.TEST_DATABASE_ADMIN_URL = adminUrl;
};
