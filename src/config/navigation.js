const items = [
  { text: "Applications", href: "/applications" },
  { text: "Apply", href: "/apply/details" },
  { text: "Apply for housing", href: "/apply-housing/details" },
  { text: "Apply for Housing Benefit (disability)", href: "/apply-housing-benefit/details" },
  { text: "Not sure which service you need?", href: "/choose-service" },
  { text: "Pay council tax", href: "/pay-council-tax/details" },
  { text: "Pay for garden waste", href: "/pay-garden-waste/details" },
];

function forCurrentPath(currentPath) {
  return items.map((item) => ({
    ...item,
    current: currentPath === item.href || currentPath.startsWith(`${item.href}/`),
  }));
}

module.exports = { forCurrentPath };
