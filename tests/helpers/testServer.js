const createApp = require("../../src/app");
const { prepareTestDatabase } = require("./prepareTestDatabase");

// Supertest binds and closes a fresh ephemeral server for every `request(app)`
// call. Across the whole suite that was ~145 bind/close cycles, and under
// parallel workers the churn made any suite fail intermittently - socket hang
// ups, malformed responses, and requests answered by another file's app, which
// surfaced as stray 403s and 404s. One server per file keeps the port stable
// for that file's lifetime. See CBLT-109.
function useSharedServer() {
  let server;

  // Every route goes through the session middleware, which now always writes to Postgres
  // (see src/middleware/session.js) - a file doesn't have to touch the applications table to
  // still need its worker's database ready. Calling this here, rather than trusting each file to
  // do it, means a file testing something unrelated to data storage can't fail on a missing
  // schema. It's a no-op if the file's own beforeAll already called it.
  beforeAll(async () => {
    await prepareTestDatabase();
    server = createApp().listen(0);
  });

  // Guarded: if beforeAll threw, closing an undefined server would add a second
  // failure on top of the real one.
  afterAll(() => (server ? new Promise((resolve) => server.close(resolve)) : undefined));

  return () => server;
}

module.exports = { useSharedServer };
