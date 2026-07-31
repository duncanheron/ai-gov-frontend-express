const { JSDOM } = require("jsdom");

// `href` is null for a cell with no link - see govuk-frontend's table
// template.njk for the markup this selects against. Head and body cells go
// through this same function so a sort link in a `<th>` is reachable too.
function cellShape(cell) {
  const link = cell.querySelector("a");
  return {
    text: cell.textContent.replace(/\s+/g, " ").trim(),
    html: cell.innerHTML,
    href: link ? link.getAttribute("href") : null,
  };
}

function extractTable(table) {
  return {
    head: [...table.querySelectorAll(":scope > thead > tr > th")].map(cellShape),
    rows: [...table.querySelectorAll(":scope > tbody > tr")].map((row) =>
      [...row.querySelectorAll(":scope > th, :scope > td")].map(cellShape),
    ),
  };
}

// Returns null rather than throwing when `selector` matches nothing, so an
// empty-state page with no table at all can be asserted on directly.
function findTable(html, selector = ".govuk-table") {
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector(selector);
  const result = table ? extractTable(table) : null;
  dom.window.close();
  return result;
}

function countTables(html, selector = ".govuk-table") {
  const dom = new JSDOM(html);
  const count = dom.window.document.querySelectorAll(selector).length;
  dom.window.close();
  return count;
}

function parseTable(html, selector = ".govuk-table") {
  const table = findTable(html, selector);
  if (!table) {
    throw new Error(`No element matching "${selector}" found in response body`);
  }
  return table;
}

module.exports = { parseTable, findTable, countTables };
