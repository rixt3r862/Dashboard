const COLORS = [
  { id: "red", label: "Red", short: "R", css: "#d94b4b" },
  { id: "blue", label: "Blue", short: "B", css: "#3e86d1" },
  { id: "green", label: "Green", short: "G", css: "#36a56c" },
  { id: "yellow", label: "Yellow", short: "Y", css: "#d8a329" },
];

const BOT_NAMES = [
  "Nova",
  "Juno",
  "Kite",
  "Piper",
  "Clover",
  "Atlas",
  "Sunny",
  "Blaze",
];

const BOT_DIFFICULTIES = ["easy", "medium", "hard"];

const STORAGE_KEY = "phase10.table.v1";
const SESSIONS_KEY = "phase10.table.sessions.v1";
const EXPORT_VERSION = 1;
let transientNoticeTimer = null;
let pilePulseTimer = null;
let flashedCardTimer = null;
let flashedGroupsTimer = null;
let dealAnimationTimer = null;

const PHASES = [
  {
    number: 1,
    title: "2 sets of 3",
    groups: [
      { kind: "set", size: 3 },
      { kind: "set", size: 3 },
    ],
  },
  {
    number: 2,
    title: "1 set of 3 + 1 run of 4",
    groups: [
      { kind: "set", size: 3 },
      { kind: "run", size: 4 },
    ],
  },
  {
    number: 3,
    title: "1 set of 4 + 1 run of 4",
    groups: [
      { kind: "set", size: 4 },
      { kind: "run", size: 4 },
    ],
  },
  {
    number: 4,
    title: "1 run of 7",
    groups: [{ kind: "run", size: 7 }],
  },
  {
    number: 5,
    title: "1 run of 8",
    groups: [{ kind: "run", size: 8 }],
  },
  {
    number: 6,
    title: "1 run of 9",
    groups: [{ kind: "run", size: 9 }],
  },
  {
    number: 7,
    title: "2 sets of 4",
    groups: [
      { kind: "set", size: 4 },
      { kind: "set", size: 4 },
    ],
  },
  {
    number: 8,
    title: "7 cards of one color",
    groups: [{ kind: "color", size: 7 }],
  },
  {
    number: 9,
    title: "1 set of 5 + 1 set of 2",
    groups: [
      { kind: "set", size: 5 },
      { kind: "set", size: 2 },
    ],
  },
  {
    number: 10,
    title: "1 set of 5 + 1 set of 3",
    groups: [
      { kind: "set", size: 5 },
      { kind: "set", size: 3 },
    ],
  },
];

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  roundNumber: 1,
  currentPlayerIndex: 0,
  roundStarterIndex: 0,
  turnStage: "setup",
  deck: [],
  discardPile: [],
  selectedCardId: null,
  lastDrawnCardId: null,
  selectedSkipTargetId: null,
  pendingSkipPlayerIds: [],
  logs: [],
  roundHistory: [],
  pendingRoundSummary: null,
  winnerId: null,
  transientNotice: null,
  pilePulse: null,
  flashedCardId: null,
  flashedGroupIds: [],
  dealAnimationCardIds: [],
  handSortMode: "color",
  roundHistorySortDir: "asc",
  humanExtraPlayUndoStack: [],
  humanPhasePreviewRequested: false,
  setupBotNames: BOT_NAMES.slice(0, 3),
  setupBotDifficulties: ["medium", "medium", "medium"],
  friendlyShuffle: true,
  currentSessionId: null,
  selectedSessionId: "",
  sessionStatusMessage: "",
  sessionToolsExpanded: false,
  mobileView: "play",
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
  botCount: document.getElementById("botCount"),
  friendlyShuffleToggle: document.getElementById("friendlyShuffleToggle"),
  botNameFields: document.getElementById("botNameFields"),
  startGameBtn: document.getElementById("startGameBtn"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  downloadSessionBtn: document.getElementById("downloadSessionBtn"),
  importSessionBtn: document.getElementById("importSessionBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  sessionToolsToggle: document.getElementById("sessionToolsToggle"),
  sessionToolsBody: document.getElementById("sessionToolsBody"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
  importSessionFile: document.getElementById("importSessionFile"),
  sessionStatus: document.getElementById("sessionStatus"),
  mobileSummaryBar: document.getElementById("mobileSummaryBar"),
  mobileRoundValue: document.getElementById("mobileRoundValue"),
  mobileTurnValue: document.getElementById("mobileTurnValue"),
  mobileDeckValue: document.getElementById("mobileDeckValue"),
  mobileDiscardValue: document.getElementById("mobileDiscardValue"),
  mobileViewTabs: document.getElementById("mobileViewTabs"),
  mobileOpponentsStrip: document.getElementById("mobileOpponentsStrip"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  deckPreview: document.getElementById("deckPreview"),
  discardPreview: document.getElementById("discardPreview"),
  drawDeckBtn: document.getElementById("drawDeckBtn"),
  takeDiscardBtn: document.getElementById("takeDiscardBtn"),
  actionDrawDeckBtn: document.getElementById("actionDrawDeckBtn"),
  actionTakeDiscardBtn: document.getElementById("actionTakeDiscardBtn"),
  layPhaseBtn: document.getElementById("layPhaseBtn"),
  discardBtn: document.getElementById("discardBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  handPanelTitle: document.getElementById("handPanelTitle"),
  actionSortBtn: document.getElementById("actionSortBtn"),
  actionHint: document.getElementById("actionHint"),
  eventNotice: document.getElementById("eventNotice"),
  selectedDiscard: document.getElementById("selectedDiscard"),
  suggestedDiscard: document.getElementById("suggestedDiscard"),
  playersBoard: document.getElementById("playersBoard"),
  leaderText: document.getElementById("leaderText"),
  humanSeatSummary: document.getElementById("humanSeatSummary"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  roundHistorySummary: document.getElementById("roundHistorySummary"),
  roundHistoryWrap: document.getElementById("roundHistoryWrap"),
  roundHistoryOrderBtn: document.getElementById("roundHistoryOrderBtn"),
};

bindEvents();
renderBotNameFields();
hydrateSavedGame();
render();
resumeRestoredBotTurn();

function bindEvents() {
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startNewGame();
  });

  els.botCount.addEventListener("change", () => {
    syncSetupBotConfigFromInputs();
    renderBotNameFields();
  });
  els.friendlyShuffleToggle.addEventListener("change", () => {
    state.friendlyShuffle = els.friendlyShuffleToggle.checked;
  });
  els.botNameFields.addEventListener("input", (event) => {
    const input = event.target.closest("input[id^='botName']");
    if (input) {
      const match = input.id.match(/^botName(\d)$/);
      if (!match) return;
      const index = Number(match[1]) - 1;
      if (index < 0 || index > 2) return;
      state.setupBotNames[index] = input.value;
      return;
    }
    const select = event.target.closest("select[id^='botDifficulty']");
    if (!select) return;
    const match = select.id.match(/^botDifficulty(\d)$/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    if (index < 0 || index > 2) return;
    state.setupBotDifficulties[index] = normalizeBotDifficulty(select.value);
  });
  els.botNameFields.addEventListener("change", (event) => {
    const select = event.target.closest("select[id^='botDifficulty']");
    if (!select) return;
    const match = select.id.match(/^botDifficulty(\d)$/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    if (index < 0 || index > 2) return;
    state.setupBotDifficulties[index] = normalizeBotDifficulty(select.value);
  });
  els.resetTableBtn.addEventListener("click", resetTable);
  els.saveSessionBtn.addEventListener("click", saveNamedSession);
  els.downloadSessionBtn.addEventListener("click", () => {
    exportSessionFile();
  });
  els.importSessionBtn.addEventListener("click", () => {
    els.importSessionFile.click();
  });
  els.sessionToolsToggle.addEventListener("click", () => {
    state.sessionToolsExpanded = !state.sessionToolsExpanded;
    renderSessionControls();
  });
  els.loadSessionBtn.addEventListener("click", () => {
    loadSelectedSession();
  });
  els.deleteSessionBtn.addEventListener("click", deleteSelectedSession);
  els.savedSessionSelect.addEventListener("change", () => {
    state.selectedSessionId = els.savedSessionSelect.value || "";
    render();
  });
  els.importSessionFile.addEventListener("change", () => {
    const file = els.importSessionFile.files?.[0];
    importSessionFile(file);
  });
  els.drawDeckBtn.addEventListener("click", () => humanDraw("deck"));
  els.takeDiscardBtn.addEventListener("click", () => humanDraw("discard"));
  els.actionDrawDeckBtn.addEventListener("click", () => humanDraw("deck"));
  els.actionTakeDiscardBtn.addEventListener("click", () => humanDraw("discard"));
  els.actionSortBtn.addEventListener("click", toggleHandSortMode);
  els.layPhaseBtn.addEventListener("click", humanLayPhase);
  els.discardBtn.addEventListener("click", humanDiscardSelected);
  els.nextRoundBtn.addEventListener("click", beginNextRound);
  els.roundHistoryOrderBtn.addEventListener("click", () => {
    state.roundHistorySortDir = state.roundHistorySortDir === "desc" ? "asc" : "desc";
    persistGame();
    renderRoundHistory();
  });
  els.mobileViewTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-view]");
    if (!button || !state.gameStarted) return;
    const nextView = normalizeMobileView(button.getAttribute("data-mobile-view"));
    if (nextView === state.mobileView) return;
    state.mobileView = nextView;
    render();
  });
  els.humanHand.addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-id]");
    if (!button) return;
    const cardId = button.getAttribute("data-card-id");
    if (!cardId) return;
    if (!isHumanTurn() || state.turnStage !== "main" || state.busy) return;
    state.selectedCardId = state.selectedCardId === cardId ? null : cardId;
    syncSelectedSkipTarget();
    render();
  });

  els.playersBoard.addEventListener("click", (event) => {
    const undoCard = event.target.closest("[data-undo-card-id]");
    if (undoCard) {
      const cardId = undoCard.getAttribute("data-undo-card-id");
      if (cardId) {
        undoHumanExtraPlay(cardId);
      }
      return;
    }
    const skipTargetCard = event.target.closest("[data-skip-target-id]");
    if (skipTargetCard) {
      const targetId = skipTargetCard.getAttribute("data-skip-target-id");
      if (targetId) {
        humanSelectSkipTarget(targetId);
      }
      return;
    }
    const button = event.target.closest("[data-group-id]");
    if (!button) return;
    const groupId = button.getAttribute("data-group-id");
    if (!groupId) return;
    humanPlaySelectedCardToGroup(groupId);
  });
  els.playersBoard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const skipTargetCard = event.target.closest("[data-skip-target-id]");
    if (!skipTargetCard) return;
    event.preventDefault();
    const targetId = skipTargetCard.getAttribute("data-skip-target-id");
    if (!targetId) return;
    humanSelectSkipTarget(targetId);
  });

  els.humanSeatSummary.addEventListener("click", (event) => {
    const undoCard = event.target.closest("[data-undo-card-id]");
    if (undoCard) {
      const cardId = undoCard.getAttribute("data-undo-card-id");
      if (cardId) {
        undoHumanExtraPlay(cardId);
      }
      return;
    }
    const button = event.target.closest("[data-group-id]");
    if (!button) return;
    const groupId = button.getAttribute("data-group-id");
    if (!groupId) return;
    humanPlaySelectedCardToGroup(groupId);
  });
}

function renderBotNameFields(preferredNames = null, preferredDifficulties = null) {
  const botCount = clampNumber(Number(els.botCount.value), 1, 3, 2);
  let currentNames;
  let currentDifficulties;
  if (preferredNames) {
    state.setupBotNames = Array.from({ length: 3 }, (_, index) => {
      const fallbackName = BOT_NAMES[index] ?? `Bot ${index + 1}`;
      return preferredNames[index] ?? state.setupBotNames[index] ?? fallbackName;
    });
  }
  if (preferredDifficulties) {
    state.setupBotDifficulties = Array.from({ length: 3 }, (_, index) =>
      normalizeBotDifficulty(preferredDifficulties[index] ?? state.setupBotDifficulties[index]),
    );
  }
  if (preferredNames || preferredDifficulties) {
    currentNames = [...state.setupBotNames];
    currentDifficulties = [...state.setupBotDifficulties];
  } else {
    const currentConfig = els.botNameFields.children.length
      ? syncSetupBotConfigFromInputs()
      : {
          names: [...state.setupBotNames],
          difficulties: [...state.setupBotDifficulties],
        };
    currentNames = currentConfig.names;
    currentDifficulties = currentConfig.difficulties;
  }

  els.botNameFields.innerHTML = Array.from({ length: botCount }, (_, index) => {
    const fallbackName = BOT_NAMES[index] ?? `Bot ${index + 1}`;
    const value = currentNames[index] ?? fallbackName;
    const difficulty = normalizeBotDifficulty(currentDifficulties[index]);
    return `
      <div class="bot-config-row">
        <label class="field">
          <span>Bot ${index + 1} name</span>
          <input
            id="botName${index + 1}"
            type="text"
            maxlength="24"
            autocomplete="off"
            placeholder="${escapeHtml(fallbackName)}"
            value="${escapeHtml(value)}"
          />
        </label>
        <label class="field bot-difficulty-field">
          <span>Level</span>
          <select id="botDifficulty${index + 1}">
            ${BOT_DIFFICULTIES.map((entry) => `
              <option value="${entry}" ${difficulty === entry ? "selected" : ""}>${difficultyLabel(entry)}</option>
            `).join("")}
          </select>
        </label>
      </div>
    `;
  }).join("");
}

function botNameInput(index) {
  return els.botNameFields.querySelector(`#botName${index + 1}`);
}

function botDifficultyInput(index) {
  return els.botNameFields.querySelector(`#botDifficulty${index + 1}`);
}

function syncSetupBotConfigFromInputs() {
  const nextNames = [...state.setupBotNames];
  const nextDifficulties = [...state.setupBotDifficulties];
  for (let index = 0; index < 3; index += 1) {
    const nameInput = botNameInput(index);
    const difficultyInput = botDifficultyInput(index);
    if (nameInput) {
      nextNames[index] = nameInput.value;
    } else if (!nextNames[index]) {
      nextNames[index] = BOT_NAMES[index] ?? `Bot ${index + 1}`;
    }
    nextDifficulties[index] = difficultyInput
      ? normalizeBotDifficulty(difficultyInput.value)
      : normalizeBotDifficulty(nextDifficulties[index]);
  }
  state.setupBotNames = nextNames;
  state.setupBotDifficulties = nextDifficulties;
  return {
    names: nextNames,
    difficulties: nextDifficulties,
  };
}

