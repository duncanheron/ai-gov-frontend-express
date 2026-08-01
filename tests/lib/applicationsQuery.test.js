const { parse, MAX_NAME_LENGTH } = require("../../src/lib/applicationsQuery");

describe("applicationsQuery.parse", () => {
  it("returns the trimmed name", () => {
    expect(parse({ name: "  Grace Hopper  " })).toEqual({ name: "Grace Hopper" });
  });

  it.each([
    ["a missing parameter", {}],
    ["an empty parameter", { name: "" }],
    ["a whitespace-only parameter", { name: "   " }],
  ])("treats %s as no search", (_description, query) => {
    expect(parse(query)).toEqual({ name: "" });
  });

  it("takes the first value when the parameter is repeated, rather than an array", () => {
    expect(parse({ name: ["Grace", "Alan"] })).toEqual({ name: "Grace" });
  });

  it.each([
    ["a NUL byte mid-string", "Grace\u0000Hopper", "GraceHopper"],
    ["a leading NUL byte", "\u0000Grace", "Grace"],
    ["a NUL byte on its own", "\u0000", ""],
    ["other control characters", "Grace\u0007\u001bHopper", "GraceHopper"],
    ["the whitespace a stripped control character leaves behind", "\u0000 Grace ", "Grace"],
  ])("strips %s, which a Postgres text column cannot hold", (_description, name, expected) => {
    expect(parse({ name })).toEqual({ name: expected });
  });

  it("caps the name at the length the apply form allows on full_name", () => {
    const { name } = parse({ name: "a".repeat(MAX_NAME_LENGTH + 50) });

    expect(name).toBe("a".repeat(MAX_NAME_LENGTH));
  });
});
