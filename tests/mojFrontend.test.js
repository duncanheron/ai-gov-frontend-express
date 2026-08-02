const { JSDOM } = require("jsdom");
const nunjucks = require("nunjucks");
const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");

// The applications list is the only page using MoJ styles, and it composes the
// search markup rather than calling mojSearch (the macro drops `value`), so these
// tests are what hold the macro resolution and stylesheet wiring up.

const getServer = useSharedServer();

const SEARCH_TEMPLATE = `
  {% from "moj/components/search/macro.njk" import mojSearch %}
  {{ mojSearch({
    label: { text: "Search applications" },
    input: { id: "applicant-name", name: "name" },
    button: { text: "Search" }
  }) }}
`;

describe("MoJ Frontend", () => {
  it("resolves and renders an MoJ macro through the app's Nunjucks environment", () => {
    const dom = new JSDOM(nunjucks.renderString(SEARCH_TEMPLATE, {}));
    const { document } = dom.window;

    const input = document.querySelector(".moj-search input");
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("name")).toBe("name");
    expect(document.querySelector(`label[for="${input.id}"]`).textContent.trim()).toBe(
      "Search applications",
    );
    expect(input.closest("form").querySelector("button").textContent.trim()).toBe("Search");

    dom.window.close();
  });

  // Each component is imported separately, so a missing @use costs that component its
  // styling alone - the page still renders, and every other test still passes.
  it.each([[".moj-search"], [".moj-filter"], [".moj-filter__tag"]])(
    "serves the %s styles in the compiled stylesheet",
    async (selector) => {
      const response = await request(getServer()).get("/stylesheets/main.css");

      expect(response.status).toBe(200);
      expect(response.text).toContain(selector);
    },
  );

  // Layout cannot be asserted in JSDOM, which computes no cascade and no box model.
  // What broke the button's alignment was source order between two equal-specificity
  // rules, and that is readable from the stylesheet itself: MoJ's own
  // .moj-search__button rule is emitted before .govuk-button's margin, so without an
  // override emitted afterwards the button keeps a bottom margin and the flex row
  // lifts it clear of the input.
  it("settles .moj-search__button's bottom margin after .govuk-button's", async () => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    const lastMargin = (selector) => {
      const rule = new RegExp(`\\${selector}\\{[^}]*margin-bottom:([^;}]+)[^}]*\\}`, "g");
      const matches = [...response.text.matchAll(rule)];
      return matches.length ? matches[matches.length - 1] : null;
    };
    const button = lastMargin(".moj-search__button");
    const govukButton = lastMargin(".govuk-button");

    expect(button.index).toBeGreaterThan(govukButton.index);
    expect(button[1]).toBe("0");
  });

  it("still serves the GDS Transport font faces, which MoJ's vendored config drops", async () => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    expect(response.text.match(/@font-face/g)).toHaveLength(2);
    expect(response.text).toContain('font-family:"GDS Transport"');
  });
});
