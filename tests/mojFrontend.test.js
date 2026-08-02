const { JSDOM } = require("jsdom");
const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");

// The applications list is the only page using MoJ styles, and now the only one
// loading MoJ JavaScript, so these tests are what hold the stylesheet wiring, the
// bundle, and the caseworker/citizen split at the JavaScript layer.

const getServer = useSharedServer();

const MOJ_BUNDLE = "/javascripts/moj-frontend.min.js";
const GOVUK_BUNDLE = "/javascripts/govuk-frontend.min.js";

// Both halves matter. A bundle can be pulled in by `src`, or by an inline module
// importing it - checking only `src` would let an inline import onto a citizen page
// with the test still green.
const scriptsOn = (html) => {
  const dom = new JSDOM(html);
  const scripts = [...dom.window.document.querySelectorAll("script")];
  const parsed = {
    sources: scripts.map((script) => script.getAttribute("src")).filter(Boolean),
    importsMoj: scripts.some((script) => script.textContent.includes("moj-frontend")),
  };
  dom.window.close();
  return parsed;
};

describe("MoJ Frontend styles", () => {
  // Each component is imported separately, so a missing @use costs that component its
  // styling alone - the page still renders, and every other test still passes.
  // `.moj-js-hidden` is the one that collapses the filter panel, and it comes from a
  // utilities partial rather than a component - easy to miss, and missing it leaves a
  // toggle that flips aria-expanded and hides nothing.
  it.each([[".moj-search"], [".moj-filter"], [".moj-filter__tag"], [".moj-js-hidden"]])(
    "serves the %s styles in the compiled stylesheet",
    async (selector) => {
      const response = await request(getServer()).get("/stylesheets/main.css");

      expect(response.status).toBe(200);
      expect(response.text).toContain(selector);
    },
  );

  // Criterion 5 of CBLT-137 needs the active sort visible, not only announced. MoJ's
  // rules target `[aria-sort] button` and their arrows come from a script that does not
  // drive our headings, so these rules are ours alone, and a page stripped of them
  // still renders and still passes every other test.
  // Unquoted: the minifier drops the quotes the source writes.
  it.each([["[aria-sort=ascending]"], ["[aria-sort=descending]"]])(
    "styles the %s column so the sort is visible, not only announced",
    async (selector) => {
      const response = await request(getServer()).get("/stylesheets/main.css");

      expect(response.text).toContain(selector);
    },
  );

  // Layout cannot be asserted in JSDOM, which computes no cascade and no box model. What
  // breaks it is source order between two equal-specificity rules, and that is readable
  // from the stylesheet itself.
  //
  // Two properties, one failure mode. MoJ sets both on .moj-search__button to opt out of
  // govuk's defaults, but govuk's own rule is emitted later at equal specificity and
  // wins, so each opt-out silently does nothing until restated after the import.
  //   margin-bottom (CBLT-141) - the button hangs above the input the flex row aligns to.
  //   width         (CBLT-144) - the button goes full width under 640px and crushes the
  //                              label and input beside it. Invisible on desktop, where
  //                              govuk's own media query restores auto.
  it.each([
    ["margin-bottom", "0"],
    ["width", "auto"],
  ])("settles .moj-search__button's %s after .govuk-button's", async (property, expected) => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    // Two boundaries matter. Before the selector, or `.app-filter-toggle .govuk-button`
    // counts as a rule for `.govuk-button`. Before the property, or `max-width` reads as
    // `width`.
    const lastDeclaration = (selector) => {
      const rule = new RegExp(`(?:^|[},])\\${selector}\\{(?:[^}]*;)?${property}:([^;}]+)`, "g");
      const matches = [...response.text.matchAll(rule)];
      return matches.length ? matches[matches.length - 1] : null;
    };
    const button = lastDeclaration(".moj-search__button");
    const govukButton = lastDeclaration(".govuk-button");

    expect(button.index).toBeGreaterThan(govukButton.index);
    expect(button[1]).toBe(expected);
  });

  it("still serves the GDS Transport font faces, which MoJ's vendored config drops", async () => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    expect(response.text.match(/@font-face/g)).toHaveLength(2);
    expect(response.text).toContain('font-family:"GDS Transport"');
  });
});

