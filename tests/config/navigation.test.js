const navigation = require("../../src/config/navigation");

describe("navigation config", () => {
  it("marks an item current for an exact path match", () => {
    const items = navigation.forCurrentPath("/applications");

    expect(items[0]).toEqual({ text: "Applications", href: "/applications", current: true });
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

  it("includes an entry for each of the four application flows plus applications", () => {
    const items = navigation.forCurrentPath("/");

    expect(items).toEqual([
      { text: "Applications", href: "/applications", current: false },
      { text: "Apply", href: "/apply/details", current: false },
      { text: "Apply for housing", href: "/apply-housing/details", current: false },
      {
        text: "Apply for Housing Benefit (disability)",
        href: "/apply-housing-benefit/details",
        current: false,
      },
      { text: "Not sure which service you need?", href: "/choose-service", current: false },
    ]);
  });

  it("marks the apply item current for an exact path match", () => {
    const items = navigation.forCurrentPath("/apply/details");

    expect(items.find((item) => item.href === "/apply/details").current).toBe(true);
    expect(items.find((item) => item.href === "/apply-housing/details").current).toBe(false);
    expect(items.find((item) => item.href === "/apply-housing-benefit/details").current).toBe(
      false,
    );
    expect(items.find((item) => item.href === "/choose-service").current).toBe(false);
  });

  it("marks the choose-service item current for an exact path match", () => {
    const items = navigation.forCurrentPath("/choose-service");

    expect(items.find((item) => item.href === "/choose-service").current).toBe(true);
  });
});
