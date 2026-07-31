const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const config = require("../config");
const pool = require("../db/pool");

const sessionOptions = {
  secret: config.sessionSecret,
  name: "sessionId",
  resave: false,
  saveUninitialized: false,
  store: new pgSession({ pool, tableName: "session" }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 30 * 60 * 1000,
  },
};

module.exports = session(sessionOptions);
