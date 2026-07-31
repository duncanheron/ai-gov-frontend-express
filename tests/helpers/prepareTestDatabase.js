const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { URL } = require("node:url");
const { Client } = require("pg");
const config = require("../../src/config");
const pool = require("../../src/db/pool");

const execFileAsync = promisify(execFile);

// Isolation strategy: one shared Postgres container (tests/setup/globalSetup.js) serving one
// database per Jest worker, keyed off JEST_WORKER_ID (tests/setup/setWorkerDatabaseUrl.js points
// DATABASE_URL at it) - concurrent workers can't collide. Within a worker, test files run
// sequentially against that one database, so each file's call to prepareTestDatabase() truncates
// every table before that file's own tests run: whatever a previous file left behind is gone
// before the next file's beforeAll returns.

const DUPLICATE_DATABASE = "42P04";

const NODE_PG_MIGRATE_BIN = path.join(__dirname, "../../node_modules/.bin/node-pg-migrate");
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

async function ensureDatabaseExists() {
  const databaseName = new URL(config.databaseUrl).pathname.slice(1);
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });

  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if (error.code !== DUPLICATE_DATABASE) throw error;
  } finally {
    await admin.end();
  }
}

// node-pg-migrate v8 ships ESM-only, which Jest's CommonJS test files can't `require()`. Run the
// same CLI `npm run migrate:up` uses instead, as a subprocess - it tracks applied migrations in
// its own `pgmigrations` table, so calling this repeatedly (once per file, sharing a worker's
// database) is a no-op once the schema is up to date.
async function migrate() {
  await execFileAsync(
    NODE_PG_MIGRATE_BIN,
    ["up", "--migrations-dir", MIGRATIONS_DIR, "--no-verbose"],
    {
      env: { ...process.env, DATABASE_URL: config.databaseUrl },
    },
  );
}

async function truncateAllTables() {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'",
  );

  if (rows.length === 0) return;

  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

async function prepareTestDatabase() {
  await ensureDatabaseExists();
  await migrate();
  await truncateAllTables();
}

module.exports = { prepareTestDatabase };
