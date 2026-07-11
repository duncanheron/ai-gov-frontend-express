const express = require("express");

const registrations = require("../db/registrations");

const router = express.Router();

function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

router.get("/", async (req, res) => {
  const allRegistrations = await registrations.list();

  res.render("registrations/list.njk", {
    rows: allRegistrations.map((registration) => [
      { text: registration.full_name },
      {
        html: `<a class="govuk-link" href="/registrations/${registration.reference}">${registration.reference}</a>`,
      },
      { text: formatDate(registration.submitted_at) },
    ]),
  });
});

router.get("/:reference", async (req, res, next) => {
  const registration = await registrations.get(req.params.reference);

  if (!registration) {
    return next();
  }

  res.render("registrations/detail.njk", {
    fullName: registration.full_name,
    email: registration.email,
    dateOfBirthFormatted: formatDate(registration.date_of_birth),
    reference: registration.reference,
    submittedAtFormatted: formatDate(registration.submitted_at),
  });
});

module.exports = router;
