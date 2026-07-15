const up = `
ALTER TABLE "applications" ADD COLUMN "preferences" text[] NOT NULL DEFAULT '{}';
`;

const down = `
ALTER TABLE "applications" DROP COLUMN "preferences";
`;

module.exports = { up, down };
