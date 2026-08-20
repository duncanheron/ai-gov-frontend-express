const navigation = require("../../src/config/navigation");

describe("navigation config", () => {
  describe("resolveServiceContext", () => {
    it("resolves the default service name and full navigation for the homepage", () => {
      const context = navigation.resolveServiceContext("/");

      expect(context.serviceName).toBe("Apply and pay for council services");
      expect(context.navigationItems).toEqual([
        { text: "Applications", href: "/applications", current: false },
        { text: "Not sure which service you need?", href: "/choose-service", current: false },
      ]);
    });

    it("resolves the default service name and navigation for choose-service, marking it current", () => {
      const context = navigation.resolveServiceContext("/choose-service");

      expect(context.serviceName).toBe("Apply and pay for council services");
      expect(context.navigationItems.find((item) => item.href === "/choose-service").current).toBe(
        true,
      );
    });

    it("resolves the default service name and navigation for an unmatched (error) path", () => {
      const context = navigation.resolveServiceContext("/not-a-real-page");

      expect(context.serviceName).toBe("Apply and pay for council services");
      expect(context.navigationItems).toHaveLength(2);
    });

    it("resolves the default service name for /applications, marking Applications current", () => {
      const context = navigation.resolveServiceContext("/applications");

      expect(context.serviceName).toBe("Apply and pay for council services");
      expect(context.navigationItems.find((item) => item.href === "/applications").current).toBe(
        true,
      );
    });

    it("resolves the default service name for an applications detail sub-path", () => {
      const context = navigation.resolveServiceContext("/applications/ABCD-123-XYZ");

      expect(context.serviceName).toBe("Apply and pay for council services");
      expect(context.navigationItems.find((item) => item.href === "/applications").current).toBe(
        true,
      );
    });

    it("does not resolve the applications section for a path that merely shares its prefix", () => {
      const context = navigation.resolveServiceContext("/applications-archive");

      expect(context.serviceName).toBe("Apply and pay for council services");
    });

    it("resolves the general application journey with no navigation", () => {
      const context = navigation.resolveServiceContext("/apply/details");

      expect(context.serviceName).toBe("Submit a general application");
      expect(context.navigationItems).toEqual([]);
    });

    it("resolves the housing journey with no navigation", () => {
      const context = navigation.resolveServiceContext("/apply-housing/details");

      expect(context.serviceName).toBe("Apply for housing");
      expect(context.navigationItems).toEqual([]);
    });

    it("resolves the housing benefit journey with no navigation", () => {
      const context = navigation.resolveServiceContext("/apply-housing-benefit/details");

      expect(context.serviceName).toBe("Apply for Housing Benefit (disability)");
      expect(context.navigationItems).toEqual([]);
    });

    it("resolves the council tax journey with no navigation", () => {
      const context = navigation.resolveServiceContext("/pay-council-tax/details");

      expect(context.serviceName).toBe("Pay council tax");
      expect(context.navigationItems).toEqual([]);
    });

    it("resolves the garden waste journey with no navigation", () => {
      const context = navigation.resolveServiceContext("/pay-garden-waste/details");

      expect(context.serviceName).toBe("Pay for garden waste");
      expect(context.navigationItems).toEqual([]);
    });

    // The ordering bug: "/apply" is a text-prefix of "/apply-housing" and
    // "/apply-housing-benefit". A naive `path.startsWith(prefix)` check run in
    // the wrong order resolves "/apply-housing/details" to the general
    // application journey instead of housing - wrong, but plausible enough
    // that no other assertion here would catch it.
    it("resolves the housing journey name for a housing sub-path, never the general application name", () => {
      const context = navigation.resolveServiceContext("/apply-housing/details");

      expect(context.serviceName).toBe("Apply for housing");
      expect(context.serviceName).not.toBe("Submit a general application");
    });

    it("resolves the housing benefit journey name for a housing benefit sub-path, never the housing or general application name", () => {
      const context = navigation.resolveServiceContext("/apply-housing-benefit/details");

      expect(context.serviceName).toBe("Apply for Housing Benefit (disability)");
      expect(context.serviceName).not.toBe("Apply for housing");
      expect(context.serviceName).not.toBe("Submit a general application");
    });
  });
});
