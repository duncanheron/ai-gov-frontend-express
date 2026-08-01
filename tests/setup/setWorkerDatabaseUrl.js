const { workerDatabaseUrl } = require("../helpers/testDatabaseAdmin");

// JEST_WORKER_ID is unset when Jest runs in-band (a single worker sharing the main process),
// hence the fallback. tests/setup/globalSetup.js already created and migrated this worker's
// database under that same ID.
process.env.DATABASE_URL = workerDatabaseUrl(
  process.env.TEST_DATABASE_ADMIN_URL,
  process.env.JEST_WORKER_ID || "0",
);
