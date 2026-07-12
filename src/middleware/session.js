const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const config = require("../config");
const pool = require("../db/pool");

const sessionOptions = {
  secret: config.sessionSecret,
  name: "sessionId",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 30 * 60 * 1000,
  },
};

// pg-mem (used in tests, see src/db/pool.js) doesn't support the SQL
// connect-pg-simple runs internally, so tests keep express-session's
// default in-memory store instead.
if (!config.isTest) {
  sessionOptions.store = new pgSession({ pool, tableName: "session" });
}

module.exports = session(sessionOptions);
