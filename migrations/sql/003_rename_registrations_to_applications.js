const up = `
ALTER TABLE "registrations" RENAME TO "applications";
`;

const down = `
ALTER TABLE "applications" RENAME TO "registrations";
`;

module.exports = { up, down };
