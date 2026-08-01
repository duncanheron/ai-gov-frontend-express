const pool = require("../../src/db/pool");

describe("db pool", () => {
  it("round-trips a row through the applications table", async () => {
    await pool.query(
      `INSERT INTO applications (id, full_name, email, date_of_birth, reference, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["application-1", "John Smith", "john@example.com", "1985-06-15", "REF-001", new Date()],
    );

    const result = await pool.query("SELECT * FROM applications WHERE reference = $1", ["REF-001"]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].full_name).toBe("John Smith");
    expect(result.rows[0].email).toBe("john@example.com");
  });

  // This proves the *test database* has real Postgres ILIKE/ESCAPE semantics, not pg-mem's
  // inverted ones - the empirical case for this ticket. It defines its own escaping and query
  // rather than calling src/db/applications.js, so it cannot catch a regression there; CBLT-129
  // owns adding that behavioural coverage against the real helper.
  it("this test database's ILIKE + ESCAPE matches a search term literally, not as a wildcard", async () => {
    await pool.query(
      `INSERT INTO applications (id, full_name, email, date_of_birth, reference, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)`,
      [
        "application-percent",
        "Alice % Percent",
        "alice@example.com",
        "1985-06-15",
        "REF-PERCENT",
        new Date(),
        "application-underscore",
        "Bob_Underscore",
        "bob@example.com",
        "1985-06-15",
        "REF-UNDERSCORE",
        new Date(),
        "application-backslash",
        "Carol \\ Backslash",
        "carol@example.com",
        "1985-06-15",
        "REF-BACKSLASH",
        new Date(),
      ],
    );

    async function searchByName(term) {
      const escaped = term.replace(/[\\%_]/g, (match) => `\\${match}`);
      const result = await pool.query(
        "SELECT reference FROM applications WHERE full_name ILIKE $1 ESCAPE '\\'",
        [`%${escaped}%`],
      );
      return result.rows.map((row) => row.reference);
    }

    await expect(searchByName("%")).resolves.toEqual(["REF-PERCENT"]);
    await expect(searchByName("_")).resolves.toEqual(["REF-UNDERSCORE"]);
    await expect(searchByName("\\")).resolves.toEqual(["REF-BACKSLASH"]);
  });
});
