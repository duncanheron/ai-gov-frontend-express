const request = require("supertest");
const createApp = require("../src/app");
const registrations = require("../src/db/registrations");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");

describe("registrations list page", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("shows an empty state when there are no registrations", async () => {
    const app = createApp();

    const response = await request(app).get("/registrations");

    expect(response.status).toBe(200);
    expect(response.text).toContain("There are no registrations yet.");
  });

  it("lists registrations newest first, linking each reference to its detail page", async () => {
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

    const app = createApp();
    const response = await request(app).get("/registrations");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Grace Hopper");
    expect(response.text).toContain("Alan Turing");
    expect(response.text).toContain('href="/registrations/TEST-LATER"');
    expect(response.text).toContain('href="/registrations/TEST-EARLIER"');

    const laterIndex = response.text.indexOf("TEST-LATER");
    const earlierIndex = response.text.indexOf("TEST-EARLIER");
    expect(laterIndex).toBeGreaterThan(-1);
    expect(laterIndex).toBeLessThan(earlierIndex);
  });
});
