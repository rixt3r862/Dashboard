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

const STORAGE_KEY = "phase10.table.v1";
let lastBannerStage = null;
let transientNoticeTimer = null;

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
  logs: [],
  pendingRoundSummary: null,
  winnerId: null,
  transientNotice: null,
  handSortMode: "color",
  setupBotNames: BOT_NAMES.slice(0, 3),
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
  botCount: document.getElementById("botCount"),
  botNameFields: document.getElementById("botNameFields"),
  startGameBtn: document.getElementById("startGameBtn"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  deckPreview: document.getElementById("deckPreview"),
  discardPreview: document.getElementById("discardPreview"),
  drawDeckBtn: document.getElementById("drawDeckBtn"),
  takeDiscardBtn: document.getElementById("takeDiscardBtn"),
  layPhaseBtn: document.getElementById("layPhaseBtn"),
  discardBtn: document.getElementById("discardBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  roundBanner: document.getElementById("roundBanner"),
  roundBannerKicker: document.getElementById("roundBannerKicker"),
  roundBannerTitle: document.getElementById("roundBannerTitle"),
  roundBannerText: document.getElementById("roundBannerText"),
  roundBannerScores: document.getElementById("roundBannerScores"),
  bannerNextRoundBtn: document.getElementById("bannerNextRoundBtn"),
  bannerResetBtn: document.getElementById("bannerResetBtn"),
  handPanelTitle: document.getElementById("handPanelTitle"),
  actionHint: document.getElementById("actionHint"),
  eventNotice: document.getElementById("eventNotice"),
  selectedDiscard: document.getElementById("selectedDiscard"),
  suggestedDiscard: document.getElementById("suggestedDiscard"),
  logList: document.getElementById("logList"),
  playersBoard: document.getElementById("playersBoard"),
  leaderText: document.getElementById("leaderText"),
  humanSeatSummary: document.getElementById("humanSeatSummary"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
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
    syncSetupBotNamesFromInputs();
    renderBotNameFields();
  });
  els.botNameFields.addEventListener("input", (event) => {
    const input = event.target.closest("input[id^='botName']");
    if (!input) return;
    const match = input.id.match(/^botName(\d)$/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    if (index < 0 || index > 2) return;
    state.setupBotNames[index] = input.value;
  });
  els.resetTableBtn.addEventListener("click", resetTable);
  els.drawDeckBtn.addEventListener("click", () => humanDraw("deck"));
  els.takeDiscardBtn.addEventListener("click", () => humanDraw("discard"));
  els.layPhaseBtn.addEventListener("click", humanLayPhase);
  els.discardBtn.addEventListener("click", humanDiscardSelected);
  els.nextRoundBtn.addEventListener("click", beginNextRound);
  els.bannerNextRoundBtn.addEventListener("click", beginNextRound);
  els.bannerResetBtn.addEventListener("click", resetTable);
  els.humanHand.addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-id]");
    if (!button) return;
    const cardId = button.getAttribute("data-card-id");
    if (!cardId) return;
    if (!isHumanTurn() || state.turnStage !== "main" || state.busy) return;
    state.selectedCardId = state.selectedCardId === cardId ? null : cardId;
    render();
  });

  els.playersBoard.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group-id]");
    if (!button) return;
    const groupId = button.getAttribute("data-group-id");
    if (!groupId) return;
    humanPlaySelectedCardToGroup(groupId);
  });

  els.humanSeatSummary.addEventListener("click", (event) => {
    const sortToggle = event.target.closest("[data-hand-sort-toggle]");
    if (sortToggle) {
      toggleHandSortMode();
      return;
    }
    const button = event.target.closest("[data-group-id]");
    if (!button) return;
    const groupId = button.getAttribute("data-group-id");
    if (!groupId) return;
    humanPlaySelectedCardToGroup(groupId);
  });
}

