const { URL } = require("node:url");

// Runs once per test file, before that file's own requires - see tests/helpers/prepareTestDatabase.js
// for why every Jest worker needs its own database. `JEST_WORKER_ID` is unset when Jest runs
// in-band (a single worker sharing the main process), hence the fallback.
const adminUrl = new URL(process.env.TEST_DATABASE_ADMIN_URL);
adminUrl.pathname = `/jest_worker_${process.env.JEST_WORKER_ID || "0"}`;
process.env.DATABASE_URL = adminUrl.toString();
