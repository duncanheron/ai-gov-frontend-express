const { JSDOM } = require("jsdom");
const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

describe("homepage heading", () => {
  it("addresses the user in the h1 and the page title", async () => {
    const response = await request(getServer()).get("/");
    expect(response.status).toBe(200);

    const { document } = new JSDOM(response.text).window;

    expect(document.querySelector("h1").textContent.trim()).toBe("Choose your service");
    // The layout appends the service name and " - GOV.UK", so only the leading
    // segment is this page's own title.
    expect(document.title.split(" - ")[0]).toBe("Choose your service");
  });
});
