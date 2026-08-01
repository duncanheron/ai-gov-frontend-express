const { JSDOM } = require("jsdom");
const nunjucks = require("nunjucks");
const request = require("supertest");
const { useSharedServer } = require("./helpers/testServer");

// No page uses an MoJ component yet (CBLT-130 adopts the first one), so until
// then this is the only thing holding the wiring up.

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

  it("serves the MoJ component styles in the compiled stylesheet", async () => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    expect(response.status).toBe(200);
    expect(response.text).toContain(".moj-search");
  });

  it("still serves the GDS Transport font faces, which MoJ's vendored config drops", async () => {
    const response = await request(getServer()).get("/stylesheets/main.css");

    expect(response.text.match(/@font-face/g)).toHaveLength(2);
    expect(response.text).toContain('font-family:"GDS Transport"');
  });
});
