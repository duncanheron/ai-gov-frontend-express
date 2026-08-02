const crypto = require("node:crypto");
const pool = require("./pool");

async function create({
  fullName,
  email,
  dateOfBirth,
  reference,
  submittedAt,
  preferences = [],
  flow = "standard",
  flowAnswer = null,
  favouriteAnimal = null,
}) {
  const id = crypto.randomUUID();

  await pool.query(
    `INSERT INTO applications (id, full_name, email, date_of_birth, reference, submitted_at, preferences, flow, flow_answer, favourite_animal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      fullName,
      email,
      dateOfBirth,
      reference,
      submittedAt,
      preferences,
      flow,
      flowAnswer,
      favouriteAnimal,
    ],
  );

  return {
    id,
    fullName,
    email,
    dateOfBirth,
    reference,
    submittedAt,
    preferences,
    flow,
    flowAnswer,
    favouriteAnimal,
  };
}

async function get(reference) {
  const result = await pool.query("SELECT * FROM applications WHERE reference = $1", [reference]);
  return result.rows[0] || null;
}

const LIKE_WILDCARDS = { "\\": "\\\\", "%": "\\%", _: "\\_" };

// Escapes \, % and _ so a name matches literally rather than as a LIKE/ILIKE wildcard.
function escapeLikeWildcards(value) {
  return value.replace(/[\\%_]/g, (character) => LIKE_WILDCARDS[character]);
}

async function list({ name, services } = {}) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const conditions = [];
  const params = [];

  if (trimmedName) {
    params.push(`%${escapeLikeWildcards(trimmedName)}%`);
    conditions.push(`full_name ILIKE $${params.length} ESCAPE '\\'`);
  }

  // = ANY($n) takes the whole selection as one bound array parameter, so a service value
  // is never spliced into an IN list. No services selected means no service filter.
  if (Array.isArray(services) && services.length > 0) {
    params.push(services);
    conditions.push(`flow = ANY($${params.length})`);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM applications${where} ORDER BY submitted_at DESC`,
    params,
  );
  return result.rows;
}

module.exports = { create, get, list };
