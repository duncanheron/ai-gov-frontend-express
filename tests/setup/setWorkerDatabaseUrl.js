const { URL } = require("node:url");

// JEST_WORKER_ID is unset when Jest runs in-band (a single worker sharing the main process),
// hence the fallback. See tests/helpers/prepareTestDatabase.js for the per-worker database split.
const adminUrl = new URL(process.env.TEST_DATABASE_ADMIN_URL);
adminUrl.pathname = `/jest_worker_${process.env.JEST_WORKER_ID || "0"}`;
process.env.DATABASE_URL = adminUrl.toString();
