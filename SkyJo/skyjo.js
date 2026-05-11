const BOT_NAMES = ["Nova", "Juno", "Kite", "Piper", "Clover", "Atlas"];
const BOT_DIFFICULTIES = ["easy", "medium", "hard"];
const DEFAULT_TARGET_SCORE = 100;
const ROWS = 3;
const COLS = 4;
const GRID_SIZE = ROWS * COLS;
const STORAGE_KEY = "skyjo.table.v1";
const SESSIONS_KEY = "skyjo.table.sessions.v1";
const EXPORT_VERSION = 1;
let dealAnimationTimer = null;

const CARD_COUNTS = new Map([
  [-2, 5],
  [-1, 10],
  [0, 15],
  [1, 10],
  [2, 10],
  [3, 10],
  [4, 10],
  [5, 10],
  [6, 10],
  [7, 10],
  [8, 10],
  [9, 10],
  [10, 10],
  [11, 10],
  [12, 10],
]);

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  roundNumber: 1,
  currentPlayerIndex: 0,
  roundStarterIndex: 0,
  deck: [],
  discardPile: [],
  turnStage: "setup",
  drawnCard: null,
  drawnSource: null,
  openingStarter: null,
  finalTurnTriggerId: null,
  finalTurnRemainingIds: [],
  roundHistory: [],
  roundHistorySortDir: "asc",
  dealAnimationCardIds: [],
  pendingRoundSummary: null,
  winnerId: null,
  targetScore: DEFAULT_TARGET_SCORE,
  setupBotNames: BOT_NAMES.slice(0, 3),
  setupBotDifficulties: ["medium", "medium", "medium"],
  currentSessionId: null,
  selectedSessionId: "",
  sessionStatusMessage: "",
  sessionToolsExpanded: false,
};

