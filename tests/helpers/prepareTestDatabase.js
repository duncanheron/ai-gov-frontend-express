const pool = require("../../src/db/pool");
const initSql = require("../../migrations/sql/001_init");

async function prepareTestDatabase() {
  await pool.query(initSql.up);
}

module.exports = { prepareTestDatabase };
