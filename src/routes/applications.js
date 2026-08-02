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

const serviceListFormat = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

// A sortable heading carries its own link and the sort state a screen reader
// announces. `Reference` gets neither, so it renders as plain text.
function sortableHeading(current, key) {
  const { label } = applicationsQuery.SORTS.find((sort) => sort.key === key);
  return {
    text: label,
    href: applicationsQuery.sortUrl(current, key),
    ariaSort: current.sort === key ? current.direction : "none",
  };
}

router.get("/", async (req, res) => {
  const current = applicationsQuery.parse(req.query);
  const { name, services, sort, direction } = current;
  const matching = await applications.list({ name, services, sort, direction });

  // Both the caption and the no-matches message have to name the filter, or a partial
  // list reads as the whole one. They share this clause so they cannot describe
  // different filters.
  const inServices = services.length
    ? ` in ${serviceListFormat.format(services.map(applicationsQuery.serviceLabel))}`
    : "";
  const selected = new Set(services);

  let tableCaption = "All applications";
  if (name) {
    tableCaption = `Applications matching “${name}”${inServices}`;
  } else if (inServices) {
    tableCaption = `Applications${inServices}`;
  }

  res.render("applications/list.njk", {
    searchName: name,
    selectedServices: services,
    applications: matching.map((application) => ({
      fullName: application.full_name,
      reference: application.reference,
      submittedFormatted: formatDate(application.submitted_at),
    })),
    tableCaption,
    tableHead: [
      sortableHeading(current, "name"),
      { text: "Reference" },
      sortableHeading(current, "submitted"),
    ],
    noMatchesMessage: name
      ? `No applications match “${name}”${inServices}.`
      : `No applications${inServices}.`,
    serviceCheckboxes: applicationsQuery.SERVICES.map(({ value, label }) => ({
      value,
      text: label,
      checked: selected.has(value),
    })),
    // Undefined rather than empty so mojFilter renders no selected-filter block at all.
    selectedFilters: services.length
      ? {
          heading: { text: "Selected filters" },
          clearLink: { text: "Clear filters", href: applicationsQuery.buildUrl() },
          categories: [
            {
              heading: { text: "Service" },
              items: services.map((value) => ({
                text: applicationsQuery.serviceLabel(value),
                href: applicationsQuery.buildUrl(current, {
                  services: services.filter((other) => other !== value),
                }),
              })),
            },
          ],
        }
      : undefined,
    clearSearchHref: applicationsQuery.buildUrl(current, { name: "" }),
    // Null while the default order is showing, so the forms carry no redundant
    // fields and a plain search still lands on /applications?name=…
    activeOrder:
      sort === applicationsQuery.DEFAULT_SORT && direction === applicationsQuery.DEFAULT_DIRECTION
        ? null
        : { sort, direction },
    // The search box and filter panel are pointless with nothing to search, but stay on
    // screen while either is applied so the caseworker can change or clear them. An empty
    // database with a term is therefore the no-matches state, not "no applications yet".
    showControls: Boolean(name) || services.length > 0 || matching.length > 0,
    maxNameLength: applicationsQuery.MAX_NAME_LENGTH,
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
