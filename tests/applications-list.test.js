const { JSDOM } = require("jsdom");
const request = require("supertest");
const applications = require("../src/db/applications");
const { createApplication } = require("./helpers/applicationFactory");
const { parseTable } = require("./helpers/parseTable");
const { truncateAllTables } = require("./helpers/prepareTestDatabase");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

// Reads the parts of the page that are not the table: the search box (as its
// rendered attributes, not the raw markup) and the messages inside <main>, so a
// test can tell "no matches" from "no applications yet". `search` is null when the
// page renders no search box, and `elementCount` supports asserting that a search
// term added no element of its own.
function parseListPage(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const input = document.querySelector(".moj-search input[name='name']");
  const form = input && input.closest("form");

  const parsed = {
    search: input && {
      value: input.getAttribute("value"),
      type: input.getAttribute("type"),
      label: document.querySelector(`label[for="${input.id}"]`).textContent.trim(),
      action: form.getAttribute("action"),
      method: form.getAttribute("method"),
      buttonText: form.querySelector("button").textContent.trim(),
    },
    messages: [...document.querySelectorAll("main p")].map((p) => p.textContent.trim()),
    scripts: [...document.querySelectorAll("script")].map((script) => script.textContent),
    elementCount: document.querySelectorAll("*").length,
  };

  dom.window.close();
  return parsed;
}

const names = (table) => table.rows.map(([fullName]) => fullName.text);

// Three applicants: "grace" matches two of them and not the third, so a filtered
// result is distinguishable from both the full list and an empty one.
async function seedThreeApplicants() {
  const hopper = await createApplication({
    fullName: "Grace Hopper",
    submittedAt: new Date("2026-01-01T09:00:00.000Z"),
  });
  const marianne = await createApplication({
    fullName: "Marianne Grace",
    submittedAt: new Date("2026-01-02T09:00:00.000Z"),
  });
  const turing = await createApplication({
    fullName: "Alan Turing",
    submittedAt: new Date("2026-01-03T09:00:00.000Z"),
  });

  return { hopper, marianne, turing };
}

describe("applications list page", () => {
  // beforeEach, not beforeAll: one test asserts the empty state and the others seed rows -
  // under --randomize any can run first, so each needs its own clean table. The schema
  // itself is guaranteed by tests/setup/prepareDatabaseBeforeAll.js, so only truncation is
  // needed here.
  beforeEach(async () => {
    await truncateAllTables();
  });

  it("shows an empty state, and no search box, when there are no applications", async () => {
    const response = await request(getServer()).get("/applications");

    expect(response.status).toBe(200);
    expect(parseTable(response.text)).toBeNull();
    expect(parseListPage(response.text)).toMatchObject({
      search: null,
      messages: ["There are no applications yet."],
    });
  });

  it("lists applications newest first, linking each reference to its detail page", async () => {
    const { hopper, marianne, turing } = await seedThreeApplicants();

    const response = await request(getServer()).get("/applications");

    expect(response.status).toBe(200);
    const table = parseTable(response.text);
    expect(names(table)).toEqual(["Alan Turing", "Marianne Grace", "Grace Hopper"]);
    expect(table.rows.map(([, reference]) => reference.href)).toEqual([
      `/applications/${turing.reference}`,
      `/applications/${marianne.reference}`,
      `/applications/${hopper.reference}`,
    ]);
    expect(table.caption).toBe("All applications");
    expect(parseListPage(response.text).messages).toEqual([]);
  });

  it("renders a reference containing markup as the link's text, not as elements", async () => {
    const reference = 'TEST-<b>bold</b>-"quoted"';
    await createApplication({ fullName: "Grace Hopper", reference });

    const response = await request(getServer()).get("/applications");

    const [[, referenceCell]] = parseTable(response.text).rows;
    expect(referenceCell.text).toBe(reference);
    expect(referenceCell.href).toBe(`/applications/${reference}`);
  });

  it("shows only the applicants whose name matches the search term, newest first", async () => {
    const { hopper, marianne } = await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=grace");

    expect(response.status).toBe(200);
    const table = parseTable(response.text);
    expect(names(table)).toEqual(["Marianne Grace", "Grace Hopper"]);
    expect(table.rows.map(([, reference]) => reference.href)).toEqual([
      `/applications/${marianne.reference}`,
      `/applications/${hopper.reference}`,
    ]);
  });

  it("describes the search in the table's caption, so it does not claim to list everything", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=grace");

    expect(parseTable(response.text).caption).toBe("Applications matching “grace”");
  });

  it("shows a no-matches message, and no table, for a term nobody matches", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=Nobody");

    expect(response.status).toBe(200);
    expect(parseTable(response.text)).toBeNull();
    expect(parseListPage(response.text).messages).toEqual(["No applications match “Nobody”."]);
  });

  it.each([
    ["an empty term", "?name="],
    ["a whitespace-only term", "?name=%20%20"],
  ])("shows the full list with no message for %s", async (_description, queryString) => {
    await seedThreeApplicants();

    const response = await request(getServer()).get(`/applications${queryString}`);

    expect(response.status).toBe(200);
    expect(names(parseTable(response.text))).toEqual([
      "Alan Turing",
      "Marianne Grace",
      "Grace Hopper",
    ]);
    expect(parseListPage(response.text).messages).toEqual([]);
  });

  it("keeps the trimmed term in a search box that submits back to /applications", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=%20grace%20");

    expect(parseListPage(response.text).search).toEqual({
      value: "grace",
      type: "search",
      label: "Search by applicant name",
      action: "/applications",
      method: "get",
      buttonText: "Search",
    });
    expect(names(parseTable(response.text))).toEqual(["Marianne Grace", "Grace Hopper"]);
  });

  it("keeps the search box on screen when the term matches nothing, so it can be changed", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=Nobody");

    expect(parseListPage(response.text).search).toMatchObject({ value: "Nobody" });
  });

  it("takes the first value when the term is repeated in a hand-edited URL", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=grace&name=turing");

    expect(response.status).toBe(200);
    expect(names(parseTable(response.text))).toEqual(["Marianne Grace", "Grace Hopper"]);
  });

  it("matches a percent sign literally rather than as a wildcard", async () => {
    await createApplication({ fullName: "Grace 100% Hopper" });
    await createApplication({ fullName: "Grace 100X Hopper" });
    await createApplication({ fullName: "Alan Turing" });

    const response = await request(getServer()).get("/applications?name=100%25");

    expect(names(parseTable(response.text))).toEqual(["Grace 100% Hopper"]);
  });

  it("renders a term containing a script element as text, adding no element to the page", async () => {
    await seedThreeApplicants();
    const term = "<script>alert(1)</script>";

    const injected = await request(getServer()).get(
      `/applications?name=${encodeURIComponent(term)}`,
    );
    const benign = await request(getServer()).get("/applications?name=Nobody");

    expect(injected.status).toBe(200);
    const page = parseListPage(injected.text);
    expect(page.messages).toEqual([`No applications match “${term}”.`]);
    expect(page.search.value).toBe(term);
    expect(page.scripts.some((script) => script.includes("alert(1)"))).toBe(false);
    expect(page.elementCount).toBe(parseListPage(benign.text).elementCount);
  });

  it("renders a normal page for a term that tries to destroy the table, leaving every row intact", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get(
      `/applications?name=${encodeURIComponent("x'); DROP TABLE applications; --")}`,
    );

    expect(response.status).toBe(200);
    expect(parseTable(response.text)).toBeNull();
    expect(await applications.list()).toHaveLength(3);
  });
});
