const up = `
ALTER TABLE "applications" ADD COLUMN "favourite_animal" text;
`;

const down = `
ALTER TABLE "applications" DROP COLUMN "favourite_animal";
`;

module.exports = { up, down };
