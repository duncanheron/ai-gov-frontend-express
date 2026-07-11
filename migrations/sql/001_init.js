const up = `
CREATE TABLE "registrations" (
  "id" text PRIMARY KEY,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "date_of_birth" date NOT NULL,
  "reference" text UNIQUE NOT NULL,
  "submitted_at" timestamptz NOT NULL
);
`;

const down = `
DROP TABLE "registrations";
`;

module.exports = { up, down };
