const { toStr } = require("../validation/applyValidation");

// The query string behind /applications. `name` is always a trimmed string, so a
// hand-edited ?name=a&name=b reaches the query layer as the first value rather
// than as an array.
//
// The sibling tickets extend this module rather than adding their own: the sort
// and pagination links land here as buildUrl(current, changes).
function parse(query = {}) {
  return { name: toStr(query.name) };
}

module.exports = { parse };