function renderBotNameFields(preferredNames = null) {
  const botCount = clampNumber(Number(els.botCount.value), 1, 3, 2);
  if (preferredNames) {
    state.setupBotNames = Array.from({ length: 3 }, (_, index) => {
      const fallbackName = BOT_NAMES[index] ?? `Bot ${index + 1}`;
      return preferredNames[index] ?? state.setupBotNames[index] ?? fallbackName;
    });
  }
  const currentNames = syncSetupBotNamesFromInputs();

  els.botNameFields.innerHTML = Array.from({ length: botCount }, (_, index) => {
    const fallbackName = BOT_NAMES[index] ?? `Bot ${index + 1}`;
    const value = currentNames[index] ?? fallbackName;
    return `
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
    `;
  }).join("");
}

function readSetupBotNames(count) {
  return Array.from({ length: count }, (_, index) => {
    const input = botNameInput(index);
    return input ? input.value : "";
  });
}

function botNameInput(index) {
  return els.botNameFields.querySelector(`#botName${index + 1}`);
}

function syncSetupBotNamesFromInputs() {
  const nextNames = [...state.setupBotNames];
  for (let index = 0; index < 3; index += 1) {
    const input = botNameInput(index);
    if (input) {
      nextNames[index] = input.value;
    } else if (!nextNames[index]) {
      nextNames[index] = BOT_NAMES[index] ?? `Bot ${index + 1}`;
    }
  }
  state.setupBotNames = nextNames;
  return nextNames;
}

function hydrateSavedGame() {
  const saved = readSavedGame();
  if (!saved) return;

  state.gameStarted = Boolean(saved.gameStarted);
  state.busy = false;
  state.players = Array.isArray(saved.players) ? saved.players.map(normalizePlayerRecord) : [];
  state.roundNumber = clampNumber(saved.roundNumber, 1, 999, 1);
  state.currentPlayerIndex = clampNumber(
    saved.currentPlayerIndex,
    0,
    Math.max(0, state.players.length - 1),
    0,
  );
  state.roundStarterIndex = clampNumber(
    saved.roundStarterIndex,
    0,
    Math.max(0, state.players.length - 1),
    0,
  );
  state.turnStage = normalizeTurnStage(saved.turnStage);
  state.deck = normalizeCardList(saved.deck);
  state.discardPile = normalizeCardList(saved.discardPile);
  state.selectedCardId = normalizeSelectedCardId(saved.selectedCardId);
  state.lastDrawnCardId = normalizeSelectedCardId(saved.lastDrawnCardId);
  state.logs = Array.isArray(saved.logs)
    ? saved.logs.map((entry) => String(entry)).slice(0, 14)
    : [];
  state.pendingRoundSummary =
    saved.pendingRoundSummary && typeof saved.pendingRoundSummary === "object"
      ? saved.pendingRoundSummary
      : null;
  state.winnerId = saved.winnerId ? String(saved.winnerId) : null;
  state.handSortMode = normalizeHandSortMode(saved.handSortMode);

  if (!state.gameStarted || !state.players.length) {
    clearSavedGame();
    return;
  }

  syncSetupControlsFromState();
  appendLog("Saved game restored.");
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
    logs: state.logs,
    pendingRoundSummary: state.pendingRoundSummary,
    winnerId: state.winnerId,
    handSortMode: state.handSortMode,
  };
}

