const pool = require("../../src/db/pool");
const initSql = require("../../migrations/sql/001_init");
const renameToApplicationsSql = require("../../migrations/sql/003_rename_registrations_to_applications");
const addPreferencesSql = require("../../migrations/sql/004_add_preferences_to_applications");
const addFlowSql = require("../../migrations/sql/005_add_flow_to_applications");

async function prepareTestDatabase() {
  await pool.query(initSql.up);
  await pool.query(renameToApplicationsSql.up);
  await pool.query(addPreferencesSql.up);
  await pool.query(addFlowSql.up);
}

module.exports = { prepareTestDatabase };
