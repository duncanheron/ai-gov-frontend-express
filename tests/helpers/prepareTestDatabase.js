const pool = require("../../src/db/pool");

// Isolation strategy: one shared Postgres container (tests/setup/globalSetup.js) serving one
// database per Jest worker, keyed off JEST_WORKER_ID (tests/setup/setWorkerDatabaseUrl.js points
// DATABASE_URL at it) - concurrent workers can't collide. Schema for every worker database is
// created and migrated once, up front, by globalSetup - not here. Within a worker, test files run
// sequentially against that one database; tests/setup/prepareDatabaseBeforeAll.js truncates every
// table before each file's own hooks run, so whatever a previous file left behind is gone before
// that file's tests start.

async function truncateAllTables() {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'",
  );

  if (rows.length === 0) return;

  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { truncateAllTables };
