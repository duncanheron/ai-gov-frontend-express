const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const response = await request(getServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
