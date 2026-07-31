const pool = require("../../src/db/pool");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

describe("db pool", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

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

  // Pins real Postgres ILIKE/ESCAPE behaviour: a search term is matched literally, not as a
  // wildcard pattern, once its own %, _ and \ characters are escaped (see CBLT-131).
  it("matches ILIKE + ESCAPE patterns literally, not as wildcards", async () => {
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
