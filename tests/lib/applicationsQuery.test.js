const { URL } = require("node:url");
const {
  parse,
  buildUrl,
  sortUrl,
  serviceLabel,
  SERVICES,
  SORTS,
  MAX_NAME_LENGTH,
} = require("../../src/lib/applicationsQuery");

// Spread into a parse expectation so the assertions stay exact: a new key in the
// parsed query has to be accounted for here rather than slipping through.
const DEFAULT_ORDER = { sort: "submitted", direction: "descending" };

describe("applicationsQuery.parse", () => {
  it("returns the trimmed name", () => {
    expect(parse({ name: "  Grace Hopper  " })).toEqual({
      name: "Grace Hopper",
      services: [],
      ...DEFAULT_ORDER,
    });
  });

  it.each([
    ["a missing parameter", {}],
    ["an empty parameter", { name: "" }],
    ["a whitespace-only parameter", { name: "   " }],
  ])("treats %s as no search", (_description, query) => {
    expect(parse(query)).toEqual({ name: "", services: [], ...DEFAULT_ORDER });
  });

  it("takes the first value when the parameter is repeated, rather than an array", () => {
    expect(parse({ name: ["Grace", "Alan"] })).toEqual({
      name: "Grace",
      services: [],
      ...DEFAULT_ORDER,
    });
  });

  it.each([
    ["a NUL byte mid-string", "Grace\u0000Hopper", "GraceHopper"],
    ["a leading NUL byte", "\u0000Grace", "Grace"],
    ["a NUL byte on its own", "\u0000", ""],
    ["other control characters", "Grace\u0007\u001bHopper", "GraceHopper"],
    ["the whitespace a stripped control character leaves behind", "\u0000 Grace ", "Grace"],
  ])("strips %s, which a Postgres text column cannot hold", (_description, name, expected) => {
    expect(parse({ name })).toEqual({ name: expected, services: [], ...DEFAULT_ORDER });
  });

  // Trimming before slicing can leave the cut end on a space, which is then echoed into
  // the box, the caption and every link on the page - where it parses back to a
  // different term, so a link does not lead to the page that built it.
  it("caps the name without leaving a trailing space, so the term round-trips", () => {
    const capped = parse({ name: `${"a".repeat(MAX_NAME_LENGTH - 1)}  b` }).name;

    expect(capped).toBe(capped.trim());
    expect(parse({ name: capped }).name).toBe(capped);
  });

  it("caps the name at the length the apply form allows on full_name", () => {
    const { name } = parse({ name: "a".repeat(MAX_NAME_LENGTH + 50) });

    expect(name).toBe("a".repeat(MAX_NAME_LENGTH));
  });
});

describe("applicationsQuery.parse - service", () => {
  it("reads a single ticked box, which arrives as a string", () => {
    expect(parse({ service: "housing" }).services).toEqual(["housing"]);
  });

  // The failure this guards against is silent: collapsing the array to its first value
  // still renders a working page, just one filtered by half of what was asked for.
  it("reads every ticked box when several arrive as an array", () => {
    expect(parse({ service: ["housing", "garden-waste"] }).services).toEqual([
      "housing",
      "garden-waste",
    ]);
  });

  it("accepts all five services at once", () => {
    const all = SERVICES.map(({ value }) => value);

    expect(parse({ service: all }).services).toEqual(all);
  });

  it.each([
    ["a value no service uses", "not-a-service"],
    ["an empty value", ""],
    ["a value differing only in case", "Housing"],
  ])("drops %s so it never reaches the query", (_description, service) => {
    expect(parse({ service }).services).toEqual([]);
  });

  it("keeps the recognised services and drops the rest from a mixed list", () => {
    expect(parse({ service: ["not-a-service", "housing", "", "council-tax"] }).services).toEqual([
      "housing",
      "council-tax",
    ]);
  });

  it("selects a repeated service once", () => {
    expect(parse({ service: ["housing", "housing"] }).services).toEqual(["housing"]);
  });

  // Ordering by SERVICES rather than by the URL is what makes a link built from the
  // result stable, so two URLs selecting the same services produce the same links.
  it("orders the services the same way whatever order the URL lists them in", () => {
    expect(parse({ service: ["garden-waste", "housing"] }).services).toEqual([
      "housing",
      "garden-waste",
    ]);
  });

  it("treats a nested parameter, which arrives as an object, as nothing selected", () => {
    expect(parse({ service: { flow: "housing" } }).services).toEqual([]);
  });
});

