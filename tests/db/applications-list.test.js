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

describe("applications data module - list({ services })", () => {
  const FLOWS = [
    "standard",
    "housing",
    "housing-benefit-disability",
    "council-tax",
    "garden-waste",
  ];

  // One application per flow, so a filter that quietly matched everything and one that
  // matched the right single row are distinguishable for every service.
  async function seedOnePerService() {
    const seeded = {};
    for (const [index, flow] of FLOWS.entries()) {
      seeded[flow] = await createApplication({
        flow,
        fullName: `Applicant ${flow}`,
        submittedAt: new Date(`2026-01-0${index + 1}T09:00:00.000Z`),
      });
    }
    return seeded;
  }

  const references = (found) => found.map((application) => application.reference);

  it.each(FLOWS)(
    "returns only the applications whose flow is %s (criteria 1 and 2)",
    async (flow) => {
      const seeded = await seedOnePerService();

      const found = await applications.list({ services: [flow] });

      expect(references(found)).toEqual([seeded[flow].reference]);
    },
  );

  it("returns both selected services and nothing else, newest first (criterion 1)", async () => {
    const seeded = await seedOnePerService();

    const found = await applications.list({ services: ["housing", "council-tax"] });

    expect(references(found)).toEqual([seeded["council-tax"].reference, seeded.housing.reference]);
  });

  it.each([[[]], [undefined]])("treats %j as no service filter", async (services) => {
    await seedOnePerService();

    const found = await applications.list({ services });

    expect(found).toHaveLength(5);
  });

  it("narrows by name and service together rather than either alone (criterion 3)", async () => {
    const wanted = await createApplication({ fullName: "Grace Hopper", flow: "housing" });
    await createApplication({ fullName: "Grace Hopper", flow: "council-tax" });
    await createApplication({ fullName: "Alan Turing", flow: "housing" });

    const found = await applications.list({ name: "grace", services: ["housing"] });

    expect(references(found)).toEqual([wanted.reference]);
  });

  it("matches nothing for a service value no application holds", async () => {
    await seedOnePerService();

    const found = await applications.list({ services: ["not-a-service"] });

    expect(found).toEqual([]);
  });

  it("binds the service list as a parameter rather than splicing it into the query", async () => {
    await seedOnePerService();

    const found = await applications.list({
      services: ["housing') OR true --", "x'); DROP TABLE applications; --"],
    });
    expect(found).toEqual([]);

    expect(await applications.list()).toHaveLength(5);
  });
});

describe("applications data module - list({ sort, direction })", () => {
  const names = (found) => found.map((application) => application.full_name);

  // Case is what makes this worth seeding: ordering on the raw column puts every
  // capital before every lower-case letter, so "alice" would land after "Zoe".
  async function seedMixedCaseNames() {
    await createApplication({
      fullName: "Zoe Zhang",
      submittedAt: new Date("2026-01-01T09:00:00.000Z"),
    });
    await createApplication({
      fullName: "alice Adams",
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
    await createApplication({
      fullName: "Alan Turing",
      submittedAt: new Date("2026-01-03T09:00:00.000Z"),
    });
  }

  it("orders names A-Z, keeping mixed case together (criterion 3)", async () => {
    await seedMixedCaseNames();

    const found = await applications.list({ sort: "name", direction: "ascending" });

    expect(names(found)).toEqual(["Alan Turing", "alice Adams", "Zoe Zhang"]);
  });

  it("orders names Z-A, keeping mixed case together (criteria 1 and 3)", async () => {
    await seedMixedCaseNames();

    const found = await applications.list({ sort: "name", direction: "descending" });

    expect(names(found)).toEqual(["Zoe Zhang", "alice Adams", "Alan Turing"]);
  });

  it("orders by date submitted, oldest or newest first (criterion 2)", async () => {
    await seedMixedCaseNames();

    const oldest = await applications.list({ sort: "submitted", direction: "ascending" });
    const newest = await applications.list({ sort: "submitted", direction: "descending" });

    expect(names(oldest)).toEqual(["Zoe Zhang", "alice Adams", "Alan Turing"]);
    expect(names(newest)).toEqual(["Alan Turing", "alice Adams", "Zoe Zhang"]);
  });

  it("defaults to newest submitted first when no order is asked for (criterion 8)", async () => {
    await seedMixedCaseNames();

    expect(names(await applications.list())).toEqual(["Alan Turing", "alice Adams", "Zoe Zhang"]);
  });

  it.each([
    ["a column that does not exist", { sort: "not-a-column" }],
    ["a real column that is not offered", { sort: "email" }],
    ["a key inherited from Object.prototype", { sort: "constructor" }],
    ["a raw SQL fragment", { sort: "full_name; DROP TABLE applications" }],
    ["a direction that is not one", { sort: "name", direction: "sideways" }],
  ])("falls back to a working order for %s (criterion 7)", async (_description, order) => {
    await seedMixedCaseNames();

    const found = await applications.list(order);

    expect(found).toHaveLength(3);
    expect(await applications.list()).toHaveLength(3);
  });

  // The `, id ASC` tiebreaker in every ORDER BY is deliberately not asserted here.
  // Its symptom - a row on two pages or none - only appears under LIMIT/OFFSET, and
  // predicting the tied order needs JS to agree with the database's text collation,
  // which is exactly the locale dependency the LOWER() above exists to avoid.
  // CBLT-138 owns the test, as its ticket says.

  it("sorts within a search and a service filter rather than replacing them", async () => {
    await createApplication({ fullName: "Grace Zhang", flow: "housing" });
    await createApplication({ fullName: "grace Adams", flow: "housing" });
    await createApplication({ fullName: "Grace Baker", flow: "council-tax" });
    await createApplication({ fullName: "Alan Turing", flow: "housing" });

    const found = await applications.list({
      name: "grace",
      services: ["housing"],
      sort: "name",
      direction: "ascending",
    });

    expect(names(found)).toEqual(["grace Adams", "Grace Zhang"]);
  });
});
