export const PRESETS = {
  custom: {
    label: "Custom",
    target: null,
    winMode: "high",
    teams: false,
    notes: "",
  },
  uno: {
    label: "Uno",
    target: 500,
    winMode: "high",
    teams: false,
    notes:
      "Winner-only scoring: enter opponents' hand points and set winner to 0. App totals opponents into winner points.",
  },
  quiz: {
    label: "Quiz",
    target: 60,
    winMode: "high",
    teams: false,
    defaultPlayers: 1,
    minPlayers: 1,
    notes:
      "Each player can earn 0 or 1 point per round. Use the point button to award the round point.",
  },
  rummikub: {
    label: "Rummikub",
    target: 3,
    winMode: "high",
    teams: false,
    notes:
      "Official-style session: enter each player's rack total, then declare the round winner. Standings rank by games won first, with cumulative score as the tiebreak.",
  },
  phase10: {
    label: "Phase 10",
    target: 10,
    winMode: "high",
    teams: false,
    notes:
      "Track leftover hand points each round and mark who completed their phase. First to finish Phase 10 wins; ties at the final phase go to the lowest total points.",
  },
  skyjo: {
    label: "SkyJo",
    target: 100,
    winMode: "low",
    teams: false,
    notes: "Lowest score wins. Negative scores possible.",
  },
  hearts: {
    label: "Hearts",
    target: 100,
    winMode: "low",
    teams: false,
    notes: "Lowest score wins. Shooting the moon applies.",
  },
  spades: {
    label: "Spades",
    target: 500,
    winMode: "high",
    teams: true,
    notes: "Partnership game. Scores are tracked per-player and summed by team.",
  },
  crazy8s: {
    label: "Crazy 8s",
    target: 100,
    winMode: "high",
    teams: false,
    notes:
      "Winner-only scoring: enter opponents' hand points and set winner to 0. App totals opponents into winner points.",
  },
};

export const PRESET_BACKGROUNDS = {
  uno: "./img/Uno.png",
  rummikub: "./img/Rummikub.jpg",
  phase10: "./img/Phase 10.png",
  crazy8s: "./img/Crazy8s.png",
  skyjo: "./img/SkyJo.png",
  hearts: "./img/Hearts.png",
  spades: "./img/Spades.png",
};

export const PRESET_TINT_OVERRIDES = {
  // Spades image tends to sample too light; use a stable slate-blue tint.
  spades: [70, 90, 120],
};

export const APP_LIMITS = {
  playerCountMin: 2,
  playerCountMax: 12,
  defaultPlayerCount: 4,
  targetMin: 1,
  targetMax: 1000000,
  defaultTarget: 100,
  scoreMin: -10000,
  scoreMax: 10000,
};

export const APP_MESSAGES = {
  setup: {
    minPlayers: "At least 2 players are required.",
    targetWholePositive: "Target must be a positive whole number.",
    allNamesRequired: "All player names are required.",
    uniqueNames: "Player names must be unique (case-insensitive).",
    spadesCountGuidance:
      "Spades is usually 4 players. You can still start, but teams are only auto-made for 4.",
    noValidSavedGame: "No valid saved game found.",
  },
  roundValidation: {
    wholeNumbers: "Scores must be whole numbers.",
    outOfRange: ({ name, value }) =>
      `Score for ${name} looks out of range (${value}).`,
    heartsTotalWarning: ({
      contextLabel,
      total,
      normalTotal,
      shootMoonTotal,
    }) =>
      `Hearts ${contextLabel} total is ${total} (typical is ${normalTotal}, or ${shootMoonTotal} when someone shoots the moon).`,
  },
};
