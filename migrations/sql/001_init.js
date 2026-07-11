const up = `
CREATE TABLE "sessions" (
  "id" text PRIMARY KEY,
  "sid" text UNIQUE NOT NULL,
  "data" text NOT NULL,
  "expires_at" timestamptz NOT NULL
);

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
DROP TABLE "sessions";
`;

module.exports = { up, down };
