const { JSDOM } = require("jsdom");
const request = require("supertest");
const applications = require("../src/db/applications");
const { MAX_NAME_LENGTH } = require("../src/lib/applicationsQuery");
const { createApplication } = require("./helpers/applicationFactory");
const { parseTable } = require("./helpers/parseTable");
const { truncateAllTables } = require("./helpers/prepareTestDatabase");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

const hiddenValues = (form, name) =>
  [...form.querySelectorAll(`input[type='hidden'][name='${name}']`)].map((input) =>
    input.getAttribute("value"),
  );

// Reads the parts of the page that are not the table: the search box and filter panel
// (as their rendered attributes, not the raw markup) and the messages inside <main>, so
// a test can tell "no matches" from "no applications yet". `search` and `filter` are
// null when the page renders neither, and `elementCount` supports asserting that a
// search term added no element of its own.
function parseListPage(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const input = document.querySelector(".moj-search input[name='name']");
  const form = input && input.closest("form");
  const clear = document.querySelector(".moj-search a.govuk-link");
  const filter = document.querySelector(".moj-filter");
  const filterForm = filter && filter.closest("form");
  const selected = filter && filter.querySelector(".moj-filter__selected");
  const selectedClear = selected && selected.querySelector("a");

  const parsed = {
    search: input && {
      value: input.getAttribute("value"),
      // A term that breaks out of value="…" adds attributes rather than elements, so
      // this is the only thing that sees it - elementCount below cannot.
      attributeNames: input.getAttributeNames().sort(),
      type: input.getAttribute("type"),
      label: document.querySelector(`label[for="${input.id}"]`).textContent.trim(),
      action: form.getAttribute("action"),
      method: form.getAttribute("method"),
      buttonText: form.querySelector("button").textContent.trim(),
    },
    // What each form would submit on the other's behalf. The filter survives a search,
    // and the search survives a filter, only if these are here.
    searchCarriesServices: form && hiddenValues(form, "service"),
    clearLink: clear && { text: clear.textContent.trim(), href: clear.getAttribute("href") },
    filter: filter && {
      action: filterForm.getAttribute("action"),
      method: filterForm.getAttribute("method"),
      carriesSearch: hiddenValues(filterForm, "name"),
      submitText: filter.querySelector(".moj-filter__options button").textContent.trim(),
      checkboxes: [...filter.querySelectorAll("input[type='checkbox'][name='service']")].map(
        (box) => ({
          value: box.getAttribute("value"),
          label: document.querySelector(`label[for="${box.id}"]`).textContent.trim(),
          checked: box.hasAttribute("checked"),
        }),
      ),
      selectedFilters: selected && {
        clearLink: {
          text: selectedClear.textContent.trim(),
          href: selectedClear.getAttribute("href"),
        },
        tags: [...selected.querySelectorAll(".moj-filter__tag")].map((tag) => ({
          // The component prefixes every tag with visually hidden link text.
          text: tag.textContent.replace("Remove this filter", "").trim(),
          href: tag.getAttribute("href"),
        })),
      },
    },
    // Status messages only - the search box and the filter panel each have paragraphs of
    // their own, and a test distinguishing "no matches" from "no applications yet" must
    // not see them.
    messages: [...document.querySelectorAll("main p")]
      .filter((p) => !p.closest(".moj-search") && !p.closest(".moj-filter"))
      .map((p) => p.textContent.trim()),
    scripts: [...document.querySelectorAll("script")].map((script) => script.textContent),
    scriptSources: [...document.querySelectorAll("script[src]")].map((script) =>
      script.getAttribute("src"),
    ),
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
    const page = parseListPage(response.text);
    expect(page.messages).toEqual([]);
    // Without this the search box could vanish from the page a caseworker lands on,
    // leaving no way to start a search at all, and every other case here still pass.
    expect(page.search).toMatchObject({ value: "" });
  });

  it("renders a reference containing markup as the link's text, not as elements", async () => {
    const reference = 'TEST-<b>bold</b>-"quoted"';
    await createApplication({ fullName: "Grace Hopper", reference });

    const response = await request(getServer()).get("/applications");

    const [[, referenceCell]] = parseTable(response.text).rows;
    expect(referenceCell.text).toBe(reference);
    expect(referenceCell.href).toBe(`/applications/${reference}`);
  });

  it("renders an applicant name containing markup as text, not as elements", async () => {
    const fullName = 'Eve <b>Bold</b> <script>alert(1)</script> "Quoted"';
    await createApplication({ fullName });

    const response = await request(getServer()).get("/applications");

    const [[nameCell]] = parseTable(response.text).rows;
    expect(nameCell.text).toBe(fullName);
    expect(nameCell.childElements).toEqual([]);
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
    const page = parseListPage(response.text);
    expect(page.messages).toEqual([]);
    expect(page.search).toMatchObject({ value: "" });
  });

  it("keeps the trimmed term in a search box that submits back to /applications", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=%20grace%20");

    expect(parseListPage(response.text).search).toEqual({
      value: "grace",
      attributeNames: ["class", "id", "maxlength", "name", "type", "value"],
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

  it.each([
    ["a term that matches", "grace"],
    ["a term that matches nothing", "Nobody"],
  ])("offers a link back to the unfiltered list after %s", async (_description, term) => {
    await seedThreeApplicants();

    const searched = await request(getServer()).get(`/applications?name=${term}`);
    expect(parseListPage(searched.text).clearLink).toEqual({
      text: "Clear search",
      href: "/applications",
    });

    const cleared = await request(getServer()).get(parseListPage(searched.text).clearLink.href);
    expect(cleared.status).toBe(200);
    expect(names(parseTable(cleared.text))).toEqual([
      "Alan Turing",
      "Marianne Grace",
      "Grace Hopper",
    ]);
    expect(parseListPage(cleared.text).clearLink).toBeNull();
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

  it.each([
    ["a double-quoted event handler", '" autofocus onfocus="alert(1)'],
    ["a single-quoted event handler", "' autofocus onfocus='alert(1)"],
    ["a closing quote and a new element", '"><img src=x onerror=alert(1)>'],
  ])("renders %s as the search box's value, adding no attribute of its own", async (_d, term) => {
    await seedThreeApplicants();

    const response = await request(getServer()).get(
      `/applications?name=${encodeURIComponent(term)}`,
    );

    expect(response.status).toBe(200);
    expect(parseListPage(response.text).search).toMatchObject({
      value: term,
      attributeNames: ["class", "id", "maxlength", "name", "type", "value"],
    });
  });

  it("renders a normal page for a term containing a NUL byte, which Postgres text cannot hold", async () => {
    await seedThreeApplicants();

    const response = await request(getServer()).get("/applications?name=%00grace");

    expect(response.status).toBe(200);
    expect(names(parseTable(response.text))).toEqual(["Marianne Grace", "Grace Hopper"]);
  });

  it("caps an over-long term rather than reflecting all of it back", async () => {
    await seedThreeApplicants();
    const term = "a".repeat(MAX_NAME_LENGTH + 300);

    const response = await request(getServer()).get(`/applications?name=${term}`);

    expect(response.status).toBe(200);
    const page = parseListPage(response.text);
    expect(page.search.value).toHaveLength(MAX_NAME_LENGTH);
    expect(page.messages).toEqual([`No applications match “${"a".repeat(MAX_NAME_LENGTH)}”.`]);
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

// One applicant per service, each named after its service, so a filter that quietly
// matched everything reads differently from one that matched the right single row.
const SERVICE_APPLICANTS = [
  ["standard", "Standard Applicant", "General application"],
  ["housing", "Housing Applicant", "Housing"],
  ["housing-benefit-disability", "Benefit Applicant", "Housing Benefit (disability)"],
  ["council-tax", "Council Tax Applicant", "Council tax"],
  ["garden-waste", "Garden Waste Applicant", "Garden waste"],
];

async function seedOnePerService() {
  for (const [index, [flow, fullName]] of SERVICE_APPLICANTS.entries()) {
    await createApplication({
      flow,
      fullName,
      submittedAt: new Date(`2026-01-0${index + 1}T09:00:00.000Z`),
    });
  }
}

describe("applications list page - service filter", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it.each(SERVICE_APPLICANTS)(
    "shows only the %s applications when that service is selected (criteria 1 and 2)",
    async (service, applicantName) => {
      await seedOnePerService();

      const response = await request(getServer()).get(`/applications?service=${service}`);

      expect(response.status).toBe(200);
      expect(names(parseTable(response.text))).toEqual([applicantName]);
    },
  );

  it("shows both selected services and nothing else (criterion 1)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?service=housing&service=council-tax",
    );

    expect(names(parseTable(response.text))).toEqual([
      "Council Tax Applicant",
      "Housing Applicant",
    ]);
  });

  it("offers every service as a checkbox, ticking back the ones that are applied (criterion 4)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?service=housing&service=council-tax",
    );

    expect(parseListPage(response.text).filter.checkboxes).toEqual(
      SERVICE_APPLICANTS.map(([value, , label]) => ({
        value,
        label,
        checked: value === "housing" || value === "council-tax",
      })),
    );
  });

  it("keeps a name search when a filter is applied, and narrows rather than resets (criterion 3)", async () => {
    await seedOnePerService();

    const searched = await request(getServer()).get("/applications?name=applicant");
    // The filter form submits this alongside the boxes, so applying a filter cannot
    // discard the term the caseworker already typed.
    expect(parseListPage(searched.text).filter.carriesSearch).toEqual(["applicant"]);

    const filtered = await request(getServer()).get("/applications?name=applicant&service=housing");
    expect(names(parseTable(filtered.text))).toEqual(["Housing Applicant"]);
    expect(parseListPage(filtered.text).search).toMatchObject({ value: "applicant" });
  });

  it("keeps the selected services when a search is run from a filtered list (criterion 3)", async () => {
    await seedOnePerService();

    const filtered = await request(getServer()).get(
      "/applications?service=housing&service=council-tax",
    );

    expect(parseListPage(filtered.text).searchCarriesServices).toEqual(["housing", "council-tax"]);
  });

  it("shows a removable tag per selected service, keeping the others and the search (criterion 5)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?name=applicant&service=housing&service=council-tax",
    );

    const { tags } = parseListPage(response.text).filter.selectedFilters;
    expect(tags).toEqual([
      { text: "Housing", href: "/applications?name=applicant&service=council-tax" },
      { text: "Council tax", href: "/applications?name=applicant&service=housing" },
    ]);

    const housingRemoved = await request(getServer()).get(tags[0].href);
    expect(housingRemoved.status).toBe(200);
    expect(names(parseTable(housingRemoved.text))).toEqual(["Council Tax Applicant"]);
    expect(parseListPage(housingRemoved.text).search).toMatchObject({ value: "applicant" });
  });

  it("clears the services and the search term through the clear link (criterion 6)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get("/applications?name=applicant&service=housing");
    const { clearLink } = parseListPage(response.text).filter.selectedFilters;
    expect(clearLink).toEqual({ text: "Clear filters", href: "/applications" });

    const cleared = await request(getServer()).get(clearLink.href);
    expect(cleared.status).toBe(200);
    expect(names(parseTable(cleared.text))).toHaveLength(5);
    const page = parseListPage(cleared.text);
    expect(page.filter.selectedFilters).toBeNull();
    expect(page.search).toMatchObject({ value: "" });
  });

  it("clears only the search, keeping the services, through the search's own clear link", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get("/applications?name=applicant&service=housing");
    expect(parseListPage(response.text).clearLink).toEqual({
      text: "Clear search",
      href: "/applications?service=housing",
    });

    const cleared = await request(getServer()).get("/applications?service=housing");
    expect(names(parseTable(cleared.text))).toEqual(["Housing Applicant"]);
  });

  it("shows no selected-filter block, and the full list, with nothing selected (criterion 7)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get("/applications");

    const page = parseListPage(response.text);
    expect(page.filter.selectedFilters).toBeNull();
    expect(page.filter.checkboxes.every((box) => box.checked)).toBe(false);
    expect(page.messages).toEqual([]);
    expect(names(parseTable(response.text))).toHaveLength(5);
  });

  it("shows no filter panel at all when there is nothing to filter", async () => {
    const response = await request(getServer()).get("/applications");

    expect(parseListPage(response.text).filter).toBeNull();
  });

  it.each([
    ["a service that does not exist", "?service=not-a-service"],
    ["an empty service", "?service="],
    ["a service given as a nested parameter", "?service[flow]=housing"],
  ])("shows the full list, not an error, for %s (criterion 8)", async (_description, query) => {
    await seedOnePerService();

    const response = await request(getServer()).get(`/applications${query}`);

    expect(response.status).toBe(200);
    expect(names(parseTable(response.text))).toHaveLength(5);
    expect(parseListPage(response.text).filter.selectedFilters).toBeNull();
  });

  it("keeps the real service and drops the invented one from a hand-edited URL (criterion 8)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?service=housing&service=not-a-service",
    );

    expect(names(parseTable(response.text))).toEqual(["Housing Applicant"]);
    expect(parseListPage(response.text).filter.selectedFilters.tags).toEqual([
      { text: "Housing", href: "/applications" },
    ]);
  });

  it("treats a service repeated in a hand-edited URL as selected once", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?service=housing&service=housing",
    );

    expect(names(parseTable(response.text))).toEqual(["Housing Applicant"]);
    expect(parseListPage(response.text).filter.selectedFilters.tags).toEqual([
      { text: "Housing", href: "/applications" },
    ]);
  });

  it("keeps the panel on screen, and names the filter, when nothing matches", async () => {
    await createApplication({ fullName: "Housing Applicant", flow: "housing" });

    const response = await request(getServer()).get("/applications?service=garden-waste");

    expect(response.status).toBe(200);
    expect(parseTable(response.text)).toBeNull();
    const page = parseListPage(response.text);
    expect(page.messages).toEqual(["No applications in Garden waste."]);
    // Without the panel the caseworker would have no way back out of the filter.
    expect(page.filter.selectedFilters.tags).toHaveLength(1);
  });

  it("names both the search term and the services in the caption, so it never claims to list everything", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get(
      "/applications?name=applicant&service=housing&service=council-tax",
    );

    expect(parseTable(response.text).caption).toBe(
      "Applications matching “applicant” in Housing and Council tax",
    );
  });

  it("drives the whole panel through plain GET requests, adding no script of its own (criterion 9)", async () => {
    await seedOnePerService();

    const response = await request(getServer()).get("/applications?service=housing");

    const page = parseListPage(response.text);
    expect(page.filter).toMatchObject({
      action: "/applications",
      method: "get",
      submitText: "Apply filters",
    });
    // MoJ's filter component ships JavaScript that collapses the panel (CBLT-139). Until
    // that lands the panel must need none, so nothing here may depend on a script.
    expect(page.scriptSources).toEqual(["/javascripts/govuk-frontend.min.js"]);
  });
});
