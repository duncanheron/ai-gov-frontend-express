const { JSDOM } = require("jsdom");

// Reads a rendered table into { caption, headings, rows }, each cell as
// { text, href }, so a test can assert on the rows a page actually rendered
// rather than on whether a string appears somewhere in the response. Returns
// null when the page renders no table at all - the shape the no-results and
// empty states need to be distinguishable from a table of rows.
function parseTable(html, selector = "table") {
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector(selector);

  if (!table) {
    dom.window.close();
    return null;
  }

  const caption = table.querySelector("caption");
  const parsed = {
    caption: caption ? caption.textContent.trim() : null,
    headings: [...table.querySelectorAll("thead th")].map((cell) => cell.textContent.trim()),
    rows: [...table.querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) => {
        const link = cell.querySelector("a");
        return {
          text: cell.textContent.trim(),
          href: link ? link.getAttribute("href") : null,
          // Cell content that should be text renders no element of its own, so an
          // empty list here is what distinguishes escaped markup from live markup.
          childElements: [...cell.children].map((child) => child.tagName.toLowerCase()),
        };
      }),
    ),
  };

  dom.window.close();
  return parsed;
}

module.exports = { parseTable };
