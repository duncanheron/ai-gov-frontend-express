const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { URL } = require("node:url");
const { Client } = require("pg");

const execFileAsync = promisify(execFile);

const DUPLICATE_DATABASE = "42P04";
const NODE_PG_MIGRATE_BIN = path.join(__dirname, "../../node_modules/.bin/node-pg-migrate");
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");
// Jest puts no timeout of its own around globalSetup, so a hung migrate subprocess would hang
// the whole run without this - unlike a hook-level guard, nothing else races it.
const MIGRATE_TIMEOUT_MS = 30_000;

// Runs in the orchestrating Jest process (globalSetup), before any worker's DATABASE_URL exists -
// so, unlike tests/db/pool.js, everything here takes a connection string explicitly rather than
// reading it from config/env.
function workerDatabaseUrl(adminUrl, workerId) {
  const url = new URL(adminUrl);
  url.pathname = `/jest_worker_${workerId}`;
  return url.toString();
}

async function ensureDatabaseExists(adminUrl, databaseName) {
  const admin = new Client({ connectionString: adminUrl });

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
async function migrate(databaseUrl) {
  await execFileAsync(
    NODE_PG_MIGRATE_BIN,
    ["up", "--migrations-dir", MIGRATIONS_DIR, "--no-verbose"],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: MIGRATE_TIMEOUT_MS,
    },
  );
}

async function createAndMigrateWorkerDatabase(adminUrl, workerId) {
  const databaseUrl = workerDatabaseUrl(adminUrl, workerId);
  const databaseName = new URL(databaseUrl).pathname.slice(1);

  await ensureDatabaseExists(adminUrl, databaseName);
  await migrate(databaseUrl);
}

module.exports = { workerDatabaseUrl, createAndMigrateWorkerDatabase };