function hydrateSavedGame() {
  const saved = readSavedGame();
  if (!saved) return;

  const restored = hydrateStateFromPayload(saved, { syncSetupControls: true });
  if (!restored) {
    clearSavedGame();
    return;
  }
}

function resumeRestoredBotTurn() {
  if (
    state.gameStarted &&
    !isHumanTurn() &&
    ["draw", "main"].includes(state.turnStage)
  ) {
    queueBotTurnIfNeeded();
  }
}

function readSavedGame() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    clearSavedGame();
    return null;
  }
}

function persistGame() {
  try {
    if (!state.gameStarted) {
      clearSavedGame();
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState()));
  } catch {}
}

function clearSavedGame() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function readStoredSessions() {
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSessionRecord).filter(Boolean);
  } catch {
    return [];
  }
}

function writeStoredSessions(sessions) {
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function normalizeSessionRecord(session) {
  if (!session || typeof session !== "object") return null;
  if (typeof session.id !== "string" || !session.id) return null;
  if (!session.payload || typeof session.payload !== "object") return null;
  const createdAt = Number(session.createdAt) || Date.now();
  const updatedAt = Number(session.updatedAt) || createdAt;
  return {
    id: session.id,
    name: normalizeName(session.name, "Phase 10 Session"),
    payload: cloneJson(session.payload),
    createdAt,
    updatedAt,
  };
}

function getSessionById(sessionId) {
  if (!sessionId) return null;
  return readStoredSessions().find((session) => session.id === sessionId) ?? null;
}

function snapshotState() {
  return {
    gameStarted: state.gameStarted,
    busy: false,
    players: state.players,
    roundNumber: state.roundNumber,
    currentPlayerIndex: state.currentPlayerIndex,
    roundStarterIndex: state.roundStarterIndex,
    turnStage: state.turnStage,
    deck: state.deck,
    discardPile: state.discardPile,
    selectedCardId: state.selectedCardId,
    lastDrawnCardId: state.lastDrawnCardId,
    selectedSkipTargetId: state.selectedSkipTargetId,
    pendingSkipPlayerIds: state.pendingSkipPlayerIds,
    logs: state.logs,
    roundHistory: state.roundHistory,
    pendingRoundSummary: state.pendingRoundSummary,
    winnerId: state.winnerId,
    handSortMode: state.handSortMode,
    roundHistorySortDir: state.roundHistorySortDir,
    humanExtraPlayUndoStack: state.humanExtraPlayUndoStack,
    humanPhasePreviewRequested: state.humanPhasePreviewRequested,
    friendlyShuffle: state.friendlyShuffle,
    currentSessionId: state.currentSessionId,
    mobileView: state.mobileView,
  };
}

function buildHydratedState(payload, options = {}) {
  const { currentSessionId = null } = options;
  if (!payload || typeof payload !== "object") return null;

  const players = Array.isArray(payload.players)
    ? payload.players.map(normalizePlayerRecord)
    : [];
  const nextState = {
    gameStarted: Boolean(payload.gameStarted),
    busy: false,
    players,
    roundNumber: clampNumber(payload.roundNumber, 1, 999, 1),
    currentPlayerIndex: clampNumber(
      payload.currentPlayerIndex,
      0,
      Math.max(0, players.length - 1),
      0,
    ),
    roundStarterIndex: clampNumber(
      payload.roundStarterIndex,
      0,
      Math.max(0, players.length - 1),
      0,
    ),
    turnStage: normalizeTurnStage(payload.turnStage),
    deck: normalizeCardList(payload.deck),
    discardPile: normalizeCardList(payload.discardPile),
    selectedCardId: normalizeSelectedCardId(payload.selectedCardId),
    lastDrawnCardId: normalizeSelectedCardId(payload.lastDrawnCardId),
    selectedSkipTargetId: normalizeSelectedCardId(payload.selectedSkipTargetId),
    pendingSkipPlayerIds: normalizeIdList(payload.pendingSkipPlayerIds),
    logs: Array.isArray(payload.logs)
      ? payload.logs.map((entry) => String(entry)).slice(0, 14)
      : [],
    roundHistory: normalizeRoundHistory(payload.roundHistory),
    pendingRoundSummary:
      payload.pendingRoundSummary && typeof payload.pendingRoundSummary === "object"
        ? payload.pendingRoundSummary
        : null,
    winnerId: payload.winnerId ? String(payload.winnerId) : null,
    handSortMode: normalizeHandSortMode(payload.handSortMode),
    roundHistorySortDir: normalizeRoundHistorySortDir(payload.roundHistorySortDir),
    humanExtraPlayUndoStack: normalizeHumanExtraPlayUndoStack(payload.humanExtraPlayUndoStack),
    humanPhasePreviewRequested: Boolean(payload.humanPhasePreviewRequested),
    friendlyShuffle: normalizeFriendlyShuffle(payload.friendlyShuffle, false),
    currentSessionId:
      currentSessionId != null
        ? normalizeSelectedCardId(currentSessionId)
        : normalizeSelectedCardId(payload.currentSessionId),
    mobileView: normalizeMobileView(payload.mobileView),
  };

  if (!nextState.gameStarted || !players.length) {
    return null;
  }

  return nextState;
}

function applyHydratedState(nextState) {
  state.gameStarted = nextState.gameStarted;
  state.busy = nextState.busy;
  state.players = nextState.players;
  state.roundNumber = nextState.roundNumber;
  state.currentPlayerIndex = nextState.currentPlayerIndex;
  state.roundStarterIndex = nextState.roundStarterIndex;
  state.turnStage = nextState.turnStage;
  state.deck = nextState.deck;
  state.discardPile = nextState.discardPile;
  state.selectedCardId = nextState.selectedCardId;
  state.lastDrawnCardId = nextState.lastDrawnCardId;
  state.selectedSkipTargetId = nextState.selectedSkipTargetId;
  state.pendingSkipPlayerIds = nextState.pendingSkipPlayerIds;
  state.logs = nextState.logs;
  state.roundHistory = nextState.roundHistory;
  state.pendingRoundSummary = nextState.pendingRoundSummary;
  state.winnerId = nextState.winnerId;
  state.handSortMode = nextState.handSortMode;
  state.roundHistorySortDir = nextState.roundHistorySortDir;
  state.humanExtraPlayUndoStack = nextState.humanExtraPlayUndoStack;
  state.humanPhasePreviewRequested = nextState.humanPhasePreviewRequested;
  state.friendlyShuffle = nextState.friendlyShuffle;
  state.currentSessionId = nextState.currentSessionId;
  state.mobileView = nextState.mobileView;
}

function hydrateStateFromPayload(payload, options = {}) {
  const { syncSetupControls = false } = options;
  const nextState = buildHydratedState(payload, options);
  if (!nextState) return false;

  applyHydratedState(nextState);

  if (syncSetupControls) {
    syncSetupControlsFromState();
  }

  return true;
}

function normalizePlayerRecord(player, index) {
  const isHuman = Boolean(player?.isHuman);
  return {
    id: String(player?.id ?? `restored-${index + 1}`),
    name: normalizeName(player?.name, index === 0 ? "Player 1" : `Player ${index + 1}`),
    isHuman,
    score: clampNumber(player?.score, 0, 999999, 0),
    phaseIndex: clampNumber(player?.phaseIndex, 0, PHASES.length, 0),
    hand: normalizeCardList(player?.hand),
    laidGroups: normalizeLaidGroups(player?.laidGroups),
    completedPhaseThisRound: Boolean(player?.completedPhaseThisRound),
    difficulty: isHuman ? null : normalizeBotDifficulty(player?.difficulty),
  };
}

function normalizeCardList(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .map(normalizeCard)
    .filter(Boolean);
}

function normalizeCard(card) {
  if (!card || typeof card !== "object" || typeof card.id !== "string") return null;
  if (card.type === "wild") {
    return { id: card.id, type: "wild", color: null, value: null };
  }
  if (card.type === "skip") {
    return { id: card.id, type: "skip", color: null, value: null };
  }
  const colorId = COLORS.some((entry) => entry.id === card.color) ? card.color : null;
  const value = clampNumber(card.value, 1, 12, 1);
  if (!colorId) return null;
  return { id: card.id, type: "number", color: colorId, value };
}

function normalizeLaidGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group, index) => normalizeLaidGroup(group, index))
    .filter(Boolean);
}

function normalizeRoundHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry, index) => normalizeRoundHistoryEntry(entry, index))
    .filter(Boolean);
}

function normalizeRoundHistoryEntry(entry, index) {
  if (!entry || typeof entry !== "object") return null;
  const normalizedResults = {};
  if (entry.playerResults && typeof entry.playerResults === "object") {
    Object.entries(entry.playerResults).forEach(([playerId, result]) => {
      if (!result || typeof result !== "object") return;
      normalizedResults[String(playerId)] = {
        points: clampNumber(result.points, 0, 999999, 0),
        completedPhaseNumber:
          result.completedPhaseNumber == null
            ? null
            : clampNumber(result.completedPhaseNumber, 1, PHASES.length, 1),
      };
    });
  }
  return {
    roundNumber: clampNumber(entry.roundNumber, 1, 999, index + 1),
    outPlayerId: normalizeSelectedCardId(entry.outPlayerId),
    playerResults: normalizedResults,
  };
}

function normalizeLaidGroup(group, index) {
  if (!group || typeof group !== "object") return null;
  const base = {
    id: String(group.id ?? `restored-group-${index + 1}`),
    ownerId: String(group.ownerId ?? "human"),
    kind: String(group.kind ?? "set"),
    label: normalizeName(group.label, "Laid group"),
    cards: normalizeCardList(group.cards),
  };
  if (base.kind === "set") {
    return { ...base, setValue: clampNumber(group.setValue, 1, 12, 1) };
  }
  if (base.kind === "color") {
    const colorId = COLORS.some((entry) => entry.id === group.color) ? group.color : "green";
    return { ...base, color: colorId };
  }
  const runGroup = {
    ...base,
    kind: "run",
    low: clampNumber(group.low, 1, 12, 1),
    high: clampNumber(group.high, 1, 24, clampNumber(group.low, 1, 12, 1)),
  };
  applyResolvedRunState(runGroup);
  return runGroup;
}

function normalizeTurnStage(value) {
  return ["setup", "draw", "main", "round-end", "game-over"].includes(value)
    ? value
    : "setup";
}

function normalizeRoundHistorySortDir(value) {
  return value === "desc" ? "desc" : "asc";
}

function normalizeSelectedCardId(value) {
  return typeof value === "string" ? value : null;
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => String(entry));
}

function normalizeHumanExtraPlayUndoStack(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const cardId = normalizeSelectedCardId(entry.cardId);
      const targetGroupId = normalizeSelectedCardId(entry.targetGroupId);
      if (!cardId || !targetGroupId) return null;
      return { cardId, targetGroupId };
    })
    .filter(Boolean);
}

function normalizeHandSortMode(value) {
  return value === "number" ? "number" : "color";
}

function normalizeMobileView(value) {
  return ["play", "table", "history"].includes(value) ? value : "play";
}

function normalizeBotDifficulty(value) {
  return BOT_DIFFICULTIES.includes(value) ? value : "medium";
}

