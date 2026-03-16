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
  const AUTOSAVE_KEY = "scorekeeper.v3.autosave";
  const SESSIONS_KEY = "scorekeeper.v3.sessions";
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
    btnExportSession: $("btnExportSession"),
    btnImportSession: $("btnImportSession"),
    btnBrowseSessions: $("btnBrowseSessions"),
    btnBrowseSessionsCount: $("btnBrowseSessionsCount"),
    btnLoadSession: $("btnLoadSession"),
    btnDeleteSession: $("btnDeleteSession"),
    btnSessionModalClose: $("btnSessionModalClose"),
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
    preRoundPresetRow: $("preRoundPresetRow"),
    preRoundPresetSelect: $("preRoundPresetSelect"),
    preRoundSpadesTeamRow: $("preRoundSpadesTeamRow"),
    preRoundSpadesPartnerLabel: $("preRoundSpadesPartnerLabel"),
    preRoundSpadesPartner: $("preRoundSpadesPartner"),
    preRoundCustomGameRow: $("preRoundCustomGameRow"),
    preRoundCustomGameName: $("preRoundCustomGameName"),
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
    btnHistoryOrder: $("btnHistoryOrder"),

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
    historySortDir: "asc",
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
      historySortDir: state.historySortDir,
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
    els.btnExportSession.disabled = !(hasCurrent || hasSelected);
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
    const baseTarget = Number.isInteger(state.target)
      ? state.target
      : APP_LIMITS.defaultTarget;
    // Recommend the next higher 50-point milestone for continued play.
    return Math.ceil((baseTarget + 1) / 50) * 50;
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
      state.historySortDir = payload.historySortDir === "desc" ? "desc" : "asc";

      state.lastRoundScores = state.rounds.length
        ? state.rounds[state.rounds.length - 1].scores || {}
        : {};
      state.currentRoundScores = Object.fromEntries(
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

  function saveNamedSession() {
    if (!hasSnapshotData()) {
      showStatusMessage("Start or load a game before saving a session.");
      return;
    }

    const sessions = getStoredSessions();
    const existing = state.currentSessionId
      ? sessions.find((session) => session.id === state.currentSessionId)
      : null;

    let name = existing?.name || defaultSessionName();
    if (!existing) {
      const answer = window.prompt("Name this saved session:", name);
      if (answer === null) return;
      name = normalizeName(answer) || name;
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
      return;
    }

    state.currentSessionId = id;
    state.selectedSessionId = id;
    save();
    updateSessionControls(id);
    showStatusMessage(`Session saved: ${name}.`);
    setLive(`Session saved: ${name}.`);
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

  function exportSessionFile(sessionId = "") {
    const exportable = resolveExportSession(sessionId);
    if (!exportable) {
      showStatusMessage("Nothing to export yet.");
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
    link.download = `${sanitizeFileName(exportable.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);

    showStatusMessage(`Exported session: ${exportable.name}.`);
    setLive(`Exported session: ${exportable.name}.`);
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
    state.target = APP_LIMITS.defaultTarget;
    state.winMode = "high";
    state.players = [];
    state.teams = null;
    state.rounds = [];
    state.lastRoundScores = {};
    state.currentRoundScores = {};
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

    // Reset target to the original app default for a fresh same-players game.
    const target = APP_LIMITS.defaultTarget;

    state.mode = "playing";
    state.target = target;
    els.targetPoints.value = String(target);

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

  function setCustomGameName(nextName, options = {}) {
    const { persist = false } = options;
    state.customGameName = String(nextName || "");
    syncCustomGameInputs();
    scoreboard.updateScoreboardTitle();
    if (persist && state.players.length) save();
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
      els.colHeadThis.textContent = isPhase10() ? "Last Completed" : "Last Round";
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
    renderCustomGameNameUi(
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
    renderCustomGameNameUi(allowPreRoundPresetChange);
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
    els.btnSaveSession.disabled = !hasSnapshotData();
    els.btnExportSession.disabled = !(
      hasSnapshotData() || !!state.selectedSessionId
    );
    els.btnLoadSession.disabled = !state.selectedSessionId;
    els.btnDeleteSession.disabled = !state.selectedSessionId;
    els.savedSessionSelect.disabled = state.savedSessionCount === 0;

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
      return;
    }
    if (e.key === "Escape" && els.sessionModal && !els.sessionModal.hidden) {
      closeSessionModal();
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
    saveNamedSession();
  });

  els.btnExportSession.addEventListener("click", () => {
    exportSessionFile();
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
