const { URL } = require("node:url");
const {
  parse,
  buildUrl,
  serviceLabel,
  SERVICES,
  MAX_NAME_LENGTH,
} = require("../../src/lib/applicationsQuery");

describe("applicationsQuery.parse", () => {
  it("returns the trimmed name", () => {
    expect(parse({ name: "  Grace Hopper  " })).toEqual({ name: "Grace Hopper", services: [] });
  });

  it.each([
    ["a missing parameter", {}],
    ["an empty parameter", { name: "" }],
    ["a whitespace-only parameter", { name: "   " }],
  ])("treats %s as no search", (_description, query) => {
    expect(parse(query)).toEqual({ name: "", services: [] });
  });

  it("takes the first value when the parameter is repeated, rather than an array", () => {
    expect(parse({ name: ["Grace", "Alan"] })).toEqual({ name: "Grace", services: [] });
  });

  it.each([
    ["a NUL byte mid-string", "Grace\u0000Hopper", "GraceHopper"],
    ["a leading NUL byte", "\u0000Grace", "Grace"],
    ["a NUL byte on its own", "\u0000", ""],
    ["other control characters", "Grace\u0007\u001bHopper", "GraceHopper"],
    ["the whitespace a stripped control character leaves behind", "\u0000 Grace ", "Grace"],
  ])("strips %s, which a Postgres text column cannot hold", (_description, name, expected) => {
    expect(parse({ name })).toEqual({ name: expected, services: [] });
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
    });
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
