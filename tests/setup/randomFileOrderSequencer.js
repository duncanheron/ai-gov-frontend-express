const Sequencer = require("@jest/test-sequencer").default;

// Mulberry32: a small deterministic PRNG seedable from a 32-bit integer. Math.random() cannot be
// seeded, and an unreplayable order is what makes an isolation bug a one-shot CI flake instead of
// something you can chase down.
function mulberry32(seed) {
  let state = seed;

  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveSeed() {
  const fromEnv = Number(process.env.JEST_SEQUENCER_SEED);
  return Number.isInteger(fromEnv) ? fromEnv : Math.floor(Math.random() * 2 ** 31);
}

// `jest --randomize` only shuffles tests within a file, so it can't prove cross-file isolation -
// file order comes from the test sequencer instead. The seed is logged and replayable via
// JEST_SEQUENCER_SEED=<seed>, so a run that catches an isolation bug can be reproduced exactly.
class RandomFileOrderSequencer extends Sequencer {
  sort(tests) {
    const seed = resolveSeed();
    const random = mulberry32(seed);

    // console.error, not console.log - this runs in the orchestrating process and `--json`
    // writes its report to the same stdout, so anything else on stdout breaks JSON.parse.
    console.error(`Test file order seed: ${seed} (replay with JEST_SEQUENCER_SEED=${seed})`);

    // Jest's own discovery order isn't guaranteed stable across runs, and the same seed must
    // produce the same shuffle regardless of it - sort to a canonical order first.
    const shuffled = [...tests].sort((a, b) => (a.path > b.path ? 1 : -1));
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }
}

module.exports = RandomFileOrderSequencer;