const els = {
  setupForm: document.getElementById("setupForm"),
  startGameBtn: document.getElementById("startGameBtn"),
  humanName: document.getElementById("humanName"),
  botCount: document.getElementById("botCount"),
  targetScore: document.getElementById("targetScore"),
  setupFields: document.getElementById("setupFields"),
  setupSummary: document.getElementById("setupSummary"),
  setupControlSlot: document.getElementById("setupControlSlot"),
  tableControlSlot: document.getElementById("tableControlSlot"),
  tableControlBlock: document.getElementById("tableControlBlock"),
  botNameFields: document.getElementById("botNameFields"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  downloadSessionBtn: document.getElementById("downloadSessionBtn"),
  importSessionBtn: document.getElementById("importSessionBtn"),
  exportScoreKeeperBtn: document.getElementById("exportScoreKeeperBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  sessionToolsToggle: document.getElementById("sessionToolsToggle"),
  sessionToolsBody: document.getElementById("sessionToolsBody"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
  importSessionFile: document.getElementById("importSessionFile"),
  sessionStatus: document.getElementById("sessionStatus"),
  drawDeckBtn: document.getElementById("drawDeckBtn"),
  takeDiscardBtn: document.getElementById("takeDiscardBtn"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  targetValue: document.getElementById("targetValue"),
  endValue: document.getElementById("endValue"),
  deckPreview: document.getElementById("deckPreview"),
  discardPreview: document.getElementById("discardPreview"),
  actionHint: document.getElementById("actionHint"),
  tableDrawnCardWrap: document.getElementById("tableDrawnCardWrap"),
  currentCardHint: document.getElementById("currentCardHint"),
  starterBanner: document.getElementById("starterBanner"),
  finalTurnBanner: document.getElementById("finalTurnBanner"),
  winnerBanner: document.getElementById("winnerBanner"),
  currentCardPanel: document.querySelector(".current-card-panel"),
  eventNotice: document.getElementById("eventNotice"),
  playersBoard: document.getElementById("playersBoard"),
  tableArea: document.querySelector(".table-area"),
  leaderText: document.getElementById("leaderText"),
  roundHistoryPanel: document.querySelector(".round-history-panel"),
  roundHistorySummary: document.getElementById("roundHistorySummary"),
  roundHistoryWrap: document.getElementById("roundHistoryWrap"),
  roundHistoryOrderBtn: document.getElementById("roundHistoryOrderBtn"),
};

function bindEvents() {
  bind(els.setupForm, "submit", (event) => {
    event.preventDefault();
    if (state.turnStage === "opening-ready" && state.openingStarter) {
      beginGamePlay();
      return;
    }
    if (state.turnStage === "round-end" && state.pendingRoundSummary && !state.winnerId) {
      dealNextRound();
      return;
    }
    if (state.turnStage === "opening-reveal") return;
    if (shouldConfirmRestart() && !window.confirm("Restart this SkyJo game? Current round and scores will be cleared.")) {
      return;
    }
    startNewGame();
  });

  bind(els.botCount, "change", () => {
    syncBotNamesFromInputs();
    renderBotNameFields();
  });

  bind(els.botNameFields, "input", (event) => {
    const input = event.target.closest("input[data-bot-index]");
    if (input) {
      state.setupBotNames[Number(input.dataset.botIndex)] = input.value;
      return;
    }
    const select = event.target.closest("select[data-bot-difficulty-index]");
    if (!select) return;
    state.setupBotDifficulties[Number(select.dataset.botDifficultyIndex)] = normalizeBotDifficulty(select.value);
  });

  bind(els.resetTableBtn, "click", resetTable);
  bind(els.saveSessionBtn, "click", saveNamedSession);
  bind(els.downloadSessionBtn, "click", exportSessionFile);
  bind(els.exportScoreKeeperBtn, "click", exportScoreKeeperFile);
  bind(els.importSessionBtn, "click", () => {
    els.importSessionFile?.click();
  });
  bind(els.sessionToolsToggle, "click", () => {
    state.sessionToolsExpanded = !state.sessionToolsExpanded;
    renderSessionControls();
  });
  bind(els.loadSessionBtn, "click", loadSelectedSession);
  bind(els.deleteSessionBtn, "click", deleteSelectedSession);
  bind(els.savedSessionSelect, "change", () => {
    state.selectedSessionId = els.savedSessionSelect.value || "";
    render();
  });
  bind(els.importSessionFile, "change", () => {
    const file = els.importSessionFile.files?.[0];
    importSessionFile(file);
  });
  bind(els.drawDeckBtn, "click", () => humanDrawDeck());
  bind(els.takeDiscardBtn, "click", () => {
    if (canHumanAct("discard-drawn")) {
      humanDiscardDrawn();
      return;
    }
    humanTakeDiscard();
  });
  bind(els.playersBoard, "click", handleBoardClick);
  bind(els.roundHistoryOrderBtn, "click", () => {
    state.roundHistorySortDir = state.roundHistorySortDir === "desc" ? "asc" : "desc";
    saveGame();
    renderHistory();
  });
}

function bind(element, eventName, handler) {
  if (!element) return;
  element.addEventListener(eventName, handler);
}

function renderBotNameFields(syncInputs = true) {
  const count = Number(els.botCount.value);
  if (syncInputs) syncBotConfigFromInputs();
  els.botNameFields.innerHTML = Array.from({ length: count }, (_, index) => {
    const value = state.setupBotNames[index] || BOT_NAMES[index] || `Bot ${index + 1}`;
    const difficulty = normalizeBotDifficulty(state.setupBotDifficulties[index]);
    return `
      <div class="bot-config-row">
        <label class="field compact-field">
          <span>Bot ${index + 1} name</span>
          <input data-bot-index="${index}" type="text" maxlength="18" autocomplete="off" value="${escapeHtml(value)}" />
        </label>
        <label class="field bot-difficulty-field">
          <span>Level</span>
          <select data-bot-difficulty-index="${index}">
            ${BOT_DIFFICULTIES.map((entry) => `
              <option value="${entry}" ${difficulty === entry ? "selected" : ""}>${difficultyLabel(entry)}</option>
            `).join("")}
          </select>
        </label>
      </div>
    `;
  }).join("");
}

function syncBotConfigFromInputs() {
  els.botNameFields.querySelectorAll("input[data-bot-index]").forEach((input) => {
    state.setupBotNames[Number(input.dataset.botIndex)] = input.value;
  });
  els.botNameFields.querySelectorAll("select[data-bot-difficulty-index]").forEach((select) => {
    state.setupBotDifficulties[Number(select.dataset.botDifficultyIndex)] =
      normalizeBotDifficulty(select.value);
  });
}

function syncBotNamesFromInputs() {
  syncBotConfigFromInputs();
}

function setupLocked() {
  return state.gameStarted && !state.winnerId;
}

function shouldConfirmRestart() {
  return state.gameStarted && !state.winnerId;
}

function readTargetScore() {
  const value = Number(els.targetScore?.value);
  if (!Number.isFinite(value)) return DEFAULT_TARGET_SCORE;
  return Math.max(25, Math.min(500, Math.round(value)));
}

function syncTargetInput() {
  if (!els.targetScore) return;
  els.targetScore.value = String(state.targetScore ?? DEFAULT_TARGET_SCORE);
}

function syncSetupFromPlayers() {
  const human = state.players.find((player) => !player.bot);
  const bots = state.players.filter((player) => player.bot);
  if (human && els.humanName) els.humanName.value = human.name;
  if (els.botCount) els.botCount.value = String(Math.max(1, Math.min(3, bots.length)));
  state.setupBotNames = BOT_NAMES.slice(0, 3);
  state.setupBotDifficulties = ["medium", "medium", "medium"];
  bots.forEach((bot, index) => {
    state.setupBotNames[index] = bot.name;
    state.setupBotDifficulties[index] = normalizeBotDifficulty(bot.difficulty);
  });
  renderBotNameFields(false);
  syncTargetInput();
}

function startNewGame() {
  syncBotConfigFromInputs();
  const humanName = cleanName(els.humanName.value, "Rick");
  const botCount = Number(els.botCount.value);
  state.targetScore = readTargetScore();
  state.players = [
    makePlayer("p-human", humanName, false),
    ...Array.from({ length: botCount }, (_, index) =>
      makePlayer(
        `p-bot-${index + 1}`,
        cleanName(state.setupBotNames[index], BOT_NAMES[index]),
        true,
        normalizeBotDifficulty(state.setupBotDifficulties[index]),
      ),
    ),
  ];
  state.gameStarted = true;
  state.roundNumber = 1;
  state.roundStarterIndex = 0;
  state.roundHistory = [];
  state.roundHistorySortDir = "asc";
  state.pendingRoundSummary = null;
  state.winnerId = null;
  state.currentSessionId = null;
  state.selectedSessionId = "";
  state.sessionStatusMessage = "";
  state.sessionToolsExpanded = false;
  syncSetupFromPlayers();
  dealRound();
}

function resetTable() {
  clearDealAnimation();
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.roundNumber = 1;
  state.currentPlayerIndex = 0;
  state.roundStarterIndex = 0;
  state.deck = [];
  state.discardPile = [];
  state.turnStage = "setup";
  state.drawnCard = null;
  state.drawnSource = null;
  state.openingStarter = null;
  state.finalTurnTriggerId = null;
  state.finalTurnRemainingIds = [];
  state.roundHistory = [];
  state.roundHistorySortDir = "asc";
  state.dealAnimationCardIds = [];
  state.pendingRoundSummary = null;
  state.winnerId = null;
  state.currentSessionId = null;
  state.selectedSessionId = "";
  state.sessionStatusMessage = "";
  state.sessionToolsExpanded = true;
  state.setupBotNames = BOT_NAMES.slice(0, 3);
  state.setupBotDifficulties = ["medium", "medium", "medium"];
  if (els.humanName) els.humanName.value = "Rick";
  if (els.botCount) els.botCount.value = "2";
  renderBotNameFields(false);
  syncTargetInput();
  saveGame();
  render();
}

function dealNextRound() {
  if (!state.pendingRoundSummary || state.winnerId) return;
  state.roundNumber += 1;
  state.roundStarterIndex = (state.roundStarterIndex + 1) % state.players.length;
  dealRound();
}

function dealRound() {
  clearDealAnimation();
  state.busy = false;
  state.deck = shuffle(createDeck());
  state.discardPile = [];
  state.drawnCard = null;
  state.drawnSource = null;
  state.openingStarter = null;
  state.finalTurnTriggerId = null;
  state.finalTurnRemainingIds = [];
  state.pendingRoundSummary = null;
  state.turnStage = "opening-reveal";
  state.currentPlayerIndex = 0;

  for (const player of state.players) {
    player.grid = Array.from({ length: GRID_SIZE }, () => ({
      card: drawFromDeck(),
      revealed: false,
      cleared: false,
    }));
  }

  triggerDealAnimation(dealAnimationCardOrder());
  appendNotice(`Round ${state.roundNumber} dealt. Choose two cards to set the lead.`);
  saveGame();
  render();
}

function dealAnimationCardOrder() {
  const orderedCardIds = [];
  const rows = Math.ceil(GRID_SIZE / COLS);
  for (let row = 0; row < rows; row += 1) {
    for (let playerColumn = 0; playerColumn < COLS; playerColumn += 1) {
      for (const player of state.players) {
        const slotIndex = row * COLS + playerColumn;
        const cardId = player.grid[slotIndex]?.card?.id;
        if (cardId) orderedCardIds.push(cardId);
      }
    }
  }
  return orderedCardIds;
}

function makePlayer(id, name, bot = true, difficulty = "medium") {
  return {
    id,
    name,
    bot,
    difficulty: bot ? normalizeBotDifficulty(difficulty) : null,
    score: 0,
    grid: [],
  };
}

function createDeck() {
  const deck = [];
  let id = 1;
  for (const [value, count] of CARD_COUNTS.entries()) {
    for (let i = 0; i < count; i += 1) {
      deck.push({ id: `c-${id}`, value });
      id += 1;
    }
  }
  return deck;
}

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function drawFromDeck() {
  if (!state.deck.length) recycleDiscardIntoDeck();
  return state.deck.pop() || null;
}

function recycleDiscardIntoDeck() {
  const top = state.discardPile.pop();
  state.deck = shuffle(state.discardPile);
  state.discardPile = top ? [top] : [];
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
  const duration = 420 + state.dealAnimationCardIds.length * 110;
  dealAnimationTimer = window.setTimeout(() => {
    dealAnimationTimer = null;
    state.dealAnimationCardIds = [];
    render();
  }, duration);
}

function revealRandomOpeningCards(player) {
  const indexes = shuffle(Array.from({ length: GRID_SIZE }, (_, index) => index)).slice(0, 2);
  indexes.forEach((index) => {
    player.grid[index].revealed = true;
  });
  clearMatchingColumns(player);
}

function completeOpeningReveal() {
  const human = state.players.find((entry) => entry.id === "p-human");
  if (state.turnStage !== "opening-reveal" || openingRevealCount(human) < 2) return;
  for (const player of state.players.filter((entry) => entry.bot)) {
    revealRandomOpeningCards(player);
  }

  const starter = openingRevealStandings()[0];
  state.currentPlayerIndex = Math.max(
    0,
    state.players.findIndex((player) => player.id === starter?.id),
  );
  state.roundStarterIndex = state.currentPlayerIndex;
  state.openingStarter = starter ?? null;
  state.turnStage = "opening-ready";
  appendNotice(
    `${starter?.name ?? currentPlayer().name} has the lead with ${starter?.total ?? 0} points. Press Start Game to begin.`,
  );
  saveGame();
  render();
}

function beginGamePlay() {
  if (state.turnStage !== "opening-ready" || !state.openingStarter) return;
  const starterName = state.openingStarter.name;
  state.openingStarter = null;
  state.turnStage = "choose-source";
  if (!topDiscard()) state.discardPile.push(drawFromDeck());
  appendNotice(`${starterName} starts the game.`);
  saveGame();
  render();
  resumeBotTurn();
}

function humanDrawDeck() {
  if (!canHumanAct("draw-deck")) return;
  state.drawnCard = drawFromDeck();
  state.drawnSource = "deck";
  state.turnStage = "deck-card-drawn";
  appendNotice(`You drew ${cardLabel(state.drawnCard)} from the deck.`);
  saveGame();
  render();
}

function humanTakeDiscard() {
  if (!canHumanAct("take-discard")) return;
  state.drawnCard = state.discardPile.pop();
  state.drawnSource = "discard";
  state.turnStage = "discard-card-taken";
  appendNotice(`You took ${cardLabel(state.drawnCard)} from discard.`);
  saveGame();
  render();
}

function humanDiscardDrawn() {
  if (!canHumanAct("discard-drawn")) return;
  state.discardPile.push(state.drawnCard);
  appendNotice(`You discarded ${cardLabel(state.drawnCard)}. Reveal one hidden card.`);
  state.drawnCard = null;
  state.drawnSource = null;
  state.turnStage = "reveal-after-discard";
  saveGame();
  render();
}

function handleBoardClick(event) {
  const button = event.target.closest("[data-player-id][data-slot-index]");
  if (!button) return;
  const player = state.players.find((entry) => entry.id === button.dataset.playerId);
  const index = Number(button.dataset.slotIndex);
  if (!player || player.bot || player.id !== "p-human" || state.busy) return;

  if (state.turnStage === "opening-reveal") {
    revealOpeningSlot(player, index);
    return;
  }

  if (player.id !== currentPlayer()?.id) return;

  if (state.turnStage === "deck-card-drawn" || state.turnStage === "discard-card-taken") {
    replaceSlotWithDrawn(player, index);
    completeTurn(player);
    return;
  }

  if (state.turnStage === "reveal-after-discard") {
    revealSlot(player, index);
    completeTurn(player);
  }
}

function replaceSlotWithDrawn(player, index) {
  const slot = player.grid[index];
  if (!state.drawnCard || !slot || slot.cleared) return;
  const replaced = slot.card;
  slot.card = state.drawnCard;
  slot.revealed = true;
  state.drawnCard = null;
  state.drawnSource = null;
  if (replaced) state.discardPile.push(replaced);
  const cleared = clearMatchingColumns(player);
  appendNotice(
    `${player.name} replaced a card with ${cardLabel(slot.card)}${cleared ? " and cleared a column" : ""}.`,
  );
}

function revealSlot(player, index) {
  const slot = player.grid[index];
  if (!slot || slot.cleared || slot.revealed) return;
  slot.revealed = true;
  const cleared = clearMatchingColumns(player);
  appendNotice(`${player.name} revealed ${cardLabel(slot.card)}${cleared ? " and cleared a column" : ""}.`);
}

function revealOpeningSlot(player, index) {
  const slot = player.grid[index];
  if (!slot || slot.revealed || openingRevealCount(player) >= 2) return;
  slot.revealed = true;
  appendNotice(`${player.name} revealed ${cardLabel(slot.card)}.`);
  saveGame();
  render();
  if (openingRevealCount(player) >= 2) {
    window.setTimeout(() => completeOpeningReveal(), 360);
  }
}

function clearMatchingColumns(player) {
  let clearedAny = false;
  for (let col = 0; col < COLS; col += 1) {
    const indexes = [col, col + COLS, col + COLS * 2];
    const slots = indexes.map((index) => player.grid[index]);
    if (
      slots.every((slot) => slot && !slot.cleared && slot.revealed && slot.card) &&
      slots.every((slot) => slot.card.value === slots[0].card.value)
    ) {
      slots.forEach((slot) => {
        slot.cleared = true;
        slot.revealed = true;
      });
      clearedAny = true;
    }
  }
  return clearedAny;
}

function completeTurn(player) {
  if (playerUncovered(player) && !state.finalTurnTriggerId) {
    state.finalTurnTriggerId = player.id;
    state.finalTurnRemainingIds = state.players
      .filter((entry) => entry.id !== player.id)
      .map((entry) => entry.id);
    appendNotice(`${player.name} turned over their last card. Everyone else gets one final turn.`);
  } else if (state.finalTurnTriggerId && player.id !== state.finalTurnTriggerId) {
    state.finalTurnRemainingIds = state.finalTurnRemainingIds.filter((id) => id !== player.id);
  }

  if (state.finalTurnTriggerId && !state.finalTurnRemainingIds.length) {
    endRound();
    return;
  }

  state.turnStage = "choose-source";
  advanceTurn();
  saveGame();
  render();
  resumeBotTurn();
}

function advanceTurn() {
  for (let step = 1; step <= state.players.length; step += 1) {
    const nextIndex = (state.currentPlayerIndex + step) % state.players.length;
    const nextPlayer = state.players[nextIndex];
    if (
      !state.finalTurnTriggerId ||
      state.finalTurnRemainingIds.includes(nextPlayer.id)
    ) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
  }
}

function endRound() {
  const rawScores = new Map();
  for (const player of state.players) {
    player.grid.forEach((slot) => {
      if (!slot.cleared) slot.revealed = true;
    });
    clearMatchingColumns(player);
    rawScores.set(player.id, roundScore(player));
  }

  const triggerScore = rawScores.get(state.finalTurnTriggerId);
  const lowestOther = Math.min(
    ...state.players
      .filter((player) => player.id !== state.finalTurnTriggerId)
      .map((player) => rawScores.get(player.id)),
  );
  const triggerDoubled =
    Number.isFinite(triggerScore) &&
    Number.isFinite(lowestOther) &&
    triggerScore > 0 &&
    triggerScore >= lowestOther;

  const results = {};
  const crossedTargetIds = [];
  const target = activeTargetScore();
  for (const player of state.players) {
    const previousScore = player.score;
    const raw = rawScores.get(player.id);
    const points = player.id === state.finalTurnTriggerId && triggerDoubled ? raw * 2 : raw;
    player.score += points;
    results[player.id] = { raw, points };
    if (previousScore < target && player.score >= target) {
      crossedTargetIds.push(player.id);
    }
  }

  const eligible = state.players.filter((player) => player.score >= target);
  const winner = eligible.length
    ? [...state.players].sort((left, right) => left.score - right.score)[0]
    : null;
  const targetHitPlayer = crossedTargetIds.length
    ? [...state.players]
        .filter((player) => crossedTargetIds.includes(player.id))
        .sort((left, right) => right.score - left.score)[0]
    : eligible.sort((left, right) => right.score - left.score)[0];

  state.pendingRoundSummary = {
    roundNumber: state.roundNumber,
    triggerId: state.finalTurnTriggerId,
    targetHitId: targetHitPlayer?.id ?? null,
    triggerDoubled,
    results,
  };
  state.roundHistory.push(state.pendingRoundSummary);
  state.winnerId = winner?.id ?? null;
  state.turnStage = winner ? "game-over" : "round-end";
  state.drawnCard = null;
  state.drawnSource = null;
  if (winner) syncSetupFromPlayers();
  appendNotice(
    winner
      ? `${winner.name} wins with ${winner.score} points.`
      : `Round ${state.roundNumber} complete.`,
  );
  saveGame();
  render();
}

function resumeBotTurn() {
  const player = currentPlayer();
  if (!state.gameStarted || state.busy || !player?.bot || !["choose-source"].includes(state.turnStage)) {
    return;
  }
  state.busy = true;
  render();
  window.setTimeout(() => {
    playBotTurn(player);
    state.busy = false;
    saveGame();
    render();
    resumeBotTurn();
  }, botTurnDelay());
}

function botTurnDelay() {
  return state.finalTurnTriggerId ? 1200 : 520;
}

function playBotTurn(player) {
  if (state.turnStage !== "choose-source") return;
  const discard = topDiscard();
  const bestSlot = chooseReplacementSlot(player, discard);
  const shouldTakeDiscard = discard && bestSlot && bestSlot.score >= replacementThreshold(player, bestSlot);

  if (shouldTakeDiscard) {
    state.drawnCard = state.discardPile.pop();
    state.drawnSource = "discard";
    replaceSlotWithDrawn(player, bestSlot.index);
    completeTurn(player);
    return;
  }

  const drawn = drawFromDeck();
  const drawnSlot = chooseReplacementSlot(player, drawn);
  if (drawnSlot && drawnSlot.score >= replacementThreshold(player, drawnSlot)) {
    state.drawnCard = drawn;
    state.drawnSource = "deck";
    replaceSlotWithDrawn(player, drawnSlot.index);
    completeTurn(player);
    return;
  }

  state.discardPile.push(drawn);
  const revealIndex = chooseRevealSlot(player);
  if (revealIndex >= 0) revealSlot(player, revealIndex);
  completeTurn(player);
}

function chooseReplacementSlot(player, card) {
  if (!card) return null;
  const difficulty = botDifficulty(player);
  const noise = difficulty === "easy" ? 2.6 : difficulty === "medium" ? 0.85 : 0.18;
  const slots = player.grid
    .map((slot, index) => {
      const baseScore = replacementScore(player, slot, index, card);
      return {
        slot,
        index,
        score: baseScore,
        sortScore: baseScore + randomBetween(-noise, noise),
      };
    })
    .filter((entry) => !entry.slot.cleared)
    .sort((left, right) => right.sortScore - left.sortScore);
  const best = slots[0];
  if (!best || best.score <= 0) return null;
  const nearBestWindow = difficulty === "easy" ? 2.4 : difficulty === "medium" ? 0.9 : 0.25;
  const nearBest = slots.filter((entry) => best.score - entry.score <= nearBestWindow && entry.score > 0);
  return sample(nearBest) || best;
}

function replacementScore(player, slot, index, card) {
  const currentEstimate = slot.revealed ? slot.card.value : hiddenSlotEstimate(player);
  let score = currentEstimate - card.value;
  const col = index % COLS;
  const columnMatches = [col, col + COLS, col + COLS * 2].filter((slotIndex) => {
    const candidate = player.grid[slotIndex];
    return candidate && !candidate.cleared && candidate.revealed && candidate.card.value === card.value;
  }).length;
  if (columnMatches >= 2) score += 18;
  if (!slot.revealed) score += 1.4;
  return score;
}

function replacementThreshold(player, slotEntry) {
  const difficulty = botDifficulty(player);
  const hiddenThreshold = difficulty === "easy" ? 3.6 : difficulty === "medium" ? 2.4 : 1.4;
  if (!slotEntry.slot.revealed) return hiddenThreshold;
  return difficulty === "easy" ? 2.8 : difficulty === "medium" ? 1.4 : 0.6;
}

function chooseRevealSlot(player) {
  const difficulty = botDifficulty(player);
  const hidden = player.grid
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => !entry.slot.cleared && !entry.slot.revealed);
  if (!hidden.length) return -1;
  if (difficulty === "easy" && Math.random() < 0.35) return sample(hidden).index;

  const columnOpportunities = hidden.filter((entry) => {
    const col = entry.index % COLS;
    const revealedValues = [col, col + COLS, col + COLS * 2]
      .map((index) => player.grid[index])
      .filter((slot) => slot && !slot.cleared && slot.revealed)
      .map((slot) => slot.card.value);
    return revealedValues.length === 2 && revealedValues[0] === revealedValues[1];
  });
  if (columnOpportunities.length) {
    const chance = difficulty === "hard" ? 0.96 : difficulty === "medium" ? 0.78 : 0.52;
    if (Math.random() < chance) return sample(columnOpportunities).index;
  }
  return sample(hidden).index;
}

function hiddenSlotEstimate(player) {
  const revealed = player.grid
    .filter((slot) => slot.revealed && !slot.cleared)
    .map((slot) => slot.card.value);
  if (!revealed.length) return 5;
  return Math.max(3, revealed.reduce((sum, value) => sum + value, 0) / revealed.length);
}

function tableCardProgress() {
  return state.players.reduce(
    (progress, player) => {
      for (const slot of player.grid) {
        if (slot.cleared) continue;
        progress.total += 1;
        if (slot.revealed) progress.faceUp += 1;
      }
      return progress;
    },
    { faceUp: 0, total: 0 },
  );
}

function render() {
  document.body.classList.toggle("game-active", state.gameStarted);
  renderSetupPanel();
  renderSessionControls();
  renderStatus();
  renderPiles();
  renderActions();
  renderPlayers();
  renderHistory();
}

function renderSetupPanel() {
  const lockPlayerSetup = setupLocked();
  if (lockPlayerSetup && state.players.length) {
    syncSetupFromPlayers();
  }
  if (els.setupFields) els.setupFields.hidden = lockPlayerSetup;
  moveTableControls(lockPlayerSetup);
  if (els.setupSummary) {
    els.setupSummary.hidden = !lockPlayerSetup;
    els.setupSummary.innerHTML = lockPlayerSetup ? setupSummaryMarkup() : "";
  }

  if (els.humanName) els.humanName.disabled = lockPlayerSetup;
  if (els.botCount) els.botCount.disabled = lockPlayerSetup;
  if (els.targetScore) els.targetScore.disabled = lockPlayerSetup;
  if (els.botNameFields) {
    els.botNameFields.querySelectorAll("input[data-bot-index], select[data-bot-difficulty-index]").forEach((field) => {
      field.disabled = lockPlayerSetup;
    });
  }
}

function moveTableControls(toTablePanel) {
  if (!els.tableControlBlock || !els.setupControlSlot || !els.tableControlSlot) return;
  const target = toTablePanel ? els.tableControlSlot : els.setupControlSlot;
  if (els.tableControlBlock.parentElement !== target) {
    target.appendChild(els.tableControlBlock);
  }
}

function setupSummaryMarkup() {
  const humanName = state.players.find((player) => !player.bot)?.name ?? "Player";
  const bots = state.players.filter((player) => player.bot);
  const botCount = bots.length;
  const botLabel = `${botCount} bot${botCount === 1 ? "" : "s"}`;
  const levelNames = [...new Set(bots.map((bot) => difficultyLabel(bot.difficulty)))];
  const levelLabel =
    levelNames.length === 1
      ? levelNames[0]
      : levelNames.length
        ? "Mixed"
        : "No bots";
  return `
    <div class="setup-summary-main">
      <strong>${escapeHtml(humanName)}</strong>
      <span>${escapeHtml(botLabel)}</span>
      <span>Target ${escapeHtml(activeTargetScore())}</span>
    </div>
    <div class="setup-summary-sub">
      <span>Bot level: ${escapeHtml(levelLabel)}</span>
    </div>
  `;
}

function renderSessionControls() {
  if (!els.savedSessionSelect) return;
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

  if (els.saveSessionBtn) els.saveSessionBtn.textContent = currentSession ? "Update Session" : "Save Session";
  if (els.loadSessionBtn) els.loadSessionBtn.disabled = !canLoadSelected;
  if (els.deleteSessionBtn) els.deleteSessionBtn.disabled = !canLoadSelected;
  els.savedSessionSelect.disabled = sessions.length === 0;
  if (els.downloadSessionBtn) els.downloadSessionBtn.disabled = !canExport;
  if (els.exportScoreKeeperBtn) {
    els.exportScoreKeeperBtn.disabled = !resolveScoreKeeperExportSession();
  }
  if (els.sessionToolsToggle) {
    els.sessionToolsToggle.hidden = !state.gameStarted;
    els.sessionToolsToggle.textContent = state.sessionToolsExpanded ? "Hide Sessions" : "Sessions";
    els.sessionToolsToggle.setAttribute(
      "aria-expanded",
      String(!(state.gameStarted && !state.sessionToolsExpanded)),
    );
  }
  if (els.sessionToolsBody) {
    els.sessionToolsBody.hidden = state.gameStarted && !state.sessionToolsExpanded;
  }

  if (!els.sessionStatus) return;
  if (state.sessionStatusMessage) {
    els.sessionStatus.textContent = state.sessionStatusMessage;
    return;
  }
  if (!sessions.length) {
    els.sessionStatus.textContent =
      "No saved sessions yet. Save on this device or download a JSON backup copy.";
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
  els.roundValue.textContent = state.gameStarted ? String(state.roundNumber) : "-";
  els.turnValue.textContent = player ? player.name : "-";
  els.targetValue.textContent = String(activeTargetScore());
  const progress = tableCardProgress();
  els.endValue.textContent = state.gameStarted ? `${progress.faceUp}/${progress.total} up` : "-";
  els.statusText.textContent = statusText();
  const leader = scoreLeader();
  els.leaderText.textContent = leader
    ? `${leader.name} leads with ${leader.score} points. Lowest score wins at ${activeTargetScore()}.`
    : "Scores and grids will appear here.";
  els.startGameBtn.textContent = primarySetupButtonText();
  els.startGameBtn.disabled = state.turnStage === "opening-reveal";
  renderStarterBanner();
  renderFinalTurnBanner();
  renderWinnerBanner();
}

function activeTargetScore() {
  return Number.isFinite(Number(state.targetScore)) ? Number(state.targetScore) : DEFAULT_TARGET_SCORE;
}

function renderStarterBanner() {
  if (!els.starterBanner) return;
  const starter = state.openingStarter;
  const show =
    state.gameStarted &&
    starter &&
    state.turnStage === "opening-ready";
  els.starterBanner.hidden = !show;
  if (!show) {
    els.starterBanner.innerHTML = "";
    return;
  }
  els.starterBanner.innerHTML = `
    <span class="starter-kicker">Lead</span>
    <strong>${escapeHtml(starter.name)} goes first</strong>
    <span>${escapeHtml(starter.total)} points</span>
  `;
}

function renderFinalTurnBanner() {
  if (!els.finalTurnBanner) return;
  const liveTrigger = state.players.find((player) => player.id === state.finalTurnTriggerId);
  const current = currentPlayer();
  const nextLastMoveId = state.finalTurnRemainingIds.includes(current?.id)
    ? current.id
    : state.finalTurnRemainingIds[0];
  const liveLastMovePlayer = state.players.find((player) => player.id === nextLastMoveId);
  const showLiveLastMove =
    state.gameStarted &&
    state.finalTurnTriggerId &&
    state.finalTurnRemainingIds.length > 0 &&
    !["round-end", "game-over"].includes(state.turnStage) &&
    liveTrigger &&
    liveLastMovePlayer;

  if (showLiveLastMove) {
    const lastMoveText = liveLastMovePlayer.bot
      ? `${liveLastMovePlayer.name} is taking their last move.`
      : "This is your last move.";
    els.finalTurnBanner.hidden = false;
    els.finalTurnBanner.innerHTML = `
      <strong>${escapeHtml(liveTrigger.name)} went out.</strong>
      <span>${escapeHtml(lastMoveText)}</span>
    `;
    return;
  }

  const summaryTriggerId = state.pendingRoundSummary?.triggerId;
  const summaryTrigger = state.players.find((player) => player.id === summaryTriggerId);
  const result = summaryTriggerId ? state.pendingRoundSummary?.results?.[summaryTriggerId] : null;
  const showSummary =
    state.gameStarted &&
    state.turnStage === "round-end" &&
    summaryTrigger &&
    result;
  els.finalTurnBanner.hidden = !showSummary;
  if (!showSummary) {
    els.finalTurnBanner.innerHTML = "";
    return;
  }

  const scoreText = state.pendingRoundSummary.triggerDoubled
    ? `(${result.raw}) x2 ${result.points}`
    : String(result.points);
  els.finalTurnBanner.innerHTML = `
    <strong>${escapeHtml(summaryTrigger.name)} went out with ${escapeHtml(scoreText)} points.</strong>
  `;
}

function renderWinnerBanner() {
  if (!els.winnerBanner) return;
  const winnerPlayer = winner();
  const show = state.gameStarted && state.turnStage === "game-over" && winnerPlayer;
  els.winnerBanner.hidden = !show;
  if (!show) {
    els.winnerBanner.innerHTML = "";
    return;
  }
  const scoreLabel = winnerPlayer.bot
    ? `${winnerPlayer.name}'s Final Score`
    : "Your Final Score";
  const targetHitPlayer = targetHitter();
  els.winnerBanner.innerHTML = `
    <span class="starter-kicker">Game winner</span>
    <strong>Congratulations, ${escapeHtml(winnerPlayer.name)}!</strong>
    <span>${escapeHtml(targetHitPlayer?.name ?? winnerPlayer.name)} hit ${escapeHtml(activeTargetScore())}. ${escapeHtml(scoreLabel)}: ${escapeHtml(winnerPlayer.score)} points.</span>
  `;
}

function renderPiles() {
  els.deckPreview.innerHTML = deckCardMarkup(state.deck.length);
  els.discardPreview.innerHTML = cardMarkup(topDiscard(), { small: true });
}

function renderActions() {
  const humanTurn = currentPlayer()?.id === "p-human" && !state.busy;
  els.actionHint.textContent = actionHint();
  const drawnSourceLabel =
    state.drawnSource === "deck"
      ? "Drawn from deck"
      : state.drawnSource === "discard"
        ? "Taken from discard"
        : "Drawn card";
  const drawnCardMarkup = state.drawnCard
    ? `<div class="drawn-card">${cardMarkup(state.drawnCard)}<span class="drawn-source-chip">${drawnSourceLabel}</span></div>`
    : `<div class="drawn-empty">No drawn card</div>`;
  els.tableDrawnCardWrap.innerHTML = drawnCardMarkup;
  els.currentCardHint.textContent = currentCardHint();

  els.drawDeckBtn.disabled = !humanTurn || !canHumanAct("draw-deck");
  els.takeDiscardBtn.disabled =
    !humanTurn || (!canHumanAct("take-discard") && !canHumanAct("discard-drawn"));
  els.takeDiscardBtn.classList.toggle("discard-target", canHumanAct("discard-drawn"));
  els.takeDiscardBtn.setAttribute(
    "aria-label",
    canHumanAct("discard-drawn") ? "Discard drawn card" : "Take discard",
  );
}

function renderPlayers() {
  if (!state.players.length) {
    moveCurrentCardPanelToDefaultPosition();
    els.playersBoard.innerHTML = `<div class="empty-board">Start a game to deal the SkyJo grids.</div>`;
    return;
  }
  moveCurrentCardPanelToDefaultPosition();
  els.playersBoard.innerHTML = state.players.map(playerMarkup).join("");
  positionCurrentCardPanel();
}

function positionCurrentCardPanel() {
  if (!els.currentCardPanel || !els.playersBoard) return;
  if (state.players.length === 4) {
    els.currentCardPanel.classList.add("in-player-grid");
    els.playersBoard.appendChild(els.currentCardPanel);
    return;
  }
  moveCurrentCardPanelToDefaultPosition();
}

function moveCurrentCardPanelToDefaultPosition() {
  if (!els.currentCardPanel || !els.tableArea || !els.roundHistoryPanel) return;
  els.currentCardPanel.classList.remove("in-player-grid");
  if (els.currentCardPanel.parentElement !== els.tableArea) {
    els.tableArea.insertBefore(els.currentCardPanel, els.roundHistoryPanel);
  }
}

function playerMarkup(player) {
  const current = player.id === currentPlayer()?.id && !["round-end", "game-over"].includes(state.turnStage);
  const trigger = player.id === state.finalTurnTriggerId;
  const selectable =
    player.id === "p-human" &&
    ((state.turnStage === "opening-reveal" && openingRevealCount(player) < 2) ||
      (current && ["deck-card-drawn", "discard-card-taken", "reveal-after-discard"].includes(state.turnStage)));
  const hiddenCount = hiddenCardCount(player);
  const roundTotal = roundScore(player, { revealedOnly: true });
  const openingTotal = openingRevealTotal(player);
  return `
    <article class="player-card ${current ? "current" : ""} ${trigger ? "trigger" : ""}">
      <div class="player-head">
        <div>
          <h3>${escapeHtml(player.name)}</h3>
          <p>${player.bot ? `Bot · ${difficultyLabel(player.difficulty)}` : "You"}${trigger ? " · ended round" : ""}</p>
        </div>
        <div class="player-stats">
          <span>${player.score} pts</span>
          <span>${hiddenCount} cards hidden</span>
          <span>${state.turnStage === "opening-reveal" ? `Lead Points: ${openingTotal}` : `Face-up Points: ${roundTotal}`}</span>
        </div>
      </div>
      <div class="skyjo-grid" style="--cols:${COLS}">
        ${player.grid.map((slot, index) => slotMarkup(player, slot, index, selectable)).join("")}
      </div>
    </article>
  `;
}

function slotMarkup(player, slot, index, selectable) {
  const canReplace = selectable && !slot.cleared && ["deck-card-drawn", "discard-card-taken"].includes(state.turnStage);
  const canOpeningReveal =
    selectable && !slot.cleared && !slot.revealed && state.turnStage === "opening-reveal";
  const canReveal =
    selectable && !slot.cleared && !slot.revealed && state.turnStage === "reveal-after-discard";
  const interactive = canReplace || canReveal || canOpeningReveal;
  const tag = interactive ? "button" : "div";
  const actionLabel = canOpeningReveal || canReveal ? "Reveal" : "Replace";
  const content = slot.cleared
    ? clearedCardMarkup(slot.card)
    : slot.revealed
      ? cardMarkup(slot.card)
      : hiddenCardMarkup();
  const dealIndex = dealAnimationIndex(slot.card?.id);
  const dealtClass = Number.isFinite(dealIndex) ? "dealt" : "";
  const style = Number.isFinite(dealIndex) ? `style="--deal-index: ${dealIndex}"` : "";
  return `
    <${tag}
      class="grid-slot ${slot.cleared ? "cleared" : ""} ${interactive ? "interactive" : ""} ${dealtClass}"
      ${style}
      ${interactive ? `type="button" data-player-id="${escapeHtml(player.id)}" data-slot-index="${index}" aria-label="${actionLabel} card ${index + 1}"` : ""}
    >
      ${content}
    </${tag}>
  `;
}

function dealAnimationIndex(cardId) {
  if (!cardId || !state.dealAnimationCardIds.length) return null;
  const index = state.dealAnimationCardIds.indexOf(cardId);
  return index >= 0 ? index : null;
}

function renderHistory() {
  if (els.roundHistoryOrderBtn) {
    els.roundHistoryOrderBtn.textContent =
      state.roundHistorySortDir === "desc" ? "Newest First" : "Oldest First";
    els.roundHistoryOrderBtn.disabled = state.roundHistory.length <= 1;
  }

  if (!state.roundHistory.length) {
    els.roundHistorySummary.textContent = state.gameStarted
      ? "Complete a round to start the table history."
      : "Start a game to track round-by-round results.";
    els.roundHistoryWrap.innerHTML = `<div class="empty-board">Round results will appear here once a round ends.</div>`;
    return;
  }
  els.roundHistorySummary.textContent = `${state.roundHistory.length} round${state.roundHistory.length === 1 ? "" : "s"} completed.`;
  const headCells = state.players
    .map((player) => `
      <th scope="col">
        <div class="history-player-head">
          <span class="history-player-name">${escapeHtml(player.name)}</span>
          <span class="history-player-points">${escapeHtml(`${player.score} pts`)}</span>
        </div>
      </th>
    `)
    .join("");
  const orderedHistory =
    state.roundHistorySortDir === "desc"
      ? [...state.roundHistory].reverse()
      : state.roundHistory;
  els.roundHistoryWrap.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th scope="col">Round</th>
          ${headCells}
          <th scope="col">Out</th>
        </tr>
      </thead>
      <tbody>
        ${orderedHistory.map(historyRowMarkup).join("")}
      </tbody>
    </table>
  `;
}

function historyRowMarkup(round) {
  const trigger = state.players.find((player) => player.id === round.triggerId);
  return `
    <tr>
      <th>R${round.roundNumber}</th>
      ${state.players.map((player) => {
        const result = round.results[player.id];
        const doubled = player.id === round.triggerId && round.triggerDoubled;
        const scoreText = result
          ? doubled
            ? `(${result.raw}) x2 ${result.points}`
            : String(result.points)
          : "-";
        return `<td>${escapeHtml(scoreText)}</td>`;
      }).join("")}
      <td>${escapeHtml(trigger?.name ?? "-")}</td>
    </tr>
  `;
}

function cardMarkup(card, options = {}) {
  if (!card) return `<span class="empty-card"></span>`;
  const colorClass = valueColorClass(card.value);
  const valueClass = cardValueClass(card.value);
  return `
    <span class="skyjo-card ${colorClass} ${options.small ? "small" : ""}">
      <span class="card-glow"></span>
      <span class="card-value ${valueClass}">${card.value}</span>
    </span>
  `;
}

function clearedCardMarkup(card) {
  if (!card) return `<span class="cleared-slot-card"></span>`;
  const valueClass = cardValueClass(card.value);
  return `
    <span class="cleared-slot-card">
      <span class="card-glow"></span>
      <span class="card-value ${valueClass}">${card.value}</span>
    </span>
  `;
}

function cardValueClass(value) {
  return String(value).length > 1 ? "card-value-wide" : "";
}

function hiddenCardMarkup() {
  return `
    <span class="skyjo-card card-back">
      <span class="back-pattern"></span>
    </span>
  `;
}

function deckCardMarkup(count) {
  return `
    <span class="skyjo-card deck-back">
      <span class="back-pattern"></span>
      <span class="deck-count">${count}</span>
    </span>
  `;
}

function valueColorClass(value) {
  if (value < 0) return "value-negative";
  if (value === 0) return "value-zero";
  if (value <= 4) return "value-low";
  if (value <= 8) return "value-mid";
  return "value-high";
}

function canHumanAct(action) {
  const humanTurn = state.gameStarted && currentPlayer()?.id === "p-human" && !state.busy;
  if (!humanTurn) return false;
  if (action === "draw-deck") return state.turnStage === "choose-source";
  if (action === "take-discard") return state.turnStage === "choose-source" && Boolean(topDiscard());
  if (action === "discard-drawn") {
    return (
      state.turnStage === "deck-card-drawn" &&
      Boolean(state.drawnCard) &&
      state.drawnSource === "deck" &&
      hiddenCardCount(currentPlayer()) > 0
    );
  }
  return false;
}

function statusText() {
  if (!state.gameStarted) return "Deal a table to begin.";
  if (state.turnStage === "opening-reveal") return "Choose two cards to set the lead.";
  if (state.turnStage === "opening-ready") return "Lead is set. Start the game when ready.";
  if (state.turnStage === "round-end") return "Round complete. Deal the next round when ready.";
  if (state.turnStage === "game-over") return "Game complete.";
  if (state.busy) return `${currentPlayer()?.name ?? "Bot"} is thinking.`;
  return actionHint();
}

function primarySetupButtonText() {
  if (state.turnStage === "opening-ready" && state.openingStarter) {
    return "Start Game";
  }
  if (state.turnStage === "opening-reveal") return "Choose 2 Cards";
  if (state.turnStage === "round-end" && state.pendingRoundSummary && !state.winnerId) {
    return "Deal Next Round";
  }
  if (!state.gameStarted) return "Set Lead";
  if (state.gameStarted) return state.winnerId ? "Start New Game" : "Restart Game";
  return "Start Game";
}

function actionHint() {
  const player = currentPlayer();
  if (!state.gameStarted) return "Start a game to deal the first round.";
  if (state.turnStage === "opening-reveal") {
    const human = state.players.find((entry) => entry.id === "p-human");
    const remaining = Math.max(0, 2 - openingRevealCount(human));
    return remaining === 1
      ? "Reveal one more lead card. Bots will reveal after you."
      : "Reveal two lead cards. Highest combined total starts the round.";
  }
  if (state.turnStage === "opening-ready") return "Lead is set. Press Start Game to begin live play.";
  if (state.turnStage === "round-end") return "Review the round scores, then deal the next round.";
  if (state.turnStage === "game-over") return `${winner()?.name ?? "The low score"} won the game.`;
  if (player?.bot) return `${player.name} is taking a turn.`;
  if (state.turnStage === "choose-source") return "Draw from the deck or take the discard pile card.";
  if (state.turnStage === "deck-card-drawn") return "Replace any grid card, or discard the drawn card and reveal a hidden card.";
  if (state.turnStage === "discard-card-taken") return "Replace any grid card with the discard card.";
  if (state.turnStage === "reveal-after-discard") return "Reveal one hidden card to finish your turn.";
  return "Choose your next move.";
}

function currentCardHint() {
  if (!state.gameStarted) return "Draw or take a card to choose where it goes.";
  if (state.turnStage === "opening-reveal") return "Lead cards reveal directly on your grid.";
  if (state.turnStage === "opening-ready") return "Lead is set. Press Start Game to turn up the discard and begin.";
  if (state.turnStage === "deck-card-drawn") {
    return "Place this card on any grid slot, or discard it and reveal a hidden card.";
  }
  if (state.turnStage === "discard-card-taken") {
    return "Place this discard card on any grid slot.";
  }
  if (state.turnStage === "reveal-after-discard") return "Reveal one hidden grid card to finish your turn.";
  if (state.turnStage === "round-end") return "Round complete. Deal the next round when ready.";
  if (state.turnStage === "game-over") return "Game complete.";
  return "Draw from the deck or take the top discard.";
}

function currentPlayer() {
  return state.players[state.currentPlayerIndex] || null;
}

function topDiscard() {
  return state.discardPile[state.discardPile.length - 1] || null;
}

function hiddenCardCount(player) {
  return player.grid.filter((slot) => !slot.cleared && !slot.revealed).length;
}

function openingRevealCount(player) {
  return player?.grid?.filter((slot) => slot.revealed && !slot.cleared).length ?? 0;
}

function openingRevealTotal(player) {
  return player?.grid?.reduce((sum, slot) => {
    if (!slot.revealed || slot.cleared) return sum;
    return sum + (slot.card?.value ?? 0);
  }, 0) ?? 0;
}

function openingRevealStandings() {
  return state.players
    .map((player, seatIndex) => ({
      id: player.id,
      name: player.name,
      total: openingRevealTotal(player),
      seatIndex,
    }))
    .sort((left, right) => right.total - left.total || left.seatIndex - right.seatIndex);
}

function playerUncovered(player) {
  return hiddenCardCount(player) === 0;
}

function roundScore(player, options = {}) {
  return player.grid.reduce((sum, slot) => {
    if (slot.cleared) return sum;
    if (options.revealedOnly && !slot.revealed) return sum;
    return sum + (slot.card?.value ?? 0);
  }, 0);
}

function scoreLeader() {
  return state.players.length
    ? [...state.players].sort((left, right) => left.score - right.score)[0]
    : null;
}

function winner() {
  return state.players.find((player) => player.id === state.winnerId) || null;
}

function targetHitter() {
  const targetHitId = state.pendingRoundSummary?.targetHitId;
  const recorded = state.players.find((player) => player.id === targetHitId);
  if (recorded) return recorded;
  return state.players
    .filter((player) => player.score >= activeTargetScore())
    .sort((left, right) => right.score - left.score)[0] || null;
}

function cardLabel(card) {
  return card ? String(card.value) : "no card";
}

function cleanName(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeBotDifficulty(value) {
  return BOT_DIFFICULTIES.includes(value) ? value : "medium";
}

function difficultyLabel(value) {
  const normalized = normalizeBotDifficulty(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function botDifficulty(player) {
  return normalizeBotDifficulty(player?.difficulty);
}

function sample(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendNotice(message) {
  els.eventNotice.hidden = false;
  els.eventNotice.textContent = message;
}

function readStoredSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
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
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
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
    name: cleanName(session.name, "SkyJo Session"),
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
  return cloneJson({
    ...state,
    dealAnimationCardIds: [],
  });
}

function applySessionPayload(payload, options = {}) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.players)) return false;
  Object.assign(state, cloneJson(payload), {
    busy: false,
    currentSessionId: options.currentSessionId ?? payload.currentSessionId ?? null,
  });
  normalizeLoadedPlayers();
  normalizeSetupBotDifficulties();
  state.dealAnimationCardIds = [];
  state.roundHistorySortDir = normalizeRoundHistorySortDir(state.roundHistorySortDir);
  state.targetScore = activeTargetScore();
  state.drawnSource = state.drawnCard ? (state.drawnSource ?? "deck") : null;
  syncSetupFromPlayers();
  syncTargetInput();
  saveGame();
  return true;
}

function sessionOptionLabel(session) {
  const players = Array.isArray(session.payload?.players) ? session.payload.players.length : 0;
  const round = Math.max(1, Math.min(999, Math.trunc(Number(session.payload?.roundNumber) || 1)));
  return `${session.name} • ${players}P • Round ${round}`;
}

function defaultSessionName(payload = snapshotState()) {
  const names = Array.isArray(payload.players)
    ? payload.players.map((player) => cleanName(player?.name, "")).filter(Boolean)
    : [];
  const lead = names.slice(0, 3).join(", ") || "SkyJo";
  const round = Math.max(1, Math.min(999, Math.trunc(Number(payload.roundNumber) || 1)));
  return `${lead} - Round ${round}`;
}

function sanitizeFileName(name) {
  const base = String(name || "skyjo-session")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return base || "skyjo-session";
}

function exportDateStamp(date = new Date()) {
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}-${date.getFullYear()}`;
}

function exportTimeStamp(date = new Date()) {
  const rawHours = Number(date.getHours()) || 0;
  const suffix = rawHours >= 12 ? "PM" : "AM";
  const hours = String(rawHours % 12 || 12).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}${minutes}${suffix}`;
}

function exportPlayerNameSegment(payload = snapshotState()) {
  const names = Array.isArray(payload.players)
    ? payload.players
        .map((player) => sanitizeFileName(cleanName(player?.name, "")).slice(0, 8))
        .filter(Boolean)
    : [];
  return names.length ? names.join("_") : "session";
}

function exportFileNameForSession(exportable, when = new Date()) {
  const payload = exportable?.payload || snapshotState();
  return `${exportDateStamp(when)}_skyjo_${exportPlayerNameSegment(payload)}_${exportTimeStamp(when)}.json`;
}

function exportFileNameForScoreKeeper(exportable, when = new Date()) {
  const payload = exportable?.sourcePayload || exportable?.scorekeeperPayload || snapshotState();
  return `${exportDateStamp(when)}_scorekeeper_skyjo_${exportPlayerNameSegment(payload)}_${exportTimeStamp(when)}.json`;
}

function showSessionMessage(message) {
  state.sessionStatusMessage = String(message || "");
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

  const name = cleanName(requestedName, defaultSessionName());
  const id = currentSession?.id || uid();
  const now = Date.now();
  const payload = cloneJson({ ...snapshotState(), currentSessionId: id });
  const nextRecord = {
    id,
    name,
    payload,
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

  if (!applySessionPayload(session.payload, { currentSessionId: session.id })) {
    showSessionMessage("That saved session could not be loaded.");
    return;
  }

  state.selectedSessionId = session.id;
  state.sessionStatusMessage = `Session loaded: ${session.name}.`;
  render();
  resumeBotTurn();
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

  if (state.currentSessionId === session.id) state.currentSessionId = null;
  state.selectedSessionId = "";
  showSessionMessage(`Deleted session: ${session.name}.`);
}

function resolveExportSession() {
  if (state.gameStarted && state.players.length) {
    const current = state.currentSessionId ? getSessionById(state.currentSessionId) : null;
    return {
      id: current?.id || null,
      name: current?.name || defaultSessionName(),
      payload: snapshotState(),
    };
  }

  const selected = state.selectedSessionId ? getSessionById(state.selectedSessionId) : null;
  if (!selected) return null;
  return {
    id: selected.id,
    name: selected.name,
    payload: cloneJson(selected.payload),
  };
}

function resolveScoreKeeperExportSession() {
  const current = resolveExportSession();
  if (!current || !current.payload?.roundHistory?.length) return null;
  const scorekeeperPayload = scoreKeeperPayloadFromSkyJo(current.payload);
  if (!scorekeeperPayload) return null;
  return {
    id: current.id,
    name: current.name,
    sourcePayload: cloneJson(current.payload),
    scorekeeperPayload,
  };
}

function scoreKeeperPayloadFromSkyJo(payload) {
  if (!payload || !Array.isArray(payload.players) || !Array.isArray(payload.roundHistory)) {
    return null;
  }
  const players = payload.players.map((player, index) => ({
    id: String(player.id || `p-${index + 1}`),
    name: cleanName(player.name, `Player ${index + 1}`),
  }));
  if (!players.length || !payload.roundHistory.length) return null;

  const playerIds = new Set(players.map((player) => player.id));
  const rounds = payload.roundHistory.map((round, index) => {
    const scores = Object.fromEntries(
      players.map((player) => {
        const raw = Number(round.results?.[player.id]?.raw ?? 0);
        return [player.id, Number.isFinite(raw) ? Math.trunc(raw) : 0];
      }),
    );
    const wentOutId = playerIds.has(round.triggerId) ? round.triggerId : null;
    return {
      n: index + 1,
      scores,
      ts: Number(round.ts) || Date.now(),
      skyjoWentOutPlayerId: wentOutId,
      skyjoSourceRoundNumber: Number(round.roundNumber) || index + 1,
      skyjoTargetHitId: playerIds.has(round.targetHitId) ? round.targetHitId : null,
    };
  });
  const winnerId = playerIds.has(payload.winnerId) ? payload.winnerId : null;
  const target = Number.isFinite(Number(payload.targetScore))
    ? Math.trunc(Number(payload.targetScore))
    : DEFAULT_TARGET_SCORE;
  const winnerMilestones = winnerId
    ? [{ winnerId, roundN: rounds.length, target, ts: Date.now() }]
    : [];
  return {
    mode: winnerId ? "finished" : "playing",
    presetKey: "skyjo",
    customGameName: "",
    heartsDeckCount: 1,
    target,
    winMode: "low",
    players,
    roundEntryOrder: players.map((player) => player.id),
    playerInactiveRanges: {},
    teams: null,
    rounds,
    winnerId,
    quizTieIds: [],
    gameState: winnerId ? "completed" : "in_progress",
    firstWinnerAt: winnerMilestones[0] || null,
    finalWinnerAt: winnerMilestones[winnerMilestones.length - 1] || null,
    winnerMilestones,
    sortByTotal: false,
    historySortDir: normalizeRoundHistorySortDir(payload.roundHistorySortDir),
    showHistoryTotals: true,
    spadesPartnerIndex: 2,
    presetNote: "Lowest score wins. Negative scores possible.",
    skyjoCurrentRoundWentOutPlayerId: null,
    rummikubCurrentRoundWinnerId: null,
    currentSessionId: null,
  };
}

function exportSessionFile() {
  const exportable = resolveExportSession();
  if (!exportable) {
    showSessionMessage("Nothing to export yet.");
    return null;
  }

  const bundle = {
    app: "skyjo-table",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    session: {
      id: exportable.id,
      name: exportable.name,
    },
    payload: exportable.payload,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
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

function exportScoreKeeperFile() {
  const exportable = resolveScoreKeeperExportSession();
  if (!exportable) {
    showSessionMessage("Complete at least one round before exporting to ScoreKeeper.");
    return null;
  }

  const bundle = {
    app: "dashboard-game-export",
    version: EXPORT_VERSION,
    sourceGame: "skyjo-table",
    scorekeeperPreset: "skyjo",
    exportedAt: new Date().toISOString(),
    session: {
      id: exportable.id,
      name: exportable.name,
    },
    scorekeeperPayload: exportable.scorekeeperPayload,
    sourcePayload: exportable.sourcePayload,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileNameForScoreKeeper(exportable);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showSessionMessage(`Downloaded ScoreKeeper JSON: ${exportable.name}.`);
  return exportable;
}

function parseImportedSession(json, filename = "") {
  if (!json || typeof json !== "object") return null;
  const payload =
    json.app === "skyjo-table" && json.payload && typeof json.payload === "object"
      ? json.payload
      : json.payload && typeof json.payload === "object"
        ? json.payload
        : json;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.players)) return null;

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
      showSessionMessage("That file is not a valid SkyJo session.");
      return;
    }

    const nextSessions = [
      imported,
      ...readStoredSessions().filter((session) => session.id !== imported.id),
    ].sort((left, right) => right.updatedAt - left.updatedAt);
    if (!writeStoredSessions(nextSessions)) {
      showSessionMessage("Unable to import that session.");
      return;
    }

    if (!applySessionPayload(imported.payload, { currentSessionId: imported.id })) {
      showSessionMessage("Imported file could not be loaded.");
      return;
    }

    state.selectedSessionId = imported.id;
    state.sessionStatusMessage = `Session imported: ${imported.name}.`;
    render();
    resumeBotTurn();
  } catch {
    showSessionMessage("Import failed. Check that the file contains valid JSON.");
  } finally {
    if (els.importSessionFile) els.importSessionFile.value = "";
  }
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState()));
  } catch {}
}

function hydrateSavedGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.players)) return;
    Object.assign(state, saved, { busy: false });
    normalizeLoadedPlayers();
    normalizeSetupBotDifficulties();
    state.dealAnimationCardIds = [];
    state.roundHistorySortDir = normalizeRoundHistorySortDir(state.roundHistorySortDir);
    state.targetScore = activeTargetScore();
    state.drawnSource = state.drawnCard ? (state.drawnSource ?? "deck") : null;
    syncSetupFromPlayers();
    syncTargetInput();
  } catch {}
}

function normalizeRoundHistorySortDir(value) {
  return value === "desc" ? "desc" : "asc";
}

function normalizeLoadedPlayers() {
  state.players = Array.isArray(state.players)
    ? state.players.map((player) => ({
        ...player,
        bot: Boolean(player.bot),
        difficulty: player.bot ? normalizeBotDifficulty(player.difficulty) : null,
      }))
    : [];
}

function normalizeSetupBotDifficulties() {
  state.setupBotDifficulties = Array.from({ length: 3 }, (_, index) =>
    normalizeBotDifficulty(state.setupBotDifficulties?.[index]),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

bindEvents();
renderBotNameFields();
hydrateSavedGame();
render();
resumeBotTurn();
