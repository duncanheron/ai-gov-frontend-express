const items = [{ text: "Applications", href: "/applications" }];

function forCurrentPath(currentPath) {
  return items.map((item) => ({
    ...item,
    current: currentPath === item.href || currentPath.startsWith(`${item.href}/`),
  }));
}

module.exports = { forCurrentPath };
