const request = require("supertest");
const createApp = require("../src/app");
const { extractCsrfToken } = require("./helpers/extractCsrfToken");
const {
  toStr,
  validateDetails,
  validateStandardDetails,
  FAVOURITE_ANIMAL_MAX_LENGTH,
} = require("../src/validation/applyValidation");

const VALID_STANDARD_DETAILS = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  "dateOfBirth-day": "27",
  "dateOfBirth-month": "3",
  "dateOfBirth-year": "1985",
};

describe("toStr", () => {
  it("returns an empty string for undefined", () => {
    expect(toStr(undefined)).toBe("");
  });

  it("trims a plain string", () => {
    expect(toStr("  hello  ")).toBe("hello");
  });

  it("takes the first value and trims it when express.urlencoded coerces a repeated key into an array", () => {
    expect(toStr(["  cat  ", "dog"])).toBe("cat");
  });

  it("returns an empty string for an empty array", () => {
    expect(toStr([])).toBe("");
  });
});

describe("validateStandardDetails", () => {
  it("is valid with favouriteAnimal left blank, and always returns the key", () => {
    const result = validateStandardDetails({ ...VALID_STANDARD_DETAILS });

    expect(result.isValid).toBe(true);
    expect(result.values.favouriteAnimal).toBe("");
    expect(result.fieldErrors.favouriteAnimal).toBeUndefined();
  });

  it("is valid with favouriteAnimal at exactly the max length", () => {
    const exactlyMax = "a".repeat(FAVOURITE_ANIMAL_MAX_LENGTH);
    const result = validateStandardDetails({
      ...VALID_STANDARD_DETAILS,
      favouriteAnimal: exactlyMax,
    });

    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.favouriteAnimal).toBeUndefined();
  });

  it("rejects a favouriteAnimal longer than the max length", () => {
    const tooLong = "a".repeat(FAVOURITE_ANIMAL_MAX_LENGTH + 1);
    const result = validateStandardDetails({
      ...VALID_STANDARD_DETAILS,
      favouriteAnimal: tooLong,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      text: "Favourite animal must be 100 characters or fewer",
      href: "#favouriteAnimal",
    });
    expect(result.fieldErrors.favouriteAnimal).toBe(
      "Favourite animal must be 100 characters or fewer",
    );
  });

  it("trims the favouriteAnimal value", () => {
    const result = validateStandardDetails({
      ...VALID_STANDARD_DETAILS,
      favouriteAnimal: "  Otter  ",
    });

    expect(result.values.favouriteAnimal).toBe("Otter");
  });
});

describe("validateDetails (shared by the housing flows)", () => {
  it("does not include favouriteAnimal even if present in the request body", () => {
    const result = validateDetails({ ...VALID_STANDARD_DETAILS, favouriteAnimal: "Cat" });

    expect(result.values).not.toHaveProperty("favouriteAnimal");
  });
});

