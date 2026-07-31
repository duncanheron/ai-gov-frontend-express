const DEFAULT_SERVICE_NAME = "Apply and pay for council services";

const NAVIGATION_ITEMS = [
  { text: "Applications", href: "/applications" },
  { text: "Not sure which service you need?", href: "/choose-service" },
];

// Ordered longest-prefix-first: "/apply" is a text-prefix of "/apply-housing"
// and "/apply-housing-benefit", so those must be checked first or a housing
// sub-path would resolve to the general application journey.
const JOURNEYS = [
  { prefix: "/apply-housing-benefit", serviceName: "Apply for Housing Benefit (disability)" },
  { prefix: "/apply-housing", serviceName: "Apply for housing" },
  { prefix: "/apply", serviceName: "Submit a general application" },
  { prefix: "/pay-council-tax", serviceName: "Pay council tax" },
  { prefix: "/pay-garden-waste", serviceName: "Pay for garden waste" },
];

const SECTIONS = [{ prefix: "/applications", serviceName: "Manage applications" }];

function matches(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function withCurrent(currentPath) {
  return NAVIGATION_ITEMS.map((item) => ({
    ...item,
    current: matches(currentPath, item.href),
  }));
}

function resolveServiceContext(currentPath) {
  const journey = JOURNEYS.find((entry) => matches(currentPath, entry.prefix));
  if (journey) {
    return { serviceName: journey.serviceName, navigationItems: [] };
  }

  const section = SECTIONS.find((entry) => matches(currentPath, entry.prefix));
  const serviceName = section ? section.serviceName : DEFAULT_SERVICE_NAME;
  return { serviceName, navigationItems: withCurrent(currentPath) };
}

module.exports = { resolveServiceContext };
