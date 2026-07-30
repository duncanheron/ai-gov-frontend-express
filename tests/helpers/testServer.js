const createApp = require("../../src/app");

// Supertest binds and closes a fresh ephemeral server for every `request(app)`
// call. Across the whole suite that was ~145 bind/close cycles, and under
// parallel workers the churn made any suite fail intermittently - socket hang
// ups, malformed responses, and requests answered by another file's app (its own
// session store and pg-mem database), which surfaced as stray 403s and 404s.
// One server per file keeps the port stable for that file's lifetime. See CBLT-109.
function useSharedServer() {
  let server;

  beforeAll(() => {
    server = createApp().listen(0);
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  return () => server;
}

module.exports = { useSharedServer };
