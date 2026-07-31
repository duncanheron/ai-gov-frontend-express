const applications = require("../../src/db/applications");
const pool = require("../../src/db/pool");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

// Captures the (sql, params) of the next pool.query call without a mocking
// library, so lint doesn't need a "jest" global this repo hasn't declared.
async function captureQuery(run) {
  const originalQuery = pool.query.bind(pool);
  let lastCall;
  pool.query = (sql, params) => {
    lastCall = [sql, params];
    return originalQuery(sql, params);
  };

  try {
    await run();
    return lastCall;
  } finally {
    pool.query = originalQuery;
  }
}

describe("applications data module - list", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("returns an empty list when there are no applications", async () => {
    const found = await applications.list();

    expect(found).toEqual([]);
  });

  it("lists applications ordered by submitted date, newest first", async () => {
    const earlier = new Date("2026-01-01T09:00:00.000Z");
    const later = new Date("2026-01-02T09:00:00.000Z");

    await applications.create({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-EARLIER",
      submittedAt: earlier,
    });
    await applications.create({
      fullName: "Alan Turing",
      email: "alan@example.com",
      dateOfBirth: "1912-06-23",
      reference: "TEST-LATER",
      submittedAt: later,
    });

    const found = await applications.list();

    expect(found.map((application) => application.reference)).toEqual([
      "TEST-LATER",
      "TEST-EARLIER",
    ]);
  });
});

// Builds on the two rows created above ("Grace Hopper" / TEST-EARLIER and
// "Alan Turing" / TEST-LATER) rather than re-seeding, since prepareTestDatabase()
// can only run once per file (it creates tables with no IF NOT EXISTS guard).
describe("applications data module - list({ name })", () => {
  beforeAll(async () => {
    await applications.create({
      fullName: "Anne Kowalski",
      email: "anne.kowalski@example.com",
      dateOfBirth: "1935-05-01",
      reference: "TEST-ANNE",
      submittedAt: new Date("2026-01-03T09:00:00.000Z"),
    });
    await applications.create({
      fullName: "Marianne Grace",
      email: "marianne.grace@example.com",
      dateOfBirth: "1940-02-14",
      reference: "TEST-MARIANNE",
      submittedAt: new Date("2026-01-04T09:00:00.000Z"),
    });
    // Genuinely contains a literal percent sign, for criterion 4.
    await applications.create({
      fullName: "Grace 100% Hopper",
      email: "grace.100@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-PERCENT",
      submittedAt: new Date("2026-01-05T09:00:00.000Z"),
    });
  });

  it("returns every row, newest first, with no filter (criterion 1)", async () => {
    const unfiltered = await applications.list();
    const withEmptyObject = await applications.list({});

    const references = unfiltered.map((application) => application.reference);

    expect(references).toEqual([
      "TEST-PERCENT",
      "TEST-MARIANNE",
      "TEST-ANNE",
      "TEST-LATER",
      "TEST-EARLIER",
    ]);
    expect(withEmptyObject.map((application) => application.reference)).toEqual(references);
  });

  it("matches full_name as a case-insensitive, mid-string substring, newest first (criteria 2 and 8)", async () => {
    const found = await applications.list({ name: "RACE" });

    expect(found.map((application) => application.reference)).toEqual([
      "TEST-PERCENT",
      "TEST-MARIANNE",
      "TEST-EARLIER",
    ]);
  });

  it("matches a substring shared by some names but not others", async () => {
    const found = await applications.list({ name: "ann" });

    expect(found.map((application) => application.reference)).toEqual([
      "TEST-MARIANNE",
      "TEST-ANNE",
    ]);
  });

  it("binds the name as a query placeholder rather than interpolating it, and leaves the table intact (criterion 3)", async () => {
    const found = await applications.list({
      name: "x'); DROP TABLE applications; --",
    });

    expect(found).toEqual([]);

    const stillThere = await applications.list();
    expect(stillThere).toHaveLength(5);
  });

  // pg-mem cannot parse an ESCAPE clause, and its ILIKE matcher doesn't apply
  // any escape semantics either way (confirmed against pg-mem 3.0.14 directly),
  // so criteria 4 and 5 are proven by inspecting the bound parameter rather
  // than by asserting on matched rows. See the comment above escapeLikeWildcards.
  it("escapes % before binding, so it cannot act as a wildcard (criterion 4)", async () => {
    const [sql, params] = await captureQuery(() => applications.list({ name: "%" }));

    expect(sql).toMatch(/\$1/);
    expect(params).toEqual(["%\\%%"]);
  });

  it("escapes _ before binding, so it cannot act as a wildcard (criterion 4)", async () => {
    const [, params] = await captureQuery(() => applications.list({ name: "a_b" }));

    expect(params).toEqual(["%a\\_b%"]);
  });

  it("escapes a literal backslash before escaping wildcards, so it cannot corrupt the pattern (criterion 5)", async () => {
    const [, params] = await captureQuery(() => applications.list({ name: "back\\slash" }));

    expect(params).toEqual(["%back\\\\slash%"]);
  });

  it.each([[""], ["   "], [undefined]])("treats %j as no filter (criterion 6)", async (name) => {
    const found = await applications.list({ name });
    const unfiltered = await applications.list();

    expect(found.map((application) => application.reference)).toEqual(
      unfiltered.map((application) => application.reference),
    );
  });

  it("does not parameterise or interpolate ORDER BY (criterion 7)", async () => {
    const [sql] = await captureQuery(() => applications.list({ name: "grace" }));

    expect(sql).toContain("ORDER BY submitted_at DESC");
  });
});

describe("escapeLikeWildcards", () => {
  it("leaves ordinary characters untouched", () => {
    expect(applications.escapeLikeWildcards("grace")).toBe("grace");
  });

  it("escapes % so it is matched literally", () => {
    expect(applications.escapeLikeWildcards("100%")).toBe("100\\%");
  });

  it("escapes _ so it is matched literally", () => {
    expect(applications.escapeLikeWildcards("a_b")).toBe("a\\_b");
  });

  it("escapes a literal backslash before escaping wildcards, so it cannot corrupt the pattern", () => {
    expect(applications.escapeLikeWildcards("back\\slash")).toBe("back\\\\slash");
    expect(applications.escapeLikeWildcards("\\%")).toBe("\\\\\\%");
  });
});