describe("MoJ Frontend JavaScript", () => {
  it("serves the MoJ bundle, which carries its own copy of the framework", async () => {
    const response = await request(getServer()).get(MOJ_BUNDLE);

    expect(response.status).toBe(200);
    // A bare specifier would fail in the browser while looking fine in the build -
    // `moj-frontend.min.js` is chosen over `all.bundle.mjs` precisely because it has none.
    expect(response.text).not.toMatch(/from\s*["']govuk-frontend["']/);
    expect(response.text).toContain("initAll");
  });

  it("serves the bundle's source map, so a stack trace in it is readable", async () => {
    const response = await request(getServer()).get(`${MOJ_BUNDLE}.map`);

    expect(response.status).toBe(200);
  });

  it("loads both bundles on the caseworker list, GOV.UK first", async () => {
    const response = await request(getServer()).get("/applications");

    // Both, not one: MoJ's initAll does not initialise GOV.UK components, so dropping
    // the GOV.UK bundle would quietly break the header and service navigation.
    expect(scriptsOn(response.text)).toEqual({
      sources: [GOVUK_BUNDLE, MOJ_BUNDLE],
      importsMoj: true,
    });
  });

  // Criterion 6. CLAUDE.md splits the two design systems by audience; this keeps that
  // true at the JavaScript layer, not only the component layer.
  it.each([["/"], ["/apply/details"], ["/choose-service"], ["/pay-council-tax/details"]])(
    "loads no MoJ JavaScript on %s, a citizen page",
    async (path) => {
      const response = await request(getServer()).get(path);

      expect(response.status).toBe(200);
      expect(scriptsOn(response.text)).toEqual({
        sources: [GOVUK_BUNDLE],
        importsMoj: false,
      });
    },
  );
});

describe("applications list filter toggle", () => {
  const parseFilter = (html) => {
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const panel = document.querySelector(".moj-filter");
    const parsed = {
      module: panel.getAttribute("data-module"),
      startHidden: panel.getAttribute("data-start-hidden"),
      // The component adds this class itself to collapse the panel. Server-rendered it
      // would hide the filters for anyone without JavaScript.
      hiddenOnTheServer: panel.classList.contains("moj-js-hidden"),
      toggleButtonContainer: Boolean(document.querySelector(".moj-action-bar__filter")),
      closeButtonContainer: Boolean(panel.querySelector(".moj-filter__header-action")),
    };
    dom.window.close();
    return parsed;
  };

  // A filter applied, because the panel is only rendered when there is something to
  // filter - an empty database and no query is the "no applications yet" state.
  it("gives the toggle every element and option it needs to run", async () => {
    const response = await request(getServer()).get("/applications?service=housing");

    expect(parseFilter(response.text)).toEqual({
      // FilterToggleButton.moduleName. The page constructs the component directly
      // rather than through initAll, which omits this component from its list, but the
      // attribute is still what ConfigurableComponent reads its config from.
      module: "moj-filter",
      // The default is `true`, and it is applied *after* the media-query check rather
      // than as its starting point, so leaving it would collapse the panel on desktop
      // too and lose criterion 3.
      startHidden: "false",
      hiddenOnTheServer: false,
      toggleButtonContainer: true,
      closeButtonContainer: true,
    });
  });

  // Criterion 4, and the whole justification for putting the toggle behind JavaScript:
  // the page this enhances has to work without it.
  it("leaves the panel and its controls fully present without JavaScript", async () => {
    const response = await request(getServer()).get("/applications?service=housing");

    const dom = new JSDOM(response.text);
    const { document } = dom.window;
    const checkboxes = document.querySelectorAll(".moj-filter input[type='checkbox']");
    const submit = document.querySelector(".moj-filter__options button");

    expect(checkboxes).toHaveLength(5);
    expect(submit.textContent.trim()).toBe("Apply filters");
    // No `hidden`, and no inline display:none - nothing but the component's own class
    // may collapse this panel, and that only runs when scripting does.
    expect(document.querySelector(".moj-filter").hasAttribute("hidden")).toBe(false);
    dom.window.close();
  });
});
