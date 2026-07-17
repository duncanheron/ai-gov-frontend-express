const items = [
  { text: "Applications", href: "/applications" },
  { text: "Apply", href: "/apply/details" },
  { text: "Apply for housing", href: "/apply-housing/details" },
  { text: "Apply for Housing Benefit (disability)", href: "/apply-housing-benefit/details" },
  { text: "Not sure which service you need?", href: "/choose-service" },
];

function forCurrentPath(currentPath) {
  return items.map((item) => ({
    ...item,
    current: currentPath === item.href || currentPath.startsWith(`${item.href}/`),
  }));
}

module.exports = { forCurrentPath };
