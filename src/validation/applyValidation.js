const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// express.urlencoded({ extended: false }) parses a repeated key (e.g.
// ?favouriteAnimal=cat&favouriteAnimal=dog) into an array, so a body field
// can't be assumed to be a string or undefined. This normalises any of
// those shapes to a single trimmed string, taking the first value for a
// duplicated parameter (the conventional choice, matching what
// `extended: true` would surface).
function toStr(value) {
  if (Array.isArray(value)) value = value[0];
  return typeof value === "string" ? value.trim() : "";
}

function toInt(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isRealDate(day, month, year) {
  if (day === null || month === null || year === null) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateDetails(body) {
  const values = {
    fullName: toStr(body.fullName),
    email: toStr(body.email),
    dobDay: toStr(body["dateOfBirth-day"]),
    dobMonth: toStr(body["dateOfBirth-month"]),
    dobYear: toStr(body["dateOfBirth-year"]),
  };

  const errors = [];
  const fieldErrors = {};
  const dateErrorParts = { day: false, month: false, year: false };

  if (!values.fullName) {
    errors.push({ text: "Enter your full name", href: "#fullName" });
    fieldErrors.fullName = "Enter your full name";
  } else if (values.fullName.length > 200) {
    errors.push({ text: "Full name must be 200 characters or fewer", href: "#fullName" });
    fieldErrors.fullName = "Full name must be 200 characters or fewer";
  }

  if (!values.email) {
    errors.push({ text: "Enter your email address", href: "#email" });
    fieldErrors.email = "Enter your email address";
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.push({ text: "Enter an email address in the correct format", href: "#email" });
    fieldErrors.email = "Enter an email address in the correct format";
  }

  const day = toInt(values.dobDay);
  const month = toInt(values.dobMonth);
  const year = toInt(values.dobYear);
  const dateProvided = values.dobDay || values.dobMonth || values.dobYear;

  if (!dateProvided) {
    errors.push({ text: "Enter your date of birth", href: "#dateOfBirth-day" });
    fieldErrors.dateOfBirth = "Enter your date of birth";
    dateErrorParts.day = true;
    dateErrorParts.month = true;
    dateErrorParts.year = true;
  } else if (day === null || month === null || year === null) {
    errors.push({
      text: "Date of birth must include a day, month and year",
      href: "#dateOfBirth-day",
    });
    fieldErrors.dateOfBirth = "Date of birth must include a day, month and year";
    dateErrorParts.day = day === null;
    dateErrorParts.month = month === null;
    dateErrorParts.year = year === null;
  } else if (!isRealDate(day, month, year)) {
    errors.push({ text: "Date of birth must be a real date", href: "#dateOfBirth-day" });
    fieldErrors.dateOfBirth = "Date of birth must be a real date";
    dateErrorParts.day = true;
    dateErrorParts.month = true;
    dateErrorParts.year = true;
  } else if (new Date(year, month - 1, day) > new Date()) {
    errors.push({ text: "Date of birth must be in the past", href: "#dateOfBirth-day" });
    fieldErrors.dateOfBirth = "Date of birth must be in the past";
    dateErrorParts.day = true;
    dateErrorParts.month = true;
    dateErrorParts.year = true;
  }

  return { values, errors, fieldErrors, dateErrorParts, isValid: errors.length === 0 };
}

const FAVOURITE_ANIMAL_MAX_LENGTH = 100;

function validateStandardDetails(body) {
  const base = validateDetails(body);
  const favouriteAnimal = toStr(body.favouriteAnimal);

  const values = { ...base.values, favouriteAnimal };
  const errors = [...base.errors];
  const fieldErrors = { ...base.fieldErrors };

  if (favouriteAnimal.length > FAVOURITE_ANIMAL_MAX_LENGTH) {
    errors.push({
      text: `Favourite animal must be ${FAVOURITE_ANIMAL_MAX_LENGTH} characters or fewer`,
      href: "#favouriteAnimal",
    });
    fieldErrors.favouriteAnimal = `Favourite animal must be ${FAVOURITE_ANIMAL_MAX_LENGTH} characters or fewer`;
  }

  return {
    values,
    errors,
    fieldErrors,
    dateErrorParts: base.dateErrorParts,
    isValid: errors.length === 0,
  };
}

const PREFERENCE_OPTIONS = [
  { value: "food", text: "Food" },
  { value: "animals", text: "Animals" },
  { value: "ai", text: "Artificial intelligence (AI)" },
];

function validatePreferences(body) {
  const raw = body.preferences;
  const preferences = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

  return {
    values: { preferences },
    errors: [],
    fieldErrors: {},
    dateErrorParts: {},
    isValid: true,
  };
}

function preferenceLabels(preferences) {
  if (!preferences || preferences.length === 0) {
    return "None selected";
  }
  const labelByValue = new Map(PREFERENCE_OPTIONS.map((option) => [option.value, option.text]));
  return preferences.map((value) => labelByValue.get(value) || value).join(", ");
}

module.exports = {
  toStr,
  validateDetails,
  validateStandardDetails,
  FAVOURITE_ANIMAL_MAX_LENGTH,
  validatePreferences,
  PREFERENCE_OPTIONS,
  preferenceLabels,
};
