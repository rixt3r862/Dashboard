// scorekeeper.js
import {
  APP_LIMITS,
  APP_MESSAGES,
  PRESETS,
  PRESET_BACKGROUNDS,
  PRESET_TINT_OVERRIDES,
} from "./js/config.js";
import {
  adjustSkyjoRoundScores,
  determineWinnerFromTotals as resolveWinnerFromTotals,
  totalsByPlayerId as sumTotalsByPlayerId,
  totalsByTeamId as sumTotalsByTeamId,
  validateRoundScores as validateScoresByRules,
} from "./js/rules.mjs";
import { createHistoryController } from "./js/history.js";
import { createRoundEntryController } from "./js/roundEntry.js";
import { createScoreboardController } from "./js/scoreboard.js";

(() => {
  const STORAGE_KEY = "scorekeeper.v2";

  const $ = (id) => document.getElementById(id);

  const els = {
    btnNewGame: $("btnNewGame"),
    btnNewSame: $("btnNewSame"),
    btnNewGame2: $("btnNewGame2"),
    btnNewSame2: $("btnNewSame2"),
    btnKeepGoing: $("btnKeepGoing"),
    btnStart: $("btnStart"),
    btnAddRound: $("btnAddRound"),
    btnUndo: $("btnUndo"),
    btnToggleSort: $("btnToggleSort"),
    btnLoadSaved: $("btnLoadSaved"),

    pillStatus: $("pillStatus"),
    pillSaved: $("pillSaved"),

    leftTitle: $("leftTitle"),
    setupPanel: $("setupPanel"),
    roundPanel: $("roundPanel"),
    setupMsg: $("setupMsg"),
    roundMsg: $("roundMsg"),

    presetSelect: $("presetSelect"),
    preRoundPresetRow: $("preRoundPresetRow"),
    preRoundPresetSelect: $("preRoundPresetSelect"),
    winModeText: $("winModeText"),

    playerCount: $("playerCount"),
    targetPoints: $("targetPoints"),
    playerNamesWrap: $("playerNamesWrap"),

    teamPreview: $("teamPreview"),
    teamChips: $("teamChips"),
    spadesPartner: $("spadesPartner"),
    // Optional: if your HTML includes this row wrapper, we’ll use it.
    teamPickerRow: $("teamPickerRow"),
    spadesPartnerLabel: $("spadesPartnerLabel"),

    targetPill: $("targetPill"),
    roundPill: $("roundPill"),
    roundPreview: $("roundPreview"),
    roundPreviewBody: $("roundPreviewBody"),
    roundHelperBar: $("roundHelperBar"),
    roundHelperButtons: $("roundHelperButtons"),
    roundHelperForm: $("roundHelperForm"),

    winnerBanner: $("winnerBanner"),
    winnerText: $("winnerText"),
    winnerSub: $("winnerSub"),

    scoreboardEmpty: $("scoreboardEmpty"),
    scoreboardArea: $("scoreboardArea"),
    scoreboardBody: $("scoreboardBody"),
    scoreboardTitle: $("scoreboardTitle"),
    scoreboardCard: $("scoreboardCard"),
    scoreboardBgImage: $("scoreboardBgImage"),

    colHeadEntity: $("colHeadEntity"),
    colHeadTotal: $("colHeadTotal"),
    colHeadThis: $("colHeadThis"),

    targetLabel: $("targetLabel"),
    phase10Ref: $("phase10Ref"),

    historyDetails: $("historyDetails"),
    historySummaryText: $("historySummaryText"),
    historyTable: $("historyTable"),

    ariaLive: $("ariaLive"),
  };

  // Guard (ignore optional teamPickerRow)
  const required = Object.entries(els)
    .filter(
      ([k, v]) =>
        ![
          "teamPickerRow",
          "spadesPartnerLabel",
          "btnNewSame",
          "btnNewSame2",
          "colHeadTotal",
          "colHeadThis",
          "targetLabel",
          "phase10Ref",
        ].includes(k) && !v,
    )
    .map(([k]) => k);
  if (required.length) {
    console.error("Scorekeeper: missing required element IDs:", required);
    return;
  }

  const state = {
    mode: "setup", // setup | playing | finished
    presetKey: "custom",
    target: APP_LIMITS.defaultTarget,
    winMode: "high", // high | low
    players: [], // { id, name }
    teams: null, // null | [{ id, name, members:[playerId]}]
    rounds: [], // { n, scores: { [playerId]: number }, ts }
    lastRoundScores: {}, // for display only
    currentRoundScores: {}, // in-progress round entry values
    winnerId: null, // playerId or teamId (depending on mode)
    sortByTotal: false,
    savedExists: false,
    bannerDismissed: false,
    historyEditingRoundN: null,

    // Preset notes: keep visible during setup
    presetNote: "",

    // Spades partner picker: partner for Player 1 is Player 2|3|4 (default: 2)
    spadesPartnerIndex: 2,
    activeRoundHelper: null,

    // SkyJo per-round "went out" marker for the current round entry.
    skyjoCurrentRoundWentOutPlayerId: null,
  };

  const roundEntry = createRoundEntryController({
    state,
    els,
    isPhase10,
    showMsg,
    setLive,
    escapeHtml,
    $,
    onAddRound: () => addRound(),
    onSkyjoMarkGoOut: (playerId) => markSkyjoWentOutForCurrentRound(playerId),
  });
  const history = createHistoryController({
    state,
    els,
    isPhase10,
    showMsg,
    setLive,
    applyPhase10UiText,
    save,
    renderAll: () => renderAll(),
    validateRoundScores,
    totalsByPlayerId,
    totalsByTeamId,
    determineWinnerFromTotals,
  });
  const scoreboard = createScoreboardController({
    state,
    els,
    PRESETS,
    PRESET_BACKGROUNDS,
    PRESET_TINT_OVERRIDES,
    isPhase10,
    escapeHtml,
    totalsByPlayerId,
    totalsByTeamId,
    leaderIdFromTotals,
    phase10CurrentPhase,
    entityName,
    renderHistoryTable: () => history.renderHistoryTable(),
  });

  const uid = () => Math.random().toString(36).slice(2, 10);

  function setLive(text) {
    els.ariaLive.textContent = text;
  }

  function clampInt(val, min, max) {
    const n = Number.parseInt(val, 10);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function showMsg(el, text) {
    el.textContent = text;
    el.classList.toggle("show", !!text);
  }

  function detectSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.savedExists = !!raw;
    } catch {
      state.savedExists = false;
    }
    els.btnLoadSaved.style.display = state.savedExists ? "inline-flex" : "none";
    els.pillSaved.style.display = state.savedExists ? "inline-flex" : "none";
  }

  function save() {
    try {
      const payload = {
        mode: state.mode,
        presetKey: state.presetKey,
        target: state.target,
        winMode: state.winMode,
        players: state.players,
        teams: state.teams,
        rounds: state.rounds,
        winnerId: state.winnerId,
        sortByTotal: state.sortByTotal,
        spadesPartnerIndex: state.spadesPartnerIndex,
        presetNote: state.presetNote,
        skyjoCurrentRoundWentOutPlayerId:
          state.skyjoCurrentRoundWentOutPlayerId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      detectSaved();
    } catch {}
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    detectSaved();
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (
        !payload ||
        !Array.isArray(payload.players) ||
        !Array.isArray(payload.rounds)
      )
        return false;

      state.mode =
        payload.mode === "playing" || payload.mode === "finished"
          ? payload.mode
          : "setup";
      state.presetKey = PRESETS[payload.presetKey]
        ? payload.presetKey
        : "custom";
      state.target = Number.isFinite(payload.target)
        ? payload.target
        : APP_LIMITS.defaultTarget;
      state.winMode = payload.winMode === "low" ? "low" : "high";

      state.players = payload.players.map((p) => ({
        id: String(p.id),
        name: String(p.name),
      }));
      state.teams = Array.isArray(payload.teams)
        ? payload.teams.map((t) => ({
            id: String(t.id),
            name: String(t.name),
            members: Array.isArray(t.members) ? t.members.map(String) : [],
          }))
        : null;

      state.rounds = payload.rounds.map((r) => ({
        n: Number(r.n),
        scores: r.scores || {},
        ts: r.ts || Date.now(),
      }));
      state.winnerId = payload.winnerId || null;
      state.sortByTotal = !!payload.sortByTotal;

      state.lastRoundScores = state.rounds.length
        ? state.rounds[state.rounds.length - 1].scores || {}
        : {};
      state.currentRoundScores = Object.fromEntries(
        state.players.map((p) => [p.id, 0]),
      );
      state.bannerDismissed = false;
      state.historyEditingRoundN = null;
      state.activeRoundHelper = null;
      state.skyjoCurrentRoundWentOutPlayerId =
        typeof payload.skyjoCurrentRoundWentOutPlayerId === "string"
          ? payload.skyjoCurrentRoundWentOutPlayerId
          : null;
      if (
        state.presetKey !== "skyjo" ||
        (state.skyjoCurrentRoundWentOutPlayerId &&
          !state.players.some(
            (p) => p.id === state.skyjoCurrentRoundWentOutPlayerId,
          ))
      ) {
        state.skyjoCurrentRoundWentOutPlayerId = null;
      }

      state.spadesPartnerIndex = [2, 3, 4].includes(payload.spadesPartnerIndex)
        ? payload.spadesPartnerIndex
        : 2;
      state.presetNote =
        typeof payload.presetNote === "string"
          ? payload.presetNote
          : PRESETS[state.presetKey]?.notes || "";

      els.presetSelect.value = state.presetKey;
      updateWinModeText();
      maybeRenderTeamPreview();
      applyPhase10UiText();

      renderAll();
      setLive("Saved game loaded.");
      return true;
    } catch {
      return false;
    }
  }

  function newGame() {
    state.mode = "setup";
    state.presetKey = "custom";
    state.target = APP_LIMITS.defaultTarget;
    state.winMode = "high";
    state.players = [];
    state.teams = null;
    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = {};
    state.winnerId = null;
    state.sortByTotal = false;
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;
    state.presetNote = "";
    state.spadesPartnerIndex = 2;

    els.presetSelect.value = "custom";
    els.playerCount.value = APP_LIMITS.defaultPlayerCount;
    els.targetPoints.value = APP_LIMITS.defaultTarget;

    updateWinModeText();
    maybeRenderTeamPreview();
    applyPhase10UiText();

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");

    renderSetupInputs(false);
    renderAll();
    setLive("New game started.");
  }

  
  function newGameSamePlayers() {
    // Prefer existing game players; if not started yet, use setup inputs.
    const names = state.players.length
      ? state.players.map((p) => p.name)
      : currentNameInputs();

    if (!names.length) {
      state.mode = "setup";
      renderAll();
      return;
    }

    // Keep preset + target settings as-is (or fall back to current target input)
    const target =
      Number.isInteger(state.target) && state.target > 0
        ? state.target
        : clampInt(
            els.targetPoints.value,
            APP_LIMITS.targetMin,
            APP_LIMITS.targetMax,
          );

    state.mode = "playing";
    state.target = target;

    // Fresh IDs prevent “stale input bindings”
    state.players = names.map((name) => ({ id: uid(), name }));
    state.teams = buildTeamsIfNeeded(state.players);

    // Reset score state
    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.winnerId = null;
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");

    save();
    applyPhase10UiText();
    renderAll();
    setLive("New game started with same players.");
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  function validateSetup(names, target) {
    if (names.length < APP_LIMITS.playerCountMin)
      return APP_MESSAGES.setup.minPlayers;
    if (!Number.isInteger(target) || target < APP_LIMITS.targetMin)
      return APP_MESSAGES.setup.targetWholePositive;
    if (names.some((n) => !n)) return APP_MESSAGES.setup.allNamesRequired;
    const lowered = names.map((n) => n.toLowerCase());
    if (new Set(lowered).size !== lowered.length)
      return APP_MESSAGES.setup.uniqueNames;
    return "";
  }

  function currentNameInputs() {
    return Array.from(document.querySelectorAll("[data-player-name]")).map(
      (inp) => normalizeName(inp.value),
    );
  }

  function updateWinModeText() {
    els.winModeText.textContent =
      state.winMode === "low" ? "Lowest score wins" : "Highest score wins";
  }

  function isPhase10() {
    return state.presetKey === "phase10";
  }

  function applyPhase10UiText() {
    if (els.targetLabel) {
      els.targetLabel.textContent = isPhase10() ? "Phases to win" : "Target";
    }
    if (els.colHeadTotal) {
      els.colHeadTotal.textContent = isPhase10() ? "Phases" : "Total";
    }
    if (els.colHeadThis) {
      els.colHeadThis.textContent = isPhase10() ? "Completed" : "This round";
    }

    // Phase 10 reference (hints/reminders)
    if (els.phase10Ref) {
      els.phase10Ref.style.display = isPhase10() ? "block" : "none";
    }
  }

  function phase10CurrentPhase(totalCompleted) {
    const t = Number.isFinite(totalCompleted) ? totalCompleted : 0;
    // If you have completed 0 phases, you are on Phase 1.
    return Math.max(1, Math.min(state.target || 10, t + 1));
  }

  function applyPreset(key) {
    const preset = PRESETS[key] || PRESETS.custom;
    state.presetKey = key in PRESETS ? key : "custom";

    if (Number.isInteger(preset.target)) {
      els.targetPoints.value = preset.target;
    }
    els.presetSelect.value = state.presetKey;
    if (els.preRoundPresetSelect) {
      els.preRoundPresetSelect.value = state.presetKey;
    }

    state.winMode = preset.winMode === "low" ? "low" : "high";
    updateWinModeText();

    state.presetNote = preset.notes || "";
    showMsg(els.setupMsg, state.presetNote);
    applyPhase10UiText();

    maybeRenderTeamPreview();
    updateStartButtonState();
  }

  function renderSetupInputs(keepExisting = true) {
    const raw = String(els.playerCount.value ?? "").trim();

    // Allow empty mid-edit without snapping. Keep existing fields; just disable Start.
    if (raw === "") {
      els.btnStart.disabled = true;
      return;
    }

    const n = Number.parseInt(raw, 10);
    const count = Number.isNaN(n)
      ? APP_LIMITS.playerCountMin
      : Math.min(
          APP_LIMITS.playerCountMax,
          Math.max(APP_LIMITS.playerCountMin, n),
        );
    els.playerCount.value = count;

    const existing = keepExisting ? currentNameInputs() : [];
    const wrap = els.playerNamesWrap;

    wrap.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const field = document.createElement("div");
      field.className = "field";
      field.style.minWidth = "180px";

      const label = document.createElement("label");
      label.setAttribute("for", `pname_${i}`);
      label.textContent = `Player ${i + 1} name`;

      const input = document.createElement("input");
      input.type = "text";
      input.id = `pname_${i}`;
      input.setAttribute("data-player-name", "1");
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = existing[i] ?? "";

      input.addEventListener("input", () => {
        updateStartButtonState();
        maybeRenderTeamPreview(); // ✅ update partner label/options live
        showMsg(els.setupMsg, state.presetNote);
      });

      field.appendChild(label);
      field.appendChild(input);
      wrap.appendChild(field);
    }

    updateStartButtonState();
    maybeRenderTeamPreview();
  }

  function updateStartButtonState() {
    const target = clampInt(
      els.targetPoints.value,
      APP_LIMITS.targetMin,
      APP_LIMITS.targetMax,
    );
    const names = currentNameInputs();
    const msg = validateSetup(names, target);

    if (msg) {
      els.btnStart.disabled = true;
      showMsg(els.setupMsg, msg);
      return;
    }

    // Spades: show guidance, but do not disable
    if (state.presetKey === "spades" && names.length !== 4) {
      showMsg(
        els.setupMsg,
        `${state.presetNote ? state.presetNote + " " : ""}${APP_MESSAGES.setup.spadesCountGuidance}`,
      );
    } else {
      showMsg(els.setupMsg, state.presetNote);
    }

    els.btnStart.disabled = false;
  }

  function buildTeamsIfNeeded(players) {
    const preset = PRESETS[state.presetKey] || PRESETS.custom;
    if (!preset.teams) return null;

    // Only build teams for exactly 4 players
    if (players.length !== 4) return null;

    // Convert partner (2|3|4) -> index (1|2|3)
    const partnerIdx = Math.min(
      3,
      Math.max(1, (state.spadesPartnerIndex ?? 2) - 1),
    );

    const p0 = players[0];
    const partner = players[partnerIdx];

    // Remaining two players become Team B
    const remaining = players
      .map((p, i) => ({ p, i }))
      .filter((x) => x.i !== 0 && x.i !== partnerIdx)
      .map((x) => x.p);

    const teamAName = `${p0.name} + ${partner.name}`;
    const teamBName = `${remaining[0].name} + ${remaining[1].name}`;

    return [
      { id: "teamA", name: teamAName, members: [p0.id, partner.id] },
      {
        id: "teamB",
        name: teamBName,
        members: [remaining[0].id, remaining[1].id],
      },
    ];
  }

  function maybeRenderTeamPreview() {
    const preset = PRESETS[state.presetKey] || PRESETS.custom;

    // Not a teams preset: hide everything and reset spades UI bits
    if (!preset.teams) {
      els.teamPreview.style.display = "none";
      els.teamChips.innerHTML = "";
      els.spadesPartner.innerHTML = "";
      els.spadesPartner.disabled = true;
      if (els.teamPickerRow) els.teamPickerRow.style.display = "none";
      if (els.spadesPartnerLabel)
        els.spadesPartnerLabel.textContent = "Partner for Player 1";
      return;
    }

    // Teams preset (Spades): show the block
    els.teamPreview.style.display = "block";

    const names = currentNameInputs(); // live input values

    // Update the label live based on Player 1's name (if available)
    const p1Name = names[0] || "Player 1";
    if (els.spadesPartnerLabel)
      els.spadesPartnerLabel.textContent = `Partner for ${p1Name}`;

    // Need exactly 4 players for partner picking + teams
    if (names.length !== 4) {
      els.teamChips.innerHTML = `<div class="chip"><strong>Spades:</strong> enter 4 players to choose teams</div>`;
      els.spadesPartner.innerHTML = "";
      els.spadesPartner.disabled = true;
      if (els.teamPickerRow) els.teamPickerRow.style.display = "none";
      return;
    }

    if (els.teamPickerRow) els.teamPickerRow.style.display = "flex";
    els.spadesPartner.disabled = false;

    // Preserve selection if still valid
    const current = [2, 3, 4].includes(state.spadesPartnerIndex)
      ? state.spadesPartnerIndex
      : 2;

    const optName = (i) => (names[i] ? names[i] : `Player ${i + 1}`);
    const options = [
      { val: 2, label: `Player 2 (${optName(1)})` },
      { val: 3, label: `Player 3 (${optName(2)})` },
      { val: 4, label: `Player 4 (${optName(3)})` },
    ];

    els.spadesPartner.innerHTML = options
      .map(
        (o) =>
          `<option value="${o.val}" ${o.val === current ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
      )
      .join("");

    // Sync state with the actual select value
    const partnerVal = Number(els.spadesPartner.value) || current;
    state.spadesPartnerIndex = [2, 3, 4].includes(partnerVal) ? partnerVal : 2;

    // Compute teams based on selection
    const partnerIdx = state.spadesPartnerIndex - 1;

    const teamA = `${p1Name} + ${names[partnerIdx] || `Player ${state.spadesPartnerIndex}`}`;
    const remaining = [1, 2, 3].filter((i) => i !== partnerIdx);
    const teamB =
      `${names[remaining[0]] || `Player ${remaining[0] + 1}`} + ${names[remaining[1]] || `Player ${remaining[1] + 1}`}`;

    els.teamChips.innerHTML = `
      <div class="chip"><strong>${escapeHtml(teamA)}</strong></div>
      <div class="chip"><strong>${escapeHtml(teamB)}</strong></div>
    `;
  }

  function startGame() {
    const target = clampInt(
      els.targetPoints.value,
      APP_LIMITS.targetMin,
      APP_LIMITS.targetMax,
    );
    const names = currentNameInputs();

    const msg = validateSetup(names, target);
    if (msg) {
      showMsg(els.setupMsg, msg);
      return;
    }

    state.mode = "playing";
    state.target = target;

    state.players = names.map((name) => ({ id: uid(), name }));
    state.teams = buildTeamsIfNeeded(state.players);

    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.winnerId = null;
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");

    save();
    applyPhase10UiText();
    renderAll();
    setLive("Game started.");
  }
  function totalsByPlayerId() {
    if (state.presetKey !== "skyjo") {
      return sumTotalsByPlayerId(state.players, state.rounds);
    }
    const totals = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    for (const r of state.rounds) {
      const adjusted = adjustedScoresForRound(r);
      for (const p of state.players) {
        totals[p.id] += Number(adjusted[p.id] ?? 0);
      }
    }
    return totals;
  }

  function totalsByTeamId(playerTotals) {
    return sumTotalsByTeamId(state.teams, playerTotals);
  }

  function leaderIdFromTotals(entries) {
    let best = null;
    for (const e of entries) {
      const t = e.total ?? 0;
      if (best === null) {
        best = e.id;
        continue;
      }
      const bestTotal = entries.find((x) => x.id === best)?.total ?? 0;

      if (state.winMode === "low") {
        if (t < bestTotal) best = e.id;
      } else {
        if (t > bestTotal) best = e.id;
      }
    }
    return best;
  }

  function determineWinnerFromTotals(entries) {
    return resolveWinnerFromTotals(entries, state.winMode, state.target);
  }

  function markSkyjoWentOutForCurrentRound(playerId) {
    if (state.presetKey !== "skyjo" || state.mode !== "playing") return;
    if (!state.players.some((p) => p.id === playerId)) return;

    state.skyjoCurrentRoundWentOutPlayerId = playerId;
    const name = entityName(playerId);
    showMsg(els.roundMsg, `${name} marked as went out for this round.`);
    save();
    renderAll();
    setLive(`${name} marked as went out in SkyJo.`);
  }

  function adjustedScoresForRound(round) {
    if (state.presetKey === "skyjo") {
      return adjustSkyjoRoundScores(state.players, round);
    }
    const out = {};
    for (const p of state.players) {
      const raw = Number(round?.scores?.[p.id] ?? 0);
      out[p.id] = Number.isFinite(raw) ? raw : 0;
    }
    return out;
  }

  function entityName(id) {
    if (state.teams) {
      return state.teams.find((t) => t.id === id)?.name ?? "Unknown Team";
    }
    return state.players.find((p) => p.id === id)?.name ?? "Unknown";
  }

  function validateRoundScores(scores, opts = {}) {
    const { contextLabel = "round" } = opts;
    return validateScoresByRules({
      scores,
      players: state.players,
      presetKey: state.presetKey,
      contextLabel,
      minScore: APP_LIMITS.scoreMin,
      maxScore: APP_LIMITS.scoreMax,
      messages: APP_MESSAGES.roundValidation,
    });
  }

  function addRound() {
    if (state.mode !== "playing") return;

    const scores = roundEntry.readRoundScores();
    const validation = validateRoundScores(scores, { contextLabel: "round" });
    if (!validation.ok) {
      showMsg(els.roundMsg, validation.error || "Invalid scores.");
      return;
    }
    if (validation.warning) {
      const proceed = window.confirm(`${validation.warning} Add round anyway?`);
      if (!proceed) return;
    }
    if (
      state.presetKey === "skyjo" &&
      !state.skyjoCurrentRoundWentOutPlayerId
    ) {
      showMsg(els.roundMsg, "SkyJo: select who went out this round.");
      return;
    }

    const nextN = state.rounds.length + 1;
    const round = {
      n: nextN,
      scores,
      ts: Date.now(),
      skyjoWentOutPlayerId:
        state.presetKey === "skyjo"
          ? state.skyjoCurrentRoundWentOutPlayerId || null
          : null,
    };
    state.rounds.push(round);
    state.lastRoundScores = scores;
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    const playerTotals = totalsByPlayerId();
    let entries = [];

    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      entries = state.teams.map((t) => ({
        id: t.id,
        total: teamTotals[t.id] ?? 0,
      }));
    } else {
      entries = state.players.map((p) => ({
        id: p.id,
        total: playerTotals[p.id] ?? 0,
      }));
    }

    const w = determineWinnerFromTotals(entries);
    if (w) {
      state.winnerId = w;
      state.mode = "finished";
      state.bannerDismissed = false;
      setLive(`Winner declared: ${entityName(w)}.`);
    } else {
      if (state.presetKey === "skyjo" && round.skyjoWentOutPlayerId) {
        setLive(
          `Round ${nextN} added. ${entityName(round.skyjoWentOutPlayerId)} went out this round.`,
        );
      } else {
        setLive(`Round ${nextN} added.`);
      }
    }

    save();
    applyPhase10UiText();
    renderAll();

    if (state.mode === "playing") {
      roundEntry.clearRoundInputs();
    }
  }

  function undoLastRound() {
    if (state.rounds.length === 0) return;
    state.rounds.pop();
    state.lastRoundScores = state.rounds.length
      ? state.rounds[state.rounds.length - 1].scores || {}
      : {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.winnerId = null;
    state.mode = state.players.length ? "playing" : "setup";
    state.bannerDismissed = true;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    save();
    applyPhase10UiText();
    renderAll();
    setLive("Last round undone.");
  }

  function renderMode() {
    const playing = state.mode === "playing" || state.mode === "finished";
    const allowPreRoundPresetChange =
      state.mode === "playing" && state.rounds.length === 0;

    els.setupPanel.style.display = playing ? "none" : "block";
    els.roundPanel.style.display = playing ? "block" : "none";
    if (els.preRoundPresetRow) {
      els.preRoundPresetRow.style.display = allowPreRoundPresetChange
        ? "flex"
        : "none";
    }
    if (allowPreRoundPresetChange && els.preRoundPresetSelect) {
      els.preRoundPresetSelect.value = state.presetKey;
    }
    els.leftTitle.textContent = playing ? "Round Entry" : "Game Setup";

    els.scoreboardEmpty.style.display = state.players.length ? "none" : "block";
    els.scoreboardArea.style.display = state.players.length ? "block" : "none";

    els.btnToggleSort.disabled = !state.players.length;
    els.btnToggleSort.textContent = state.sortByTotal
      ? "Sort: Totals"
      : "Sort: Off";

    els.btnUndo.disabled = !(state.rounds.length > 0);

    els.targetPill.textContent = String(state.target);
    els.roundPill.textContent = String(state.rounds.length + 1);

    const statusText =
      state.mode === "setup"
        ? "Setup"
        : state.mode === "playing"
          ? "Playing"
          : "Finished";
    els.pillStatus.innerHTML = `<strong>Status:</strong> ${statusText}`;

    if (playing && state.players.length) {
      roundEntry.ensureCurrentRoundScores();
      roundEntry.renderRoundPreview();
    }

    scoreboard.updateScoreboardTitle();
    scoreboard.updateScoreboardBackground();
    scoreboard.renderWinnerBanner();
  }

  function renderAll() {
    renderMode();
    if (state.players.length) {
      scoreboard.renderScoreboard();
    }
    if (state.mode === "setup") {
      updateStartButtonState();
    }
  }

  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (s) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[s],
    );
  }

  // Events
  els.presetSelect.addEventListener("change", (e) =>
    applyPreset(e.target.value),
  );
  if (els.preRoundPresetSelect) {
    els.preRoundPresetSelect.addEventListener("change", (e) => {
      if (!(state.mode === "playing" && state.rounds.length === 0)) {
        els.preRoundPresetSelect.value = state.presetKey;
        return;
      }
      applyPreset(e.target.value);
      save();
      renderAll();
    });
  }

  // Normalize playerCount only after commit (change/blur), not mid-typing
  els.playerCount.addEventListener("change", () => renderSetupInputs());
  els.playerCount.addEventListener("blur", () => renderSetupInputs());
  const selectPlayerCountValue = () => {
    requestAnimationFrame(() => {
      if (document.activeElement === els.playerCount) {
        els.playerCount.select();
      }
    });
  };
  els.playerCount.addEventListener("focus", selectPlayerCountValue);
  els.playerCount.addEventListener("click", selectPlayerCountValue);
  els.playerCount.addEventListener("touchend", selectPlayerCountValue);
  const selectTargetValue = () => {
    requestAnimationFrame(() => {
      if (document.activeElement === els.targetPoints) {
        els.targetPoints.select();
      }
    });
  };
  els.targetPoints.addEventListener("focus", selectTargetValue);
  els.targetPoints.addEventListener("click", selectTargetValue);
  els.targetPoints.addEventListener("touchend", selectTargetValue);

  els.targetPoints.addEventListener("input", () => updateStartButtonState());

  els.btnStart.addEventListener("click", startGame);
  els.btnAddRound.addEventListener("click", addRound);

  els.btnUndo.addEventListener("click", () => {
    showMsg(els.roundMsg, "");
    undoLastRound();
  });

  els.btnNewGame.addEventListener("click", (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    clearSaved();
    newGame();
  });

  els.btnNewGame2.addEventListener("click", (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    clearSaved();
    newGame();
  });

  if (els.btnNewSame) {
    els.btnNewSame.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      newGameSamePlayers();
    });
  }

  if (els.btnNewSame2) {
    els.btnNewSame2.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      newGameSamePlayers();
    });
  }

  els.btnKeepGoing.addEventListener("click", () => {
    state.bannerDismissed = true;
    state.mode = "playing";
    state.winnerId = null;
    save();
    applyPhase10UiText();
    renderAll();
    setLive("Continuing score tracking.");
  });

  els.btnToggleSort.addEventListener("click", () => {
    state.sortByTotal = !state.sortByTotal;
    save();
    applyPhase10UiText();
    renderAll();
  });

  els.btnLoadSaved.addEventListener("click", () => {
    const ok = loadSaved();
    if (!ok) {
      showMsg(els.setupMsg, APP_MESSAGES.setup.noValidSavedGame);
      clearSaved();
    }
  });

  els.spadesPartner.addEventListener("change", () => {
    state.spadesPartnerIndex = Number(els.spadesPartner.value) || 2;
    maybeRenderTeamPreview();
    save();
  });

  history.bindEvents();
  roundEntry.bindEvents();
  scoreboard.bindEvents();

  // Boot
  detectSaved();
  updateWinModeText();
  renderSetupInputs();
  maybeRenderTeamPreview();
  applyPhase10UiText();

  // Auto-load if saved game is playing/finished
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      if (
        payload &&
        (payload.mode === "playing" || payload.mode === "finished")
      ) {
        loadSaved();
      } else {
        renderAll();
      }
    } else {
      renderAll();
    }
  } catch {
    renderAll();
  }
})();
