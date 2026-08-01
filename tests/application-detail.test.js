const request = require("supertest");
const applications = require("../src/db/applications");
const { useSharedServer } = require("./helpers/testServer");

const getServer = useSharedServer();

describe("application detail page", () => {
  beforeAll(async () => {
    await applications.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      dateOfBirth: "1985-03-27",
      reference: "TEST-DETAIL",
      submittedAt: new Date("2026-01-02T09:00:00.000Z"),
    });
  });

  it("shows full application details for a known reference", async () => {
    const response = await request(getServer()).get("/applications/TEST-DETAIL");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Ada Lovelace");
    expect(response.text).toContain("ada@example.com");
    expect(response.text).toContain("27/03/1985");
    expect(response.text).toContain("TEST-DETAIL");
    expect(response.text).toContain("02/01/2026");
    expect(response.text).toContain("None selected");
  });

  it("shows selected preferences as human-readable labels", async () => {
    await applications.create({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-DETAIL-PREFS",
      submittedAt: new Date("2026-01-03T09:00:00.000Z"),
      preferences: ["food", "ai"],
    });

    const response = await request(getServer()).get("/applications/TEST-DETAIL-PREFS");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Food, Artificial intelligence (AI)");
  });

  it("shows the housing situation for a housing flow application", async () => {
    await applications.create({
      fullName: "Rosalind Franklin",
      email: "rosalind@example.com",
      dateOfBirth: "1920-07-25",
      reference: "TEST-DETAIL-HOUSING",
      submittedAt: new Date("2026-01-04T09:00:00.000Z"),
      flow: "housing",
      flowAnswer: "Renting privately",
    });

    const response = await request(getServer()).get("/applications/TEST-DETAIL-HOUSING");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Housing situation");
    expect(response.text).toContain("Renting privately");
  });

  it("shows the disability details for a housing benefit disability flow application", async () => {
    await applications.create({
      fullName: "Dorothy Hodgkin",
      email: "dorothy@example.com",
      dateOfBirth: "1910-05-12",
      reference: "TEST-DETAIL-DISABILITY",
      submittedAt: new Date("2026-01-05T09:00:00.000Z"),
      flow: "housing-benefit-disability",
      flowAnswer: "Some disability details text",
    });

    const response = await request(getServer()).get("/applications/TEST-DETAIL-DISABILITY");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Disability details");
    expect(response.text).toContain("Some disability details text");
  });

  it("shows the favourite animal row, key and value together, when a value was provided", async () => {
    await applications.create({
      fullName: "Katherine Johnson",
      email: "katherine@example.com",
      dateOfBirth: "1918-08-26",
      reference: "TEST-DETAIL-FAVOURITE-ANIMAL",
      submittedAt: new Date("2026-01-06T09:00:00.000Z"),
      favouriteAnimal: "Otter",
    });

    const response = await request(getServer()).get("/applications/TEST-DETAIL-FAVOURITE-ANIMAL");

    expect(response.status).toBe(200);
    expect(response.text).toMatch(
      /Favourite animal\s*<\/dt>\s*<dd class="govuk-summary-list__value">\s*Otter/,
    );
  });

  it("shows no favourite animal row when favourite_animal is NULL, regardless of flow", async () => {
    const applicationsWithoutFavouriteAnimal = [
      { reference: "TEST-DETAIL-NO-ANIMAL-STANDARD" },
      {
        reference: "TEST-DETAIL-NO-ANIMAL-HOUSING",
        flow: "housing",
        flowAnswer: "Renting privately",
      },
      {
        reference: "TEST-DETAIL-NO-ANIMAL-DISABILITY",
        flow: "housing-benefit-disability",
        flowAnswer: "Some disability details text",
      },
    ];

    for (const { reference, flow, flowAnswer } of applicationsWithoutFavouriteAnimal) {
      await applications.create({
        fullName: "No Animal",
        email: "no-animal@example.com",
        dateOfBirth: "1990-01-01",
        reference,
        submittedAt: new Date("2026-01-08T09:00:00.000Z"),
        flow,
        flowAnswer,
      });

      const response = await request(getServer()).get(`/applications/${reference}`);

      expect(response.status).toBe(200);
      expect(response.text).not.toContain("Favourite animal");
    }
  });

  it("shows no favourite animal row when favourite_animal is an empty string (legacy/empty row)", async () => {
    await applications.create({
      fullName: "Chien-Shiung Wu",
      email: "chien-shiung@example.com",
      dateOfBirth: "1912-05-31",
      reference: "TEST-DETAIL-EMPTY-FAVOURITE-ANIMAL",
      submittedAt: new Date("2026-01-07T09:00:00.000Z"),
      favouriteAnimal: "",
    });

    const response = await request(getServer()).get(
      "/applications/TEST-DETAIL-EMPTY-FAVOURITE-ANIMAL",
    );

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("Favourite animal");
  });

  it("shows no flow-specific row for a standard flow application", async () => {
    const response = await request(getServer()).get("/applications/TEST-DETAIL");

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("Housing situation");
    expect(response.text).not.toContain("Disability details");
  });

  it("returns a 404 for an unknown reference", async () => {
    const response = await request(getServer()).get("/applications/DOES-NOT-EXIST");

    expect(response.status).toBe(404);
  });
});
