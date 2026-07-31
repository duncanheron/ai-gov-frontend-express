const { Pool } = require("pg");
const config = require("../config");
const logger = require("../config/logger");

function createPool() {
  const pool = new Pool({ connectionString: config.databaseUrl });

  // An idle client's backend connection can drop (restart, network blip, in tests: the
  // container stopping). Without a listener, pg re-throws that as an unhandled 'error' event
  // and crashes the process instead of just discarding the dead client.
  pool.on("error", (error) => {
    logger.error({ err: error }, "Unexpected error on idle Postgres client");
  });

  return pool;
}

module.exports = createPool();