function normalizeFriendlyShuffle(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function syncSetupControlsFromState() {
  const human = humanPlayer();
  if (human) {
    els.humanName.value = human.name;
  }
  const botPlayers = state.players.filter((player) => !player.isHuman);
  const botCount = botPlayers.length;
  if (botCount >= 1 && botCount <= 3) {
    els.botCount.value = String(botCount);
  }
  els.friendlyShuffleToggle.checked = state.friendlyShuffle;
  renderBotNameFields(
    botPlayers.map((player) => player.name),
    botPlayers.map((player) => player.difficulty),
  );
}

function difficultyLabel(value) {
  const normalized = normalizeBotDifficulty(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sessionOptionLabel(session) {
  const players = Array.isArray(session.payload?.players) ? session.payload.players.length : 0;
  const round = clampNumber(session.payload?.roundNumber, 1, 999, 1);
  return `${session.name} • ${players}P • Round ${round}`;
}

function defaultSessionName(payload = snapshotState()) {
  const names = Array.isArray(payload.players)
    ? payload.players.map((player) => normalizeName(player?.name, "")).filter(Boolean)
    : [];
  const lead = names.slice(0, 3).join(", ") || "Phase 10";
  const round = clampNumber(payload.roundNumber, 1, 999, 1);
  return `${lead} - Round ${round}`;
}

function sanitizeFileName(name) {
  const base = String(name || "phase10-session")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return base || "phase10-session";
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

function exportPlayerNameSegment(payload = snapshotState()) {
  const names = Array.isArray(payload.players)
    ? payload.players
        .map((player) => sanitizeFileName(normalizeName(player?.name, "")).slice(0, 8))
        .filter(Boolean)
    : [];
  return names.length ? names.join("_") : "session";
}

function exportFileNameForSession(exportable, when = new Date()) {
  const payload = exportable?.payload || snapshotState();
  const date = exportDateStamp(when);
  const game = "phase10";
  const players = exportPlayerNameSegment(payload);
  const time = exportTimeStamp(when);
  return `${date}_${game}_${players}_${time}.json`;
}

function setSessionStatusMessage(message) {
  state.sessionStatusMessage = String(message || "");
}

function showSessionMessage(message) {
  setSessionStatusMessage(message);
  render();
}

function startNewGame() {
  clearTransientNotice();
  setSessionStatusMessage("");
  const humanName = normalizeName(els.humanName.value, "Player 1");
  const botCount = clampNumber(Number(els.botCount.value), 1, 3, 2);
  state.friendlyShuffle = els.friendlyShuffleToggle.checked;
  const setupBotConfig = syncSetupBotConfigFromInputs();
  const customBotNames = setupBotConfig.names.slice(0, botCount);
  const customBotDifficulties = setupBotConfig.difficulties.slice(0, botCount);
  const usedNames = new Set([humanName.toLowerCase()]);

  state.players = [
    createPlayer("human", humanName, true),
    ...Array.from({ length: botCount }, (_, index) =>
      createPlayer(
        `bot-${index + 1}`,
        resolveBotName(customBotNames[index], usedNames, index),
        false,
        customBotDifficulties[index],
      ),
    ),
  ];
  state.gameStarted = true;
  state.busy = false;
  state.roundNumber = 1;
  state.roundStarterIndex = 0;
  state.currentPlayerIndex = 0;
  state.turnStage = "draw";
  state.selectedCardId = null;
  state.lastDrawnCardId = null;
  state.selectedSkipTargetId = null;
  state.pendingSkipPlayerIds = [];
  state.logs = [];
  state.roundHistory = [];
  state.pendingRoundSummary = null;
  state.winnerId = null;
  state.humanExtraPlayUndoStack = [];
  state.humanPhasePreviewRequested = false;
  state.currentSessionId = null;
  state.sessionToolsExpanded = false;
  state.mobileView = "play";
  appendLog(`New game started with ${humanName} and ${botCount} bot${botCount === 1 ? "" : "s"}.`);
  startRound();
}

function resetTable() {
  clearTransientNotice();
  setSessionStatusMessage("");
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.roundNumber = 1;
  state.roundStarterIndex = 0;
  state.currentPlayerIndex = 0;
  state.turnStage = "setup";
  state.deck = [];
  state.discardPile = [];
  state.selectedCardId = null;
  state.lastDrawnCardId = null;
  state.selectedSkipTargetId = null;
  state.pendingSkipPlayerIds = [];
  state.logs = [];
  state.roundHistory = [];
  state.pendingRoundSummary = null;
  state.winnerId = null;
  state.humanExtraPlayUndoStack = [];
  state.humanPhasePreviewRequested = false;
  state.currentSessionId = null;
  state.sessionToolsExpanded = true;
  state.mobileView = "play";
  els.friendlyShuffleToggle.checked = state.friendlyShuffle;
  clearSavedGame();
  render();
}

function saveNamedSession() {
  if (!state.gameStarted || !state.players.length) {
    showSessionMessage("Start or load a game before saving a session.");
    return;
  }

  const currentSession = state.currentSessionId ? getSessionById(state.currentSessionId) : null;
  const requestedName = window.prompt(
    currentSession ? "Update saved session name:" : "Save this session as:",
    currentSession?.name || defaultSessionName(),
  );
  if (requestedName == null) return;

  const name = normalizeName(requestedName, defaultSessionName());
  const id = currentSession?.id || uid();
  const now = Date.now();
  const nextRecord = {
    id,
    name,
    payload: cloneJson({ ...snapshotState(), currentSessionId: id }),
    createdAt: currentSession?.createdAt || now,
    updatedAt: now,
  };
  const nextSessions = [
    nextRecord,
    ...readStoredSessions().filter((session) => session.id !== id),
  ]
    .map(normalizeSessionRecord)
    .filter(Boolean)
    .sort((left, right) => right.updatedAt - left.updatedAt);

  if (!writeStoredSessions(nextSessions)) {
    showSessionMessage("Unable to save this session.");
    return;
  }

  state.currentSessionId = id;
  state.selectedSessionId = id;
  showSessionMessage(`Session saved: ${name}.`);
}

function loadSelectedSession() {
  const session = state.selectedSessionId ? getSessionById(state.selectedSessionId) : null;
  if (!session) {
    showSessionMessage("Select a saved session to load.");
    return;
  }

  clearTransientNotice();
  const ok = hydrateStateFromPayload(cloneJson(session.payload), {
    syncSetupControls: true,
    currentSessionId: session.id,
  });
  if (!ok) {
    showSessionMessage("That saved session could not be loaded.");
    return;
  }

  state.selectedSessionId = session.id;
  setSessionStatusMessage(`Session loaded: ${session.name}.`);
  render();
  resumeRestoredBotTurn();
}

function deleteSelectedSession() {
  const session = state.selectedSessionId ? getSessionById(state.selectedSessionId) : null;
  if (!session) {
    showSessionMessage("Select a saved session to delete.");
    return;
  }

  const proceed = window.confirm(`Delete saved session "${session.name}"?`);
  if (!proceed) return;

  const nextSessions = readStoredSessions().filter((entry) => entry.id !== session.id);
  if (!writeStoredSessions(nextSessions)) {
    showSessionMessage("Unable to delete that session.");
    return;
  }

  if (state.currentSessionId === session.id) {
    state.currentSessionId = null;
  }
  state.selectedSessionId = "";
  showSessionMessage(`Deleted session: ${session.name}.`);
}

function resolveExportSession() {
  if (state.gameStarted && state.players.length) {
    const current = state.currentSessionId ? getSessionById(state.currentSessionId) : null;
    return {
      name: current?.name || defaultSessionName(),
      id: current?.id || null,
      payload: cloneJson(snapshotState()),
    };
  }

  const selected = state.selectedSessionId ? getSessionById(state.selectedSessionId) : null;
  if (!selected) return null;
  return {
    name: selected.name,
    id: selected.id,
    payload: cloneJson(selected.payload),
  };
}

function exportSessionFile() {
  const exportable = resolveExportSession();
  if (!exportable) {
    showSessionMessage("Nothing to export yet.");
    return null;
  }

  const bundle = {
    app: "phase10-table",
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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showSessionMessage(`Downloaded session JSON: ${exportable.name}.`);
  return exportable;
}

function parseImportedSession(json, filename = "") {
  if (!json || typeof json !== "object") return null;

  const payload =
    json.app === "phase10-table" && json.payload && typeof json.payload === "object"
      ? json.payload
      : json.payload && typeof json.payload === "object"
        ? json.payload
        : json;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.players) ||
    !Array.isArray(payload.deck) ||
    !Array.isArray(payload.discardPile)
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
  const id = uid();
  const now = Date.now();
  const clonedPayload = cloneJson(payload);
  clonedPayload.currentSessionId = id;

  return normalizeSessionRecord({
    id,
    name: providedName,
    payload: clonedPayload,
    createdAt: now,
    updatedAt: now,
  });
}

async function importSessionFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parseImportedSession(parsed, file.name);
    if (!imported) {
      showSessionMessage("That file is not a valid Phase 10 session.");
      return;
    }

    const hydrated = buildHydratedState(cloneJson(imported.payload), {
      currentSessionId: imported.id,
    });
    if (!hydrated) {
      showSessionMessage("Imported file could not be loaded.");
      return;
    }

    const nextSessions = [imported, ...readStoredSessions().filter((session) => session.id !== imported.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt);
    if (!writeStoredSessions(nextSessions)) {
      showSessionMessage("Unable to import that session.");
      return;
    }

    clearTransientNotice();
    applyHydratedState(hydrated);
    syncSetupControlsFromState();
    state.selectedSessionId = imported.id;
    setSessionStatusMessage(`Session imported: ${imported.name}.`);
    render();
    resumeRestoredBotTurn();
  } catch {
    showSessionMessage("Import failed. Check that the file contains valid JSON.");
  } finally {
    els.importSessionFile.value = "";
  }
}

function createPlayer(id, name, isHuman, difficulty = "medium") {
  return {
    id,
    name,
    isHuman,
    difficulty: isHuman ? null : normalizeBotDifficulty(difficulty),
    score: 0,
    phaseIndex: 0,
    hand: [],
    laidGroups: [],
    completedPhaseThisRound: false,
  };
}

function nextBotName(usedNames, fallbackIndex) {
  for (const name of BOT_NAMES) {
    if (!usedNames.has(name.toLowerCase())) {
      usedNames.add(name.toLowerCase());
      return name;
    }
  }
  const generated = `Bot ${fallbackIndex + 1}`;
  usedNames.add(generated.toLowerCase());
  return generated;
}

function resolveBotName(rawName, usedNames, fallbackIndex) {
  const name = String(rawName ?? "").trim();
  if (name && !usedNames.has(name.toLowerCase())) {
    usedNames.add(name.toLowerCase());
    return name;
  }
  return nextBotName(usedNames, fallbackIndex);
}

function startRound() {
  const starter = state.players[state.roundStarterIndex];
  clearTransientNotice();
  state.busy = false;
  state.turnStage = "draw";
  state.selectedCardId = null;
  state.lastDrawnCardId = null;
  state.selectedSkipTargetId = null;
  state.pendingSkipPlayerIds = [];
  state.pendingRoundSummary = null;
  state.humanExtraPlayUndoStack = [];
  state.humanPhasePreviewRequested = false;
  state.deck = buildRoundDeck();
  state.discardPile = [];

  for (const player of state.players) {
    player.hand = [];
    player.laidGroups = [];
    player.completedPhaseThisRound = false;
  }

  for (let deal = 0; deal < 10; deal += 1) {
    for (const player of state.players) {
      player.hand.push(drawFromDeckInternal());
    }
  }

  state.discardPile.push(drawFromDeckInternal());
  sortHands();
  state.currentPlayerIndex = state.roundStarterIndex;
  triggerDealAnimation(humanPlayer()?.hand.map((card) => card.id) ?? []);
  appendLog(
    `Round ${state.roundNumber} begins. ${starter.name} draws first.`,
  );
  render();
  queueBotTurnIfNeeded();
}

function buildDeck() {
  const deck = [];
  let idCounter = 1;
  for (const color of COLORS) {
    for (let value = 1; value <= 12; value += 1) {
      for (let copy = 0; copy < 2; copy += 1) {
        idCounter += 1;
        deck.push({
          id: `c${idCounter}`,
          type: "number",
          color: color.id,
          value,
        });
      }
    }
  }
  for (let wild = 0; wild < 8; wild += 1) {
    deck.push({ id: `w${wild + 1}`, type: "wild", color: null, value: null });
  }
  for (let skip = 0; skip < 4; skip += 1) {
    deck.push({ id: `s${skip + 1}`, type: "skip", color: null, value: null });
  }
  return deck;
}

function buildRoundDeck() {
  const baseDeck = buildDeck();
  if (!state.friendlyShuffle) {
    return shuffle(baseDeck);
  }

  let bestDeck = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const candidate = shuffle(baseDeck);
    const penalty = friendlyShufflePenalty(candidate, state.players.length);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestDeck = candidate;
      if (penalty === 0) break;
    }
  }
  return bestDeck ?? shuffle(baseDeck);
}

function friendlyShufflePenalty(deck, playerCount) {
  if (!Array.isArray(deck) || !deck.length || !playerCount) return 0;
  const simulation = [...deck];
  const hands = Array.from({ length: playerCount }, () => []);

  for (let deal = 0; deal < 10; deal += 1) {
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      const card = simulation.pop();
      if (card) {
        hands[playerIndex].push(card);
      }
    }
  }

  const discard = simulation.pop() ?? null;
  let penalty = discard?.type === "skip" ? 18 : 0;

  hands.forEach((hand) => {
    let skipCount = 0;
    let actionCount = 0;
    const numberCounts = new Map();

    hand.forEach((card) => {
      if (card.type === "skip") skipCount += 1;
      if (card.type === "skip" || card.type === "wild") actionCount += 1;
      if (card.type === "number") {
        numberCounts.set(card.value, (numberCounts.get(card.value) ?? 0) + 1);
      }
    });

    if (skipCount > 1) penalty += (skipCount - 1) * 18;
    if (actionCount > 2) penalty += (actionCount - 2) * 7;

    numberCounts.forEach((count) => {
      if (count > 2) {
        penalty += (count - 2) * 8;
      }
    });
  });

  const previewWindow = simulation.slice(-18).reverse();
  let previousValue = null;
  let repeatRun = 1;
  previewWindow.forEach((card) => {
    if (card.type !== "number") {
      previousValue = null;
      repeatRun = 1;
      return;
    }
    if (card.value === previousValue) {
      repeatRun += 1;
      penalty += repeatRun >= 3 ? 6 : 2;
    } else {
      previousValue = card.value;
      repeatRun = 1;
    }
  });

  return penalty;
}

