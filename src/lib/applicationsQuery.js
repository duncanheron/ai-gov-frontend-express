const { toStr } = require("../validation/applyValidation");

// Postgres text cannot hold a NUL byte, so a control character reaching the query is
// a 500 (SQLSTATE 22021) that any caller can trigger from the URL. None of them mean
// anything in a name, so they are stripped rather than rejected.
const CONTROL_CHARACTERS = /\p{Cc}/gu;

// The apply form caps full_name at 200 characters, so a longer term cannot match
// anything and only widens what a search reflects back into the page.
const MAX_NAME_LENGTH = 200;

// The query string behind /applications. `name` is always a bounded, trimmed string,
// so a hand-edited ?name=a&name=b reaches the query layer as the first value rather
// than as an array. The sort and pagination links join it here as
// buildUrl(current, changes).
function parse(query) {
  return {
    name: toStr(query.name).replace(CONTROL_CHARACTERS, "").trim().slice(0, MAX_NAME_LENGTH),
  };
}

module.exports = { parse, MAX_NAME_LENGTH };
