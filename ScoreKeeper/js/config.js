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
    notes: "First player to 500 points wins.",
  },
  phase10: {
    label: "Phase 10",
    target: 10,
    winMode: "high",
    teams: false,
    notes: "Tracking phases completed (not points).",
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
      "Standard scoring: you score points from opponents’ remaining cards. First to 100+ wins.",
  },
};

export const PRESET_BACKGROUNDS = {
  uno: "./img/Uno.png",
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
    phase10YesNo: "Phase 10 scores must be Yes/No only.",
    heartsTotalWarning: ({
      contextLabel,
      total,
      normalTotal,
      shootMoonTotal,
    }) =>
      `Hearts ${contextLabel} total is ${total} (typical is ${normalTotal}, or ${shootMoonTotal} when someone shoots the moon).`,
  },
};