function shuffle(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    cryptoObject.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

function drawFromDeckInternal() {
  if (!state.deck.length) refillDeckFromDiscard();
  return state.deck.pop() ?? null;
}

function refillDeckFromDiscard() {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile.pop();
  state.deck = shuffle(state.discardPile);
  state.discardPile = top ? [top] : [];
  appendLog("The discard pile was reshuffled back into the deck.");
}

function humanDraw(source) {
  if (!isHumanTurn() || state.busy || state.turnStage !== "draw") return;
  const player = currentPlayer();
  if (source === "discard" && !canTakeTopDiscard()) return;
  const drawn = source === "discard" ? takeDiscardInternal(player) : takeDeckInternal(player);
  if (!drawn) return;
  state.turnStage = "main";
  state.humanPhasePreviewRequested = false;
  state.selectedCardId = drawn.id;
  state.lastDrawnCardId = drawn.id;
  syncSelectedSkipTarget();
  appendLog(`${player.name} drew ${cardLabel(drawn)} from the ${source === "discard" ? "discard pile" : "deck"}.`);
  render();
}

function takeDeckInternal(player) {
  const card = drawFromDeckInternal();
  if (!card) return null;
  player.hand.push(card);
  triggerPilePulse("deck");
  sortHands();
  return card;
}

function takeDiscardInternal(player) {
  const card = state.discardPile.pop();
  if (!card) return null;
  player.hand.push(card);
  triggerPilePulse("discard");
  sortHands();
  return card;
}

function humanLayPhase() {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  if (player.laidGroups.length) return;
  const previewMeld = humanPhasePreviewMeld();
  if (previewMeld) {
    state.humanPhasePreviewRequested = false;
    const didConfirmLay = layPhaseForPlayer(player, { presetMeld: previewMeld });
    if (!didConfirmLay) {
      appendLog(`${player.name} could not complete Phase ${player.phaseIndex + 1} yet.`);
    }
    render();
    return;
  }

  const phase = currentPhaseFor(player);
  const bestMeld = phase ? findBestPhaseMeld(player.hand, phase) : null;
  if (bestMeld) {
    state.humanPhasePreviewRequested = true;
    render();
    return;
  }

  const didLay = layPhaseForPlayer(player);
  if (!didLay) {
    appendLog(`${player.name} could not complete Phase ${player.phaseIndex + 1} yet.`);
  }
  render();
}

function humanDiscardSelected() {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  const cardId = state.selectedCardId;
  if (!cardId) return;
  const card = player.hand.find((entry) => entry.id === cardId);
  if (!card) {
    state.selectedCardId = null;
    state.selectedSkipTargetId = null;
    render();
    return;
  }
  if (card.type === "skip" && !resolveSkipTarget(player, state.selectedSkipTargetId)) {
    render();
    return;
  }
  discardCard(player, card, { skipTargetId: state.selectedSkipTargetId });
}

function humanPlaySelectedCardToGroup(groupId) {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  if (!player?.laidGroups.length) return;
  if (player.hand.length <= 1) {
    appendLog("Keep one card in hand so you can discard to end the turn.");
    render();
    return;
  }

  const card = player.hand.find((entry) => entry.id === state.selectedCardId);
  if (!card) return;

  const target = findGroupById(groupId);
  if (!target || !canCardHitGroup(card, target)) return;

  moveCardToGroup(player, card, target);
  state.humanExtraPlayUndoStack.push({
    cardId: card.id,
    targetGroupId: target.id,
  });
  sortHands();

  const owner = state.players.find((entry) => entry.id === target.ownerId);
  appendLog(`${player.name} played ${cardLabel(card)} onto ${owner?.name ?? "another player"}'s ${target.label}.`);
  render();
}

function undoHumanExtraPlay(cardId = null) {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  if (!player?.isHuman) return;

  while (state.humanExtraPlayUndoStack.length) {
    const stackIndex = cardId
      ? state.humanExtraPlayUndoStack.findLastIndex((entry) => entry.cardId === cardId)
      : state.humanExtraPlayUndoStack.length - 1;
    if (stackIndex === -1) break;

    const [undoEntry] = state.humanExtraPlayUndoStack.splice(stackIndex, 1);
    const target = findGroupById(undoEntry.targetGroupId);
    if (!target) {
      if (cardId) break;
      continue;
    }

    const cardIndex = target.cards.findIndex((entry) => entry.id === undoEntry.cardId);
    if (cardIndex === -1) {
      if (cardId) break;
      continue;
    }

    const [card] = target.cards.splice(cardIndex, 1);
    player.hand.push(card);
    if (target.kind === "run") {
      applyResolvedRunState(target);
    }
    sortHands();
    state.selectedCardId = card.id;
    syncSelectedSkipTarget();

    const owner = state.players.find((entry) => entry.id === target.ownerId);
    appendLog(`${player.name} took back ${cardLabel(card)} from ${owner?.name ?? "another player"}'s ${target.label}.`);
    render();
    return;
  }

  render();
}

function humanSelectSkipTarget(targetId) {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  const selectedCard = player?.hand.find((entry) => entry.id === state.selectedCardId) ?? null;
  if (selectedCard?.type !== "skip") return;
  const target = findSkipTarget(player, targetId);
  if (!target) return;
  state.selectedSkipTargetId = target.id;
  render();
}

function discardCard(player, card, options = {}) {
  const skipTarget =
    card.type === "skip" ? resolveSkipTarget(player, options.skipTargetId) : null;
  removeCardsFromHand(player, [card.id]);
  state.discardPile.push(card);
  state.selectedCardId = null;
  state.lastDrawnCardId = null;
  state.selectedSkipTargetId = null;
  state.humanExtraPlayUndoStack = [];
  state.humanPhasePreviewRequested = false;
  triggerPilePulse("discard");
  appendLog(`${player.name} discarded ${cardLabel(card)}.`);

  if (!player.hand.length) {
    finishRound(player, card.type === "skip");
    return;
  }

  if (skipTarget) {
    state.pendingSkipPlayerIds.push(skipTarget.id);
    appendLog(`${player.name} chose to skip ${skipTarget.name}.`);
  }

  const skippedPlayers = advanceToNextActivePlayer();
  state.turnStage = "draw";
  if (skippedPlayers.length) {
    skippedPlayers.forEach((skipped) => {
      appendLog(`${skipped.name} was skipped.`);
    });
    const skippedLabel = skippedPlayers.length === 1
      ? `<strong>${escapeHtml(skippedPlayers[0].name)}</strong> was skipped.`
      : `${escapeHtml(skippedPlayers.map((entry) => entry.name).join(", "))} were skipped.`;
    setTransientNotice(`${skippedLabel} ${escapeHtml(currentPlayer()?.name ?? "Next player")} is up.`);
  } else if (skipTarget) {
    setTransientNotice(`<strong>${escapeHtml(skipTarget.name)}</strong> will be skipped. ${escapeHtml(currentPlayer()?.name ?? "Next player")} is up.`);
  }
  sortHands();
  render();
  queueBotTurnIfNeeded();
}

function clearTransientNotice() {
  if (transientNoticeTimer) {
    window.clearTimeout(transientNoticeTimer);
    transientNoticeTimer = null;
  }
  state.transientNotice = null;
}

function setTransientNotice(message) {
  if (transientNoticeTimer) {
    window.clearTimeout(transientNoticeTimer);
  }
  state.transientNotice = { message: String(message) };
  transientNoticeTimer = window.setTimeout(() => {
    transientNoticeTimer = null;
    state.transientNotice = null;
    render();
  }, 3200);
}

function advanceToNextActivePlayer() {
  if (!state.players.length) return [];
  const skippedPlayers = [];
  const maxSteps = state.players.length + state.pendingSkipPlayerIds.length + 1;
  let nextIndex = state.currentPlayerIndex;

  for (let step = 0; step < maxSteps; step += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const nextPlayer = state.players[nextIndex];
    const pendingIndex = state.pendingSkipPlayerIds.indexOf(nextPlayer.id);
    if (pendingIndex !== -1) {
      state.pendingSkipPlayerIds.splice(pendingIndex, 1);
      skippedPlayers.push(nextPlayer);
      continue;
    }
    state.currentPlayerIndex = nextIndex;
    return skippedPlayers;
  }

  state.currentPlayerIndex = nextIndex;
  return skippedPlayers;
}

function finishRound(outPlayer, finalDiscardWasSkip) {
  const leftoverScores = {};
  const roundHistoryEntry = {
    roundNumber: state.roundNumber,
    outPlayerId: outPlayer.id,
    playerResults: {},
  };
  for (const player of state.players) {
    leftoverScores[player.id] = player.hand.reduce(
      (sum, card) => sum + cardPoints(card),
      0,
    );
    roundHistoryEntry.playerResults[player.id] = {
      points: leftoverScores[player.id],
      completedPhaseNumber: player.completedPhaseThisRound ? player.phaseIndex + 1 : null,
    };
    player.score += leftoverScores[player.id];
    if (player.completedPhaseThisRound && player.phaseIndex < PHASES.length) {
      player.phaseIndex += 1;
    }
  }

  const finalists = state.players.filter(
    (player) => player.completedPhaseThisRound && player.phaseIndex >= PHASES.length,
  );
  const winner = finalists.length
    ? [...finalists].sort((left, right) => left.score - right.score)[0]
    : null;

  state.pendingRoundSummary = {
    outPlayerId: outPlayer.id,
    leftoverScores,
    finalDiscardWasSkip,
  };
  state.roundHistory = [...state.roundHistory, roundHistoryEntry];
  state.winnerId = winner?.id ?? null;
  state.roundStarterIndex = state.players.findIndex((player) => player.id === outPlayer.id);
  state.turnStage = winner ? "game-over" : "round-end";

  appendLog(`${outPlayer.name} went out and ended the round.`);
  for (const player of state.players) {
    appendLog(`${player.name} took ${leftoverScores[player.id]} points in leftovers.`);
  }
  if (winner) {
    appendLog(`${winner.name} wins the game after completing Phase 10.`);
  } else {
    appendLog(`Round ${state.roundNumber} is complete. Deal the next round when ready.`);
  }
  render();
}

function beginNextRound() {
  if (state.turnStage !== "round-end" || !state.gameStarted) return;
  state.roundNumber += 1;
  startRound();
}

async function queueBotTurnIfNeeded() {
  if (!state.gameStarted || state.busy) return;
  const player = currentPlayer();
  if (!player || player.isHuman) return;
  if (!["draw", "main"].includes(state.turnStage)) return;

  state.busy = true;
  render();

  await pause(650);
  if (state.turnStage === "draw") {
    const drawSource = chooseBotDrawSource(player);
    const drawn = drawSource === "discard" ? takeDiscardInternal(player) : takeDeckInternal(player);
    if (drawn) {
      appendLog(`${player.name} drew ${drawSource === "discard" ? "the discard" : "from the deck"} (${cardLabel(drawn)}).`);
      state.turnStage = "main";
      sortHands();
      render();
      await pause(550);
    }
  }

  if (state.turnStage === "main") {
    if (!player.laidGroups.length) {
      layPhaseForPlayer(player);
      render();
      await pause(450);
    } else {
      const extrasPlayed = autoPlayExtras(player);
      if (extrasPlayed) {
        render();
        await pause(350);
      }
    }

    const discardCardChoice = chooseBotDiscard(player);
    if (discardCardChoice) {
      const skipTarget = discardCardChoice.type === "skip" ? chooseBotSkipTarget(player) : null;
      discardCard(player, discardCardChoice, { skipTargetId: skipTarget?.id ?? null });
    }
  }

  state.busy = false;
  render();
  if (!state.gameStarted || state.turnStage === "round-end" || state.turnStage === "game-over") {
    return;
  }
  if (!currentPlayer()?.isHuman) {
    window.setTimeout(() => {
      queueBotTurnIfNeeded();
    }, 120);
  }
}

function botDifficulty(player) {
  return normalizeBotDifficulty(player?.difficulty);
}

function chooseBotDrawSource(player) {
  const discard = topDiscard();
  if (!discard) return "deck";
  if (!canTakeTopDiscard()) return "deck";
  if (discard.type === "wild") return "discard";

  const phase = currentPhaseFor(player);
  if (!phase) return "deck";

  if (player.laidGroups.length && canCardBeHitAnywhere(discard, player.id)) {
    return "discard";
  }

  const withoutDiscard = Boolean(findBestPhaseMeld(player.hand, phase));
  const withDiscard = Boolean(findBestPhaseMeld([...player.hand, discard], phase));
  if (!withoutDiscard && withDiscard) return "discard";

  const difficulty = botDifficulty(player);
  if (difficulty === "hard") {
    const bestWithout = findBestPhaseMeld(player.hand, phase);
    const bestWith = findBestPhaseMeld([...player.hand, discard], phase);
    if (bestWith && bestWithout && bestWith.points > bestWithout.points + 8) {
      return "discard";
    }
  }

  const keepScore = scoreCardKeepValue(discard, player, [...player.hand, discard]);
  if (difficulty === "easy") return keepScore >= 68 ? "discard" : "deck";
  if (difficulty === "hard") return keepScore >= 42 ? "discard" : "deck";
  return keepScore >= 52 ? "discard" : "deck";
}

function chooseBotDiscard(player) {
  const ordered = [...player.hand].sort((left, right) => {
    const leftRank = discardRankForBot(left, player, player.hand);
    const rightRank = discardRankForBot(right, player, player.hand);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return cardPoints(right) - cardPoints(left);
  });
  const topChoice = ordered[0] ?? null;
  if (topChoice?.type === "skip" && !shouldBotUseSkipNow(player)) {
    return ordered.find((card) => card.type !== "skip") ?? topChoice;
  }
  return topChoice;
}

function chooseBotSkipTarget(player) {
  const targets = skipTargetsFor(player);
  if (!targets.length) return null;
  if (botDifficulty(player) === "easy") {
    return defaultSkipTargetFor(player);
  }

  const scoredTargets = targets.map((target) => ({
    target,
    score: scoreSkipTarget(player, target),
  }));

  scoredTargets.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return left.target.name.localeCompare(right.target.name);
  });

  return scoredTargets[0]?.target ?? null;
}

function shouldBotUseSkipNow(player) {
  if (!player) return false;
  const target = chooseBotSkipTarget(player);
  if (!target) return false;

  const leader = [...skipTargetsFor(player)].sort((left, right) => {
    const rightCompleted = completedPhaseNumberFor(right);
    const leftCompleted = completedPhaseNumberFor(left);
    if (rightCompleted !== leftCompleted) return rightCompleted - leftCompleted;
    if (left.score !== right.score) return left.score - right.score;
    return left.hand.length - right.hand.length;
  })[0];

  const urgent =
    target.hand.length <= 3 ||
    target.completedPhaseThisRound ||
    leader?.id === target.id;
  const difficulty = botDifficulty(player);

  if (difficulty === "easy") {
    return Boolean(player.laidGroups.length && target.hand.length <= 2);
  }
  if (difficulty === "hard") {
    return Boolean(
      urgent ||
      (player.laidGroups.length && (target.hand.length <= 5 || target.isHuman)),
    );
  }
  return Boolean(urgent || (player.laidGroups.length && target.hand.length <= 4));
}

function layPhaseForPlayer(player, options = {}) {
  const {
    autoPlayAfterLay = !player.isHuman && botDifficulty(player) !== "easy",
    presetMeld = null,
  } = options;
  const phase = currentPhaseFor(player);
  if (!phase || player.laidGroups.length) return false;
  const bestMeld = presetMeld ?? findBestPhaseMeld(player.hand, phase);
  if (!bestMeld) return false;

  removeCardsFromHand(player, bestMeld.usedCardIds);
  player.laidGroups = bestMeld.groups.map((group, index) =>
    createLaidGroup(player.id, phase.number, index, group),
  );
  player.completedPhaseThisRound = true;
  state.humanPhasePreviewRequested = false;
  triggerGroupSettle(player.laidGroups.map((group) => group.id));
  appendLog(`${player.name} laid Phase ${phase.number}: ${phase.title}.`);
  if (autoPlayAfterLay) {
    autoPlayExtras(player);
  }
  sortHands();
  return true;
}

function createLaidGroup(ownerId, phaseNumber, index, group) {
  const groupId = `${ownerId}-p${phaseNumber}-g${index + 1}`;
  if (group.meta.kind === "set") {
    return {
      id: groupId,
      ownerId,
      kind: "set",
      label: `Set of ${group.meta.size}`,
      cards: [...group.cards],
      setValue: group.meta.value,
    };
  }
  if (group.meta.kind === "color") {
    return {
      id: groupId,
      ownerId,
      kind: "color",
      label: `${group.meta.size} ${group.meta.colorLabel}`,
      cards: [...group.cards],
      color: group.meta.color,
    };
  }
  const runGroup = {
    id: groupId,
    ownerId,
    kind: "run",
    label: `Run ${group.meta.start}-${group.meta.end}`,
    cards: [...group.cards],
    low: group.meta.start,
    high: group.meta.end,
  };
  applyResolvedRunState(runGroup);
  return runGroup;
}