describe("application journey - validation", () => {
  it("shows the slashed date of birth hint example", async () => {
    const app = createApp();
    const detailsPage = await request(app).get("/apply/details");

    expect(detailsPage.status).toBe(200);
    expect(detailsPage.text).toContain("For example, 27/3/1985");
  });

  it("shows the error summary and per-field errors for invalid input", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent.post("/apply/details").type("form").send({
      _csrf: token,
      fullName: "",
      email: "not-an-email",
      "dateOfBirth-day": "31",
      "dateOfBirth-month": "2",
      "dateOfBirth-year": "2020",
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain("There is a problem");
    expect(response.text).toContain("Enter your full name");
    expect(response.text).toContain("Enter an email address in the correct format");
    expect(response.text).toContain("Date of birth must be a real date");
  });

  it("does not 500 when every scalar field is submitted as a duplicated parameter, and takes the first value", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    const response = await agent
      .post("/apply/details")
      .type("form")
      .send({
        _csrf: token,
        fullName: ["Ada Lovelace", "Ignored Duplicate"],
        email: ["ada@example.com", "ignored@example.com"],
        "dateOfBirth-day": ["27", "1"],
        "dateOfBirth-month": ["3", "1"],
        "dateOfBirth-year": ["1985", "2000"],
        favouriteAnimal: ["Cat", "Dog"],
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/apply/check-answers");

    // Re-fetch details to confirm the repopulated value is the first one submitted.
    const detailsAgain = await agent.get("/apply/details");
    expect(detailsAgain.text).toMatch(/name="favouriteAnimal"[^>]*value="Cat"/);
    expect(detailsAgain.text).not.toContain("Dog");
  });

  it("shows a favouriteAnimal error, keeps the entered value, and points at the field for a too-long submission", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    const tooLong = "a".repeat(FAVOURITE_ANIMAL_MAX_LENGTH + 1);
    const response = await agent.post("/apply/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      favouriteAnimal: tooLong,
    });

    expect(response.status).toBe(400);
    expect(response.text).toContain('href="#favouriteAnimal"');
    expect(response.text).toContain("Favourite animal must be 100 characters or fewer");
    expect(response.text).toContain(`value="${tooLong}"`);
  });

  it("renders the favouriteAnimal input wired to the correct field name and value", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    await agent.post("/apply/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      favouriteAnimal: "Otter",
    });

    const detailsAgain = await agent.get("/apply/details");
    expect(detailsAgain.text).toMatch(/name="favouriteAnimal"[^>]*value="Otter"/);
  });

  it("repopulates then clears the favouriteAnimal value across two submissions", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const token = extractCsrfToken(detailsPage.text);

    await agent.post("/apply/details").type("form").send({
      _csrf: token,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      favouriteAnimal: "Otter",
    });

    const repopulated = await agent.get("/apply/details");
    expect(repopulated.text).toMatch(/name="favouriteAnimal"[^>]*value="Otter"/);

    const secondToken = extractCsrfToken(repopulated.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: secondToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
      favouriteAnimal: "",
    });

    const cleared = await agent.get("/apply/details");
    expect(cleared.text).not.toMatch(/name="favouriteAnimal"[^>]*value="Otter"/);
    expect(cleared.text).toMatch(/name="favouriteAnimal"[^>]*value=""/);
  });

  it("blocks check-answers and confirmation without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply/details");

    const confirmation = await agent.get("/apply/confirmation");
    expect(confirmation.status).toBe(302);
    expect(confirmation.headers.location).toBe("/");
  });

  it("blocks preferences without completing the details step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const preferences = await agent.get("/apply/preferences");
    expect(preferences.status).toBe(302);
    expect(preferences.headers.location).toBe("/apply/details");
  });

  it("blocks check-answers without completing the preferences step", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(302);
    expect(checkAnswers.headers.location).toBe("/apply/preferences");
  });

  it("accepts a single checked preference sent as a plain string, not an array", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    const submitPreferences = await agent
      .post("/apply/preferences")
      .type("form")
      .send({ _csrf: preferencesToken, preferences: "animals" });
    expect(submitPreferences.status).toBe(302);
    expect(submitPreferences.headers.location).toBe("/apply/check-answers");

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.text).toContain("Animals");
  });

  it("does not wipe a previously submitted preferences answer when re-editing details", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const detailsPage = await agent.get("/apply/details");
    const detailsToken = extractCsrfToken(detailsPage.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsToken,
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const preferencesPage = await agent.get("/apply/preferences");
    const preferencesToken = extractCsrfToken(preferencesPage.text);
    await agent
      .post("/apply/preferences")
      .type("form")
      .send({ _csrf: preferencesToken, preferences: "animals" });

    const detailsAgain = await agent.get("/apply/details");
    const detailsTokenAgain = extractCsrfToken(detailsAgain.text);
    await agent.post("/apply/details").type("form").send({
      _csrf: detailsTokenAgain,
      fullName: "Ada Lovelace-Updated",
      email: "ada@example.com",
      "dateOfBirth-day": "27",
      "dateOfBirth-month": "3",
      "dateOfBirth-year": "1985",
    });

    const checkAnswers = await agent.get("/apply/check-answers");
    expect(checkAnswers.status).toBe(200);
    expect(checkAnswers.text).toContain("Ada Lovelace-Updated");
    expect(checkAnswers.text).toContain("Animals");
  });

  it("returns 404 for an unknown route", async () => {
    const app = createApp();
    const response = await request(app).get("/not-a-real-page");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Page not found");
  });
});
