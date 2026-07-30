const request = require("supertest");
const applications = require("../../src/db/applications");
const { extractCsrfToken } = require("../helpers/extractCsrfToken");
const { prepareTestDatabase } = require("../helpers/prepareTestDatabase");
const { useSharedServer } = require("../helpers/testServer");

const getServer = useSharedServer();

describe("applications data module", () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  it("creates an application then fetches it back by reference", async () => {
    const submittedAt = new Date();

    const created = await applications.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      dateOfBirth: "1985-03-27",
      reference: "TEST-001",
      submittedAt,
    });

    expect(created.reference).toBe("TEST-001");

    const found = await applications.get("TEST-001");

    expect(found).not.toBeNull();
    expect(found.full_name).toBe("Ada Lovelace");
    expect(found.email).toBe("ada@example.com");
    expect(found.reference).toBe("TEST-001");
  });

  it("returns null for an unknown reference", async () => {
    const found = await applications.get("DOES-NOT-EXIST");

    expect(found).toBeNull();
  });

  it("creates an application with preferences and reads them back", async () => {
    await applications.create({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      dateOfBirth: "1906-12-09",
      reference: "TEST-PREFS",
      submittedAt: new Date(),
      preferences: ["food", "animals"],
    });

    const found = await applications.get("TEST-PREFS");

    expect(found.preferences).toEqual(["food", "animals"]);
  });

  it("defaults preferences to an empty array when not provided", async () => {
    await applications.create({
      fullName: "Alan Turing",
      email: "alan@example.com",
      dateOfBirth: "1912-06-23",
      reference: "TEST-NO-PREFS",
      submittedAt: new Date(),
    });

    const found = await applications.get("TEST-NO-PREFS");

    expect(found.preferences).toEqual([]);
  });

  it("creates an application with a flow and flow answer and reads them back", async () => {
    await applications.create({
      fullName: "Katherine Johnson",
      email: "katherine@example.com",
      dateOfBirth: "1918-08-26",
      reference: "TEST-FLOW",
      submittedAt: new Date(),
      flow: "housing",
      flowAnswer: "yes",
    });

    const found = await applications.get("TEST-FLOW");

    expect(found.flow).toBe("housing");
    expect(found.flow_answer).toBe("yes");
  });

  it("defaults flow to 'standard' and flow_answer to null when not provided", async () => {
    await applications.create({
      fullName: "Rosalind Franklin",
      email: "rosalind@example.com",
      dateOfBirth: "1920-07-25",
      reference: "TEST-NO-FLOW",
      submittedAt: new Date(),
    });

    const found = await applications.get("TEST-NO-FLOW");

    expect(found.flow).toBe("standard");
    expect(found.flow_answer).toBeNull();
  });

  it("creates an application with a favourite animal and reads it back", async () => {
    await applications.create({
      fullName: "Marie Curie",
      email: "marie@example.com",
      dateOfBirth: "1867-11-07",
      reference: "TEST-FAVOURITE-ANIMAL",
      submittedAt: new Date(),
      favouriteAnimal: "Otter",
    });

    const found = await applications.get("TEST-FAVOURITE-ANIMAL");

    expect(found.favourite_animal).toBe("Otter");
  });

  it("defaults favourite_animal to null when not provided", async () => {
    await applications.create({
      fullName: "Chien-Shiung Wu",
      email: "chien-shiung@example.com",
      dateOfBirth: "1912-05-31",
      reference: "TEST-NO-FAVOURITE-ANIMAL",
      submittedAt: new Date(),
    });

    const found = await applications.get("TEST-NO-FAVOURITE-ANIMAL");

    expect(found.favourite_animal).toBeNull();
  });

  async function submitStandardApplication({ agent, favouriteAnimal }) {
    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      favouriteAnimal,
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    await agent.post("/apply/preferences").type("form").send({ _csrf: preferencesToken });

    const checkAnswers = await agent.get("/apply/check-answers");
    const checkAnswersToken = extractCsrfToken(checkAnswers.text);
    const submitFinal = await agent
      .post("/apply/check-answers")
      .type("form")
      .send({ _csrf: checkAnswersToken });

    const confirmation = await agent.get(submitFinal.headers.location);
    const [, reference] = confirmation.text.match(/([A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{3})/);
    return reference;
  }

  it("stores a blank favourite animal answer submitted through the full route as NULL, not an empty string", async () => {
    const agent = request.agent(getServer());

    const reference = await submitStandardApplication({ agent, favouriteAnimal: "" });

    const stored = await applications.get(reference);
    expect(stored.favourite_animal).toBeNull();
  });

  it("stores a real favourite animal answer submitted through the full route", async () => {
    const agent = request.agent(getServer());

    const reference = await submitStandardApplication({ agent, favouriteAnimal: "Otter" });

    const stored = await applications.get(reference);
    expect(stored.favourite_animal).toBe("Otter");
  });
});
