const { Pool } = require("pg");
const config = require("../config");
const logger = require("../config/logger");

function createPool() {
  const pool = new Pool({ connectionString: config.databaseUrl });

  // connect-pg-simple only attaches its own pool 'error' listener when it creates the pool
  // itself; passing in an existing pool (as src/middleware/session.js does) leaves it with none.
  // Without one, a routine idle-connection reset - a Neon serverless restart, a network blip, in
  // tests the container stopping - re-throws as an unhandled 'error' event and crashes the
  // process instead of just discarding the dead client.
  pool.on("error", (error) => {
    logger.error({ err: error }, "Unexpected error on idle Postgres client");
  });

  return pool;
}

module.exports = createPool();
