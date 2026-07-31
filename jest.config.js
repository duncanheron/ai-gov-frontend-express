module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setup/setWorkerDatabaseUrl.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/closePoolAfterTests.js"],
};
