const crypto = require("node:crypto");
const applications = require("../../src/db/applications");

// Defaults mirror allPages.js's PERSON pattern: a shared baseline so a test only spells out the
// field it cares about. Owns reference uniqueness (UNIQUE NOT NULL) so call sites don't have to.
async function createApplication(overrides = {}) {
  return applications.create({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    dateOfBirth: "1985-03-27",
    reference: `TEST-${crypto.randomUUID()}`,
    submittedAt: new Date(),
    ...overrides,
  });
}

module.exports = { createApplication };
