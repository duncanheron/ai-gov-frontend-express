const Sequencer = require("@jest/test-sequencer").default;

// `jest --randomize` only shuffles tests within a file, so it can't prove cross-file isolation -
// file order comes from the test sequencer instead. This one shuffles it on every run, which is
// how CBLT-131 proved that no file depends on another's leftover state or on run order.
class RandomFileOrderSequencer extends Sequencer {
  sort(tests) {
    const shuffled = [...tests];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }
}

module.exports = RandomFileOrderSequencer;