function autoPlayExtras(player) {
  if (!player.laidGroups.length) return 0;
  let moved = 0;
  let foundMove = true;
  const maxMoves = botDifficulty(player) === "easy" ? 1 : Infinity;

  while (foundMove && player.hand.length > 1 && moved < maxMoves) {
    foundMove = false;
    const candidates = [...player.hand].sort(
      (left, right) => cardPoints(right) - cardPoints(left),
    );
    for (const card of candidates) {
      const target = findHitTarget(card, player.id);
      if (!target) continue;
      moveCardToGroup(player, card, target);
      moved += 1;
      foundMove = true;
      break;
    }
  }

  if (moved) {
    appendLog(`${player.name} played ${moved} extra card${moved === 1 ? "" : "s"} onto laid phases.`);
  }
  return moved;
}

function moveCardToGroup(player, card, target) {
  removeCardsFromHand(player, [card.id]);
  if (target.kind === "run") {
    target.cards.push(card);
    applyResolvedRunState(target);
    triggerPlayedCardFlash(card.id);
    return;
  }

  target.cards.push(card);
  triggerPlayedCardFlash(card.id);
}

function clearPilePulse() {
  if (pilePulseTimer) {
    window.clearTimeout(pilePulseTimer);
    pilePulseTimer = null;
  }
  state.pilePulse = null;
}

function triggerPilePulse(pile) {
  clearPilePulse();
  state.pilePulse = pile;
  pilePulseTimer = window.setTimeout(() => {
    pilePulseTimer = null;
    state.pilePulse = null;
    render();
  }, 520);
}

function clearPlayedCardFlash() {
  if (flashedCardTimer) {
    window.clearTimeout(flashedCardTimer);
    flashedCardTimer = null;
  }
  state.flashedCardId = null;
}

function triggerPlayedCardFlash(cardId) {
  clearPlayedCardFlash();
  state.flashedCardId = cardId;
  flashedCardTimer = window.setTimeout(() => {
    flashedCardTimer = null;
    state.flashedCardId = null;
    render();
  }, 900);
}

function clearGroupSettle() {
  if (flashedGroupsTimer) {
    window.clearTimeout(flashedGroupsTimer);
    flashedGroupsTimer = null;
  }
  state.flashedGroupIds = [];
}

function triggerGroupSettle(groupIds) {
  clearGroupSettle();
  state.flashedGroupIds = Array.isArray(groupIds) ? groupIds.filter(Boolean) : [];
  if (!state.flashedGroupIds.length) return;
  flashedGroupsTimer = window.setTimeout(() => {
    flashedGroupsTimer = null;
    state.flashedGroupIds = [];
    render();
  }, 800);
}

function clearDealAnimation() {
  if (dealAnimationTimer) {
    window.clearTimeout(dealAnimationTimer);
    dealAnimationTimer = null;
  }
  state.dealAnimationCardIds = [];
}

function triggerDealAnimation(cardIds) {
  clearDealAnimation();
  state.dealAnimationCardIds = Array.isArray(cardIds) ? cardIds.filter(Boolean) : [];
  if (!state.dealAnimationCardIds.length) return;
  const duration = 260 + state.dealAnimationCardIds.length * 55;
  dealAnimationTimer = window.setTimeout(() => {
    dealAnimationTimer = null;
    state.dealAnimationCardIds = [];
    render();
  }, duration);
}

function canCardBeHitAnywhere(card, playerId) {
  return findHitTargets(card, playerId).length > 0;
}

function findHitTarget(card, playerId) {
  return findHitTargets(card, playerId)[0] ?? null;
}

function findHitTargets(card, playerId) {
  if (!card || card.type === "skip") return [];
  const orderedPlayers = [
    ...state.players.filter((player) => player.id === playerId),
    ...state.players.filter((player) => player.id !== playerId),
  ];
  const hits = [];
  for (const player of orderedPlayers) {
    for (const group of player.laidGroups) {
      if (canCardHitGroup(card, group)) {
        hits.push(group);
      }
    }
  }
  return hits;
}

function findGroupById(groupId) {
  for (const player of state.players) {
    for (const group of player.laidGroups) {
      if (group.id === groupId) return group;
    }
  }
  return null;
}

function canCardHitGroup(card, group) {
  if (!card || !group || card.type === "skip") return false;
  if (group.kind === "set") {
    return card.type === "wild" || card.value === group.setValue;
  }
  if (group.kind === "color") {
    return card.type === "wild" || card.color === group.color;
  }
  const extensionValues = getRunExtensionValues(group.cards);
  if (card.type === "wild") return extensionValues.size > 0;
  return extensionValues.has(card.value);
}

function getValidRunStarts(cards) {
  const naturals = cards.filter((card) => card?.type === "number");
  const totalCards = cards.filter((card) => card?.type === "number" || card?.type === "wild").length;
  if (!totalCards) return [];

  const naturalValues = naturals.map((card) => Number(card.value));
  if (new Set(naturalValues).size !== naturalValues.length) return [];

  const starts = [];
  for (let start = 1; start <= 13 - totalCards; start += 1) {
    const high = start + totalCards - 1;
    const fits = naturalValues.every((value) => value >= start && value <= high);
    if (fits) {
      starts.push(start);
    }
  }
  return starts;
}

function resolvePreferredRunStart(cards) {
  const starts = getValidRunStarts(cards);
  return starts.length ? starts[starts.length - 1] : null;
}

function getRunExtensionValues(cards) {
  const starts = getValidRunStarts(cards);
  const length = cards.filter((card) => card?.type === "number" || card?.type === "wild").length;
  const values = new Set();

  for (const start of starts) {
    const left = start - 1;
    const right = start + length;
    if (left >= 1) values.add(left);
    if (right <= 12) values.add(right);
  }

  return values;
}

function orderRunCardsForDisplay(cards, low, high) {
  const naturalsByValue = new Map();
  const wilds = [];

  for (const card of cards) {
    if (card.type === "number") {
      naturalsByValue.set(card.value, card);
    } else if (card.type === "wild") {
      wilds.push(card);
    }
  }

  const ordered = [];
  for (let value = low; value <= high; value += 1) {
    const natural = naturalsByValue.get(value);
    if (natural) {
      ordered.push(natural);
      continue;
    }
    const wild = wilds.shift();
    if (wild) {
      ordered.push(wild);
    }
  }

  return ordered.length === cards.length ? ordered : [...cards];
}

function applyResolvedRunState(group) {
  if (!group || group.kind !== "run") return group;
  const start = resolvePreferredRunStart(group.cards);
  if (start == null) return group;
  const length = group.cards.filter((card) => card?.type === "number" || card?.type === "wild").length;
  group.low = start;
  group.high = start + length - 1;
  group.label = `Run ${group.low}-${group.high}`;
  group.cards = orderRunCardsForDisplay(group.cards, group.low, group.high);
  return group;
}

