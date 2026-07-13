const request = require("supertest");
const createApp = require("../src/app");
const applications = require("../src/db/applications");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

describe("application detail page", () => {
  beforeAll(async () => {
    await prepareTestDatabase();

    await applications.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      dateOfBirth: "1985-03-27",
      reference: "TEST-DETAIL",
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
  });

  it("shows full application details for a known reference", async () => {
    const app = createApp();

    const response = await request(app).get("/applications/TEST-DETAIL");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Ada Lovelace");
    expect(response.text).toContain("ada@example.com");
    expect(response.text).toContain("27/03/1985");
    expect(response.text).toContain("TEST-DETAIL");
    expect(response.text).toContain("02/01/2026");
  });

  it("returns a 404 for an unknown reference", async () => {
    const app = createApp();

    const response = await request(app).get("/applications/DOES-NOT-EXIST");

    expect(response.status).toBe(404);
  });
});
