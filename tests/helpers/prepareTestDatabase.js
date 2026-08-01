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
// sequentially against that one database; tests/setup/prepareDatabaseBeforeAll.js truncates every
// table before each file's own hooks run, so whatever a previous file left behind is gone before
// that file's tests start. migrateTestDatabase() only ensures the schema exists and is separate
// from truncateAllTables() because the two have different safety properties: the former is
// idempotent and safe to call from anywhere, the latter destroys data and must run before a file
// seeds anything, not after.

const DUPLICATE_DATABASE = "42P04";

const NODE_PG_MIGRATE_BIN = path.join(__dirname, "../../node_modules/.bin/node-pg-migrate");
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");
const MIGRATE_TIMEOUT_MS = 30_000;

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
// its own `pgmigrations` table, so re-running it once the schema is current is a no-op.
async function migrate() {
  await execFileAsync(
    NODE_PG_MIGRATE_BIN,
    ["up", "--migrations-dir", MIGRATIONS_DIR, "--no-verbose"],
    {
      env: { ...process.env, DATABASE_URL: config.databaseUrl },
      timeout: MIGRATE_TIMEOUT_MS,
    },
  );
}

// process.env survives across test files within a worker even though Jest resets the module
// registry per file, so it's the only channel available to skip the repeat CREATE DATABASE/
// migrate subprocess once a worker's database is already up to date.
function migratedEnvKey() {
  return `TEST_DATABASE_MIGRATED_${process.env.JEST_WORKER_ID || "0"}`;
}

async function migrateTestDatabase() {
  if (process.env[migratedEnvKey()]) return;

  await ensureDatabaseExists();
  await migrate();
  process.env[migratedEnvKey()] = "true";
}

async function truncateAllTables() {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'",
  );

  if (rows.length === 0) return;

  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

// Combines both for tests/db/applications-list.test.js (CBLT-129's, left as-is). Everywhere else,
// tests/setup/prepareDatabaseBeforeAll.js calls the two functions directly.
async function prepareTestDatabase() {
  await migrateTestDatabase();
  await truncateAllTables();
}

module.exports = { migrateTestDatabase, truncateAllTables, prepareTestDatabase };
