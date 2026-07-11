const registrations = require("../../src/db/registrations");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");

describe("registrations data module", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("creates a registration then fetches it back by reference", async () => {
    const submittedAt = new Date();

    const created = await registrations.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      dateOfBirth: "1985-03-27",
      reference: "TEST-001",
      submittedAt,
    });

    expect(created.reference).toBe("TEST-001");

    const found = await registrations.get("TEST-001");

    expect(found).not.toBeNull();
    expect(found.full_name).toBe("Ada Lovelace");
    expect(found.email).toBe("ada@example.com");
    expect(found.reference).toBe("TEST-001");
  });

  it("returns null for an unknown reference", async () => {
    const found = await registrations.get("DOES-NOT-EXIST");

    expect(found).toBeNull();
  });
});
