// Fixed amount for the council tax payment demo flow: £150.00.
const COUNCIL_TAX_AMOUNT_PENCE = 15000;

// Per-bin, per-year price for the garden waste payment demo flow: £45.00.
const GARDEN_WASTE_PENCE_PER_BIN_PER_YEAR = 4500;

// Formats an integer number of pence as a GBP string, e.g. 12345 -> "£123.45".
// This is a demo service - no payment is ever actually taken.
function formatPence(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

module.exports = {
  formatPence,
  COUNCIL_TAX_AMOUNT_PENCE,
  GARDEN_WASTE_PENCE_PER_BIN_PER_YEAR,
};
