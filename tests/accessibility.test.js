const fs = require("node:fs");
const request = require("supertest");
const { JSDOM } = require("jsdom");
const { useSharedServer } = require("./helpers/testServer");
const { resetTestResponses } = require("../src/services/routeApplicationFlow");
const {
  buildAllPages,
  extractReference,
  reachCouncilTaxConfirmation,
  reachGardenWasteConfirmation,
} = require("./helpers/allPages");

const getServer = useSharedServer();

// Built once at module load: `get()` closures only call `getServer()` when
// invoked by a test, well after the shared server exists.
const pages = buildAllPages(getServer);

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function expectNoViolations(html) {
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  dom.window.eval(axeSource);
  const results = await dom.window.axe.run();
  dom.window.close();

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`)
      .join("\n");
    throw new Error(`Accessibility violations found:\n${summary}`);
  }
}

describe("accessibility", () => {
  afterEach(() => {
    resetTestResponses();
  });

  // Every page the service serves - including session-gated ones reached
  // partway through a journey - shares one enumeration with the structural
  // invariants suite (tests/invariants.test.js). See tests/helpers/allPages.js
  // and CBLT-114: a new page added there gets both checks automatically.
  it.each(pages)(
    "$name has no automatically detectable accessibility violations",
    async ({ get }) => {
      const response = await get();
      await expectNoViolations(response.text);
    },
  );

  // Regression test for CBLT-106: the flow-answer label map silently dropped
  // the council tax and garden waste flows, so the caseworker detail page
  // rendered without the answer even though the page itself loaded fine -
  // exactly the shape of false pass this suite otherwise guards against.
  it("council tax and garden waste applications both render their flow answer on the caseworker detail page and appear in the list", async () => {
    const councilTaxConfirmation = await reachCouncilTaxConfirmation(request.agent(getServer()));
    const councilTaxReference = extractReference(councilTaxConfirmation.text);

    const gardenWasteConfirmation = await reachGardenWasteConfirmation(request.agent(getServer()));
    const gardenWasteReference = extractReference(gardenWasteConfirmation.text);

    const councilTaxDetail = await request(getServer()).get(`/applications/${councilTaxReference}`);
    expect(councilTaxDetail.text).toContain("Council tax payment");
    expect(councilTaxDetail.text).toContain("Council tax - account 12345678, £150.00");

    const gardenWasteDetail = await request(getServer()).get(
      `/applications/${gardenWasteReference}`,
    );
    expect(gardenWasteDetail.text).toContain("Garden waste payment");
    expect(gardenWasteDetail.text).toContain("Garden waste - 2 bins, £90.00 per year");

    const list = await request(getServer()).get("/applications");
    expect(list.text).toContain(councilTaxReference);
    expect(list.text).toContain(gardenWasteReference);
  });
});
