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
