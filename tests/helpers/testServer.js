const createApp = require("../../src/app");
const pool = require("../../src/db/pool");

// Supertest binds and closes a fresh ephemeral server for every `request(app)`
// call. Across the whole suite that was ~145 bind/close cycles, and under
// parallel workers the churn made any suite fail intermittently - socket hang
// ups, malformed responses, and requests answered by another file's app, which
// surfaced as stray 403s and 404s. One server per file keeps the port stable
// for that file's lifetime. See CBLT-109.
function useSharedServer() {
  let server;

  // Claim pool teardown so tests/setup/closePoolAfterTests.js defers to the afterAll below -
  // whatever owns the server must close it before the pool it depends on, and only this
  // module knows when that is.
  global.__POOL_CLOSED_BY_TEST_SERVER__ = true;

  beforeAll(() => {
    server = createApp().listen(0);
  });

  // Guarded: if beforeAll threw, closing an undefined server would add a second
  // failure on top of the real one. Closes the pool only after the server, so no in-flight
  // request or session-store write can land on an already-ended pool.
  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  return () => server;
}

module.exports = { useSharedServer };
