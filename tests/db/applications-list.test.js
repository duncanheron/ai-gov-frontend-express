const applications = require("../../src/db/applications");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

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
