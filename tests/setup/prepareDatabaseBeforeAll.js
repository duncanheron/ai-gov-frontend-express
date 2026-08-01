const { truncateAllTables } = require("../helpers/prepareTestDatabase");

// setupFilesAfterEnv loads before a test file is required, so this root beforeAll is always
// declared - and therefore always runs - before any beforeAll the file itself declares. That
// makes truncate-before-seed a structural guarantee rather than something each file has to
// remember to call in the right order. Schema itself is guaranteed by
// tests/setup/globalSetup.js, once per worker database, before any test file runs.
beforeAll(async () => {
  await truncateAllTables();
});
