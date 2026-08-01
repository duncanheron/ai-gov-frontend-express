module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setup/setWorkerDatabaseUrl.js"],
  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/prepareDatabaseBeforeAll.js",
    "<rootDir>/tests/setup/closePoolAfterTests.js",
  ],
  // The first prepareDatabaseBeforeAll per worker does CREATE DATABASE, a migrate subprocess and
  // a truncate inside one hook; the default 5000ms budget flakes under contention.
  testTimeout: 15000,
  // Runs file order in a fresh random shuffle every time - see the sequencer itself for why
  // `--randomize` isn't a substitute.
  testSequencer: "<rootDir>/tests/setup/randomFileOrderSequencer.js",
};