function normalizePlayerRecord(player, index) {
  return {
    id: String(player?.id ?? `restored-${index + 1}`),
    name: normalizeName(player?.name, index === 0 ? "Player 1" : `Player ${index + 1}`),
    isHuman: Boolean(player?.isHuman),
    score: clampNumber(player?.score, 0, 999999, 0),
    phaseIndex: clampNumber(player?.phaseIndex, 0, PHASES.length, 0),
    hand: normalizeCardList(player?.hand),
    laidGroups: normalizeLaidGroups(player?.laidGroups),
    completedPhaseThisRound: Boolean(player?.completedPhaseThisRound),
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

function normalizeSelectedCardId(value) {
  return typeof value === "string" ? value : null;
}

function normalizeHandSortMode(value) {
  return value === "number" ? "number" : "color";
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
  renderBotNameFields(botPlayers.map((player) => player.name));
}

function startNewGame() {
  clearTransientNotice();
  const humanName = normalizeName(els.humanName.value, "Player 1");
  const botCount = clampNumber(Number(els.botCount.value), 1, 3, 2);
  const customBotNames = syncSetupBotNamesFromInputs().slice(0, botCount);
  const usedNames = new Set([humanName.toLowerCase()]);

  state.players = [
    createPlayer("human", humanName, true),
    ...Array.from({ length: botCount }, (_, index) =>
      createPlayer(
        `bot-${index + 1}`,
        resolveBotName(customBotNames[index], usedNames, index),
        false,
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
  state.logs = [];
  state.pendingRoundSummary = null;
  state.winnerId = null;
  appendLog(`New game started with ${humanName} and ${botCount} bot${botCount === 1 ? "" : "s"}.`);
  startRound();
}

function resetTable() {
  clearTransientNotice();
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
  state.logs = [];
  state.pendingRoundSummary = null;
  state.winnerId = null;
  clearSavedGame();
  render();
}

function createPlayer(id, name, isHuman) {
  return {
    id,
    name,
    isHuman,
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
  state.pendingRoundSummary = null;
  state.deck = shuffle(buildDeck());
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

function shuffle(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
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
  state.selectedCardId = drawn.id;
  state.lastDrawnCardId = drawn.id;
  appendLog(`${player.name} drew ${cardLabel(drawn)} from the ${source === "discard" ? "discard pile" : "deck"}.`);
  render();
}

function takeDeckInternal(player) {
  const card = drawFromDeckInternal();
  if (!card) return null;
  player.hand.push(card);
  sortHands();
  return card;
}

function takeDiscardInternal(player) {
  const card = state.discardPile.pop();
  if (!card) return null;
  player.hand.push(card);
  sortHands();
  return card;
}

function humanLayPhase() {
  if (!isHumanTurn() || state.busy || state.turnStage !== "main") return;
  const player = currentPlayer();
  if (player.laidGroups.length) return;
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
    render();
    return;
  }
  discardCard(player, card);
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
  sortHands();

  const owner = state.players.find((entry) => entry.id === target.ownerId);
  appendLog(`${player.name} played ${cardLabel(card)} onto ${owner?.name ?? "another player"}'s ${target.label}.`);
  render();
}

function discardCard(player, card) {
  removeCardsFromHand(player, [card.id]);
  state.discardPile.push(card);
  state.selectedCardId = null;
  state.lastDrawnCardId = null;
  appendLog(`${player.name} discarded ${cardLabel(card)}.`);

  if (!player.hand.length) {
    finishRound(player, card.type === "skip");
    return;
  }

  const skipped = card.type === "skip" ? advanceTurn(2) : advanceTurn(1);
  state.turnStage = "draw";
  if (skipped) {
    appendLog(`${skipped.name} was skipped.`);
    setTransientNotice(`<strong>${escapeHtml(skipped.name)}</strong> was skipped. ${escapeHtml(currentPlayer()?.name ?? "Next player")} is up.`);
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

function advanceTurn(step) {
  const playerCount = state.players.length;
  const skippedPlayer =
    step > 1 ? state.players[(state.currentPlayerIndex + 1) % playerCount] : null;
  state.currentPlayerIndex = (state.currentPlayerIndex + step) % playerCount;
  return skippedPlayer;
}

function finishRound(outPlayer, finalDiscardWasSkip) {
  const leftoverScores = {};
  for (const player of state.players) {
    leftoverScores[player.id] = player.hand.reduce(
      (sum, card) => sum + cardPoints(card),
      0,
    );
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
      discardCard(player, discardCardChoice);
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

  const keepScore = scoreCardKeepValue(discard, player, [...player.hand, discard]);
  return keepScore >= 52 ? "discard" : "deck";
}

function chooseBotDiscard(player) {
  const ordered = [...player.hand].sort((left, right) => {
    const leftRank = scoreCardKeepValue(left, player, player.hand) - cardPoints(left) * 1.15;
    const rightRank = scoreCardKeepValue(right, player, player.hand) - cardPoints(right) * 1.15;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return cardPoints(right) - cardPoints(left);
  });
  return ordered[0] ?? null;
}

function layPhaseForPlayer(player, options = {}) {
  const { autoPlayAfterLay = !player.isHuman } = options;
  const phase = currentPhaseFor(player);
  if (!phase || player.laidGroups.length) return false;
  const bestMeld = findBestPhaseMeld(player.hand, phase);
  if (!bestMeld) return false;

  removeCardsFromHand(player, bestMeld.usedCardIds);
  player.laidGroups = bestMeld.groups.map((group, index) =>
    createLaidGroup(player.id, phase.number, index, group),
  );
  player.completedPhaseThisRound = true;
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

  while (foundMove && player.hand.length > 1) {
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
    return;
  }

  target.cards.push(card);
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

function topDiscard() {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

function canTakeTopDiscard() {
  const discard = topDiscard();
  return Boolean(discard && discard.type !== "skip");
}

function nextPlayerIsHuman() {
  const next = state.players[(state.currentPlayerIndex + 1) % state.players.length];
  return Boolean(next?.isHuman);
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

function scoreCardKeepValue(card, player, hand) {
  if (card.type === "wild") {
    return player.laidGroups.length ? 58 : 96;
  }
  if (card.type === "skip") {
    let score = nextPlayerIsHuman() ? 22 : 8;
    if (player.laidGroups.length) score += 8;
    if (hand.length <= 4) score += 6;
    if (hand.length >= 8) score -= 6;
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

function miniCardMarkup(card) {
  if (!card) return "";
  const baseClass = card.type === "number" ? card.color : card.type;
  return `<span class="mini-card ${baseClass}">${escapeHtml(miniCardLabel(card))}</span>`;
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
  const dataAttr = options.cardId ? ` data-card-id="${escapeHtml(options.cardId)}"` : "";
  const tag = options.interactive ? "button" : "div";
  const buttonType = options.interactive ? ` type="button"` : "";

  return `
    <${tag}
      class="hand-card card-type-${card.type} ${selectedClass} ${drawnClass}"
      ${dataAttr}
      ${buttonType}
      style="${card.type === "number" ? `--color: ${colorMeta?.css ?? "#36a56c"};` : ""}"
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
  renderRoundBanner();
  renderStatus();
  renderBoard();
  renderHand();
  renderLog();
  persistGame();
}

function renderRoundBanner() {
  const inRoundEnd = state.turnStage === "round-end";
  const inGameOver = state.turnStage === "game-over";
  const visible = inRoundEnd || inGameOver;

  els.roundBanner.hidden = !visible;
  els.bannerNextRoundBtn.hidden = !inRoundEnd;
  els.bannerNextRoundBtn.disabled = !inRoundEnd;

  if (!visible) {
    els.roundBannerScores.innerHTML = "";
    lastBannerStage = null;
    return;
  }

  const outPlayer = state.players.find(
    (entry) => entry.id === state.pendingRoundSummary?.outPlayerId,
  );
  const winner = state.players.find((entry) => entry.id === state.winnerId);

  if (inGameOver) {
    els.roundBannerKicker.textContent = "Game Over";
    els.roundBannerTitle.textContent = `${winner?.name ?? "A player"} wins the table`;
    els.roundBannerText.textContent =
      `${outPlayer?.name ?? winner?.name ?? "A player"} went out and the game is complete. Start a fresh table when you are ready.`;
  } else {
    els.roundBannerKicker.textContent = "Round Over";
    els.roundBannerTitle.textContent = `${outPlayer?.name ?? "A player"} went out`;
    els.roundBannerText.textContent =
      "Leftover points have been scored. Deal the next round to keep the game moving.";
  }

  const leftoverScores = state.pendingRoundSummary?.leftoverScores;
  els.roundBannerScores.innerHTML =
    leftoverScores && typeof leftoverScores === "object"
      ? state.players
          .map((player) => {
            const roundPoints = Number(leftoverScores[player.id] ?? 0);
            return `
              <span class="round-score-pill">
                <span class="round-score-name">${escapeHtml(player.name)}</span>
                <strong class="round-score-points">+${roundPoints}</strong>
                <span class="round-score-total">${player.score} total</span>
              </span>
            `;
          })
          .join("")
      : "";

  const bannerStage = state.turnStage;
  if (bannerStage !== lastBannerStage) {
    lastBannerStage = bannerStage;
    const focusTarget = inRoundEnd ? els.bannerNextRoundBtn : els.bannerResetBtn;
    window.setTimeout(() => {
      focusTarget?.focus();
    }, 0);
  }
}

function renderStatus() {
  const player = currentPlayer();
  const human = humanPlayer();
  const discard = topDiscard();
  const humanPhase = human ? currentPhaseFor(human) : null;
  const humanCanLay = human && state.turnStage === "main"
    ? Boolean(humanPhase && findBestPhaseMeld(human.hand, humanPhase))
    : false;
  const selectedCard = selectedHumanCard();
  const selectedTargets =
    selectedCard && canHumanHitCards()
      ? findHitTargets(selectedCard, human?.id)
      : [];
  const suggestedDiscard = human && state.turnStage === "main"
    ? chooseBotDiscard(human)
    : null;
  const summaryLines = [];

  els.handPanelTitle.textContent = human?.name || "Your Hand";

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
  els.deckPreview.innerHTML = deckCardMarkup(state.deck.length);
  els.discardPreview.innerHTML = faceCardMarkup(discard);
  els.drawDeckBtn.setAttribute("aria-label", `Draw from deck: ${state.deck.length} cards remaining`);
  els.drawDeckBtn.title = `Draw from deck: ${state.deck.length} cards remaining`;
  els.takeDiscardBtn.setAttribute(
    "aria-label",
    discard ? `Take discard: ${cardLabel(discard)}` : "Take discard",
  );
  els.takeDiscardBtn.title = discard ? `Take discard: ${cardLabel(discard)}` : "Take discard";

  els.drawDeckBtn.disabled = !isHumanTurn() || state.turnStage !== "draw" || state.busy;
  els.takeDiscardBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "draw" ||
    state.busy ||
    !canTakeTopDiscard();
  els.layPhaseBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "main" ||
    state.busy ||
    !humanCanLay ||
    Boolean(human?.laidGroups.length);
  els.discardBtn.disabled =
    !isHumanTurn() ||
    state.turnStage !== "main" ||
    state.busy ||
    !state.selectedCardId;
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
  if (human?.laidGroups.length && selectedCard && human.hand.length <= 1) {
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

  const botPlayers = state.players.filter((player) => !player.isHuman);
  els.playersBoard.innerHTML = botPlayers
    .map((player) => {
      const { completedLabel, workingLabel, completedPhaseNumber } = playerPhaseProgressCopy(player);
      const badges = [
        `<span class="badge ${player.id === state.winnerId ? "gold" : ""}">${player.isHuman ? "Human" : "Bot"}</span>`,
        player === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over"
          ? `<span class="badge gold">Current turn</span>`
          : "",
        player.completedPhaseThisRound ? `<span class="badge gold">Phase completed</span>` : "",
      ]
        .filter(Boolean)
        .join("");

      return `
        <article class="player-card ${player === currentPlayer() ? "current" : ""} ${player.isHuman ? "human" : ""}">
          <div class="player-head">
            <div>
              <h3 class="player-name">${escapeHtml(player.name)}</h3>
              <div class="badge-row">${badges}</div>
            </div>
            <div class="stat-row">
              <span class="stat-pill gold">${player.score} pts</span>
            </div>
          </div>
          <div class="phase-copy">
            <p>${escapeHtml(completedLabel)}</p>
            <p>${escapeHtml(workingLabel)}</p>
          </div>
          <div class="player-stats">
            <div class="stat-row">
              <span class="stat-pill">${player.hand.length} in hand</span>
              <span class="stat-pill">Completed ${completedPhaseNumber}/10</span>
            </div>
          </div>
          ${renderMeldStack(player, targetIds, selectedCard)}
        </article>
      `;
    })
    .join("");

  if (!botPlayers.length) {
    els.playersBoard.innerHTML = `<div class="empty-board">Bot players will appear here once the game starts.</div>`;
  }
}

function renderHand() {
  const human = humanPlayer();
  if (!human) {
    els.handPanelTitle.textContent = "Your Hand";
    els.handSummary.textContent = "Start a game to see the human player hand.";
    els.humanSeatSummary.innerHTML = "";
    els.humanHand.closest(".hand-panel")?.classList.remove("current");
    els.humanHand.innerHTML = "";
    return;
  }

  const phase = currentPhaseFor(human);
  const completionReady = Boolean(phase && findBestPhaseMeld(human.hand, phase));
  const selectedCard = selectedHumanCard();
  const { completedLabel, workingLabel, completedPhaseNumber } = playerPhaseProgressCopy(human);
  const targetIds = new Set(
    canHumanHitCards() && selectedCard
      ? findHitTargets(selectedCard, human.id).map((group) => group.id)
      : [],
  );
  const badges = [
    `<span class="badge gold">Human</span>`,
    human === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over"
      ? `<span class="badge gold">Current turn</span>`
      : "",
    human.completedPhaseThisRound ? `<span class="badge gold">Phase completed</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  els.handPanelTitle.textContent = human.name;
  els.handSummary.textContent =
    state.turnStage === "round-end"
      ? "Round complete. Review the hand counts above and deal the next round."
      : completionReady && !human.laidGroups.length
        ? "Your current phase is ready to lay."
        : "Your laid phase and hand are below.";
  els.humanHand.closest(".hand-panel")?.classList.toggle(
    "current",
    human === currentPlayer() && state.turnStage !== "round-end" && state.turnStage !== "game-over",
  );
  els.humanSeatSummary.innerHTML = `
    <div class="human-seat-copy">
      <div class="badge-row">${badges}</div>
      <div class="phase-copy">
        <p>${escapeHtml(completedLabel)}</p>
        <p>${escapeHtml(workingLabel)}</p>
      </div>
      <div class="stat-row">
        <span class="stat-pill gold">${human.score} pts</span>
        <span class="stat-pill">${human.hand.length} in hand</span>
        <span class="stat-pill">Completed ${completedPhaseNumber}/10</span>
        <button
          class="stat-pill sort-pill"
          type="button"
          data-hand-sort-toggle="true"
          aria-label="Sort hand by ${state.handSortMode === "color" ? "number" : "color"}"
          title="Click to sort hand by ${state.handSortMode === "color" ? "number" : "color"}"
        >
          Sort: ${escapeHtml(state.handSortMode === "color" ? "Color" : "Number")}
        </button>
      </div>
    </div>
    ${renderMeldStack(human, targetIds, selectedCard, {
      emptyMessage: "Lay your current phase to display it above your hand.",
    })}
  `;

  els.humanHand.innerHTML = human.hand
    .map((card) =>
      faceCardMarkup(card, {
        interactive: true,
        cardId: card.id,
        selected: state.selectedCardId === card.id,
        justDrew: state.lastDrawnCardId === card.id,
      }),
    )
    .join("");
}

function renderLog() {
  if (!state.logs.length) {
    els.logList.innerHTML = `<li>The table log will appear here once play starts.</li>`;
    return;
  }
  els.logList.innerHTML = state.logs
    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
    .join("");
}

function renderMeldStack(player, targetIds, selectedCard, options = {}) {
  const emptyMessage = options.emptyMessage || "Nothing laid down this round yet.";
  if (!player.laidGroups.length) {
    return `<p class="empty-note">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="meld-stack">${player.laidGroups
    .map((group) => {
      const isTarget = targetIds.has(group.id);
      return `
        <button
          type="button"
          class="meld-card ${isTarget ? "hit-target" : ""}"
          ${isTarget ? `data-group-id="${escapeHtml(group.id)}"` : "disabled"}
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
          ${isTarget ? `<span class="meld-card-target-note">Play selected card here</span>` : ""}
          <div class="mini-card-row">${group.cards.map((card) => miniCardMarkup(card)).join("")}</div>
        </button>
      `;
    })
    .join("")}</div>`;
}

function appendLog(message) {
  state.logs.unshift(message);
  state.logs = state.logs.slice(0, 14);
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