describe("applicationsQuery.buildUrl", () => {
  it("returns the bare path when nothing is applied", () => {
    expect(buildUrl()).toBe("/applications");
    expect(buildUrl({ name: "", services: [] })).toBe("/applications");
  });

  it("carries the search term and every service", () => {
    expect(buildUrl({ name: "grace", services: ["housing", "council-tax"] })).toBe(
      "/applications?name=grace&service=housing&service=council-tax",
    );
  });

  it("applies a change over the current query rather than replacing it", () => {
    const current = { name: "grace", services: ["housing", "council-tax"] };

    expect(buildUrl(current, { services: ["housing"] })).toBe(
      "/applications?name=grace&service=housing",
    );
    expect(buildUrl(current, { name: "" })).toBe(
      "/applications?service=housing&service=council-tax",
    );
  });

  it("escapes a term that would otherwise add a service of its own", () => {
    const url = buildUrl({ name: "grace&service=housing" });

    expect(url).toBe("/applications?name=grace%26service%3Dhousing");
    expect(parse(Object.fromEntries(new URL(url, "http://x").searchParams))).toEqual({
      name: "grace&service=housing",
      services: [],
      ...DEFAULT_ORDER,
    });
  });

  // Without this the "clear filters" link becomes /applications?sort=…&direction=…,
  // which reads as a filter still being applied.
  it("leaves the default order out of the query string entirely", () => {
    expect(buildUrl({ sort: "submitted", direction: "descending" })).toBe("/applications");
  });

  it.each([
    ["a non-default direction on the default column", "submitted", "ascending"],
    ["a non-default column", "name", "ascending"],
  ])("carries %s", (_description, sort, direction) => {
    expect(buildUrl({ sort, direction })).toBe(`/applications?sort=${sort}&direction=${direction}`);
  });

  it("carries the order alongside the search and services", () => {
    expect(
      buildUrl({ name: "grace", services: ["housing"], sort: "name", direction: "ascending" }),
    ).toBe("/applications?name=grace&service=housing&sort=name&direction=ascending");
  });
});

describe("applicationsQuery.parse - sort and direction", () => {
  const order = (query) => {
    const { sort, direction } = parse(query);
    return { sort, direction };
  };

  it("defaults to newest submitted first", () => {
    expect(order({})).toEqual({ sort: "submitted", direction: "descending" });
  });

  it.each([
    ["name", "ascending"],
    ["name", "descending"],
    ["submitted", "ascending"],
    ["submitted", "descending"],
  ])("accepts sort=%s direction=%s", (sort, direction) => {
    expect(order({ sort, direction })).toEqual({ sort, direction });
  });

  it.each([
    ["a column that does not exist", "not-a-column"],
    ["a real column that is not offered", "email"],
    ["the reference column, which is deliberately unsortable", "reference"],
    ["a raw SQL fragment", "full_name; DROP TABLE applications"],
    // A bare property lookup would return Object.prototype's own value here and
    // splice a function's source into ORDER BY.
    ["a key inherited from Object.prototype", "constructor"],
    ["__proto__", "__proto__"],
  ])("falls back to the default sort for %s", (_description, sort) => {
    expect(order({ sort })).toEqual({ sort: "submitted", direction: "descending" });
  });

  it.each([["sideways"], ["ASC"], ["ascending; DROP TABLE applications"]])(
    "falls back to the default direction for %j",
    (direction) => {
      expect(order({ sort: "name", direction })).toEqual({
        sort: "name",
        direction: "descending",
      });
    },
  );
});

describe("applicationsQuery.sortUrl", () => {
  const listing = { name: "", services: [], sort: "submitted", direction: "descending" };

  it("sorts a column that is not active ascending, whichever column is", () => {
    expect(sortUrl(listing, "name")).toBe("/applications?sort=name&direction=ascending");
    expect(sortUrl({ ...listing, sort: "name", direction: "descending" }, "submitted")).toBe(
      "/applications?sort=submitted&direction=ascending",
    );
  });

  // The only case that separates "reverse the active column" from "reverse whatever
  // is ascending": moving to a new column while the current one is ascending. Both
  // rules agree everywhere else, so without this a swapped condition goes unnoticed.
  it("starts a new column ascending even while the active column is ascending", () => {
    expect(sortUrl({ ...listing, sort: "name", direction: "ascending" }, "submitted")).toBe(
      "/applications?sort=submitted&direction=ascending",
    );
  });

  it("reverses the column that is already active", () => {
    expect(sortUrl({ ...listing, sort: "name", direction: "ascending" }, "name")).toBe(
      "/applications?sort=name&direction=descending",
    );
    expect(sortUrl({ ...listing, sort: "name", direction: "descending" }, "name")).toBe(
      "/applications?sort=name&direction=ascending",
    );
  });

  // Criterion 2: the landing state is submitted/descending, so the first click on
  // Submitted has to give oldest first rather than repeating what is on screen.
  it("turns the default newest-first into oldest-first on the first click", () => {
    expect(sortUrl(listing, "submitted")).toBe("/applications?sort=submitted&direction=ascending");
  });

  it("keeps the search and the selected services in the heading link", () => {
    expect(sortUrl({ ...listing, name: "grace", services: ["housing"] }, "name")).toBe(
      "/applications?name=grace&service=housing&sort=name&direction=ascending",
    );
  });
});

describe("applicationsQuery.SORTS", () => {
  it("offers exactly the two sortable columns, labelled as their headings", () => {
    expect(SORTS).toEqual([
      { key: "name", label: "Full name" },
      { key: "submitted", label: "Submitted" },
    ]);
  });
});

describe("applicationsQuery.serviceLabel", () => {
  it("labels every service the flow column can hold", () => {
    expect(SERVICES.map(({ value }) => serviceLabel(value))).toEqual([
      "General application",
      "Housing",
      "Housing Benefit (disability)",
      "Council tax",
      "Garden waste",
    ]);
  });
});