function findBestPhaseMeld(hand, phase) {
  if (!phase) return null;
  const usableCards = hand.filter((card) => card.type !== "skip");
  const availableIds = new Set(usableCards.map((card) => card.id));
  let best = null;

  searchGroups(0, availableIds, []);
  return best;

  function searchGroups(groupIndex, remainingIds, builtGroups) {
    if (groupIndex >= phase.groups.length) {
      const usedCards = builtGroups.flatMap((group) => group.cards);
      const points = usedCards.reduce((sum, card) => sum + cardPoints(card), 0);
      const candidate = {
        groups: builtGroups,
        usedCardIds: usedCards.map((card) => card.id),
        points,
      };
      if (!best || candidate.points > best.points) {
        best = candidate;
      }
      return;
    }

    const availableCards = usableCards.filter((card) => remainingIds.has(card.id));
    const candidates = generateGroupCandidates(availableCards, phase.groups[groupIndex]).sort(
      (left, right) => right.points - left.points,
    );
    for (const candidate of candidates) {
      const nextRemaining = new Set(remainingIds);
      let blocked = false;
      for (const card of candidate.cards) {
        if (!nextRemaining.delete(card.id)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      searchGroups(groupIndex + 1, nextRemaining, [...builtGroups, candidate]);
    }
  }
}

function generateGroupCandidates(cards, descriptor) {
  if (descriptor.kind === "set") {
    return generateSetCandidates(cards, descriptor.size);
  }
  if (descriptor.kind === "run") {
    return generateRunCandidates(cards, descriptor.size);
  }
  return generateColorCandidates(cards, descriptor.size);
}

function generateSetCandidates(cards, size) {
  const wilds = cards.filter((card) => card.type === "wild");
  const candidates = [];
  const seen = new Set();

  for (let value = 1; value <= 12; value += 1) {
    const naturals = cards.filter(
      (card) => card.type === "number" && card.value === value,
    );
    const minNaturals = Math.max(1, size - wilds.length);
    const maxNaturals = Math.min(size, naturals.length);
    for (let naturalCount = minNaturals; naturalCount <= maxNaturals; naturalCount += 1) {
      for (const combo of combinations(naturals, naturalCount)) {
        const selectedWilds = wilds.slice(0, size - naturalCount);
        if (combo.length + selectedWilds.length !== size) continue;
        const groupCards = [...combo, ...selectedWilds];
        const signature = cardSignature(groupCards);
        if (seen.has(signature)) continue;
        seen.add(signature);
        candidates.push({
          cards: groupCards,
          meta: { kind: "set", size, value },
          points: groupCards.reduce((sum, card) => sum + cardPoints(card), 0),
        });
      }
    }
  }
  return candidates;
}

function generateColorCandidates(cards, size) {
  const wilds = cards.filter((card) => card.type === "wild");
  const candidates = [];
  const seen = new Set();

  for (const color of COLORS) {
    const naturals = cards.filter(
      (card) => card.type === "number" && card.color === color.id,
    );
    const minNaturals = Math.max(1, size - wilds.length);
    const maxNaturals = Math.min(size, naturals.length);
    for (let naturalCount = minNaturals; naturalCount <= maxNaturals; naturalCount += 1) {
      for (const combo of combinations(naturals, naturalCount)) {
        const selectedWilds = wilds.slice(0, size - naturalCount);
        if (combo.length + selectedWilds.length !== size) continue;
        const groupCards = [...combo, ...selectedWilds];
        const signature = cardSignature(groupCards);
        if (seen.has(signature)) continue;
        seen.add(signature);
        candidates.push({
          cards: groupCards,
          meta: {
            kind: "color",
            size,
            color: color.id,
            colorLabel: color.label,
          },
          points: groupCards.reduce((sum, card) => sum + cardPoints(card), 0),
        });
      }
    }
  }
  return candidates;
}

function generateRunCandidates(cards, size) {
  const wilds = cards.filter((card) => card.type === "wild");
  const candidates = [];
  const seen = new Set();

  for (let start = 1; start <= 13 - size; start += 1) {
    const sequenceValues = Array.from({ length: size }, (_, offset) => start + offset);
    const optionsByValue = sequenceValues.map((value) => ({
      value,
      options: cards.filter((card) => card.type === "number" && card.value === value),
    }));
    const availableValues = optionsByValue.filter((entry) => entry.options.length > 0);
    const minNaturals = Math.max(1, size - wilds.length);
    const maxNaturals = Math.min(size, availableValues.length);

    for (let naturalCount = minNaturals; naturalCount <= maxNaturals; naturalCount += 1) {
      for (const valueCombo of combinations(availableValues, naturalCount)) {
        const selectedWilds = wilds.slice(0, size - naturalCount);
        if (valueCombo.length + selectedWilds.length !== size) continue;
        const chosenNaturals = valueCombo.map((entry) => entry.options[0]);
        const groupCards = [...chosenNaturals, ...selectedWilds];
        const signature = `${start}:${cardSignature(groupCards)}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        candidates.push({
          cards: groupCards,
          meta: {
            kind: "run",
            size,
            start,
            end: start + size - 1,
          },
          points: groupCards.reduce((sum, card) => sum + cardPoints(card), 0),
        });
      }
    }
  }

  return candidates;
}

function combinations(items, choose) {
  if (choose === 0) return [[]];
  if (choose > items.length) return [];
  if (choose === items.length) return [[...items]];

  const results = [];
  const stack = [];

  function search(index) {
    if (stack.length === choose) {
      results.push([...stack]);
      return;
    }
    for (let cursor = index; cursor <= items.length - (choose - stack.length); cursor += 1) {
      stack.push(items[cursor]);
      search(cursor + 1);
      stack.pop();
    }
  }

  search(0);
  return results;
}

function cardSignature(cards) {
  return cards
    .map((card) => card.id)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function currentPlayer() {
  return state.players[state.currentPlayerIndex] ?? null;
}

function humanPlayer() {
  return state.players.find((player) => player.isHuman) ?? null;
}

function skipTargetsFor(player) {
  if (!player) return [];
  return state.players.filter((entry) => entry.id !== player.id);
}

function defaultSkipTargetFor(player) {
  if (!player) return null;
  const playerIndex = state.players.findIndex((entry) => entry.id === player.id);
  if (playerIndex === -1) return skipTargetsFor(player)[0] ?? null;
  for (let offset = 1; offset < state.players.length; offset += 1) {
    const candidate = state.players[(playerIndex + offset) % state.players.length];
    if (candidate && candidate.id !== player.id) {
      return candidate;
    }
  }
  return null;
}

function resolveSkipTarget(player, targetId) {
  return findSkipTarget(player, targetId) ?? (player?.isHuman ? null : defaultSkipTargetFor(player));
}

function findSkipTarget(player, targetId) {
  const targets = skipTargetsFor(player);
  if (!targets.length) return null;
  const normalizedTargetId = typeof targetId === "string" ? targetId : null;
  return targets.find((target) => target.id === normalizedTargetId) ?? null;
}

function syncSelectedSkipTarget() {
  const player = currentPlayer();
  const card = player?.hand.find((entry) => entry.id === state.selectedCardId) ?? null;
  if (!card || card.type !== "skip") {
    state.selectedSkipTargetId = null;
    return;
  }
  state.selectedSkipTargetId = findSkipTarget(player, state.selectedSkipTargetId)?.id ?? null;
}

function currentPhaseFor(player) {
  return PHASES[player.phaseIndex] ?? null;
}

function phaseProgressIsPostRoundState() {
  return state.turnStage === "round-end" || state.turnStage === "game-over";
}

function completedPhaseNumberFor(player) {
  if (!player) return 0;
  const completed = player.completedPhaseThisRound
    ? phaseProgressIsPostRoundState()
      ? player.phaseIndex
      : player.phaseIndex + 1
    : player.phaseIndex;
  return clampNumber(completed, 0, PHASES.length, 0);
}

function nextWorkingPhaseFor(player) {
  if (!player) return null;
  if (player.completedPhaseThisRound) {
    return phaseProgressIsPostRoundState()
      ? currentPhaseFor(player)
      : PHASES[player.phaseIndex + 1] ?? null;
  }
  return currentPhaseFor(player);
}

function playerPhaseProgressCopy(player) {
  const completedPhaseNumber = completedPhaseNumberFor(player);
  const workingPhase = nextWorkingPhaseFor(player);
  const completedLabel = completedPhaseNumber
    ? `Completed: Phase ${completedPhaseNumber}`
    : "Completed: None yet";
  const workingLabel = workingPhase
    ? `Working on: Phase ${workingPhase.number} - ${workingPhase.title}${player.completedPhaseThisRound ? " next round" : ""}`
    : "Working on: All phases complete";
  return { completedLabel, workingLabel, completedPhaseNumber };
}

function humanPhasePreviewMeld() {
  const human = humanPlayer();
  if (
    !human ||
    !state.humanPhasePreviewRequested ||
    !isHumanTurn() ||
    state.turnStage !== "main" ||
    human.laidGroups.length
  ) {
    return null;
  }
  const phase = currentPhaseFor(human);
  return phase ? findBestPhaseMeld(human.hand, phase) : null;
}

function topDiscard() {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

function canTakeTopDiscard() {
  const discard = topDiscard();
  return Boolean(discard && discard.type !== "skip");
}

function isHumanTurn() {
  return Boolean(currentPlayer()?.isHuman);
}

function selectedHumanCard() {
  const human = humanPlayer();
  return human?.hand.find((card) => card.id === state.selectedCardId) ?? null;
}

function canHumanHitCards() {
  const human = humanPlayer();
  return Boolean(
    isHumanTurn() &&
      state.turnStage === "main" &&
      human?.laidGroups.length &&
      human.hand.length > 1,
  );
}

function removeCardsFromHand(player, cardIds) {
  const removal = new Set(cardIds);
  if (state.selectedCardId && removal.has(state.selectedCardId)) {
    state.selectedCardId = null;
    state.selectedSkipTargetId = null;
  }
  if (state.lastDrawnCardId && removal.has(state.lastDrawnCardId)) {
    state.lastDrawnCardId = null;
  }
  player.hand = player.hand.filter((card) => !removal.has(card.id));
}

function sortHands() {
  for (const player of state.players) {
    player.hand.sort(compareCards);
  }
}

function compareCards(left, right) {
  const order = { wild: 0, number: 1, skip: 2 };
  if (order[left.type] !== order[right.type]) {
    return order[left.type] - order[right.type];
  }
  if (left.type === "wild" || left.type === "skip") {
    return left.id.localeCompare(right.id);
  }
  const colorOrder = COLORS.map((color) => color.id);
  if (state.handSortMode === "number") {
    if (left.value !== right.value) {
      return left.value - right.value;
    }
    return colorOrder.indexOf(left.color) - colorOrder.indexOf(right.color);
  }
  const leftColorIndex = colorOrder.indexOf(left.color);
  const rightColorIndex = colorOrder.indexOf(right.color);
  if (leftColorIndex !== rightColorIndex) {
    return leftColorIndex - rightColorIndex;
  }
  return left.value - right.value;
}

function toggleHandSortMode() {
  state.handSortMode = state.handSortMode === "color" ? "number" : "color";
  sortHands();
  render();
}

function discardRankForBot(card, player, hand) {
  const keepScore = scoreCardKeepValue(card, player, hand);
  const difficulty = botDifficulty(player);

  if (difficulty === "easy") {
    if (card.type === "wild") return keepScore - 34;
    if (card.type === "skip") return keepScore - 12;
    return keepScore - cardPoints(card) * 0.55;
  }

  if (difficulty === "hard") {
    let rank = keepScore - cardPoints(card) * 0.9;
    if (player.laidGroups.length && canCardBeHitAnywhere(card, player.id)) rank += 24;
    if (card.type === "wild" && !player.laidGroups.length) rank += 18;
    if (card.type === "skip") {
      const target = chooseBotSkipTarget(player);
      if ((target?.hand.length ?? 99) <= 3) rank += 12;
    }
    return rank;
  }

  return keepScore - cardPoints(card) * 1.15;
}

function scoreCardKeepValue(card, player, hand) {
  if (card.type === "wild") {
    return player.laidGroups.length ? 58 : 96;
  }
  if (card.type === "skip") {
    const target = chooseBotSkipTarget(player);
    let score = target?.isHuman ? 8 : 5;
    if (target?.completedPhaseThisRound) score += 8;
    if ((target?.hand.length ?? 99) <= 3) score += 12;
    if ((target?.hand.length ?? 99) <= 5) score += 4;
    if (player.laidGroups.length) score += 6;
    if (!player.laidGroups.length && hand.length >= 7) score -= 10;
    if (hand.length <= 4) score += 4;
    return score;
  }

  let score = 0;
  const numbers = hand.filter((entry) => entry.type === "number");
  const sameValueCount = numbers.filter((entry) => entry.value === card.value).length;
  const sameColorCount = numbers.filter((entry) => entry.color === card.color).length;
  const uniqueValues = new Set(numbers.map((entry) => entry.value));

  const phase = currentPhaseFor(player);
  if (phase) {
    for (const group of phase.groups) {
      if (group.kind === "set") {
        score += sameValueCount * 14;
      }
      if (group.kind === "color") {
        score += sameColorCount * 10;
      }
      if (group.kind === "run") {
        if (uniqueValues.has(card.value - 1)) score += 10;
        if (uniqueValues.has(card.value + 1)) score += 10;
        score += 4;
      }
    }
  }

  if (player.laidGroups.length && canCardBeHitAnywhere(card, player.id)) {
    score += 70;
  }

  return score;
}

function cardPoints(card) {
  if (!card) return 0;
  if (card.type === "wild") return 25;
  if (card.type === "skip") return 15;
  return card.value >= 10 ? 10 : 5;
}

function cardLabel(card) {
  if (!card) return "no card";
  if (card.type === "wild") return "Wild";
  if (card.type === "skip") return "Skip";
  const color = COLORS.find((entry) => entry.id === card.color)?.label ?? "Color";
  return `${color} ${card.value}`;
}

function miniCardMarkup(card, options = {}) {
  if (!card) return "";
  const baseClass = card.type === "number" ? card.color : card.type;
  const undoableCardIds = options.undoableCardIds ?? new Set();
  const isUndoable = undoableCardIds.has(card.id);
  const flashedClass = state.flashedCardId === card.id ? "flashed" : "";
  if (card.type === "number") {
    const short = String(card.value);
    return `
      <span
        class="mini-card ${baseClass} mini-card-number ${isUndoable ? "undoable" : ""} ${flashedClass}"
        ${isUndoable ? `data-undo-card-id="${escapeHtml(card.id)}"` : ""}
        ${isUndoable ? `title="Return ${escapeHtml(cardLabel(card))} to your hand"` : ""}
      >
        <span class="mini-card-band mini-card-band-top">
          <span>${escapeHtml(short)}</span>
          <span>${escapeHtml(short)}</span>
        </span>
        <span class="mini-card-value">${escapeHtml(short)}</span>
        <span class="mini-card-band mini-card-band-bottom">
          <span>${escapeHtml(short)}</span>
          <span>${escapeHtml(short)}</span>
        </span>
      </span>
    `;
  }
  if (card.type === "wild" || card.type === "skip") {
    const short = card.type === "wild" ? "W" : "S";
    const word = card.type === "wild" ? "WILD" : "SKIP";
    return `
      <span
        class="mini-card ${baseClass} mini-card-special ${isUndoable ? "undoable" : ""} ${flashedClass}"
        ${isUndoable ? `data-undo-card-id="${escapeHtml(card.id)}"` : ""}
        ${isUndoable ? `title="Return ${escapeHtml(cardLabel(card))} to your hand"` : ""}
      >
        <span class="mini-card-band mini-card-band-special mini-card-band-top">
          <span>${escapeHtml(short)}</span>
          <span>${escapeHtml(short)}</span>
        </span>
        <span class="mini-card-special-body">
          <span class="mini-card-stripes" aria-hidden="true">
            <span class="special-stripe red"></span>
            <span class="special-stripe blue"></span>
            <span class="special-stripe green"></span>
            <span class="special-stripe yellow"></span>
          </span>
          <span class="mini-card-special-word">${escapeHtml(word)}</span>
        </span>
        <span class="mini-card-band mini-card-band-special mini-card-band-bottom">
          <span>${escapeHtml(short)}</span>
          <span>${escapeHtml(short)}</span>
        </span>
      </span>
    `;
  }
  return `
    <span
      class="mini-card ${baseClass} ${isUndoable ? "undoable" : ""} ${flashedClass}"
      ${isUndoable ? `data-undo-card-id="${escapeHtml(card.id)}"` : ""}
      ${isUndoable ? `title="Return ${escapeHtml(cardLabel(card))} to your hand"` : ""}
    >${escapeHtml(miniCardLabel(card))}</span>
  `;
}

function faceCardMarkup(card, options = {}) {
  if (!card) return `<span class="pile-preview-empty"></span>`;
  const colorMeta = COLORS.find((entry) => entry.id === card.color);
  const label = cardLabel(card);
  const short = card.type === "number" ? String(card.value) : card.type === "wild" ? "W" : "S";
  const subtitle =
    card.type === "number"
      ? colorMeta?.label ?? "Color"
      : card.type === "wild"
        ? "Wild"
        : "Skip";
  const showSubtitle = !(options.interactive && card.type === "number");
  const selectedClass = options.selected ? "selected" : "";
  const drawnClass = options.justDrew ? "just-drew" : "";
  const previewedClass = options.previewed ? "previewed" : "";
  const dealtClass = options.dealt ? "dealt" : "";
  const dataAttr = options.cardId ? ` data-card-id="${escapeHtml(options.cardId)}"` : "";
  const tag = options.interactive ? "button" : "div";
  const buttonType = options.interactive ? ` type="button"` : "";
  const titleAttr = options.interactive ? ` title="${escapeHtml(`${label} • ${cardPoints(card)} pts`)}"` : "";
  const styleVars = [];
  if (card.type === "number") {
    styleVars.push(`--color: ${colorMeta?.css ?? "#36a56c"}`);
  }
  if (Number.isFinite(options.dealIndex)) {
    styleVars.push(`--deal-index: ${options.dealIndex}`);
  }
  const styleAttr = styleVars.length ? `style="${styleVars.join("; ")}"` : "";

  if (card.type === "number") {
    return `
      <${tag}
        class="hand-card card-type-number ${card.color} ${selectedClass} ${drawnClass} ${previewedClass} ${dealtClass}"
        ${dataAttr}
        ${buttonType}
        ${titleAttr}
        ${styleAttr}
        aria-label="${escapeHtml(label)}"
      >
        <div class="card-band card-band-top">
          <span class="card-corner">${escapeHtml(short)}</span>
          <span class="card-corner">${escapeHtml(short)}</span>
        </div>
        <div class="card-body card-body-number">
          <div class="card-value">${escapeHtml(short)}</div>
        </div>
        <div class="card-band card-band-bottom">
          <span class="card-corner">${escapeHtml(short)}</span>
          <span class="card-corner">${escapeHtml(short)}</span>
        </div>
      </${tag}>
    `;
  }
  if (card.type === "wild" || card.type === "skip") {
    const short = card.type === "wild" ? "W" : "S";
    const word = card.type === "wild" ? "WILD" : "SKIP";
    return `
      <${tag}
        class="hand-card card-type-${card.type} card-type-special ${selectedClass} ${drawnClass} ${previewedClass} ${dealtClass}"
        ${dataAttr}
        ${buttonType}
        ${titleAttr}
        ${styleAttr}
        aria-label="${escapeHtml(label)}"
      >
        <div class="card-band card-band-special card-band-top">
          <span class="card-corner">${escapeHtml(short)}</span>
          <span class="card-corner">${escapeHtml(short)}</span>
        </div>
        <div class="card-body card-body-special">
          <div class="card-special-stripes" aria-hidden="true">
            <span class="special-stripe red"></span>
            <span class="special-stripe blue"></span>
            <span class="special-stripe green"></span>
            <span class="special-stripe yellow"></span>
          </div>
          <div class="card-special-word">${escapeHtml(word)}</div>
        </div>
        <div class="card-band card-band-special card-band-bottom">
          <span class="card-corner">${escapeHtml(short)}</span>
          <span class="card-corner">${escapeHtml(short)}</span>
        </div>
      </${tag}>
    `;
  }

  return `
    <${tag}
      class="hand-card card-type-${card.type} ${selectedClass} ${drawnClass} ${previewedClass} ${dealtClass}"
      ${dataAttr}
      ${buttonType}
      ${titleAttr}
      ${styleAttr}
      aria-label="${escapeHtml(label)}"
    >
      <div class="card-accent"></div>
      <div class="card-body">
        <div class="card-value">${escapeHtml(short)}</div>
        <div class="card-meta">
          ${showSubtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
          <span>${cardPoints(card)} pts</span>
        </div>
      </div>
    </${tag}>
  `;
}

function deckCardMarkup(deckCount) {
  return `
    <div class="deck-card">
      <span class="deck-card-badge">${escapeHtml(String(deckCount))}</span>
    </div>
  `;
}

function miniPileButtonClass(card) {
  if (!card) return "mini-pile-action mini-pile-action--discard";
  return `mini-pile-action mini-pile-action--discard card-type-${card.type}`;
}

function miniPileButtonStyle(card) {
  if (!card || card.type !== "number") return "";
  const colorMeta = COLORS.find((entry) => entry.id === card.color);
  return colorMeta?.css ? `--color: ${colorMeta.css};` : "";
}

function miniPileButtonMarkup(label, meta) {
  return `
    <span class="mini-pile-action-label">${escapeHtml(label)}</span>
    <span class="mini-pile-action-meta">${escapeHtml(meta)}</span>
  `;
}

function cardShortLabel(card) {
  if (!card) return "";
  if (card.type === "wild") return "W";
  if (card.type === "skip") return "S";
  const color = COLORS.find((entry) => entry.id === card.color);
  return `${color?.short ?? "?"}${card.value}`;
}

function miniCardLabel(card) {
  if (!card) return "";
  if (card.type === "wild") return "W";
  if (card.type === "skip") return "S";
  return String(card.value);
}

function render() {
  document.body.classList.toggle("game-active", state.gameStarted);
  document.body.dataset.mobileView = normalizeMobileView(state.mobileView);
  renderSessionControls();
  renderStatus();
  renderBoard();
  renderHand();
  renderRoundHistory();
  persistGame();
}

function renderSessionControls() {
  const sessions = readStoredSessions().sort((left, right) => right.updatedAt - left.updatedAt);
  const selectedId =
    state.selectedSessionId && sessions.some((session) => session.id === state.selectedSessionId)
      ? state.selectedSessionId
      : state.currentSessionId && sessions.some((session) => session.id === state.currentSessionId)
        ? state.currentSessionId
        : "";
  state.selectedSessionId = selectedId;

  els.savedSessionSelect.innerHTML = `<option value="">Saved sessions on this device</option>`;
  sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = session.id;
    option.textContent = sessionOptionLabel(session);
    els.savedSessionSelect.appendChild(option);
  });
  els.savedSessionSelect.value = selectedId;

  const currentSession = state.currentSessionId ? getSessionById(state.currentSessionId) : null;
  const canLoadSelected = Boolean(selectedId);
  const canExport = Boolean(resolveExportSession());

  els.saveSessionBtn.textContent = currentSession ? "Update Session" : "Save Session";
  els.loadSessionBtn.disabled = !canLoadSelected;
  els.deleteSessionBtn.disabled = !canLoadSelected;
  els.savedSessionSelect.disabled = sessions.length === 0;
  els.downloadSessionBtn.disabled = !canExport;
  els.sessionToolsToggle.hidden = !state.gameStarted;
  els.sessionToolsBody.hidden = state.gameStarted && !state.sessionToolsExpanded;
  els.sessionToolsToggle.textContent = state.sessionToolsExpanded ? "Hide Sessions" : "Sessions";
  els.sessionToolsToggle.setAttribute("aria-expanded", String(!els.sessionToolsBody.hidden));

  if (state.sessionStatusMessage) {
    els.sessionStatus.textContent = state.sessionStatusMessage;
    return;
  }

  if (!sessions.length) {
    els.sessionStatus.textContent = "No saved sessions yet. Save on this device or download a JSON backup copy.";
    return;
  }

  const sessionNoun = sessions.length === 1 ? "session" : "sessions";
  if (currentSession) {
    els.sessionStatus.textContent = `${sessions.length} saved ${sessionNoun}. Current session: ${currentSession.name}.`;
    return;
  }

  els.sessionStatus.textContent = `${sessions.length} saved ${sessionNoun} on this device.`;
}

function renderStatus() {
  const player = currentPlayer();
  const human = humanPlayer();
  const botPlayers = state.players.filter((entry) => !entry.isHuman);
  const discard = topDiscard();
  const humanPhase = human ? currentPhaseFor(human) : null;
  const previewMeld = humanPhasePreviewMeld();
  const humanCanLay = human && state.turnStage === "main"
    ? Boolean(humanPhase && findBestPhaseMeld(human.hand, humanPhase))
    : false;
  const selectedCard = selectedHumanCard();
  const selectedTargets =
    selectedCard && canHumanHitCards()
      ? findHitTargets(selectedCard, human?.id)
      : [];
  const skipTargets =
    isHumanTurn() && state.turnStage === "main" && selectedCard?.type === "skip"
      ? skipTargetsFor(human)
      : [];
  const activeSkipTarget = findSkipTarget(human, state.selectedSkipTargetId);
  const suggestedDiscard = human && state.turnStage === "main"
    ? chooseBotDiscard(human)
    : null;
  const summaryLines = [];

  els.handPanelTitle.textContent = human?.name || "Your Hand";
  els.mobileSummaryBar.hidden = !state.gameStarted;
  els.mobileViewTabs.hidden = !state.gameStarted;
  els.mobileRoundValue.textContent = state.gameStarted ? `R${state.roundNumber}` : "-";
  els.mobileTurnValue.textContent = player ? (player.isHuman ? "You" : player.name) : "-";
  els.mobileDeckValue.textContent = state.gameStarted ? String(state.deck.length) : "-";
  els.mobileDiscardValue.textContent = discard ? cardShortLabel(discard) : "-";
  els.mobileViewTabs
    .querySelectorAll("[data-mobile-view]")
    .forEach((button) => {
      const isActive = button.getAttribute("data-mobile-view") === state.mobileView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  els.mobileOpponentsStrip.hidden = !state.gameStarted || !botPlayers.length;
  els.mobileOpponentsStrip.innerHTML = state.gameStarted
    ? botPlayers
        .map((bot) => {
          const isCurrent = bot.id === player?.id && state.turnStage !== "round-end" && state.turnStage !== "game-over";
          const isOut =
            (state.turnStage === "round-end" || state.turnStage === "game-over") &&
            state.pendingRoundSummary?.outPlayerId === bot.id;
          const statusBits = [
            `${bot.hand.length} cards`,
            `${bot.score} pts`,
            bot.laidGroups.length ? "phase down" : "not down",
          ];
          return `
            <article class="mobile-opponent-chip ${isCurrent ? "current" : ""} ${isOut ? "round-out" : ""}">
              <div class="mobile-opponent-head">
                <strong>${escapeHtml(bot.name)}</strong>
                <span>${escapeHtml(difficultyLabel(bot.difficulty))}</span>
              </div>
              <div class="mobile-opponent-meta">${escapeHtml(statusBits.join(" • "))}</div>
            </article>
          `;
        })
        .join("")
    : "";

  if (!state.gameStarted) {
    summaryLines.push("Deal a game to begin.");
  } else if (state.turnStage === "game-over") {
    const winner = state.players.find((entry) => entry.id === state.winnerId);
    summaryLines.push(`${winner?.name ?? "A player"} won the table.`);
  } else if (state.turnStage === "round-end") {
    const roundWinner = state.players.find(
      (entry) => entry.id === state.pendingRoundSummary?.outPlayerId,
    );
    summaryLines.push(`${roundWinner?.name ?? "A player"} went out.`);
    summaryLines.push("Deal the next round when you are ready.");
  } else if (player) {
    const phase = currentPhaseFor(player);
    summaryLines.push(`${player.name} is up.`);
    summaryLines.push(
      phase
        ? `Working on Phase ${phase.number}: ${phase.title}.`
        : `${player.name} has already completed every phase.`,
    );
  }

  els.statusText.textContent = summaryLines.join(" ");
  els.roundValue.textContent = state.gameStarted ? String(state.roundNumber) : "-";
  els.turnValue.textContent = player?.name ?? "-";
  els.startGameBtn.textContent = state.gameStarted ? "Deal New Game" : "Start Game";
  els.startGameBtn.title = state.gameStarted
    ? "End the current game and deal a fresh one with these players."
    : "Deal a new Phase 10 game with these players.";
  els.startGameBtn.setAttribute("aria-label", els.startGameBtn.title);
  els.actionSortBtn.innerHTML = `
    <span class="action-sort-label">Sort Hand</span>
    <span class="action-sort-mode">${state.handSortMode === "color" ? "Color" : "Number"}</span>
  `;
  els.actionSortBtn.setAttribute(
    "aria-label",
    `Sort hand by ${state.handSortMode === "color" ? "number" : "color"}`,
  );
  els.actionSortBtn.title = `Click to sort hand by ${state.handSortMode === "color" ? "number" : "color"}`;
  els.actionSortBtn.disabled = !state.gameStarted;
  els.deckPreview.innerHTML = deckCardMarkup(state.deck.length);
  els.discardPreview.innerHTML = faceCardMarkup(discard);
  els.drawDeckBtn.classList.toggle("pile-pulsed", state.pilePulse === "deck");
  els.takeDiscardBtn.classList.toggle("pile-pulsed", state.pilePulse === "discard");
  els.actionDrawDeckBtn.innerHTML = miniPileButtonMarkup("Draw Card", `${state.deck.length} left`);
  els.drawDeckBtn.setAttribute("aria-label", `Draw from deck: ${state.deck.length} cards remaining`);
  els.drawDeckBtn.title = `Draw from deck: ${state.deck.length} cards remaining`;
  els.actionDrawDeckBtn.setAttribute("aria-label", els.drawDeckBtn.getAttribute("aria-label") ?? "Draw from deck");
  els.actionDrawDeckBtn.title = els.drawDeckBtn.title;
  els.takeDiscardBtn.setAttribute(
    "aria-label",
    discard ? `Take discard: ${cardLabel(discard)}` : "Take discard",
  );
  els.takeDiscardBtn.title = discard ? `Take discard: ${cardLabel(discard)}` : "Take discard";
  els.actionTakeDiscardBtn.setAttribute("aria-label", els.takeDiscardBtn.getAttribute("aria-label") ?? "Take discard");
  els.actionTakeDiscardBtn.title = els.takeDiscardBtn.title;
  els.actionTakeDiscardBtn.className = miniPileButtonClass(discard);
  els.actionTakeDiscardBtn.style.cssText = miniPileButtonStyle(discard);
  els.actionTakeDiscardBtn.innerHTML = miniPileButtonMarkup(
    "Draw Discard",
    discard ? cardLabel(discard) : "No discard",
  );

  els.drawDeckBtn.disabled = !isHumanTurn() || state.turnStage !== "draw" || state.busy;
  els.takeDiscardBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "draw" ||
    state.busy ||
    !canTakeTopDiscard();
  els.actionDrawDeckBtn.disabled = els.drawDeckBtn.disabled;
  els.actionTakeDiscardBtn.disabled = els.takeDiscardBtn.disabled;
  els.layPhaseBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "main" ||
    state.busy ||
    !humanCanLay ||
    Boolean(human?.laidGroups.length);
  els.layPhaseBtn.textContent = previewMeld ? "Confirm Lay Phase" : "Lay Phase";
  els.discardBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "main" ||
    state.busy ||
    !state.selectedCardId ||
    (selectedCard?.type === "skip" && !activeSkipTarget);
  els.nextRoundBtn.disabled = state.turnStage !== "round-end";
  els.eventNotice.hidden = !state.transientNotice;
  els.eventNotice.innerHTML = state.transientNotice?.message ?? "";

  if (!state.gameStarted) {
    els.actionHint.textContent = "Use Start Game to deal a fresh table.";
  } else if (state.turnStage === "round-end") {
    els.actionHint.textContent = "Round scoring is finished. Use Deal Next Round to continue.";
  } else if (state.turnStage === "game-over") {
    els.actionHint.textContent = "The game is over. Use Deal New Game to play again.";
  } else if (!isHumanTurn()) {
    els.actionHint.textContent = `${player?.name ?? "A bot"} is taking a turn.`;
  } else if (state.turnStage === "draw") {
    els.actionHint.textContent = "Choose whether to draw from the deck or take the top discard.";
  } else if (selectedCard?.type === "skip" && activeSkipTarget) {
    els.actionHint.textContent = `Discard Skip to make ${activeSkipTarget.name} lose a turn.`;
  } else if (selectedCard?.type === "skip") {
    els.actionHint.textContent = "Click a highlighted player card to choose who to skip, then discard the Skip card.";
  } else if (previewMeld) {
    els.actionHint.textContent = `Phase ${humanPhase?.number ?? "?"} preview is shown. Confirm to lay it, or discard instead.`;
  } else if (state.humanExtraPlayUndoStack.length) {
    els.actionHint.textContent = "Click one of your just-played mini cards to return it to your hand, keep adding cards, or discard to end the turn.";
  } else if (human?.laidGroups.length && selectedTargets.length) {
    els.actionHint.textContent = `Click a highlighted phase group to play ${cardLabel(selectedCard)}, or discard it instead.`;
  } else if (human?.laidGroups.length) {
    els.actionHint.textContent = "Your phase is down. Select a card, click a highlighted phase to play it, or discard to end the turn.";
  } else if (humanCanLay) {
    els.actionHint.textContent = `You can lay Phase ${humanPhase?.number ?? "?"} right now before discarding.`;
  } else {
    els.actionHint.textContent = `Select one card to discard when you are ready.`;
  }

  els.selectedDiscard.textContent = selectedCard ? cardLabel(selectedCard) : "None";
  if (selectedCard?.type === "skip" && activeSkipTarget) {
    els.suggestedDiscard.textContent = `Skip target: ${activeSkipTarget.name}. Discard Skip to apply it.`;
  } else if (selectedCard?.type === "skip") {
    els.suggestedDiscard.textContent = "Choose a highlighted player card to set the skip target.";
  } else if (human?.laidGroups.length && selectedCard && human.hand.length <= 1) {
    els.suggestedDiscard.textContent = "This is your last card. Discard it to end the turn.";
  } else if (selectedTargets.length) {
    els.suggestedDiscard.textContent = `Playable targets: ${selectedTargets.length}. Click a highlighted phase group to add this card.`;
  } else if (human?.laidGroups.length && selectedCard) {
    els.suggestedDiscard.textContent = `No laid phase can take ${cardLabel(selectedCard)} right now.`;
  } else {
    els.suggestedDiscard.textContent = suggestedDiscard
      ? `Suggested discard: ${cardLabel(suggestedDiscard)}`
      : "The table will suggest a discard when it is your turn.";
  }
}

function renderBoard() {
  if (!state.gameStarted) {
    els.leaderText.textContent = "Scores and phases will appear here.";
    els.playersBoard.innerHTML = `<div class="empty-board">Start a game to populate the table.</div>`;
    return;
  }

  const outPlayerId =
    state.turnStage === "round-end" || state.turnStage === "game-over"
      ? state.pendingRoundSummary?.outPlayerId ?? null
      : null;
  const leader = [...state.players].sort((left, right) => {
    const rightCompleted = completedPhaseNumberFor(right);
    const leftCompleted = completedPhaseNumberFor(left);
    if (rightCompleted !== leftCompleted) return rightCompleted - leftCompleted;
    return left.score - right.score;
  })[0];

  const leaderWorkingPhase = leader ? nextWorkingPhaseFor(leader) : null;
  els.leaderText.textContent = leader
    ? `${leader.name} is leading${leaderWorkingPhase ? ` and is working on Phase ${leaderWorkingPhase.number}` : " after completing all phases"} with ${leader.score} points.`
    : "Scores and phases will appear here.";

  const human = humanPlayer();
  const selectedCard = selectedHumanCard();
  const targetIds = new Set(
    canHumanHitCards() && selectedCard
      ? findHitTargets(selectedCard, human?.id).map((group) => group.id)
      : [],
  );
  const skipTargetIds = new Set(
    isHumanTurn() && state.turnStage === "main" && selectedCard?.type === "skip"
      ? skipTargetsFor(human).map((entry) => entry.id)
      : [],
  );
  const activeSkipTarget = findSkipTarget(human, state.selectedSkipTargetId);

  const botPlayers = state.players.filter((player) => !player.isHuman);
  els.playersBoard.innerHTML = botPlayers
    .map((player) => {
      const { completedPhaseNumber } = playerPhaseProgressCopy(player);
      const isSkipTarget = skipTargetIds.has(player.id);
      const isSelectedSkipTarget = activeSkipTarget?.id === player.id;
      const badges = [
        `<span class="badge ${player.id === state.winnerId ? "gold" : ""}">${player.isHuman ? "Human" : "Bot"}</span>`,
        !player.isHuman ? `<span class="badge">${escapeHtml(difficultyLabel(player.difficulty))}</span>` : "",
        player === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over"
          ? `<span class="badge gold">Current turn</span>`
          : "",
        player.completedPhaseThisRound ? `<span class="badge gold">Phase completed</span>` : "",
      ]
        .filter(Boolean)
        .join("");

      return `
        <article
          class="player-card ${player === currentPlayer() ? "current" : ""} ${player.id === outPlayerId ? "round-out" : ""} ${player.isHuman ? "human" : ""} ${isSkipTarget ? "skip-target" : ""} ${isSelectedSkipTarget ? "skip-target-selected" : ""}"
          ${isSkipTarget ? `data-skip-target-id="${escapeHtml(player.id)}"` : ""}
          ${isSkipTarget ? `role="button" tabindex="0"` : ""}
          aria-label="${escapeHtml(
            isSkipTarget
              ? `Choose ${player.name} as the skip target`
              : `${player.name} player card`,
          )}"
        >
          <div class="player-head">
            <div>
              <h3 class="player-name">${escapeHtml(player.name)}</h3>
              <div class="badge-row">${badges}</div>
            </div>
            <div class="stat-row">
              <span class="stat-pill gold">${player.score} pts</span>
            </div>
          </div>
          <div class="player-stats">
            <div class="stat-row">
              <span class="stat-pill">${player.hand.length} in hand</span>
              <span class="stat-pill">Completed ${completedPhaseNumber}/10</span>
            </div>
          </div>
          ${renderMeldStack(player, targetIds, selectedCard)}
          ${isSkipTarget ? `<p class="player-card-target-note">${isSelectedSkipTarget ? "Skip target selected" : "Click to skip this player"}</p>` : ""}
        </article>
      `;
    })
    .join("");

  if (!botPlayers.length) {
    els.playersBoard.innerHTML = `<div class="empty-board">Bot players will appear here once the game starts.</div>`;
  }
}

function phasePreviewGroupLabel(group) {
  if (group.meta.kind === "set") {
    return `Set of ${group.meta.size}`;
  }
  if (group.meta.kind === "color") {
    return `${group.meta.size} ${group.meta.colorLabel}`;
  }
  return `Run ${group.meta.start}-${group.meta.end}`;
}

function renderPhasePreviewMarkup(meld, phase) {
  if (!meld || !phase) return "";
  return `
    <section class="phase-preview-card" aria-label="Phase preview">
      <div class="phase-preview-head">
        <strong>Phase ${phase.number} Preview</strong>
        <span class="group-chip">${meld.usedCardIds.length} cards</span>
      </div>
      <p class="phase-preview-copy">These cards will be laid when you confirm.</p>
      <div class="phase-preview-groups">
        ${meld.groups
          .map((group) => `
            <div class="phase-preview-group">
              <span class="phase-preview-label">${escapeHtml(phasePreviewGroupLabel(group))}</span>
              <div class="mini-card-row">${group.cards.map((card) => miniCardMarkup(card)).join("")}</div>
            </div>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function renderHand() {
  const human = humanPlayer();
  if (!human) {
    els.handPanelTitle.textContent = "Your Hand";
    els.handSummary.textContent = "Start a game to see the human player hand.";
    els.humanSeatSummary.innerHTML = "";
    els.humanHand.closest(".hand-panel")?.classList.remove("current");
    els.humanHand.closest(".hand-panel")?.classList.remove("round-out");
    els.humanHand.innerHTML = "";
    return;
  }

  const phase = currentPhaseFor(human);
  const previewMeld = humanPhasePreviewMeld();
  const previewCardIds = new Set(previewMeld?.usedCardIds ?? []);
  const dealAnimationIndexById = new Map(
    state.dealAnimationCardIds.map((cardId, index) => [cardId, index]),
  );
  const completionReady = Boolean(phase && findBestPhaseMeld(human.hand, phase));
  const selectedCard = selectedHumanCard();
  const { completedLabel, workingLabel, completedPhaseNumber } = playerPhaseProgressCopy(human);
  const targetIds = new Set(
    canHumanHitCards() && selectedCard
      ? findHitTargets(selectedCard, human.id).map((group) => group.id)
      : [],
  );
  const badges = [
    human === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over"
      ? `<span class="badge gold">Current turn</span>`
      : "",
    human.completedPhaseThisRound ? `<span class="badge gold">Phase completed</span>` : "",
  ]
    .filter(Boolean)
    .join("");
  const compactPhaseStatus = previewMeld
    ? `Previewing Phase ${phase?.number ?? "?"}`
    : human.completedPhaseThisRound && phase
      ? `Phase ${completedPhaseNumber} complete • Working on Phase ${phase.number} - ${phase.title}`
      : completedPhaseNumber && phase
        ? `Phase ${completedPhaseNumber} complete • Working on Phase ${phase.number} - ${phase.title}`
        : phase
          ? `Working on Phase ${phase.number} - ${phase.title}`
          : "All phases complete";

  els.handPanelTitle.textContent = human.name;
  els.handSummary.textContent = "";
  els.humanHand.closest(".hand-panel")?.classList.toggle(
    "current",
    human === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over",
  );
  els.humanHand.closest(".hand-panel")?.classList.toggle(
    "round-out",
    (state.turnStage === "round-end" || state.turnStage === "game-over") &&
      state.pendingRoundSummary?.outPlayerId === human.id,
  );
  els.humanSeatSummary.innerHTML = `
    <div class="human-seat-copy">
      <div class="badge-row">${badges}</div>
      <p class="human-phase-inline">${escapeHtml(compactPhaseStatus)}</p>
      <div class="stat-row">
        <span class="stat-pill gold">${human.score} pts</span>
        <span class="stat-pill">${human.hand.length} in hand</span>
        <span class="stat-pill">Completed ${completedPhaseNumber}/10</span>
      </div>
    </div>
    ${renderPhasePreviewMarkup(previewMeld, phase)}
    ${renderMeldStack(human, targetIds, selectedCard, {
      emptyMessage: "",
    })}
  `;

  els.humanHand.innerHTML = human.hand
    .map((card) =>
      faceCardMarkup(card, {
        interactive: true,
        cardId: card.id,
        selected: state.selectedCardId === card.id,
        justDrew: state.lastDrawnCardId === card.id,
        previewed: previewCardIds.has(card.id),
        dealt: dealAnimationIndexById.has(card.id),
        dealIndex: dealAnimationIndexById.get(card.id),
      }),
    )
    .join("");
}

function renderRoundHistory() {
  if (els.roundHistoryOrderBtn) {
    els.roundHistoryOrderBtn.textContent =
      state.roundHistorySortDir === "desc" ? "Newest First" : "Oldest First";
    els.roundHistoryOrderBtn.disabled = state.roundHistory.length <= 1;
  }

  if (!state.players.length || !state.roundHistory.length) {
    els.roundHistorySummary.textContent = state.gameStarted
      ? "Complete a round to start the table history."
      : "Start a game to track round-by-round results.";
    els.roundHistoryWrap.innerHTML = `<div class="empty-board">Round results will appear here once a round ends.</div>`;
    return;
  }

  const orderedHistory =
    state.roundHistorySortDir === "desc"
      ? [...state.roundHistory].reverse()
      : state.roundHistory;

  const rows = orderedHistory
    .map((entry) => {
      const outPlayerName = state.players.find((player) => player.id === entry.outPlayerId)?.name ?? "Unknown";
      const playerCells = state.players
        .map((player) => {
          const result = entry.playerResults[player.id];
          const points = result ? `+${result.points}` : "-";
          const phaseNote = result?.completedPhaseNumber
            ? `Phase ${result.completedPhaseNumber}`
            : "No phase";
          const phaseNoteClass = result?.completedPhaseNumber
            ? "round-history-phase-note is-complete"
            : "round-history-phase-note is-empty";
          return `
            <td>
              <div class="round-history-cell">
                <strong>${escapeHtml(points)}</strong>
                <span class="${phaseNoteClass}">${escapeHtml(phaseNote)}</span>
              </div>
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          <th scope="row">R${entry.roundNumber}</th>
          ${playerCells}
          <td class="round-history-out">${escapeHtml(outPlayerName)}</td>
        </tr>
      `;
    })
    .join("");

  const mobileCards = orderedHistory
    .map((entry) => {
      const outPlayerName =
        state.players.find((player) => player.id === entry.outPlayerId)?.name ?? "Unknown";
      const resultRows = state.players
        .map((player) => {
          const result = entry.playerResults[player.id];
          const points = result ? `+${result.points}` : "-";
          const phaseNote = result?.completedPhaseNumber
            ? `Phase ${result.completedPhaseNumber}`
            : "No phase";
          const phaseNoteClass = result?.completedPhaseNumber
            ? "round-history-phase-note is-complete"
            : "round-history-phase-note is-empty";
          return `
            <div class="round-history-mobile-result">
              <span class="round-history-mobile-player">${escapeHtml(player.name)}</span>
              <strong>${escapeHtml(points)}</strong>
              <span class="${phaseNoteClass}">${escapeHtml(phaseNote)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <article class="round-history-mobile-card">
          <div class="round-history-mobile-head">
            <strong>Round ${entry.roundNumber}</strong>
            <span class="round-history-out">Went out: ${escapeHtml(outPlayerName)}</span>
          </div>
          <div class="round-history-mobile-results">${resultRows}</div>
        </article>
      `;
    })
    .join("");

  const headCells = state.players
    .map((player) => {
      const { completedPhaseNumber } = playerPhaseProgressCopy(player);
      const phaseHeaderLabel = completedPhaseNumber
        ? `Phase ${completedPhaseNumber}`
        : "No phase yet";
      return `
        <th scope="col">
          <div class="round-history-player-head">
            <span class="round-history-player-name">${escapeHtml(player.name)}</span>
            <span class="round-history-player-phase">${escapeHtml(phaseHeaderLabel)}</span>
          </div>
        </th>
      `;
    })
    .join("");

  els.roundHistorySummary.textContent = `${state.roundHistory.length} completed round${state.roundHistory.length === 1 ? "" : "s"} on this table.`;
  els.roundHistoryWrap.innerHTML = `
    <div class="round-history-mobile-list">${mobileCards}</div>
    <table class="round-history-table">
      <thead>
        <tr>
          <th scope="col">Round</th>
          ${headCells}
          <th scope="col">Went Out</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMeldStack(player, targetIds, selectedCard, options = {}) {
  const emptyMessage =
    options.emptyMessage === undefined
      ? "Nothing laid down this round yet."
      : options.emptyMessage;
  if (!player.laidGroups.length) {
    return emptyMessage ? `<p class="empty-note">${escapeHtml(emptyMessage)}</p>` : "";
  }
  const undoableCardIds = new Set(state.humanExtraPlayUndoStack.map((entry) => entry.cardId));

  return `<div class="meld-stack">${player.laidGroups
    .map((group) => {
      const isTarget = targetIds.has(group.id);
      const tag = isTarget ? "button" : "div";
      const targetAttrs = isTarget
        ? `type="button" data-group-id="${escapeHtml(group.id)}"`
        : `aria-disabled="true"`;
      const settledClass = state.flashedGroupIds.includes(group.id) ? "just-laid" : "";
      return `
        <${tag}
          class="meld-card ${isTarget ? "hit-target" : ""} ${settledClass}"
          ${targetAttrs}
          aria-label="${escapeHtml(
            isTarget && selectedCard
              ? `Play ${cardLabel(selectedCard)} onto ${player.name}'s ${group.label}`
              : `${player.name} ${group.label}`,
          )}"
        >
          <div class="meld-title">
            <strong>${escapeHtml(group.label)}</strong>
            <span class="group-chip">${group.cards.length} cards</span>
          </div>
          <div class="meld-card-play-row">
            <div class="mini-card-row">${group.cards
              .map((card) => miniCardMarkup(card, { undoableCardIds }))
              .join("")}</div>
            ${isTarget ? `<span class="meld-card-target-note">Play selected card here</span>` : ""}
          </div>
        </${tag}>
      `;
    })
    .join("")}</div>`;
}

function appendLog(message) {
  state.logs.unshift(message);
  state.logs = state.logs.slice(0, 14);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function scoreSkipTarget(player, target) {
  const leader = [...skipTargetsFor(player)].sort((left, right) => {
    const rightCompleted = completedPhaseNumberFor(right);
    const leftCompleted = completedPhaseNumberFor(left);
    if (rightCompleted !== leftCompleted) return rightCompleted - leftCompleted;
    if (left.score !== right.score) return left.score - right.score;
    return left.hand.length - right.hand.length;
  })[0];
  const playerIndex = state.players.findIndex((entry) => entry.id === player.id);
  const nextPlayer =
    playerIndex === -1 ? null : state.players[(playerIndex + 1) % state.players.length];

  let score = 0;
  if (target.isHuman) score += 2;
  if (target.completedPhaseThisRound) score += 8;
  if (target.hand.length <= 4) score += 10;
  if (leader?.id === target.id) score += 7;
  if (nextPlayer?.id === target.id) score += 3;
  score += Math.max(0, 5 - target.hand.length);
  return score;
}

function normalizeName(value, fallback) {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function pause(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
