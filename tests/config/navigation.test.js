const navigation = require("../../src/config/navigation");

describe("navigation config", () => {
  it("marks an item current for an exact path match", () => {
    const items = navigation.forCurrentPath("/applications");

    expect(items).toEqual([{ text: "Applications", href: "/applications", current: true }]);
  });

  it("marks an item current for a sub-path match", () => {
    const items = navigation.forCurrentPath("/applications/ABCD-123-XYZ");

    expect(items[0].current).toBe(true);
  });

  it("does not mark an item current for an unrelated path", () => {
    const items = navigation.forCurrentPath("/apply/details");

    expect(items[0].current).toBe(false);
  });

  it("does not mark an item current for a different path that merely shares a prefix", () => {
    const items = navigation.forCurrentPath("/applications-archive");

    expect(items[0].current).toBe(false);
  });
});
