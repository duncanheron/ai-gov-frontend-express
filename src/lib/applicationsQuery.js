const { URLSearchParams } = require("node:url");
const { toStr } = require("../validation/applyValidation");

// Postgres text cannot hold a NUL byte, so a control character reaching the query is
// a 500 (SQLSTATE 22021) that any caller can trigger from the URL. None of them mean
// anything in a name, so they are stripped rather than rejected.
const CONTROL_CHARACTERS = /\p{Cc}/gu;

// The apply form caps full_name at 200 characters, so a longer term cannot match
// anything and only widens what a search reflects back into the page.
const MAX_NAME_LENGTH = 200;

const PATH = "/applications";

// Every value `flow` can hold, with the label the caseworker sees. The checkboxes and
// the selected-filter tags both read this, so a label cannot drift between them.
const SERVICES = [
  { value: "standard", label: "General application" },
  { value: "housing", label: "Housing" },
  { value: "housing-benefit-disability", label: "Housing Benefit (disability)" },
  { value: "council-tax", label: "Council tax" },
  { value: "garden-waste", label: "Garden waste" },
];

const SERVICE_LABELS = new Map(SERVICES.map(({ value, label }) => [value, label]));

function serviceLabel(value) {
  return SERVICE_LABELS.get(value);
}

// The columns a caseworker can order by, with the heading each one labels.
// `Reference` is deliberately absent - it sorts by nothing a caseworker wants.
const SORTS = [
  { key: "name", label: "Full name" },
  { key: "submitted", label: "Submitted" },
];

const DIRECTIONS = ["ascending", "descending"];
const DEFAULT_SORT = "submitted";
const DEFAULT_DIRECTION = "descending";

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

// `service` is repeatable, so Express hands it over as a string, an array or nothing
// depending on how many boxes were ticked. `toStr` cannot express that - it collapses an
// array to its first element, so two ticked boxes would silently become one. Filtering
// SERVICES by what was asked for whitelists, de-duplicates and orders in one pass:
// unrecognised values never reach SQL, and a link built from the result is stable
// whatever order the URL listed them in.
function toServices(value) {
  const requested = new Set(Array.isArray(value) ? value : [value]);
  return SERVICES.map(({ value: service }) => service).filter((service) => requested.has(service));
}

// The query string behind /applications. `name` is always a bounded, trimmed string,
// so a hand-edited ?name=a&name=b reaches the query layer as the first value rather
// than as an array.
function parse(query) {
  return {
    // Slice then trim: trimming first can leave the cut end on a space, which then
    // reflects into every link and parses back as a different term.
    name: toStr(query.name).replace(CONTROL_CHARACTERS, "").slice(0, MAX_NAME_LENGTH).trim(),
    services: toServices(query.service),
    // An unrecognised sort falls back rather than erroring, so a hand-edited URL
    // is a normal page. This is also what keeps an arbitrary string away from
    // ORDER BY, which cannot take a bound parameter.
    sort: oneOf(
      toStr(query.sort),
      SORTS.map(({ key }) => key),
      DEFAULT_SORT,
    ),
    direction: oneOf(toStr(query.direction), DIRECTIONS, DEFAULT_DIRECTION),
  };
}

// Every link on the list page is this page with one thing changed - drop a service, clear
// the search - so they are all built from the parsed current query rather than assembled
// by hand. CBLT-137's sort links join here as another entry in `changes`.
function buildUrl(current = {}, changes = {}) {
  const {
    name = "",
    services = [],
    sort = DEFAULT_SORT,
    direction = DEFAULT_DIRECTION,
  } = { ...current, ...changes };

  const params = new URLSearchParams();
  if (name) {
    params.set("name", name);
  }
  for (const service of services) {
    params.append("service", service);
  }
  // The default order is what a bare /applications already gives, so leaving it
  // out keeps the cleared list at /applications rather than a URL that only
  // looks like a filter.
  if (sort !== DEFAULT_SORT || direction !== DEFAULT_DIRECTION) {
    params.set("sort", sort);
    params.set("direction", direction);
  }

  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

// Where a column heading points: this page ordered by that column, reversed if it
// is already the active one, and always ascending when arriving at a new column.
function sortUrl(current, key) {
  const reversed = current.sort === key && current.direction === "ascending";
  return buildUrl(current, { sort: key, direction: reversed ? "descending" : "ascending" });
}

module.exports = {
  parse,
  buildUrl,
  sortUrl,
  serviceLabel,
  SERVICES,
  SORTS,
  MAX_NAME_LENGTH,
  DEFAULT_SORT,
  DEFAULT_DIRECTION,
};
