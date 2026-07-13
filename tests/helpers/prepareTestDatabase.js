const pool = require("../../src/db/pool");
const initSql = require("../../migrations/sql/001_init");
const renameToApplicationsSql = require("../../migrations/sql/003_rename_registrations_to_applications");

async function prepareTestDatabase() {
  await pool.query(initSql.up);
  await pool.query(renameToApplicationsSql.up);
}

module.exports = { prepareTestDatabase };
