const { parse } = require("../../src/lib/applicationsQuery");

describe("applicationsQuery.parse", () => {
  it("returns the trimmed name", () => {
    expect(parse({ name: "  Grace Hopper  " })).toEqual({ name: "Grace Hopper" });
  });

  it.each([
    ["a missing parameter", {}, ""],
    ["no query string at all", undefined, ""],
    ["an empty parameter", { name: "" }, ""],
    ["a whitespace-only parameter", { name: "   " }, ""],
  ])("treats %s as no search", (_description, query, expected) => {
    expect(parse(query)).toEqual({ name: expected });
  });

  it("takes the first value when the parameter is repeated, rather than an array", () => {
    expect(parse({ name: ["Grace", "Alan"] })).toEqual({ name: "Grace" });
  });

  it("ignores parameters it does not own", () => {
    expect(parse({ name: "Grace", service: "housing" })).toEqual({ name: "Grace" });
  });
});
