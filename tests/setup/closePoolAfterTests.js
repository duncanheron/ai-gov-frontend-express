const pool = require("../../src/db/pool");

// src/db/pool.js is an eager singleton with real open sockets now (see CBLT-131) - without this,
// each test file leaves its pool's connections open, and Jest force-kills the worker instead of
// exiting cleanly once every file has run.
afterAll(async () => {
  await pool.end();
});
