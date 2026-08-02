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

// ORDER BY cannot take a bound parameter, so the column and direction are looked
// up here and never interpolated from the request. Sorting names on LOWER() keeps
// mixed case together whatever collation the database was created with, which
// differs between the Testcontainers image and Neon.
const SORT_EXPRESSIONS = { name: "LOWER(full_name)", submitted: "submitted_at" };
const SORT_DIRECTIONS = { ascending: "ASC", descending: "DESC" };
const DEFAULT_SORT = "submitted";
const DEFAULT_DIRECTION = "descending";

// hasOwn, not a bare lookup: ?sort=constructor would otherwise reach SQL as a
// value inherited from Object.prototype.
function fromWhitelist(table, key, fallback) {
  return Object.hasOwn(table, key) ? table[key] : table[fallback];
}

function orderBy(sort, direction) {
  const column = fromWhitelist(SORT_EXPRESSIONS, sort, DEFAULT_SORT);
  const order = fromWhitelist(SORT_DIRECTIONS, direction, DEFAULT_DIRECTION);
  // The primary key breaks every tie, so the order is total. Without it rows
  // sharing a submitted_at can swap between identical queries - invisible today,
  // and "a row on two pages, or none" once LIMIT/OFFSET arrives (CBLT-138).
  return `${column} ${order}, id ASC`;
}

async function list({ name, services, sort, direction } = {}) {
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
    `SELECT * FROM applications${where} ORDER BY ${orderBy(sort, direction)}`,
    params,
  );
  return result.rows;
}

module.exports = { create, get, list };
