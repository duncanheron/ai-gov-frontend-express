const applications = require("../../src/db/applications");
const { truncateAllTables } = require("../helpers/prepareTestDatabase");
const { createApplication } = require("../helpers/applicationFactory");

// beforeEach, not beforeAll: every test below seeds its own rows, and under --randomize any of
// them can run first - each needs its own clean table.
beforeEach(async () => {
  await truncateAllTables();
});

describe("applications data module - list", () => {
  it("returns an empty list when there are no applications", async () => {
    const found = await applications.list();

    expect(found).toEqual([]);
  });

  it("lists applications ordered by submitted date, newest first", async () => {
    const earlier = await createApplication({
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    const later = await createApplication({
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });

    const found = await applications.list();

    expect(found.map((application) => application.reference)).toEqual([
      later.reference,
      earlier.reference,
    ]);
  });
});

describe("applications data module - list({ name })", () => {
  it("returns every row, newest first, with no filter (criterion 1)", async () => {
    const earlier = await createApplication({
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    const later = await createApplication({
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
    const expected = [later.reference, earlier.reference];

    const unfiltered = await applications.list();
    const withEmptyObject = await applications.list({});

    expect(unfiltered.map((application) => application.reference)).toEqual(expected);
    expect(withEmptyObject.map((application) => application.reference)).toEqual(expected);
  });

  it("matches full_name as a case-insensitive, mid-string substring, newest first (criteria 2 and 8)", async () => {
    const earliest = await createApplication({
      fullName: "Grace Hopper",
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    const middle = await createApplication({
      fullName: "Marianne Grace",
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
    const latest = await createApplication({
      fullName: "GRACE Percent",
      submittedAt: new Date("2026-01-03T09:00:00.000Z"),
    });
    await createApplication({ fullName: "Alan Turing" });

    const found = await applications.list({ name: "RACE" });

    expect(found.map((application) => application.reference)).toEqual([
      latest.reference,
      middle.reference,
      earliest.reference,
    ]);
  });

  it("matches a substring shared by some names but not others", async () => {
    const anne = await createApplication({
      fullName: "Anne Kowalski",
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    const marianne = await createApplication({
      fullName: "Marianne Grace",
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
    await createApplication({ fullName: "Alan Turing" });

    const found = await applications.list({ name: "ann" });

    expect(found.map((application) => application.reference)).toEqual([
      marianne.reference,
      anne.reference,
    ]);
  });

  it("binds the name as a query placeholder rather than interpolating it, and leaves the table intact (criterion 3)", async () => {
    await createApplication({ fullName: "Grace Hopper" });
    await createApplication({ fullName: "Alan Turing" });

    const found = await applications.list({
      name: "x'); DROP TABLE applications; --",
    });
    expect(found).toEqual([]);

    const stillThere = await applications.list();
    expect(stillThere).toHaveLength(2);
  });

  it("matches % literally rather than as a wildcard (criterion 4)", async () => {
    const percent = await createApplication({ fullName: "Grace 100% Hopper" });
    await createApplication({ fullName: "Grace 100X Hopper" });

    const found = await applications.list({ name: "100%" });

    expect(found.map((application) => application.reference)).toEqual([percent.reference]);
  });

  it("matches _ literally rather than as a wildcard (criterion 4)", async () => {
    const underscore = await createApplication({ fullName: "Ann_Bell" });
    await createApplication({ fullName: "AnnXBell" });

    const found = await applications.list({ name: "ann_bell" });

    expect(found.map((application) => application.reference)).toEqual([underscore.reference]);
  });

  it("matches a name containing a literal backslash (criterion 5)", async () => {
    const backslash = await createApplication({ fullName: "Back\\Slash Hopper" });
    await createApplication({ fullName: "Alan Turing" });

    const found = await applications.list({ name: "Back\\Slash" });

    expect(found.map((application) => application.reference)).toEqual([backslash.reference]);
  });

  it.each([[""], ["   "], [undefined]])("treats %j as no filter (criterion 6)", async (name) => {
    const earlier = await createApplication({
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    const later = await createApplication({
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });

    const found = await applications.list({ name });

    expect(found.map((application) => application.reference)).toEqual([
      later.reference,
      earlier.reference,
    ]);
  });
});
