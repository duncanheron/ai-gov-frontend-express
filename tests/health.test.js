const request = require("supertest");
const createApp = require("../src/app");

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
