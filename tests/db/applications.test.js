const applications = require("../../src/db/applications");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

describe("applications data module", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("creates an application then fetches it back by reference", async () => {
    const submittedAt = new Date();

    const created = await applications.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      dateOfBirth: "1985-03-27",
      reference: "TEST-001",
      submittedAt,
    });

    expect(created.reference).toBe("TEST-001");

    const found = await applications.get("TEST-001");

    expect(found).not.toBeNull();
    expect(found.full_name).toBe("Ada Lovelace");
    expect(found.email).toBe("ada@example.com");
    expect(found.reference).toBe("TEST-001");
  });

  it("returns null for an unknown reference", async () => {
    const found = await applications.get("DOES-NOT-EXIST");

    expect(found).toBeNull();
  });

  it("creates an application with preferences and reads them back", async () => {
    await applications.create({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-PREFS",
      submittedAt: new Date(),
      preferences: ["food", "animals"],
    });

    const found = await applications.get("TEST-PREFS");

    expect(found.preferences).toEqual(["food", "animals"]);
  });

  it("defaults preferences to an empty array when not provided", async () => {
    await applications.create({
      fullName: "Alan Turing",
      email: "alan@example.com",
      dateOfBirth: "1912-06-23",
      reference: "TEST-NO-PREFS",
      submittedAt: new Date(),
    });

    const found = await applications.get("TEST-NO-PREFS");

    expect(found.preferences).toEqual([]);
  });
});
