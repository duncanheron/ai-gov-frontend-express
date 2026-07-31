const request = require("supertest");
const { JSDOM } = require("jsdom");
const applications = require("../src/db/applications");
const { prepareTestDatabase } = require("./helpers/prepareTestDatabase");
const { useSharedServer } = require("./helpers/testServer");
const { parseTable, countTables } = require("./helpers/table");

const getServer = useSharedServer();

describe("applications list page", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("shows an empty state when there are no applications", async () => {
    const response = await request(getServer()).get("/applications");

    expect(response.status).toBe(200);

    const dom = new JSDOM(response.text);
    const paragraph = dom.window.document.querySelector("main .govuk-body");
    dom.window.close();

    expect(paragraph.textContent.trim()).toBe("There are no applications yet.");
    expect(countTables(response.text)).toBe(0);
  });

  it("lists applications newest first, linking each reference to its detail page", async () => {
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

    const response = await request(getServer()).get("/applications");

    expect(response.status).toBe(200);

    const table = parseTable(response.text);
    expect(table.head).toEqual([
      { text: "Full name", html: "Full name", href: null },
      { text: "Reference", html: "Reference", href: null },
      { text: "Submitted", html: "Submitted", href: null },
    ]);
    expect(table.rows).toEqual([
      [
        { text: "Alan Turing", html: "Alan Turing", href: null },
        {
          text: "TEST-LATER",
          html: '<a class="govuk-link" href="/applications/TEST-LATER">TEST-LATER</a>',
          href: "/applications/TEST-LATER",
        },
        { text: "02/01/2026", html: "02/01/2026", href: null },
      ],
      [
        { text: "Grace Hopper", html: "Grace Hopper", href: null },
        {
          text: "TEST-EARLIER",
          html: '<a class="govuk-link" href="/applications/TEST-EARLIER">TEST-EARLIER</a>',
          href: "/applications/TEST-EARLIER",
        },
        { text: "01/01/2026", html: "01/01/2026", href: null },
      ],
    ]);
  });
});
