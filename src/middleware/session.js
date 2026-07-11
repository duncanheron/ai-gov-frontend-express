const session = require("express-session");
const config = require("../config");

module.exports = session({
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
});
