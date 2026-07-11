const crypto = require("node:crypto");

// Excludes visually ambiguous characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReference() {
  const chars = Array.from({ length: 10 }, () => {
    const index = crypto.randomInt(0, ALPHABET.length);
    return ALPHABET[index];
  });

  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 7).join("")}-${chars.slice(7, 10).join("")}`;
}

module.exports = { generateReference };
