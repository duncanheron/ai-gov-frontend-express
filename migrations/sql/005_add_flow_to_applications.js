const up = `
ALTER TABLE "applications" ADD COLUMN "flow" text NOT NULL DEFAULT 'standard';
ALTER TABLE "applications" ADD COLUMN "flow_answer" text;
`;

const down = `
ALTER TABLE "applications" DROP COLUMN "flow_answer";
ALTER TABLE "applications" DROP COLUMN "flow";
`;

module.exports = { up, down };
