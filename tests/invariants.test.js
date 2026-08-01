const { JSDOM } = require("jsdom");
const { useSharedServer } = require("./helpers/testServer");
const { resetTestResponses } = require("../src/services/routeApplicationFlow");
const { buildAllPages } = require("./helpers/allPages");

// Structural HTML invariants that no page may violate, checked across every
// page the service serves - the same enumeration the accessibility suite
// uses (tests/helpers/allPages.js). See CBLT-114: these are the checks axe
// does not make, and are exactly what let CBLT-113's dead Continue button
// (and CBLT-111's 500 page) pass unnoticed.
//
// A response is only inspected for structural content once its status is
// confirmed to match what that page expects (200 for almost every page; 404
// for the two pages that are deliberately testing "not found" behaviour).
// That mirrors CBLT-111: two tests asserted content against a 500 without
// checking status first. If a page's status doesn't match, that failure is
// reported on its own and no content assertions run against it.

const getServer = useSharedServer();
const pages = buildAllPages(getServer);

describe("structural HTML invariants", () => {
  afterEach(() => {
    resetTestResponses();
  });

  it.each(pages)("$name", async ({ get, expectedStatus = 200 }) => {
    const response = await get();
    expect(response.status).toBe(expectedStatus);

    if (response.status !== 200) {
      return;
    }

    const dom = new JSDOM(response.text);
    const { document } = dom.window;

    // Invariant 1: no <button type="submit"> outside a <form>. This is
    // exactly the CBLT-113 bug - govukButton falls back to a submit button
    // when `href` is falsy, and an orphaned submit button is focusable,
    // announced as an action, and does nothing. axe does not flag it.
    const orphanSubmitButtons = [...document.querySelectorAll("button")]
      .filter((button) => button.type === "submit" && !button.closest("form"))
      .map((button) => button.textContent.trim());
    expect(orphanSubmitButtons).toEqual([]);

    // Invariant 2: no govuk-button anchor with a missing or empty href - the
    // sibling failure mode to invariant 1 (govukButton renders an <a> once
    // `href` is truthy, so a falsy-but-present href still slips through).
    const brokenGovukButtonLinks = [...document.querySelectorAll("a.govuk-button")]
      .filter((link) => !link.getAttribute("href"))
      .map((link) => link.textContent.trim());
    expect(brokenGovukButtonLinks).toEqual([]);

    // Invariant 3: no anchor anywhere with href="".
    const emptyHrefAnchors = [...document.querySelectorAll('a[href=""]')].map((link) =>
      link.textContent.trim(),
    );
    expect(emptyHrefAnchors).toEqual([]);

    dom.window.close();
  });
});
