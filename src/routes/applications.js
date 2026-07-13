const express = require("express");

const applications = require("../db/applications");

const router = express.Router();

function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

router.get("/", async (req, res) => {
  const allApplications = await applications.list();

  res.render("applications/list.njk", {
    rows: allApplications.map((application) => [
      { text: application.full_name },
      {
        html: `<a class="govuk-link" href="/applications/${application.reference}">${application.reference}</a>`,
      },
      { text: formatDate(application.submitted_at) },
    ]),
  });
});

router.get("/:reference", async (req, res, next) => {
  const application = await applications.get(req.params.reference);

  if (!application) {
    return next();
  }

  res.render("applications/detail.njk", {
    fullName: application.full_name,
    email: application.email,
    dateOfBirthFormatted: formatDate(application.date_of_birth),
    reference: application.reference,
    submittedAtFormatted: formatDate(application.submitted_at),
  });
});

module.exports = router;
