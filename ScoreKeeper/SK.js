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
  determinePhase10Winner,
  heartsRoundPenaltyTotal,
  phase10ProgressByPlayerId,
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
  const AUTOSAVE_KEY = "scorekeeper.v3.autosave";
  const SESSIONS_KEY = "scorekeeper.v3.sessions";
  const AUTO_EXPORT_ON_SAVE_KEY = "scorekeeper.v3.autoExportOnSave";
  const LEGACY_AUTOSAVE_KEY = "scorekeeper.v2";
  const EXPORT_VERSION = 1;

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
    btnSaveSession: $("btnSaveSession"),
    btnImportSession: $("btnImportSession"),
    btnBrowseSessions: $("btnBrowseSessions"),
    btnBrowseSessionsCount: $("btnBrowseSessionsCount"),
    btnLoadSession: $("btnLoadSession"),
    btnDeleteSession: $("btnDeleteSession"),
    btnSessionModalClose: $("btnSessionModalClose"),
    btnSaveSessionConfirm: $("btnSaveSessionConfirm"),
    btnSaveSessionCancel: $("btnSaveSessionCancel"),
    importSessionFile: $("importSessionFile"),
    savedSessionSelect: $("savedSessionSelect"),
    sessionBrowserSearch: $("sessionBrowserSearch"),
    sessionBrowserSort: $("sessionBrowserSort"),
    sessionBrowserList: $("sessionBrowserList"),
    sessionBrowserSummary: $("sessionBrowserSummary"),
    sessionBrowserEmpty: $("sessionBrowserEmpty"),

    pillStatus: $("pillStatus"),

    leftTitle: $("leftTitle"),
    setupPanel: $("setupPanel"),
    roundPanel: $("roundPanel"),
    setupMsg: $("setupMsg"),
    roundMsg: $("roundMsg"),

    presetSelect: $("presetSelect"),
    customGameRow: $("customGameRow"),
    customGameName: $("customGameName"),
    heartsDeckRow: $("heartsDeckRow"),
    heartsDeckCount: $("heartsDeckCount"),
    customWinModeRow: $("customWinModeRow"),
    customWinModeSelect: $("customWinModeSelect"),
    preRoundPresetRow: $("preRoundPresetRow"),
    preRoundPresetSelect: $("preRoundPresetSelect"),
    preRoundHeartsDeckRow: $("preRoundHeartsDeckRow"),
    preRoundHeartsDeckCount: $("preRoundHeartsDeckCount"),
    preRoundSpadesTeamRow: $("preRoundSpadesTeamRow"),
    preRoundSpadesPartnerLabel: $("preRoundSpadesPartnerLabel"),
    preRoundSpadesPartner: $("preRoundSpadesPartner"),
    preRoundCustomGameRow: $("preRoundCustomGameRow"),
    preRoundCustomGameName: $("preRoundCustomGameName"),
    preRoundCustomWinModeRow: $("preRoundCustomWinModeRow"),
    preRoundCustomWinModeSelect: $("preRoundCustomWinModeSelect"),
    preRoundTargetPoints: $("preRoundTargetPoints"),
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
    roundStorageStatus: $("roundStorageStatus"),
    roundAutosaveStatus: $("roundAutosaveStatus"),
    roundSessionsStatus: $("roundSessionsStatus"),

    winnerBanner: $("winnerBanner"),
    winnerText: $("winnerText"),
    winnerSub: $("winnerSub"),
    winnerMilestones: $("winnerMilestones"),
    continueModal: $("continueModal"),
    sessionModal: $("sessionModal"),
    saveSessionModal: $("saveSessionModal"),
    continueModalContext: $("continueModalContext"),
    continueModalIntro: $("continueModalIntro"),
    continueTargetRequirement: $("continueTargetRequirement"),
    continueTargetRequirementText: $("continueTargetRequirementText"),
    continueModalPrompt: $("continueModalPrompt"),
    continueTargetPoints: $("continueTargetPoints"),
    saveSessionName: $("saveSessionName"),
    saveSessionAutoExport: $("saveSessionAutoExport"),
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
    btnHistoryOrder: $("btnHistoryOrder"),
    btnHistoryTotals: $("btnHistoryTotals"),

    targetLabel: $("targetLabel"),
    phase10Ref: $("phase10Ref"),

    historyDetails: $("historyDetails"),
    historySummaryText: $("historySummaryText"),
    historyTable: $("historyTable"),
    historyCards: $("historyCards"),
    historyGraphWrap: $("historyGraphWrap"),
    historyPrimaryGraphPanel: $("historyPrimaryGraphPanel"),
    historyGraphTitle: $("historyGraphTitle"),
    historyGraphMeta: $("historyGraphMeta"),
    historyGraph: $("historyGraph"),
    historyGraphLegend: $("historyGraphLegend"),
    historyPointsGraphPanel: $("historyPointsGraphPanel"),
    historyPointsGraphTitle: $("historyPointsGraphTitle"),
    historyPointsGraphMeta: $("historyPointsGraphMeta"),
    historyPointsGraph: $("historyPointsGraph"),
    historyPointsGraphLegend: $("historyPointsGraphLegend"),
    historyPositionGraphPanel: $("historyPositionGraphPanel"),
    historyPositionGraphTitle: $("historyPositionGraphTitle"),
    historyPositionGraphMeta: $("historyPositionGraphMeta"),
    historyPositionGraph: $("historyPositionGraph"),
    historyPositionGraphLegend: $("historyPositionGraphLegend"),
    historyHeatmapPanel: $("historyHeatmapPanel"),
    historyHeatmapTitle: $("historyHeatmapTitle"),
    historyHeatmapMeta: $("historyHeatmapMeta"),
    historyHeatmap: $("historyHeatmap"),
    historyInsights: $("historyInsights"),
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
    customGameName: "",
    heartsDeckCount: 1,
    target: APP_LIMITS.defaultTarget,
    winMode: "high", // high | low
    players: [], // { id, name }
    teams: null, // null | [{ id, name, members:[playerId]}]
    rounds: [], // { n, scores: { [playerId]: number }, ts, phase10CompletedByPlayerId? }
    lastRoundScores: {}, // for display only
    currentRoundScores: {}, // in-progress round entry values
    currentRoundPhase10Completed: {}, // in-progress Phase 10 completion flags
    roundEntryOrder: [], // player ids for round-entry display only
    playerInactiveRanges: {}, // { [playerId]: [{ startRound, endRound|null }] }
    winnerId: null, // playerId or teamId (depending on mode)
    gameState: "in_progress", // in_progress | completed | extended | free_play
    firstWinnerAt: null, // { winnerId, roundN, target, ts }
    finalWinnerAt: null, // { winnerId, roundN, target, ts }
    winnerMilestones: [], // [{ winnerId, roundN, target, ts }]
    sortByTotal: false,
    historySortDir: "asc",
    showHistoryTotals: true,
    savedExists: false,
    savedSessionCount: 0,
    selectedSessionId: "",
    currentSessionId: null,
    sessionBrowserSearch: "",
    sessionBrowserSort: "updated",
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
    activePlayers,
    inactivePlayers,
    retirePlayer: (playerId) => retirePlayer(playerId),
    unretirePlayer: (playerId) => unretirePlayer(playerId),
    renamePlayer: (playerId, nextName) => renamePlayer(playerId, nextName),
    save,
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
    isPlayerRetired,
    retiredAfterRound,
    isPlayerActiveInRound,
    entityName,
    renderHistoryTable: () => history.renderHistoryTable(),
  });

  const uid = () => Math.random().toString(36).slice(2, 10);

  function setLive(text) {
    els.ariaLive.textContent = text;
  }

  function activeMessageEl() {
    return state.mode === "setup" ? els.setupMsg : els.roundMsg;
  }

  function showStatusMessage(text) {
    showMsg(activeMessageEl(), text);
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function snapshotState() {
    return {
      mode: state.mode,
      presetKey: state.presetKey,
      customGameName: normalizeCustomGameName(state.customGameName),
      heartsDeckCount: state.heartsDeckCount,
      target: state.target,
      winMode: state.winMode,
      players: state.players,
      roundEntryOrder: state.roundEntryOrder,
      playerInactiveRanges: state.playerInactiveRanges,
      teams: state.teams,
      rounds: state.rounds,
      winnerId: state.winnerId,
      gameState: state.gameState,
      firstWinnerAt: state.firstWinnerAt,
      finalWinnerAt: state.finalWinnerAt,
      winnerMilestones: state.winnerMilestones,
      sortByTotal: state.sortByTotal,
      historySortDir: state.historySortDir,
      showHistoryTotals: state.showHistoryTotals,
      spadesPartnerIndex: state.spadesPartnerIndex,
      presetNote: state.presetNote,
      skyjoCurrentRoundWentOutPlayerId:
        state.skyjoCurrentRoundWentOutPlayerId,
      currentSessionId: state.currentSessionId,
    };
  }

  function hasSnapshotData(payload = snapshotState()) {
    return !!(
      Array.isArray(payload?.players) && payload.players.length
    );
  }

  function displayGameLabel(payload = state) {
    const customName = normalizeCustomGameName(payload?.customGameName);
    if (payload?.presetKey === "custom" && customName) return customName;
    return PRESETS[payload?.presetKey]?.label || "Custom";
  }

  function normalizedRoundEntryOrder(order = state.roundEntryOrder, players = state.players) {
    const validIds = new Set(players.map((p) => p.id));
    const normalized = Array.isArray(order)
      ? order.filter((id) => validIds.has(id))
      : [];
    for (const player of players) {
      if (!normalized.includes(player.id)) normalized.push(player.id);
    }
    return normalized;
  }

  function normalizedHeartsDeckCount(value = state.heartsDeckCount) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed)
      ? Math.max(1, Math.min(4, parsed))
      : 1;
  }

  function normalizedPlayerInactiveRanges(
    inactiveRanges = state.playerInactiveRanges,
    players = state.players,
    legacyRetiredPlayers = null,
  ) {
    const validIds = new Set(players.map((p) => p.id));
    const out = {};

    if (inactiveRanges && typeof inactiveRanges === "object") {
      for (const [playerId, ranges] of Object.entries(inactiveRanges)) {
        if (!validIds.has(playerId) || !Array.isArray(ranges)) continue;
        const normalizedRanges = ranges
          .map((range) => {
            const startRound = Number.parseInt(range?.startRound, 10);
            const rawEndRound = range?.endRound;
            const endRound =
              rawEndRound === null || rawEndRound === undefined || rawEndRound === ""
                ? null
                : Number.parseInt(rawEndRound, 10);
            if (!Number.isInteger(startRound) || startRound < 1) return null;
            if (endRound !== null && (!Number.isInteger(endRound) || endRound < startRound)) {
              return null;
            }
            return { startRound, endRound };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (a.startRound !== b.startRound) return a.startRound - b.startRound;
            if (a.endRound === null) return 1;
            if (b.endRound === null) return -1;
            return a.endRound - b.endRound;
          });
        if (normalizedRanges.length) out[playerId] = normalizedRanges;
      }
    }

    if (!Object.keys(out).length && legacyRetiredPlayers && typeof legacyRetiredPlayers === "object") {
      for (const [playerId, retiredAfterRound] of Object.entries(legacyRetiredPlayers)) {
        if (!validIds.has(playerId)) continue;
        const roundN = Number.parseInt(retiredAfterRound, 10);
        if (!Number.isInteger(roundN) || roundN < 0) continue;
        out[playerId] = [{ startRound: roundN + 1, endRound: null }];
      }
    }
    return out;
  }

  function inactiveRangesForPlayer(playerId) {
    return Array.isArray(state.playerInactiveRanges?.[playerId])
      ? state.playerInactiveRanges[playerId]
      : [];
  }

  function currentParticipationRound() {
    return state.rounds.length + 1;
  }

  function currentInactiveRange(playerId) {
    const roundN = currentParticipationRound();
    return (
      inactiveRangesForPlayer(playerId).find(
        (range) =>
          range.startRound <= roundN &&
          (range.endRound === null || range.endRound >= roundN),
      ) || null
    );
  }

  function retiredAfterRound(playerId) {
    const range = currentInactiveRange(playerId);
    return range ? Math.max(0, range.startRound - 1) : null;
  }

  function isPlayerRetired(playerId) {
    return !!currentInactiveRange(playerId);
  }

  function isPlayerActiveInRound(playerId, roundN) {
    if (!Number.isInteger(roundN) || roundN < 1) return !isPlayerRetired(playerId);
    return !inactiveRangesForPlayer(playerId).some(
      (range) =>
        range.startRound <= roundN &&
        (range.endRound === null || range.endRound >= roundN),
    );
  }

  function activePlayers() {
    return state.players.filter((player) => !isPlayerRetired(player.id));
  }

  function inactivePlayers() {
    return state.players.filter((player) => isPlayerRetired(player.id));
  }

  function setInactiveRangesForPlayer(playerId, ranges) {
    const normalized = Array.isArray(ranges)
      ? ranges
          .filter(
            (range) =>
              Number.isInteger(range?.startRound) &&
              range.startRound >= 1 &&
              (range.endRound === null ||
                (Number.isInteger(range.endRound) &&
                  range.endRound >= range.startRound)),
          )
          .map((range) => ({
            startRound: range.startRound,
            endRound: range.endRound ?? null,
          }))
      : [];
    if (normalized.length) {
      state.playerInactiveRanges[playerId] = normalized;
    } else {
      delete state.playerInactiveRanges[playerId];
    }
  }

  function retirePlayerFromNextRound(playerId) {
    const ranges = [...inactiveRangesForPlayer(playerId)];
    const nextRound = currentParticipationRound();
    if (
      ranges.some(
        (range) =>
          range.startRound <= nextRound &&
          (range.endRound === null || range.endRound >= nextRound),
      )
    ) {
      return;
    }
    ranges.push({ startRound: nextRound, endRound: null });
    ranges.sort((a, b) => a.startRound - b.startRound);
    setInactiveRangesForPlayer(playerId, ranges);
  }

  function restorePlayerForNextRound(playerId) {
    const ranges = [...inactiveRangesForPlayer(playerId)];
    const nextRound = currentParticipationRound();
    const idx = ranges.findIndex(
      (range) =>
        range.startRound <= nextRound &&
        (range.endRound === null || range.endRound >= nextRound),
    );
    if (idx < 0) return false;
    const range = ranges[idx];
    if (range.startRound > state.rounds.length) {
      ranges.splice(idx, 1);
    } else {
      ranges[idx] = {
        startRound: range.startRound,
        endRound: state.rounds.length,
      };
    }
    setInactiveRangesForPlayer(playerId, ranges);
    return true;
  }

  function defaultSessionName(payload = snapshotState()) {
    const presetLabel = displayGameLabel(payload);
    const names = Array.isArray(payload?.players)
      ? payload.players
          .map((player) => normalizeName(player?.name))
          .filter(Boolean)
          .slice(0, 2)
      : [];
    const when = new Date().toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    if (names.length) {
      return `${presetLabel}: ${names.join(" & ")} (${when})`;
    }
    return `${presetLabel} Session (${when})`;
  }

  function sessionOptionLabel(session) {
    const presetLabel = displayGameLabel(session.payload);
    const players = Array.isArray(session.payload?.players)
      ? session.payload.players.length
      : 0;
    const rounds = Array.isArray(session.payload?.rounds)
      ? session.payload.rounds.length
      : 0;
    return `${session.name} • ${presetLabel} • ${players}P • ${rounds}R`;
  }

  function sanitizeFileName(name) {
    const base = String(name || "scorekeeper-session")
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return base || "scorekeeper-session";
  }

  function exportDateStamp(date = new Date()) {
    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear();
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}-${year}`;
  }

  function exportTimeStamp(date = new Date()) {
    const rawHours = Number(date.getHours()) || 0;
    const suffix = rawHours >= 12 ? "PM" : "AM";
    const hours12 = rawHours % 12 || 12;
    const hours = String(hours12).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}${minutes}${suffix}`;
  }

  function exportPlayerNameSegment(payload = state) {
    const names = Array.isArray(payload?.players)
      ? payload.players
          .map((player) => sanitizeFileName(normalizeName(player?.name)).slice(0, 8))
          .filter(Boolean)
      : [];
    return names.length ? names.join("_") : "session";
  }

  function exportFileNameForSession(exportable, when = new Date()) {
    const payload = exportable?.payload || state;
    const date = exportDateStamp(when);
    const game = sanitizeFileName(displayGameLabel(payload));
    const players = exportPlayerNameSegment(payload);
    const time = exportTimeStamp(when);
    return `${date}_${game}_${players}_${time}.json`;
  }

  function formatSessionTimestamp(ts) {
    const date = new Date(Number(ts) || Date.now());
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function sessionPresetLabel(session) {
    return displayGameLabel(session.payload);
  }

  function sessionPlayerNames(session) {
    return Array.isArray(session.payload?.players)
      ? session.payload.players
          .map((player) => normalizeName(player?.name))
          .filter(Boolean)
      : [];
  }

  function sessionRoundCount(session) {
    return Array.isArray(session.payload?.rounds)
      ? session.payload.rounds.length
      : 0;
  }

  function sessionSearchText(session) {
    return [
      session.name,
      sessionPresetLabel(session),
      normalizeCustomGameName(session.payload?.customGameName),
      ...sessionPlayerNames(session),
    ]
      .join(" ")
      .toLowerCase();
  }

  function getSelectedSession() {
    if (!state.selectedSessionId) return null;
    return getStoredSessions().find((session) => session.id === state.selectedSessionId) || null;
  }

  function getSessionById(sessionId) {
    if (!sessionId) return null;
    return getStoredSessions().find((session) => session.id === sessionId) || null;
  }

  function selectSession(sessionId) {
    state.selectedSessionId = sessionId || "";
    updateSessionControls(state.selectedSessionId);
  }

  function setAutosavePayload(payload) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      try {
        localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
      } catch {}
      return true;
    } catch {
      return false;
    }
  }

  function readAutosavePayload() {
    for (const key of [AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEY]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const payload = JSON.parse(raw);
        if (
          payload &&
          Array.isArray(payload.players) &&
          Array.isArray(payload.rounds)
        ) {
          return {
            key,
            payload,
          };
        }
      } catch {}
    }
    return null;
  }

  function normalizeSessionRecord(entry) {
    if (!entry || typeof entry !== "object") return null;
    const payload =
      entry.payload && typeof entry.payload === "object" ? entry.payload : null;
    if (
      !payload ||
      !Array.isArray(payload.players) ||
      !Array.isArray(payload.rounds)
    ) {
      return null;
    }

    const createdAt = Number.parseInt(entry.createdAt, 10);
    const updatedAt = Number.parseInt(entry.updatedAt, 10);
    return {
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id
          : uid(),
      name:
        typeof entry.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : defaultSessionName(payload),
      payload,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
  }

  function getStoredSessions() {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeSessionRecord)
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  function setStoredSessions(sessions) {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      return true;
    } catch {
      return false;
    }
  }

  function autoExportOnSavePreference() {
    try {
      const raw = localStorage.getItem(AUTO_EXPORT_ON_SAVE_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
    } catch {}
    return null;
  }

  function setAutoExportOnSavePreference(value) {
    try {
      localStorage.setItem(AUTO_EXPORT_ON_SAVE_KEY, value ? "true" : "false");
      return true;
    } catch {
      return false;
    }
  }

  function updateSessionControls(preferredId = state.selectedSessionId) {
    const sessions = getStoredSessions();
    state.savedSessionCount = sessions.length;

    let selectedId = preferredId;
    if (!selectedId && state.currentSessionId) {
      selectedId = state.currentSessionId;
    }
    if (selectedId && !sessions.some((session) => session.id === selectedId)) {
      selectedId = "";
    }
    state.selectedSessionId = selectedId;

    if (els.savedSessionSelect) {
      els.savedSessionSelect.innerHTML = `<option value="">Saved sessions on this device</option>`;
      for (const session of sessions) {
        const option = document.createElement("option");
        option.value = session.id;
        option.textContent = sessionOptionLabel(session);
        els.savedSessionSelect.appendChild(option);
      }
      els.savedSessionSelect.value = selectedId;
      els.savedSessionSelect.disabled = sessions.length === 0;
    }

    if (els.btnBrowseSessionsCount) {
      els.btnBrowseSessionsCount.textContent = String(sessions.length);
      els.btnBrowseSessionsCount.hidden = sessions.length === 0;
    }

    const hasCurrent = hasSnapshotData();
    const hasSelected = !!selectedId;
    els.btnSaveSession.disabled = !hasCurrent;
    els.btnLoadSession.disabled = !hasSelected;
    els.btnDeleteSession.disabled = !hasSelected;

    renderSessionBrowser(sessions);
    renderStorageStatus();
  }

  function renderStorageStatus() {
    const playing = state.mode === "playing" || state.mode === "finished";
    if (els.roundStorageStatus) {
      els.roundStorageStatus.hidden = !playing;
    }
    if (!playing) return;

    if (els.roundAutosaveStatus) {
      els.roundAutosaveStatus.textContent = state.savedExists
        ? "Autosave ready on this device"
        : "Autosave unavailable on this device";
    }
    if (els.roundSessionsStatus) {
      const noun = state.savedSessionCount === 1 ? "session" : "sessions";
      els.roundSessionsStatus.textContent = `Saved ${noun}: ${state.savedSessionCount}`;
    }
  }

  function filteredAndSortedSessions(sessions) {
    const query = state.sessionBrowserSearch.trim().toLowerCase();
    const filtered = sessions.filter((session) =>
      !query || sessionSearchText(session).includes(query),
    );

    const sortKey = state.sessionBrowserSort;
    filtered.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortKey === "preset") {
        return (
          sessionPresetLabel(a).localeCompare(sessionPresetLabel(b), undefined, {
            sensitivity: "base",
          }) || b.updatedAt - a.updatedAt
        );
      }
      if (sortKey === "rounds") {
        return (
          sessionRoundCount(b) - sessionRoundCount(a) ||
          b.updatedAt - a.updatedAt
        );
      }
      return b.updatedAt - a.updatedAt;
    });

    return filtered;
  }

  function renderSessionBrowser(sessions = getStoredSessions()) {
    if (
      !els.sessionBrowserList ||
      !els.sessionBrowserSummary ||
      !els.sessionBrowserEmpty
    ) {
      return;
    }

    const filtered = filteredAndSortedSessions(sessions);
    const total = sessions.length;
    const shown = filtered.length;
    const query = state.sessionBrowserSearch.trim();

    if (els.sessionBrowserSearch) {
      els.sessionBrowserSearch.value = state.sessionBrowserSearch;
    }
    if (els.sessionBrowserSort) {
      els.sessionBrowserSort.value = state.sessionBrowserSort;
    }

    if (!total) {
      els.sessionBrowserSummary.textContent =
        "No saved sessions yet. Save a game snapshot to build your library.";
    } else if (query) {
      els.sessionBrowserSummary.textContent = `Showing ${shown} of ${total} saved sessions.`;
    } else {
      els.sessionBrowserSummary.textContent = `${total} saved session${total === 1 ? "" : "s"} on this device.`;
    }

    els.sessionBrowserList.innerHTML = "";
    els.sessionBrowserEmpty.hidden = shown !== 0;
    if (!shown) return;

    for (const session of filtered) {
      const card = document.createElement("article");
      card.className = "session-card";
      if (session.id === state.selectedSessionId) card.classList.add("active");
      if (session.id === state.currentSessionId) card.classList.add("current");
      card.setAttribute("data-session-id", session.id);

      const players = sessionPlayerNames(session);
      const rounds = sessionRoundCount(session);
      const statusLabel =
        session.payload?.mode === "finished"
          ? "Finished"
          : session.payload?.mode === "playing"
            ? "In progress"
            : "Setup";

      card.innerHTML = `
        <div class="session-card-head">
          <div>
            <h4 class="session-card-title">${escapeHtml(session.name)}</h4>
            <div class="muted">Updated ${escapeHtml(formatSessionTimestamp(session.updatedAt))}</div>
          </div>
          <div class="session-card-badges">
            <span class="session-badge">${escapeHtml(sessionPresetLabel(session))}</span>
            <span class="session-badge">${escapeHtml(statusLabel)}</span>
            ${
              session.id === state.currentSessionId
                ? '<span class="session-badge current">Current</span>'
                : ""
            }
          </div>
        </div>
        <div class="session-card-meta">
          <div class="session-card-stat">
            <strong>Players</strong>
            <span>${players.length}</span>
          </div>
          <div class="session-card-stat">
            <strong>Rounds</strong>
            <span>${rounds}</span>
          </div>
          <div class="session-card-stat">
            <strong>Target</strong>
            <span>${escapeHtml(String(session.payload?.target ?? APP_LIMITS.defaultTarget))}</span>
          </div>
          <div class="session-card-stat">
            <strong>Created</strong>
            <span>${escapeHtml(formatSessionTimestamp(session.createdAt))}</span>
          </div>
        </div>
        <div class="session-card-players">${escapeHtml(players.join(", ") || "No player names saved.")}</div>
        <div class="session-card-actions">
          <button type="button" class="btn" data-session-action="select" data-session-id="${session.id}">Select</button>
          <button type="button" class="btn" data-session-action="load" data-session-id="${session.id}">Load</button>
          <button type="button" class="btn" data-session-action="rename" data-session-id="${session.id}">Rename</button>
          <button type="button" class="btn" data-session-action="export" data-session-id="${session.id}">Export</button>
          <button type="button" class="btn danger" data-session-action="delete" data-session-id="${session.id}">Delete</button>
        </div>
      `;
      els.sessionBrowserList.appendChild(card);
    }
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
    const eligiblePlayers = activePlayers();
    if (isPhase10()) {
      const progress = phase10Progress();
      return eligiblePlayers.map((p) => ({
        id: p.id,
        total: playerTotals[p.id] ?? 0,
        phaseCompleted: progress[p.id]?.completedPhases ?? 0,
      }));
    }
    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      return state.teams.map((t) => ({
        id: t.id,
        total: teamTotals[t.id] ?? 0,
      }));
    }
    return eligiblePlayers.map((p) => ({
      id: p.id,
      total: playerTotals[p.id] ?? 0,
    }));
  }

  function suggestedContinueTarget() {
    const requirement = continueTargetRequirement();
    // Recommend the next higher 50-point milestone that is safely above
    // all current totals, so "continue" never starts in an already-won state.
    return Math.ceil(requirement.minTarget / 50) * 50;
  }

  function continueTargetRequirement() {
    const playerTotals = totalsByPlayerId();
    const entries = buildWinnerEntries(playerTotals);
    const topEntry = entries.reduce((best, entry) => {
      const total = Number(entry?.total ?? 0);
      if (!Number.isFinite(total)) return best;
      if (!best || total > best.total) {
        return { id: entry.id, total };
      }
      return best;
    }, null);

    const highestTotal = Number(topEntry?.total ?? 0);
    return {
      highestId: topEntry?.id ?? null,
      highestTotal,
      minTarget: Math.max(
        APP_LIMITS.targetMin,
        highestTotal + 1,
      ),
    };
  }

  function renderContinueModalContext(requirement, opts = {}) {
    const { invalid = false } = opts;
    if (!els.continueModalContext) return;

    const firstRound = state.firstWinnerAt?.roundN;
    const firstTarget = state.firstWinnerAt?.target;
    const firstLine =
      firstRound && firstTarget
        ? `Original winner declared in round ${firstRound} at target ${firstTarget}.`
        : "A winner has already been declared.";
    const highestLabel = requirement.highestId
      ? entityName(requirement.highestId)
      : "A player";
    const requirementLine = `${highestLabel} is already at ${requirement.highestTotal}, so the new target must be at least `;

    if (
      els.continueModalIntro &&
      els.continueTargetRequirement &&
      els.continueTargetRequirementText &&
      els.continueModalPrompt
    ) {
      els.continueModalIntro.textContent = firstLine;
      els.continueTargetRequirementText.innerHTML =
        `${requirementLine}<strong class="continue-target-min">${requirement.minTarget}</strong>.`;
      els.continueTargetRequirement.classList.toggle("is-invalid", invalid);
      els.continueModalPrompt.textContent = "Choose how to continue.";
      return;
    }

    els.continueModalContext.textContent = `${firstLine} ${requirementLine} Choose how to continue.`;
  }

  function syncContinueTargetRequirementFeedback() {
    if (!els.continueTargetPoints) return;
    const requirement = continueTargetRequirement();
    const raw = String(els.continueTargetPoints.value ?? "").trim();
    const parsed = Number.parseInt(raw, 10);
    const invalid = raw !== "" && (!Number.isInteger(parsed) || parsed < requirement.minTarget);
    renderContinueModalContext(requirement, { invalid });
    els.continueTargetPoints.classList.toggle("is-invalid", invalid);
  }

  function canContinueFinishedGame() {
    return !isPhase10();
  }

  function normalizePhase10GameState(hasWinner = false) {
    if (canContinueFinishedGame()) return;
    if (state.gameState === "extended" || state.gameState === "free_play") {
      state.gameState = hasWinner ? "completed" : "in_progress";
    }
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
    normalizePhase10GameState(Boolean(resolvedWinner));

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
    if (
      state.mode !== "finished" ||
      !state.winnerId ||
      !els.continueModal ||
      !canContinueFinishedGame()
    ) {
      return;
    }
    const requirement = continueTargetRequirement();
    const suggestedTarget = suggestedContinueTarget();
    els.continueTargetPoints.value = String(suggestedTarget);
    els.continueTargetPoints.classList.remove("is-invalid");
    els.continueTargetPoints.min = String(
      Math.min(APP_LIMITS.targetMax, requirement.minTarget),
    );
    renderContinueModalContext(requirement);
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

  function openSessionModal() {
    if (!els.sessionModal) return;
    renderSessionBrowser();
    els.sessionModal.hidden = false;
    els.sessionModal.classList.add("is-open");
    els.sessionBrowserSearch?.focus();
    els.sessionBrowserSearch?.select?.();
  }

  function closeSessionModal() {
    if (!els.sessionModal) return;
    els.sessionModal.classList.remove("is-open");
    els.sessionModal.hidden = true;
  }

  function openSaveSessionModal() {
    if (!hasSnapshotData() || !els.saveSessionModal) return;
    const sessions = getStoredSessions();
    const existing = state.currentSessionId
      ? sessions.find((session) => session.id === state.currentSessionId)
      : null;
    const name = existing?.name || defaultSessionName();
    if (els.saveSessionName) {
      els.saveSessionName.value = name;
    }
    if (els.saveSessionAutoExport) {
      els.saveSessionAutoExport.checked = autoExportOnSavePreference() === true;
    }
    els.saveSessionModal.hidden = false;
    els.saveSessionModal.classList.add("is-open");
    els.saveSessionName?.focus();
    els.saveSessionName?.select?.();
  }

  function closeSaveSessionModal() {
    if (!els.saveSessionModal) return;
    els.saveSessionModal.classList.remove("is-open");
    els.saveSessionModal.hidden = true;
  }

  function continueWithRaisedTarget() {
    if (!canContinueFinishedGame()) {
      closeContinueModal();
      return;
    }
    const nextTarget = clampInt(
      els.continueTargetPoints.value,
      APP_LIMITS.targetMin,
      APP_LIMITS.targetMax,
    );
    const requirement = continueTargetRequirement();
    if (
      !Number.isInteger(nextTarget) ||
      nextTarget < APP_LIMITS.targetMin ||
      nextTarget > APP_LIMITS.targetMax
    ) {
      showMsg(
        els.roundMsg,
        `New target must be between ${APP_LIMITS.targetMin} and ${APP_LIMITS.targetMax}.`,
      );
      els.continueTargetPoints.focus();
      els.continueTargetPoints.select?.();
      return;
    }
    if (nextTarget < requirement.minTarget) {
      const highestLabel = requirement.highestId
        ? entityName(requirement.highestId)
        : "A player";
      renderContinueModalContext(requirement, { invalid: true });
      els.continueTargetPoints.classList.add("is-invalid");
      showMsg(
        els.roundMsg,
        `${highestLabel} is already at ${requirement.highestTotal}. Enter at least ${requirement.minTarget}, or choose Free Play instead.`,
      );
      els.continueTargetPoints.focus();
      els.continueTargetPoints.select?.();
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
    if (!canContinueFinishedGame()) {
      closeContinueModal();
      return;
    }
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
    state.savedExists = !!readAutosavePayload();
    els.btnLoadSaved.style.display = state.savedExists ? "inline-flex" : "none";
    updateSessionControls();
    renderStorageStatus();
  }

  function save() {
    setAutosavePayload(snapshotState());
    detectSaved();
  }

  function clearSaved() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    } catch {}
    detectSaved();
  }

  function hydrateStateFromPayload(payload, options = {}) {
    try {
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
      state.customGameName = normalizeCustomGameName(payload.customGameName);
      state.heartsDeckCount = normalizedHeartsDeckCount(payload.heartsDeckCount);
      state.target = Number.isFinite(payload.target)
        ? payload.target
        : APP_LIMITS.defaultTarget;
      state.winMode = payload.winMode === "low" ? "low" : "high";

      state.players = payload.players.map((p) => ({
        id: String(p.id),
        name: String(p.name),
      }));
      state.roundEntryOrder = normalizedRoundEntryOrder(
        payload.roundEntryOrder,
        state.players,
      );
      state.playerInactiveRanges = normalizedPlayerInactiveRanges(
        payload.playerInactiveRanges,
        state.players,
        payload.retiredPlayers,
      );
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
        phase10CompletedByPlayerId:
          r.phase10CompletedByPlayerId &&
          typeof r.phase10CompletedByPlayerId === "object"
            ? Object.fromEntries(
                state.players.map((p) => [
                  p.id,
                  Number(r.phase10CompletedByPlayerId?.[p.id] ?? 0) > 0 ? 1 : 0,
                ]),
              )
            : null,
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
      state.historySortDir = payload.historySortDir === "desc" ? "desc" : "asc";
      state.showHistoryTotals =
        typeof payload.showHistoryTotals === "boolean"
          ? payload.showHistoryTotals
          : true;

      state.lastRoundScores = state.rounds.length
        ? state.rounds[state.rounds.length - 1].scores || {}
        : {};
      state.currentRoundScores = Object.fromEntries(
        state.players.map((p) => [p.id, 0]),
      );
      state.currentRoundPhase10Completed = Object.fromEntries(
        state.players.map((p) => [p.id, 0]),
      );
      state.bannerDismissed = false;
      state.historyEditingRoundN = null;
      state.activeRoundHelper = null;
      const requestedSessionId =
        typeof options.currentSessionId === "string"
          ? options.currentSessionId
          : typeof payload.currentSessionId === "string"
            ? payload.currentSessionId
            : null;
      const sessionIds = new Set(getStoredSessions().map((session) => session.id));
      state.currentSessionId =
        requestedSessionId && sessionIds.has(requestedSessionId)
          ? requestedSessionId
          : null;
      state.selectedSessionId = state.currentSessionId || "";
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
      syncCustomGameInputs();
      syncCustomWinModeInputs();
      updateWinModeText();
      maybeRenderTeamPreview();
      applyPhase10UiText();

      save();
      renderAll();
      updateSessionControls(state.selectedSessionId);
      setLive(options.liveMessage || "Saved game loaded.");
      return true;
    } catch {
      return false;
    }
  }

  function loadSaved() {
    const autosave = readAutosavePayload();
    if (!autosave) return false;
    const ok = hydrateStateFromPayload(autosave.payload, {
      liveMessage: "Autosave resumed.",
    });
    if (ok && autosave.key === LEGACY_AUTOSAVE_KEY) {
      save();
    }
    return ok;
  }

  function saveNamedSession(options = {}) {
    const {
      name: providedName = "",
      autoExport = false,
      persistAutoExportPreference = false,
    } = options;
    if (!hasSnapshotData()) {
      showStatusMessage("Start or load a game before saving a session.");
      return false;
    }

    const sessions = getStoredSessions();
    const existing = state.currentSessionId
      ? sessions.find((session) => session.id === state.currentSessionId)
      : null;

    let name = normalizeName(providedName) || existing?.name || defaultSessionName();
    if (!name) {
      showStatusMessage("Session name cannot be empty.");
      return false;
    }

    const now = Date.now();
    const id = existing?.id || uid();
    const payload = cloneJson(snapshotState());
    payload.currentSessionId = id;
    const nextRecord = {
      id,
      name,
      payload,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextSessions = [nextRecord, ...sessions.filter((session) => session.id !== id)]
      .map(normalizeSessionRecord)
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (!setStoredSessions(nextSessions)) {
      showStatusMessage("Unable to save this session.");
      return false;
    }

    state.currentSessionId = id;
    state.selectedSessionId = id;
    save();
    updateSessionControls(id);
    if (persistAutoExportPreference) {
      setAutoExportOnSavePreference(autoExport);
    }
    handlePostSaveSession(name, id, { autoExport });
    return true;
  }

  function renameSessionById(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return;
    const answer = window.prompt("Rename this saved session:", session.name);
    if (answer === null) return;

    const nextName = normalizeName(answer);
    if (!nextName) {
      showStatusMessage("Session name cannot be empty.");
      return;
    }

    const nextSessions = getStoredSessions().map((entry) =>
      entry.id === session.id
        ? {
            ...entry,
            name: nextName,
            updatedAt: Date.now(),
          }
        : entry,
    );
    if (!setStoredSessions(nextSessions)) {
      showStatusMessage("Unable to rename that session.");
      return;
    }

    if (state.currentSessionId === session.id) {
      save();
    } else {
      updateSessionControls(session.id);
    }
    showStatusMessage(`Session renamed to ${nextName}.`);
    setLive(`Session renamed to ${nextName}.`);
  }

  function loadSelectedSession() {
    loadSessionById(state.selectedSessionId);
  }

  function loadSessionById(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return;
    const ok = hydrateStateFromPayload(cloneJson(session.payload), {
      currentSessionId: session.id,
      liveMessage: `Session loaded: ${session.name}.`,
    });
    if (!ok) {
      showStatusMessage("That session could not be loaded.");
      return;
    }
    state.selectedSessionId = session.id;
    updateSessionControls(session.id);
    closeSessionModal();
  }

  function deleteSelectedSession() {
    deleteSessionById(state.selectedSessionId);
  }

  function deleteSessionById(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return;

    const proceed = window.confirm(`Delete saved session "${session.name}"?`);
    if (!proceed) return;

    const remaining = getStoredSessions().filter(
      (entry) => entry.id !== session.id,
    );
    if (!setStoredSessions(remaining)) {
      showStatusMessage("Unable to delete that session.");
      return;
    }

    if (state.currentSessionId === session.id) {
      state.currentSessionId = null;
    }
    state.selectedSessionId = "";
    save();
    updateSessionControls("");
    showStatusMessage(`Deleted session: ${session.name}.`);
    setLive(`Deleted session: ${session.name}.`);
  }

  function resolveExportSession(sessionId = "") {
    if (sessionId) {
      const session = getSessionById(sessionId);
      if (!session) return null;
      return {
        name: session.name,
        id: session.id,
        payload: cloneJson(session.payload),
      };
    }

    if (hasSnapshotData()) {
      const current = state.currentSessionId
        ? getStoredSessions().find((session) => session.id === state.currentSessionId)
        : null;
      return {
        name: current?.name || defaultSessionName(),
        id: current?.id || null,
        payload: cloneJson(snapshotState()),
      };
    }

    const session = getSelectedSession();
    if (!session) return null;
    return {
      name: session.name,
      id: session.id,
      payload: cloneJson(session.payload),
    };
  }

  function exportSessionFile(sessionId = "", opts = {}) {
    const { suppressStatus = false, suppressLive = false } = opts;
    const exportable = resolveExportSession(sessionId);
    if (!exportable) {
      if (!suppressStatus) showStatusMessage("Nothing to export yet.");
      return;
    }

    const bundle = {
      app: "scorekeeper",
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      session: {
        id: exportable.id,
        name: exportable.name,
      },
      payload: exportable.payload,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileNameForSession(exportable);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);

    if (!suppressStatus) showStatusMessage(`Exported session: ${exportable.name}.`);
    if (!suppressLive) setLive(`Exported session: ${exportable.name}.`);
    return exportable;
  }

  function handlePostSaveSession(name, sessionId, opts = {}) {
    const { autoExport = autoExportOnSavePreference() === true } = opts;
    if (autoExport) {
      const exported = exportSessionFile(sessionId, {
        suppressStatus: true,
        suppressLive: true,
      });
      if (exported) {
        showStatusMessage(`Session saved and backed up: ${name}.`);
        setLive(`Session saved and backed up: ${name}.`);
        return;
      }
    }
    showStatusMessage(`Session saved: ${name}.`);
    setLive(`Session saved: ${name}.`);
  }

  function parseImportedSession(json, filename = "") {
    if (!json || typeof json !== "object") return null;

    const payload =
      json.app === "scorekeeper" && json.payload
        ? json.payload
        : json.payload && typeof json.payload === "object"
          ? json.payload
          : json;
    if (
      !payload ||
      !Array.isArray(payload.players) ||
      !Array.isArray(payload.rounds)
    ) {
      return null;
    }

    const fallbackName = filename
      ? sanitizeFileName(filename.replace(/\.json$/i, ""))
      : defaultSessionName(payload);
    const providedName =
      typeof json.session?.name === "string" && json.session.name.trim()
        ? json.session.name.trim()
        : typeof json.name === "string" && json.name.trim()
          ? json.name.trim()
          : fallbackName;
    const now = Date.now();
    const id = uid();
    const clonedPayload = cloneJson(payload);
    clonedPayload.currentSessionId = id;

    return {
      id,
      name: providedName,
      payload: clonedPayload,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function importSessionFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parseImportedSession(parsed, file.name);
      if (!imported) {
        showStatusMessage("That file is not a valid ScoreKeeper session.");
        return;
      }

      const nextSessions = [imported, ...getStoredSessions()]
        .map(normalizeSessionRecord)
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (!setStoredSessions(nextSessions)) {
        showStatusMessage("Unable to import that session.");
        return;
      }

      const ok = hydrateStateFromPayload(imported.payload, {
        currentSessionId: imported.id,
        liveMessage: `Session imported: ${imported.name}.`,
      });
      if (!ok) {
        showStatusMessage("Imported file could not be loaded.");
        return;
      }
      state.selectedSessionId = imported.id;
      updateSessionControls(imported.id);
    } catch {
      showStatusMessage("Import failed. Check that the file contains valid JSON.");
    } finally {
      if (els.importSessionFile) {
        els.importSessionFile.value = "";
      }
    }
  }

  function newGame() {
    state.mode = "setup";
    state.presetKey = "custom";
    state.customGameName = "";
    state.heartsDeckCount = 1;
    state.target = APP_LIMITS.defaultTarget;
    state.winMode = "high";
    state.players = [];
    state.roundEntryOrder = [];
    state.playerInactiveRanges = {};
    state.teams = null;
    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = {};
    state.currentRoundPhase10Completed = {};
    clearWinnerLifecycle();
    state.sortByTotal = false;
    state.currentSessionId = null;
    state.selectedSessionId = "";
    state.bannerDismissed = false;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;
    state.presetNote = "";
    state.spadesPartnerIndex = 2;

    els.presetSelect.value = "custom";
    if (els.customGameName) els.customGameName.value = "";
    if (els.preRoundCustomGameName) els.preRoundCustomGameName.value = "";
    if (els.heartsDeckCount) els.heartsDeckCount.value = "1";
    if (els.preRoundHeartsDeckCount) els.preRoundHeartsDeckCount.value = "1";
    syncCustomWinModeInputs();
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
    updateSessionControls("");
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

    // Fresh same-players games should honor the active preset's default target.
    const preset = PRESETS[state.presetKey] || PRESETS.custom;
    const target = Number.isInteger(preset.target)
      ? preset.target
      : APP_LIMITS.defaultTarget;

    state.mode = "playing";
    state.heartsDeckCount = normalizedHeartsDeckCount(state.heartsDeckCount);
    state.target = target;
    els.targetPoints.value = String(target);

    // Fresh IDs prevent “stale input bindings”
    state.players = names.map((name) => ({ id: uid(), name }));
    state.roundEntryOrder = state.players.map((p) => p.id);
    state.playerInactiveRanges = {};
    state.teams = buildTeamsIfNeeded(state.players);

    // Reset score state
    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.currentRoundPhase10Completed = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    clearWinnerLifecycle();
    state.currentSessionId = null;
    state.selectedSessionId = "";
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
    updateSessionControls("");
    setLive("New game started with same players.");
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  function normalizeCustomGameName(name) {
    return String(name || "").trim();
  }

  function syncCustomGameInputs() {
    if (els.customGameName && els.customGameName.value !== state.customGameName) {
      els.customGameName.value = state.customGameName;
    }
    if (
      els.preRoundCustomGameName &&
      els.preRoundCustomGameName.value !== state.customGameName
    ) {
      els.preRoundCustomGameName.value = state.customGameName;
    }
  }

  function syncHeartsDeckInputs() {
    const value = String(normalizedHeartsDeckCount(state.heartsDeckCount));
    if (els.heartsDeckCount && els.heartsDeckCount.value !== value) {
      els.heartsDeckCount.value = value;
    }
    if (
      els.preRoundHeartsDeckCount &&
      els.preRoundHeartsDeckCount.value !== value
    ) {
      els.preRoundHeartsDeckCount.value = value;
    }
  }

  function syncCustomWinModeInputs() {
    const value = state.winMode === "low" ? "low" : "high";
    if (els.customWinModeSelect && els.customWinModeSelect.value !== value) {
      els.customWinModeSelect.value = value;
    }
    if (
      els.preRoundCustomWinModeSelect &&
      els.preRoundCustomWinModeSelect.value !== value
    ) {
      els.preRoundCustomWinModeSelect.value = value;
    }
  }

  function renderCustomGameNameUi(allowPreRoundPresetChange = false) {
    syncCustomGameInputs();
    if (els.customGameRow) {
      els.customGameRow.style.display = state.presetKey === "custom" ? "block" : "none";
    }
    if (els.preRoundCustomGameRow) {
      els.preRoundCustomGameRow.style.display =
        allowPreRoundPresetChange && state.presetKey === "custom" ? "block" : "none";
    }
  }

  function renderCustomWinModeUi(allowPreRoundPresetChange = false) {
    syncCustomWinModeInputs();
    if (els.customWinModeRow) {
      els.customWinModeRow.style.display =
        state.presetKey === "custom" ? "flex" : "none";
    }
    if (els.preRoundCustomWinModeRow) {
      els.preRoundCustomWinModeRow.style.display =
        allowPreRoundPresetChange && state.presetKey === "custom"
          ? "flex"
          : "none";
    }
  }

  function renderHeartsDeckUi(allowPreRoundPresetChange = false) {
    syncHeartsDeckInputs();
    if (els.heartsDeckRow) {
      els.heartsDeckRow.style.display =
        state.presetKey === "hearts" ? "flex" : "none";
    }
    if (els.preRoundHeartsDeckRow) {
      els.preRoundHeartsDeckRow.style.display =
        allowPreRoundPresetChange && state.presetKey === "hearts"
          ? "flex"
          : "none";
    }
  }

  function setCustomGameName(nextName, options = {}) {
    const { persist = false } = options;
    state.customGameName = String(nextName || "");
    syncCustomGameInputs();
    scoreboard.updateScoreboardTitle();
    if (persist && state.players.length) save();
  }

  function setWinMode(nextMode, options = {}) {
    const { persist = false } = options;
    state.winMode = nextMode === "low" ? "low" : "high";
    syncCustomWinModeInputs();
    updateWinModeText();
    renderAll();
    if (persist && state.players.length) save();
  }

  function setHeartsDeckCount(nextCount, options = {}) {
    const { persist = false } = options;
    state.heartsDeckCount = normalizedHeartsDeckCount(nextCount);
    syncHeartsDeckInputs();
    renderAll();
    if (persist && state.players.length) save();
  }

  function heartsPenaltyPoints() {
    return heartsRoundPenaltyTotal(state.heartsDeckCount);
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
      els.targetLabel.textContent = isPhase10() ? "Final phase" : "Target";
    }
    if (els.colHeadTotal) {
      els.colHeadTotal.textContent = isPhase10() ? "Points" : "Total";
    }
    if (els.colHeadThis) {
      els.colHeadThis.textContent = "Last Round";
    }

    // Phase 10 reference (hints/reminders)
    if (els.phase10Ref) {
      els.phase10Ref.hidden = !isPhase10();
    }
  }

  function phase10Progress() {
    return phase10ProgressByPlayerId(state.players, state.rounds, state.target);
  }

  function applyPreset(key) {
    const preset = PRESETS[key] || PRESETS.custom;
    state.presetKey = key in PRESETS ? key : "custom";

    if (Number.isInteger(preset.target)) {
      state.target = preset.target;
      els.targetPoints.value = String(preset.target);
      if (els.preRoundTargetPoints) {
        els.preRoundTargetPoints.value = String(preset.target);
      }
    }
    els.presetSelect.value = state.presetKey;
    if (els.preRoundPresetSelect) {
      els.preRoundPresetSelect.value = state.presetKey;
    }

    state.winMode = preset.winMode === "low" ? "low" : "high";
    updateWinModeText();
    syncCustomWinModeInputs();

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
    renderCustomGameNameUi(
      state.mode === "playing" && state.rounds.length === 0,
    );
    renderHeartsDeckUi(
      state.mode === "playing" && state.rounds.length === 0,
    );
    renderCustomWinModeUi(
      state.mode === "playing" && state.rounds.length === 0,
    );
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
    state.customGameName = String(els.customGameName?.value || "");
    if (state.presetKey === "custom") {
      state.winMode =
        els.customWinModeSelect?.value === "low" ? "low" : "high";
      syncCustomWinModeInputs();
      updateWinModeText();
    }

    const msg = validateSetup(names, target);
    if (msg) {
      showMsg(els.setupMsg, msg);
      return;
    }

    state.mode = "playing";
    state.heartsDeckCount = normalizedHeartsDeckCount(
      els.heartsDeckCount?.value ?? state.heartsDeckCount,
    );
    state.target = target;

    state.players = names.map((name) => ({ id: uid(), name }));
    state.roundEntryOrder = state.players.map((p) => p.id);
    state.playerInactiveRanges = {};
    state.teams = buildTeamsIfNeeded(state.players);

    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.currentRoundPhase10Completed = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    clearWinnerLifecycle();
    state.currentSessionId = null;
    state.selectedSessionId = "";
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
    updateSessionControls("");
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
    const eligibleEntries = entries.filter((entry) => !entry.retired);
    if (!eligibleEntries.length) return null;
    if (isPhase10()) {
      const bestPhase = Math.max(
        ...eligibleEntries.map((entry) => Number(entry.phaseCompleted ?? 0)),
      );
      const leaders = eligibleEntries.filter(
        (entry) => Number(entry.phaseCompleted ?? 0) === bestPhase,
      );
      return leaders.length === 1 ? leaders[0]?.id ?? null : null;
    }

    let best = null;
    for (const e of eligibleEntries) {
      const t = e.total ?? 0;
      if (best === null) {
        best = e.id;
        continue;
      }
      const bestTotal = eligibleEntries.find((x) => x.id === best)?.total ?? 0;

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
    if (isPhase10()) {
      return determinePhase10Winner(activePlayers(), state.rounds, state.target);
    }
    return resolveWinnerFromTotals(entries, state.winMode, state.target);
  }

  function retirePlayer(playerId) {
    if (state.mode !== "playing") return;
    if (state.teams) {
      showMsg(els.roundMsg, "Retiring players is not available in team games yet.");
      return;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player || isPlayerRetired(playerId)) return;
    const remaining = activePlayers().filter((entry) => entry.id !== playerId);
    if (remaining.length < 2) {
      showMsg(els.roundMsg, "At least two active players are required to continue.");
      return;
    }
    const confirmed = window.confirm(
      `Retire ${player.name} from future rounds? Past scores and history will be kept.`,
    );
    if (!confirmed) return;

    retirePlayerFromNextRound(playerId);
    state.currentRoundScores[playerId] = 0;
    state.currentRoundPhase10Completed[playerId] = 0;
    if (state.skyjoCurrentRoundWentOutPlayerId === playerId) {
      state.skyjoCurrentRoundWentOutPlayerId = null;
    }
    syncWinnerLifecycleAfterLoad();
    save();
    renderAll();
    showMsg(els.roundMsg, `${player.name} retired from future rounds.`);
    setLive(`${player.name} retired from future rounds.`);
  }

  function unretirePlayer(playerId) {
    if (state.mode !== "playing") return;
    if (state.teams) {
      showMsg(els.roundMsg, "Unretiring players is not available in team games yet.");
      return;
    }
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player || !isPlayerRetired(playerId)) return;

    const confirmed = window.confirm(
      `Bring ${player.name} back into future rounds? Missed rounds will stay blank in history.`,
    );
    if (!confirmed) return;

    const restored = restorePlayerForNextRound(playerId);
    if (!restored) return;

    state.currentRoundScores[playerId] = 0;
    state.currentRoundPhase10Completed[playerId] = 0;
    syncWinnerLifecycleAfterLoad();
    save();
    renderAll();
    showMsg(els.roundMsg, `${player.name} can join again starting next round.`);
    setLive(`${player.name} can join again starting next round.`);
  }

  function markSkyjoWentOutForCurrentRound(playerId) {
    if (state.presetKey !== "skyjo" || state.mode !== "playing") return;
    if (!activePlayers().some((p) => p.id === playerId)) return;

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

  function renamePlayer(playerId, nextName) {
    if (state.mode !== "playing" && state.mode !== "finished") return false;
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return false;

    const normalized = normalizeName(nextName);
    if (!normalized) {
      showMsg(els.roundMsg, "Enter a player name.");
      return false;
    }
    const duplicate = state.players.some(
      (entry) =>
        entry.id !== playerId &&
        normalizeName(entry.name).toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      showMsg(els.roundMsg, APP_MESSAGES.setup.uniqueNames);
      return false;
    }
    if (player.name === normalized) return true;

    player.name = normalized;
    if (state.teams?.length) {
      state.teams = buildTeamsIfNeeded(state.players);
    }
    save();
    renderAll();
    showMsg(els.roundMsg, `${normalized} updated.`);
    setLive(`Renamed player to ${normalized}.`);
    return true;
  }

  function validateRoundScores(scores, opts = {}) {
    const { contextLabel = "round" } = opts;
    return validateScoresByRules({
      scores,
      players: activePlayers(),
      presetKey: state.presetKey,
      heartsDeckCount: state.heartsDeckCount,
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

    const eligiblePlayers = activePlayers();
    const zeroIds = eligiblePlayers
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
    const winnerPoints = eligiblePlayers.reduce((sum, p) => {
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
    const players = activePlayers();

    if (
      state.presetKey === "skyjo" &&
      !state.skyjoCurrentRoundWentOutPlayerId
    ) {
      return "SkyJo: select who went out this round.";
    }

    if (state.presetKey === "hearts") {
      const normalTotal = heartsPenaltyPoints();
      const total = players.reduce(
        (sum, p) => sum + Number(roundScores?.[p.id] ?? 0),
        0,
      );
      const shootMoonTotal = normalTotal * Math.max(0, players.length - 1);
      if (total !== normalTotal && total !== shootMoonTotal) {
        return `Hearts: round total must be ${normalTotal} (or ${shootMoonTotal} for shoot the moon).`;
      }
    }

    if (state.presetKey === "uno" || state.presetKey === "crazy8s") {
      const zeroCount = players.filter(
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
    const phase10CompletedByPlayerId = isPhase10()
      ? roundEntry.readPhase10Completions()
      : null;
    const blockReason = addRoundBlockReason(scores);
    if (blockReason) {
      showMsg(els.roundMsg, blockReason);
      return;
    }
    if (state.presetKey === "hearts") {
      const normalized = normalizeHeartsShootMoonScores(
        activePlayers(),
        scores,
        state.heartsDeckCount,
      );
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
      phase10CompletedByPlayerId,
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
    state.currentRoundPhase10Completed = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;
    state.skyjoCurrentRoundWentOutPlayerId = null;

    const playerTotals = totalsByPlayerId();
    const entries = buildWinnerEntries(playerTotals);
    normalizePhase10GameState(false);
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
    state.currentRoundPhase10Completed = Object.fromEntries(
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
    if (allowPreRoundPresetChange && els.preRoundTargetPoints) {
      els.preRoundTargetPoints.value = String(state.target);
    }
    renderCustomGameNameUi(allowPreRoundPresetChange);
    renderHeartsDeckUi(allowPreRoundPresetChange);
    renderCustomWinModeUi(allowPreRoundPresetChange);
    renderPreRoundSpadesTeamPicker(
      allowPreRoundPresetChange && state.presetKey === "spades",
    );
    els.leftTitle.textContent = playing ? "Round Entry" : "Game Setup";

    els.scoreboardEmpty.style.display = state.players.length ? "none" : "block";
    els.scoreboardArea.style.display = state.players.length ? "block" : "none";

    els.btnToggleSort.disabled = !state.players.length;
    els.btnPrint.disabled = !state.players.length;
    els.btnToggleSort.textContent = state.sortByTotal
      ? isPhase10()
        ? "Sort: Standings"
        : "Sort: Totals"
      : "Sort: Off";
    els.btnSaveSession.disabled = !hasSnapshotData();
    els.btnLoadSession.disabled = !state.selectedSessionId;
    els.btnDeleteSession.disabled = !state.selectedSessionId;
    els.savedSessionSelect.disabled = state.savedSessionCount === 0;

    els.btnUndo.disabled = !(state.rounds.length > 0);

    els.targetPill.textContent = String(state.target);
    els.roundPill.textContent = String(state.rounds.length + 1);

    let statusText = "Setup";
    if (state.mode === "playing") {
      if (canContinueFinishedGame() && state.gameState === "free_play") {
        statusText = "Playing (Free Play)";
      } else if (canContinueFinishedGame() && state.gameState === "extended") {
        statusText = "Playing (Extended)";
      } else {
        statusText = "Playing";
      }
    } else if (state.mode === "finished") {
      statusText =
        canContinueFinishedGame() && state.gameState === "extended"
          ? "Finished (Extended)"
          : "Finished";
    }
    els.pillStatus.innerHTML = `<strong>Status:</strong> ${statusText}`;
    renderStorageStatus();

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
    updateSessionControls(state.selectedSessionId);
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

  const onCustomGameNameInput = (value) => {
    setCustomGameName(value, {
      persist: state.mode === "playing",
    });
  };
  if (els.customGameName) {
    els.customGameName.addEventListener("input", () => {
      onCustomGameNameInput(els.customGameName.value);
    });
  }
  if (els.preRoundCustomGameName) {
    els.preRoundCustomGameName.addEventListener("input", () => {
      onCustomGameNameInput(els.preRoundCustomGameName.value);
    });
  }
  const onCustomWinModeChange = (value) => {
    if (state.presetKey !== "custom") return;
    setWinMode(value, {
      persist: state.mode === "playing",
    });
  };
  if (els.customWinModeSelect) {
    els.customWinModeSelect.addEventListener("change", () => {
      onCustomWinModeChange(els.customWinModeSelect.value);
    });
  }
  if (els.preRoundCustomWinModeSelect) {
    els.preRoundCustomWinModeSelect.addEventListener("change", () => {
      onCustomWinModeChange(els.preRoundCustomWinModeSelect.value);
    });
  }
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
  const onHeartsDeckCountChange = (value) => {
    if (state.presetKey !== "hearts") return;
    setHeartsDeckCount(value, {
      persist: state.mode === "playing",
    });
  };
  if (els.heartsDeckCount) {
    els.heartsDeckCount.addEventListener("change", () => {
      onHeartsDeckCountChange(els.heartsDeckCount.value);
    });
  }
  if (els.preRoundHeartsDeckCount) {
    els.preRoundHeartsDeckCount.addEventListener("change", () => {
      if (!(state.mode === "playing" && state.rounds.length === 0)) {
        return;
      }
      onHeartsDeckCountChange(els.preRoundHeartsDeckCount.value);
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
  const selectPreRoundTargetValue = () => {
    requestAnimationFrame(() => {
      if (document.activeElement === els.preRoundTargetPoints) {
        els.preRoundTargetPoints.select();
      }
    });
  };
  const syncPreRoundTarget = (raw, opts = {}) => {
    const { commit = false } = opts;
    const value = String(raw ?? "").trim();
    if (value === "") {
      if (commit && els.preRoundTargetPoints) {
        els.preRoundTargetPoints.value = String(state.target);
      }
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
      if (commit && els.preRoundTargetPoints) {
        els.preRoundTargetPoints.value = String(state.target);
      }
      return;
    }
    const nextTarget = clampInt(
      parsed,
      APP_LIMITS.targetMin,
      APP_LIMITS.targetMax,
    );
    state.target = nextTarget;
    els.targetPoints.value = String(nextTarget);
    if (els.preRoundTargetPoints) {
      els.preRoundTargetPoints.value = String(nextTarget);
    }
    els.targetPill.textContent = String(nextTarget);
    save();
  };
  els.targetPoints.addEventListener("focus", selectTargetValue);
  els.targetPoints.addEventListener("click", selectTargetValue);
  els.targetPoints.addEventListener("touchend", selectTargetValue);

  els.targetPoints.addEventListener("input", () => updateStartButtonState());
  if (els.preRoundTargetPoints) {
    els.preRoundTargetPoints.addEventListener("focus", selectPreRoundTargetValue);
    els.preRoundTargetPoints.addEventListener("click", selectPreRoundTargetValue);
    els.preRoundTargetPoints.addEventListener("touchend", selectPreRoundTargetValue);
    els.preRoundTargetPoints.addEventListener("input", () => {
      if (state.mode === "playing" && state.rounds.length === 0) {
        syncPreRoundTarget(els.preRoundTargetPoints.value);
      }
    });
    els.preRoundTargetPoints.addEventListener("change", () => {
      if (state.mode === "playing" && state.rounds.length === 0) {
        syncPreRoundTarget(els.preRoundTargetPoints.value, { commit: true });
      }
    });
    els.preRoundTargetPoints.addEventListener("blur", () => {
      if (state.mode === "playing" && state.rounds.length === 0) {
        syncPreRoundTarget(els.preRoundTargetPoints.value, { commit: true });
      }
    });
  }

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
    els.continueTargetPoints.addEventListener("input", () => {
      syncContinueTargetRequirementFeedback();
    });
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
      return;
    }
    if (e.key === "Escape" && els.sessionModal && !els.sessionModal.hidden) {
      closeSessionModal();
      return;
    }
    if (e.key === "Escape" && els.saveSessionModal && !els.saveSessionModal.hidden) {
      closeSaveSessionModal();
    }
  });

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const viewportContentOriginal = viewportMeta?.getAttribute("content") || null;
  let postPrintNormalizeTimer = null;
  function normalizeAfterPrintView() {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLSelectElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLButtonElement
    ) {
      active.blur();
    }

    // Best-effort fix for browsers that can return from print at a magnified viewport scale.
    const scale = window.visualViewport?.scale || 1;
    if (viewportMeta && viewportContentOriginal && scale > 1.05) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
      );
      setTimeout(() => {
        viewportMeta.setAttribute("content", viewportContentOriginal);
      }, 160);
    }
  }

  let historyOpenBeforePrint = false;
  window.addEventListener("beforeprint", () => {
    if (postPrintNormalizeTimer) {
      clearTimeout(postPrintNormalizeTimer);
      postPrintNormalizeTimer = null;
    }
    historyOpenBeforePrint = !!els.historyDetails?.open;
    if (els.historyDetails) els.historyDetails.open = true;
  });
  window.addEventListener("afterprint", () => {
    if (els.historyDetails) els.historyDetails.open = historyOpenBeforePrint;
    normalizeAfterPrintView();
  });

  els.btnPrint.addEventListener("click", () => {
    if (!state.players.length) return;
    historyOpenBeforePrint = !!els.historyDetails?.open;
    if (els.historyDetails) els.historyDetails.open = true;
    // Fallback for engines that skip afterprint.
    postPrintNormalizeTimer = setTimeout(() => {
      normalizeAfterPrintView();
      postPrintNormalizeTimer = null;
    }, 700);
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

  if (els.historyDetails) {
    els.historyDetails.addEventListener("toggle", () => {
      renderAll();
    });
  }

  if (els.btnHistoryOrder) {
    els.btnHistoryOrder.addEventListener("click", () => {
      state.historySortDir = state.historySortDir === "desc" ? "asc" : "desc";
      save();
      renderAll();
    });
  }
  if (els.btnHistoryTotals) {
    els.btnHistoryTotals.addEventListener("click", () => {
      state.showHistoryTotals = !state.showHistoryTotals;
      save();
      renderAll();
    });
  }

  els.savedSessionSelect.addEventListener("change", () => {
    selectSession(els.savedSessionSelect.value || "");
  });

  els.sessionBrowserSearch.addEventListener("input", () => {
    state.sessionBrowserSearch = els.sessionBrowserSearch.value || "";
    renderSessionBrowser();
  });

  els.sessionBrowserSort.addEventListener("change", () => {
    state.sessionBrowserSort = els.sessionBrowserSort.value || "updated";
    renderSessionBrowser();
  });

  els.sessionBrowserList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-session-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-session-action");
    const sessionId = btn.getAttribute("data-session-id") || "";
    if (!sessionId) return;

    if (action === "select") {
      selectSession(sessionId);
      return;
    }
    if (action === "load") {
      loadSessionById(sessionId);
      return;
    }
    if (action === "rename") {
      renameSessionById(sessionId);
      return;
    }
    if (action === "export") {
      exportSessionFile(sessionId);
      return;
    }
    if (action === "delete") {
      deleteSessionById(sessionId);
    }
  });

  els.btnSaveSession.addEventListener("click", () => {
    openSaveSessionModal();
  });

  els.btnImportSession.addEventListener("click", () => {
    els.importSessionFile.click();
  });

  els.btnBrowseSessions.addEventListener("click", () => {
    openSessionModal();
  });

  els.importSessionFile.addEventListener("change", () => {
    const file = els.importSessionFile.files?.[0];
    importSessionFile(file);
  });

  els.btnLoadSession.addEventListener("click", () => {
    loadSelectedSession();
  });

  els.btnDeleteSession.addEventListener("click", () => {
    deleteSelectedSession();
  });

  els.btnSessionModalClose.addEventListener("click", () => {
    closeSessionModal();
  });

  if (els.sessionModal) {
    els.sessionModal.addEventListener("click", (e) => {
      if (e.target === els.sessionModal) closeSessionModal();
    });
  }
  if (els.saveSessionModal) {
    els.saveSessionModal.addEventListener("click", (e) => {
      if (e.target === els.saveSessionModal) closeSaveSessionModal();
    });
  }
  if (els.btnSaveSessionCancel) {
    els.btnSaveSessionCancel.addEventListener("click", () => {
      closeSaveSessionModal();
    });
  }
  if (els.btnSaveSessionConfirm) {
    els.btnSaveSessionConfirm.addEventListener("click", () => {
      const ok = saveNamedSession({
        name: els.saveSessionName?.value || "",
        autoExport: !!els.saveSessionAutoExport?.checked,
        persistAutoExportPreference: true,
      });
      if (ok) closeSaveSessionModal();
    });
  }
  if (els.saveSessionName) {
    els.saveSessionName.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const ok = saveNamedSession({
        name: els.saveSessionName?.value || "",
        autoExport: !!els.saveSessionAutoExport?.checked,
        persistAutoExportPreference: true,
      });
      if (ok) closeSaveSessionModal();
    });
  }

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
  updateSessionControls();

  // Auto-load if saved game is playing/finished
  try {
    const autosave = readAutosavePayload();
    if (autosave) {
      const payload = autosave.payload;
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
