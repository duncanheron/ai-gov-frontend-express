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
    // `sortModule` is the client-side sorting this table must not be wired to, and
    // `ariaSort` is null rather than "none" only when the attribute is absent
    // altogether - the two are different claims about a column.
    sortModule: table.getAttribute("data-module"),
    headings: [...table.querySelectorAll("thead th")].map((cell) => {
      const link = cell.querySelector("a");
      const indicator = cell.querySelector(".app-sort-indicator");
      return {
        text: cell.textContent.trim(),
        href: link ? link.getAttribute("href") : null,
        ariaSort: cell.getAttribute("aria-sort"),
        // The visible arrow. `direction` is what it depicts, which is not the same
        // claim as `ariaSort` - the pair shown on an unsorted column has to be
        // announced as "none", and a column with no indicator makes no claim at all.
        sortIndicator: indicator && {
          direction: [...indicator.classList]
            .map((name) => name.replace("app-sort-indicator--", ""))
            .find((name) => ["ascending", "descending", "none"].includes(name)),
          hiddenFromAssistiveTech: indicator.getAttribute("aria-hidden") === "true",
          focusable: indicator.getAttribute("focusable"),
        },
      };
    }),
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
