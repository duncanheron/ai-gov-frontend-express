const registrations = require("../../src/db/registrations");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

describe("registrations data module - list", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("returns an empty list when there are no registrations", async () => {
    const found = await registrations.list();

    expect(found).toEqual([]);
  });

  it("lists registrations ordered by submitted date, newest first", async () => {
    const earlier = new Date("2026-01-01T09:00:00.000Z");
    const later = new Date("2026-01-02T09:00:00.000Z");

    await registrations.create({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-EARLIER",
      submittedAt: earlier,
    });
    await registrations.create({
      fullName: "Alan Turing",
      email: "alan@example.com",
      dateOfBirth: "1912-06-23",
      reference: "TEST-LATER",
      submittedAt: later,
    });

    const found = await registrations.list();

    expect(found.map((registration) => registration.reference)).toEqual(["TEST-LATER", "TEST-EARLIER"]);
  });
});
