const express = require("express");

const applications = require("../db/applications");
const applicationsQuery = require("../lib/applicationsQuery");
const { preferenceLabels } = require("../validation/applyValidation");

const router = express.Router();

function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

const flowAnswerLabels = {
  housing: "Housing situation",
  "housing-benefit-disability": "Disability details",
  "council-tax": "Council tax payment",
  "garden-waste": "Garden waste payment",
};

router.get("/", async (req, res) => {
  const { name } = applicationsQuery.parse(req.query);
  const matching = await applications.list({ name });

  res.render("applications/list.njk", {
    searchName: name,
    applications: matching.map((application) => ({
      fullName: application.full_name,
      reference: application.reference,
      submittedFormatted: formatDate(application.submitted_at),
    })),
    tableCaption: name ? `Applications matching “${name}”` : "All applications",
    // A search box is pointless with nothing to search, but must stay on screen
    // while a search is applied so the caseworker can change or clear it.
    showSearch: matching.length > 0 || Boolean(name),
  });
});

router.get("/:reference", async (req, res, next) => {
  const application = await applications.get(req.params.reference);

  if (!application) {
    return next();
  }

  const flowAnswerLabel = flowAnswerLabels[application.flow];

  res.render("applications/detail.njk", {
    fullName: application.full_name,
    email: application.email,
    dateOfBirthFormatted: formatDate(application.date_of_birth),
    reference: application.reference,
    submittedAtFormatted: formatDate(application.submitted_at),
    preferencesLabel: preferenceLabels(application.preferences),
    favouriteAnimal: application.favourite_animal || undefined,
    flowAnswerLabel,
    flowAnswer: flowAnswerLabel ? application.flow_answer : undefined,
  });
});

module.exports = router;
