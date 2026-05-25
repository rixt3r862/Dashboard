import test from "node:test";
import assert from "node:assert/strict";

import { PRESET_BACKGROUNDS, PRESETS } from "../js/config.js";

test("5 Crowns preset is configured for ScoreKeeper sessions", () => {
  assert.deepEqual(PRESETS.fivecrowns, {
    label: "5 Crowns",
    target: 11,
    winMode: "low",
    teams: false,
    notes:
      "Fixed 11-round session. Enter each player's remaining deadwood points; lowest total score wins.",
  });

  assert.equal(PRESET_BACKGROUNDS.fivecrowns, "./img/5 Crowns.png");
});
