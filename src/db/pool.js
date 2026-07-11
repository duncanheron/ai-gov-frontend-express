const { Pool } = require("pg");
const config = require("../config");

function createPool() {
  if (config.isTest) {
    const { newDb } = require("pg-mem");
    const { Pool: MemPool } = newDb().adapters.createPg();
    return new MemPool();
  }

  return new Pool({ connectionString: config.databaseUrl });
}

module.exports = createPool();
