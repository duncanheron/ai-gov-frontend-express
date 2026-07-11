const pool = require("../../src/db/pool");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

describe("db pool (pg-mem test double)", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("round-trips a row through the registrations table", async () => {
    await pool.query(
      `INSERT INTO registrations (id, full_name, email, date_of_birth, reference, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["registration-1", "John Smith", "john@example.com", "1985-06-15", "REF-001", new Date()],
    );

    const result = await pool.query("SELECT * FROM registrations WHERE reference = $1", [
      "REF-001",
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].full_name).toBe("John Smith");
    expect(result.rows[0].email).toBe("john@example.com");
  });
});
