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
}) {
  const id = crypto.randomUUID();

  await pool.query(
    `INSERT INTO applications (id, full_name, email, date_of_birth, reference, submitted_at, preferences, flow, flow_answer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, fullName, email, dateOfBirth, reference, submittedAt, preferences, flow, flowAnswer],
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
  };
}

async function get(reference) {
  const result = await pool.query("SELECT * FROM applications WHERE reference = $1", [reference]);
  return result.rows[0] || null;
}

async function list() {
  const result = await pool.query("SELECT * FROM applications ORDER BY submitted_at DESC");
  return result.rows;
}

module.exports = { create, get, list };
