const pool = require("../../src/db/pool");

// src/db/pool.js is an eager singleton with real open sockets - without this, a test file that
// never creates a server leaves its pool's connections open, and Jest force-kills the worker
// instead of exiting cleanly. Skipped when tests/helpers/testServer.js has claimed teardown: it
// must close its server first, and root-level afterAll hooks run in declaration order, so this
// file (loaded before any test file) would otherwise always close the pool first.
afterAll(async () => {
  if (global.__POOL_CLOSED_BY_TEST_SERVER__) return;
  await pool.end();
});
