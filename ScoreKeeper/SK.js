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
  normalizeHeartsShootMoonScores,
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
    btnPrint: $("btnPrint"),
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
    preRoundSpadesTeamRow: $("preRoundSpadesTeamRow"),
    preRoundSpadesPartnerLabel: $("preRoundSpadesPartnerLabel"),
    preRoundSpadesPartner: $("preRoundSpadesPartner"),
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
    roundHeartsTotal: $("roundHeartsTotal"),
    roundPreviewBody: $("roundPreviewBody"),
    roundHelperBar: $("roundHelperBar"),
    roundHelperButtons: $("roundHelperButtons"),
    roundHelperForm: $("roundHelperForm"),

    winnerBanner: $("winnerBanner"),
    winnerText: $("winnerText"),
    winnerSub: $("winnerSub"),
    winnerMilestones: $("winnerMilestones"),
    continueModal: $("continueModal"),
    continueModalContext: $("continueModalContext"),
    continueTargetPoints: $("continueTargetPoints"),
    btnContinueRaiseTarget: $("btnContinueRaiseTarget"),
    btnContinueFreePlay: $("btnContinueFreePlay"),
    btnContinueNewGame: $("btnContinueNewGame"),
    btnContinueCancel: $("btnContinueCancel"),

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
    historyCards: $("historyCards"),
    historyGraphWrap: $("historyGraphWrap"),
    historyGraphMeta: $("historyGraphMeta"),
    historyGraph: $("historyGraph"),
    historyGraphLegend: $("historyGraphLegend"),
    historyStatsTable: $("historyStatsTable"),

    ariaLive: $("ariaLive"),
  };

  // Guard (ignore optional teamPickerRow)
  const required = Object.entries(els)
    .filter(
      ([k, v]) =>
        ![
          "teamPickerRow",
          "spadesPartnerLabel",
          "btnNewSame2",
          "btnKeepGoing",
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
    gameState: "in_progress", // in_progress | completed | extended | free_play
    firstWinnerAt: null, // { winnerId, roundN, target, ts }
    finalWinnerAt: null, // { winnerId, roundN, target, ts }
    winnerMilestones: [], // [{ winnerId, roundN, target, ts }]
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
    onRoundInputsChanged: () => updateAddRoundButtonState(),
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

  function normalizeWinnerMarker(marker) {
    if (!marker || typeof marker !== "object") return null;
    const winnerId = typeof marker.winnerId === "string" ? marker.winnerId : null;
    const roundN = Number.parseInt(marker.roundN, 10);
    const target = Number.parseInt(marker.target, 10);
    const ts = Number.parseInt(marker.ts, 10);
    if (!winnerId || !Number.isInteger(roundN) || roundN < 1) return null;
    return {
      winnerId,
      roundN,
      target: Number.isInteger(target) && target > 0 ? target : state.target,
      ts: Number.isInteger(ts) && ts > 0 ? ts : Date.now(),
    };
  }

  function normalizeWinnerMilestones(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeWinnerMarker)
      .filter(Boolean)
      .sort((a, b) => (a.roundN - b.roundN) || (a.ts - b.ts));
  }

  function syncWinnerAnchorsFromMilestones() {
    if (!state.winnerMilestones.length) {
      state.firstWinnerAt = null;
      state.finalWinnerAt = null;
      return;
    }
    state.firstWinnerAt = state.winnerMilestones[0];
    state.finalWinnerAt = state.winnerMilestones[state.winnerMilestones.length - 1];
  }

  function pruneWinnerMilestonesByRound() {
    state.winnerMilestones = state.winnerMilestones.filter(
      (m) => Number.isInteger(m.roundN) && m.roundN >= 1 && m.roundN <= state.rounds.length,
    );
    syncWinnerAnchorsFromMilestones();
  }

  function appendWinnerMilestone(marker) {
    const normalized = normalizeWinnerMarker(marker);
    if (!normalized) return;
    const last = state.winnerMilestones[state.winnerMilestones.length - 1];
    if (
      last &&
      last.winnerId === normalized.winnerId &&
      last.roundN === normalized.roundN &&
      last.target === normalized.target
    ) {
      return;
    }
    state.winnerMilestones.push(normalized);
    syncWinnerAnchorsFromMilestones();
  }

  function clearWinnerLifecycle() {
    state.winnerId = null;
    state.winnerMilestones = [];
    syncWinnerAnchorsFromMilestones();
    state.gameState = "in_progress";
  }

  function makeWinnerMarker(winnerId) {
    return {
      winnerId,
      roundN: state.rounds.length,
      target: state.target,
      ts: Date.now(),
    };
  }

  function buildWinnerEntries(playerTotals) {
    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      return state.teams.map((t) => ({
        id: t.id,
        total: teamTotals[t.id] ?? 0,
      }));
    }
    return state.players.map((p) => ({
      id: p.id,
      total: playerTotals[p.id] ?? 0,
    }));
  }

  function suggestedContinueTarget() {
    const playerTotals = totalsByPlayerId();
    const entries = buildWinnerEntries(playerTotals);
    const maxTotal = entries.reduce(
      (max, e) => Math.max(max, Number(e.total) || 0),
      0,
    );
    const bump = Math.max(1, Math.ceil((state.target || 0) * 0.1));
    return Math.max(state.target + bump, maxTotal + 1);
  }

  function syncWinnerLifecycleAfterLoad() {
    if (!state.players.length) {
      clearWinnerLifecycle();
      return;
    }
    pruneWinnerMilestonesByRound();

    if (state.gameState === "free_play") {
      state.mode = state.players.length ? "playing" : "setup";
      state.winnerId = null;
      return;
    }

    const playerTotals = totalsByPlayerId();
    const entries = buildWinnerEntries(playerTotals);
    const resolvedWinner = determineWinnerFromTotals(entries);

    if (resolvedWinner) {
      state.winnerId = resolvedWinner;
      state.mode = "finished";
      const marker = makeWinnerMarker(resolvedWinner);
      appendWinnerMilestone(marker);
      if (state.gameState !== "extended") {
        state.gameState = "completed";
      }
      return;
    }

    state.winnerId = null;
    state.mode = state.players.length ? "playing" : "setup";
    if (state.gameState !== "extended") {
      state.gameState = "in_progress";
      state.winnerMilestones = [];
      syncWinnerAnchorsFromMilestones();
    } else {
      if (!state.winnerMilestones.length) {
        state.gameState = "in_progress";
      }
    }
  }

  function openContinueModal() {
    if (state.mode !== "finished" || !state.winnerId || !els.continueModal) return;
    const suggestedTarget = suggestedContinueTarget();
    els.continueTargetPoints.value = String(suggestedTarget);
    if (els.continueModalContext) {
      const firstRound = state.firstWinnerAt?.roundN;
      const firstTarget = state.firstWinnerAt?.target;
      const firstLine =
        firstRound && firstTarget
          ? `Original winner declared in round ${firstRound} at target ${firstTarget}.`
          : "A winner has already been declared.";
      els.continueModalContext.textContent = `${firstLine} Choose how to continue.`;
    }
    els.continueModal.hidden = false;
    els.continueModal.classList.add("is-open");
    els.continueTargetPoints.focus();
    els.continueTargetPoints.select?.();
  }

  function closeContinueModal() {
    if (!els.continueModal) return;
    els.continueModal.classList.remove("is-open");
    els.continueModal.hidden = true;
  }

  function continueWithRaisedTarget() {
    const nextTarget = clampInt(
      els.continueTargetPoints.value,
      APP_LIMITS.targetMin,
      APP_LIMITS.targetMax,
    );
    if (!Number.isInteger(nextTarget) || nextTarget <= state.target) {
      showMsg(
        els.roundMsg,
        `New target must be greater than current target (${state.target}).`,
      );
      return;
    }
    state.target = nextTarget;
    state.mode = "playing";
    state.winnerId = null;
    state.gameState = "extended";
    state.bannerDismissed = true;
    closeContinueModal();
    roundEntry.clearRoundInputs();
    save();
    applyPhase10UiText();
    renderAll();
    setLive(`Continuing game with new target ${nextTarget}.`);
  }

  function continueWithFreePlay() {
    state.mode = "playing";
    state.winnerId = null;
    state.gameState = "free_play";
    state.bannerDismissed = true;
    closeContinueModal();
    roundEntry.clearRoundInputs();
    save();
    applyPhase10UiText();
    renderAll();
    setLive("Continuing game in free-play mode.");
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
        gameState: state.gameState,
        firstWinnerAt: state.firstWinnerAt,
        finalWinnerAt: state.finalWinnerAt,
        winnerMilestones: state.winnerMilestones,
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
        skyjoWentOutPlayerId:
          typeof r.skyjoWentOutPlayerId === "string"
            ? String(r.skyjoWentOutPlayerId)
            : null,
      }));
      state.winnerId = payload.winnerId || null;
      state.gameState =
        payload.gameState === "completed" ||
        payload.gameState === "extended" ||
        payload.gameState === "free_play"
          ? payload.gameState
          : "in_progress";
      state.winnerMilestones = normalizeWinnerMilestones(payload.winnerMilestones);
      if (!state.winnerMilestones.length) {
        const first = normalizeWinnerMarker(payload.firstWinnerAt);
        const final = normalizeWinnerMarker(payload.finalWinnerAt);
        if (first) state.winnerMilestones.push(first);
        if (
          final &&
          (!first ||
            final.winnerId !== first.winnerId ||
            final.roundN !== first.roundN ||
            final.target !== first.target)
        ) {
          state.winnerMilestones.push(final);
        }
      }
      syncWinnerAnchorsFromMilestones();
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
      syncWinnerLifecycleAfterLoad();
      closeContinueModal();

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
    clearWinnerLifecycle();
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
    closeContinueModal();

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
    clearWinnerLifecycle();
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");
    closeContinueModal();

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
    els.scoreboardCard.classList.toggle("phase10-mode", isPhase10());
    els.scoreboardCard.classList.toggle("hearts-mode", state.presetKey === "hearts");

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

    // Allow preset switching after game start only before Round 1:
    // re-evaluate whether this game uses teams (e.g., switching to/from Spades).
    if (state.mode === "playing" && state.rounds.length === 0) {
      state.teams = buildTeamsIfNeeded(state.players);
      clearWinnerLifecycle();
    }

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
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();

        if (i < count - 1) {
          const next = document.getElementById(`pname_${i + 1}`);
          next?.focus();
          next?.select?.();
          return;
        }

        startGame();
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

  function syncTeamsForCurrentPreset() {
    // Keep team state consistent with the current preset and active players.
    if (!state.players.length) {
      state.teams = null;
      return;
    }
    state.teams = buildTeamsIfNeeded(state.players);
  }

  function renderPreRoundSpadesTeamPicker(show) {
    if (
      !els.preRoundSpadesTeamRow ||
      !els.preRoundSpadesPartnerLabel ||
      !els.preRoundSpadesPartner
    ) {
      return;
    }

    if (!show) {
      els.preRoundSpadesTeamRow.style.display = "none";
      return;
    }

    if (state.players.length !== 4) {
      els.preRoundSpadesTeamRow.style.display = "none";
      return;
    }

    const names = state.players.map((p, i) => p.name || `Player ${i + 1}`);
    const p1Name = names[0] || "Player 1";
    els.preRoundSpadesPartnerLabel.textContent = `Assign Teams (${p1Name}'s partner)`;

    const current = [2, 3, 4].includes(state.spadesPartnerIndex)
      ? state.spadesPartnerIndex
      : 2;
    const options = [
      { val: 2, label: `Player 2 (${names[1]})` },
      { val: 3, label: `Player 3 (${names[2]})` },
      { val: 4, label: `Player 4 (${names[3]})` },
    ];
    els.preRoundSpadesPartner.innerHTML = options
      .map(
        (o) =>
          `<option value="${o.val}" ${o.val === current ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
      )
      .join("");
    els.preRoundSpadesPartner.value = String(current);
    els.preRoundSpadesTeamRow.style.display = "flex";
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
    clearWinnerLifecycle();
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");
    closeContinueModal();

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
    if (state.gameState === "free_play") return null;
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

  function normalizeWinnerOnlyScores(scores) {
    const isWinnerOnlyPreset =
      state.presetKey === "uno" || state.presetKey === "crazy8s";
    if (!isWinnerOnlyPreset) {
      return { ok: true, scores };
    }

    const zeroIds = state.players
      .map((p) => p.id)
      .filter((pid) => Number(scores?.[pid] ?? 0) === 0);
    if (zeroIds.length !== 1) {
      return {
        ok: false,
        error:
          "Enter exactly one 0 score to mark the round winner for this preset.",
      };
    }

    const winnerId = zeroIds[0];
    const winnerPoints = state.players.reduce((sum, p) => {
      if (p.id === winnerId) return sum;
      return sum + Number(scores?.[p.id] ?? 0);
    }, 0);
    const normalized = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    normalized[winnerId] = winnerPoints;

    return {
      ok: true,
      scores: normalized,
    };
  }

  function addRoundBlockReason(scores = null) {
    if (state.mode !== "playing") return "Start a game to add rounds.";
    const roundScores = scores || roundEntry.readRoundScores();

    if (
      state.presetKey === "skyjo" &&
      !state.skyjoCurrentRoundWentOutPlayerId
    ) {
      return "SkyJo: select who went out this round.";
    }

    if (state.presetKey === "hearts") {
      const total = state.players.reduce(
        (sum, p) => sum + Number(roundScores?.[p.id] ?? 0),
        0,
      );
      const shootMoonTotal = 26 * Math.max(0, state.players.length - 1);
      if (total !== 26 && total !== shootMoonTotal) {
        return `Hearts: round total must be 26 (or ${shootMoonTotal} for shoot the moon).`;
      }
    }

    if (state.presetKey === "uno" || state.presetKey === "crazy8s") {
      const zeroCount = state.players.filter(
        (p) => Number(roundScores?.[p.id] ?? 0) === 0,
      ).length;
      if (zeroCount !== 1) {
        return "UNO/Crazy 8s: exactly one player must be 0 (the round winner).";
      }
    }

    return "";
  }

  function updateAddRoundButtonState() {
    const reason = addRoundBlockReason();
    els.btnAddRound.disabled = !!reason;
    els.btnAddRound.title = reason || "Add this round";
  }

  function addRound() {
    if (state.mode !== "playing") return;

    let scores = roundEntry.readRoundScores();
    const blockReason = addRoundBlockReason(scores);
    if (blockReason) {
      showMsg(els.roundMsg, blockReason);
      return;
    }
    if (state.presetKey === "hearts") {
      const normalized = normalizeHeartsShootMoonScores(state.players, scores);
      scores = normalized.scores;
    }
    const winnerOnlyNormalized = normalizeWinnerOnlyScores(scores);
    if (!winnerOnlyNormalized.ok) {
      showMsg(els.roundMsg, winnerOnlyNormalized.error || "Invalid scores.");
      return;
    }
    scores = winnerOnlyNormalized.scores;
    const validation = validateRoundScores(scores, { contextLabel: "round" });
    if (!validation.ok) {
      showMsg(els.roundMsg, validation.error || "Invalid scores.");
      return;
    }
    if (validation.warning) {
      const proceed = window.confirm(`${validation.warning} Add round anyway?`);
      if (!proceed) return;
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
    const entries = buildWinnerEntries(playerTotals);
    const w =
      state.gameState === "free_play"
        ? null
        : determineWinnerFromTotals(entries);
    if (w) {
      state.winnerId = w;
      state.mode = "finished";
      const marker = makeWinnerMarker(w);
      appendWinnerMilestone(marker);
      if (state.gameState !== "extended") {
        state.gameState = "completed";
      }
      state.bannerDismissed = false;
      setLive(`Winner declared: ${entityName(w)}.`);
    } else {
      if (state.gameState !== "free_play" && !state.winnerMilestones.length) {
        state.gameState = "in_progress";
      }
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
    syncWinnerLifecycleAfterLoad();
    state.bannerDismissed = true;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;
    closeContinueModal();

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
    renderPreRoundSpadesTeamPicker(
      allowPreRoundPresetChange && state.presetKey === "spades",
    );
    els.leftTitle.textContent = playing ? "Round Entry" : "Game Setup";

    els.scoreboardEmpty.style.display = state.players.length ? "none" : "block";
    els.scoreboardArea.style.display = state.players.length ? "block" : "none";

    els.btnToggleSort.disabled = !state.players.length;
    els.btnPrint.disabled = !state.players.length;
    els.btnToggleSort.textContent = state.sortByTotal
      ? "Sort: Totals"
      : "Sort: Off";

    els.btnUndo.disabled = !(state.rounds.length > 0);

    els.targetPill.textContent = String(state.target);
    els.roundPill.textContent = String(state.rounds.length + 1);

    let statusText = "Setup";
    if (state.mode === "playing") {
      if (state.gameState === "free_play") statusText = "Playing (Free Play)";
      else if (state.gameState === "extended") statusText = "Playing (Extended)";
      else statusText = "Playing";
    } else if (state.mode === "finished") {
      statusText =
        state.gameState === "extended" ? "Finished (Extended)" : "Finished";
    }
    els.pillStatus.innerHTML = `<strong>Status:</strong> ${statusText}`;

    if (playing && state.players.length) {
      roundEntry.ensureCurrentRoundScores();
      roundEntry.renderRoundPreview();
    }
    updateAddRoundButtonState();

    scoreboard.updateScoreboardTitle();
    scoreboard.updateScoreboardBackground();
    scoreboard.renderWinnerBanner();
  }

  function renderAll() {
    syncTeamsForCurrentPreset();
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
  if (els.preRoundSpadesPartner) {
    els.preRoundSpadesPartner.addEventListener("change", () => {
      if (
        !(
          state.mode === "playing" &&
          state.rounds.length === 0 &&
          state.presetKey === "spades"
        )
      ) {
        return;
      }
      state.spadesPartnerIndex = Number(els.preRoundSpadesPartner.value) || 2;
      syncTeamsForCurrentPreset();
      renderAll();
      save();
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

  if (els.btnKeepGoing) {
    els.btnKeepGoing.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      openContinueModal();
    });
  }
  if (els.btnContinueRaiseTarget) {
    els.btnContinueRaiseTarget.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      continueWithRaisedTarget();
    });
  }
  if (els.btnContinueFreePlay) {
    els.btnContinueFreePlay.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      continueWithFreePlay();
    });
  }
  if (els.btnContinueNewGame) {
    els.btnContinueNewGame.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      closeContinueModal();
      clearSaved();
      newGame();
    });
  }
  if (els.btnContinueCancel) {
    els.btnContinueCancel.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      closeContinueModal();
    });
  }
  if (els.continueTargetPoints) {
    els.continueTargetPoints.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      continueWithRaisedTarget();
    });
  }
  if (els.continueModal) {
    els.continueModal.addEventListener("click", (e) => {
      if (e.target === els.continueModal) closeContinueModal();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.continueModal && !els.continueModal.hidden) {
      closeContinueModal();
    }
  });

  let historyOpenBeforePrint = false;
  window.addEventListener("beforeprint", () => {
    historyOpenBeforePrint = !!els.historyDetails?.open;
    if (els.historyDetails) els.historyDetails.open = true;
  });
  window.addEventListener("afterprint", () => {
    if (els.historyDetails) els.historyDetails.open = historyOpenBeforePrint;
  });

  els.btnPrint.addEventListener("click", () => {
    if (!state.players.length) return;
    historyOpenBeforePrint = !!els.historyDetails?.open;
    if (els.historyDetails) els.historyDetails.open = true;
    window.print();
  });

  if (els.btnNewSame2) {
    els.btnNewSame2.addEventListener("click", (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      newGameSamePlayers();
    });
  }

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
    syncTeamsForCurrentPreset();
    maybeRenderTeamPreview();
    renderAll();
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
