const { JSDOM } = require("jsdom");

// Parses a rendered govukTable out of a response body into structured data,
// so callers assert on the table's actual contents instead of substring
// presence anywhere on the page. `head` is the header cell text; `rows` is
// the body rows in document order, each an array of `{ text, href }` cells
// (`href` is null for a cell with no link) - see govuk-frontend's table
// template.njk for the markup this selects against.
function parseTable(html, selector = ".govuk-table") {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const table = document.querySelector(selector);
  if (!table) {
    throw new Error(`No element matching "${selector}" found in response body`);
  }

  const head = [...table.querySelectorAll(":scope > thead > tr > th")].map((cell) =>
    cell.textContent.trim(),
  );

  const rows = [...table.querySelectorAll(":scope > tbody > tr")].map((row) =>
    [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) => {
      const link = cell.querySelector("a");
      return { text: cell.textContent.trim(), href: link ? link.getAttribute("href") : null };
    }),
  );

  dom.window.close();
  return { head, rows };
}

module.exports = { parseTable };
