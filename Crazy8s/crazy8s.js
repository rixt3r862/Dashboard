const BOT_NAMES = window.GameRoom?.BOT_NAMES || ["Nick", "Sam", "Nate", "Garth", "Kyle", "Kip"];
const BOT_DIFFICULTIES = window.GameRoom?.botDifficultyLevels?.("standard") || ["easy", "medium", "hard"];
const DEFAULT_TARGET_SCORE = 100;
const DEFAULT_PLAYER_COUNT = 4;
const DEAL_SIZE = 5;
const MAX_DRAWS_PER_TURN = 5;
const BOT_TURN_DELAY_MS = 900;
const DEAL_ANIMATION_MS = 900;
const PLAY_ANIMATION_MS = 620;
const DRAW_ANIMATION_MS = 540;
const STORAGE_SESSIONS_KEY = "dashboard.crazy8s.sessions";
const SESSION_EXPORT_VERSION = 1;
const SUITS = ["clubs", "diamonds", "spades", "hearts"];
const SUIT_SYMBOLS = { clubs: "♣", diamonds: "♦", spades: "♠", hearts: "♥" };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 50, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };

let botTurnTimer = null;
let botTurnToken = 0;

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  roundNumber: 1,
  targetScore: DEFAULT_TARGET_SCORE,
  playerCount: DEFAULT_PLAYER_COUNT,
  currentPlayerIndex: 0,
  stage: "setup",
  drawPile: [],
  discardPile: [],
  currentSuit: null,
  pendingEightCardId: null,
  drawsThisTurn: 0,
  dealAnimationTimer: null,
  dealAnimationActive: false,
  discardAnimationTimer: null,
  discardAnimationCardId: "",
  discardAnimationDirection: "",
  drawAnimationTimers: [],
  drawingToHandIds: [],
  roundHistory: [],
  historySortDir: "desc",
  setupBotNames: [],
  setupBotDifficulties: [],
  sessionExpanded: true,
  winnerId: null,
  notice: "",
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
  playerCount: document.getElementById("playerCount"),
  targetScore: document.getElementById("targetScore"),
  setupFields: document.getElementById("setupFields"),
  setupSummary: document.getElementById("setupSummary"),
  botNameFields: document.getElementById("botNameFields"),
  shuffleBotNamesBtn: document.getElementById("shuffleBotNamesBtn"),
  samePlayersBtn: document.getElementById("samePlayersBtn"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  suitValue: document.getElementById("suitValue"),
  drawValue: document.getElementById("drawValue"),
  actionHint: document.getElementById("actionHint"),
  actionControls: document.getElementById("actionControls"),
  eventNotice: document.getElementById("eventNotice"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
  sessionPanel: document.getElementById("sessionPanel"),
  sessionTools: document.getElementById("sessionTools"),
  sessionToggleBtn: document.getElementById("sessionToggleBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  downloadSessionBtn: document.getElementById("downloadSessionBtn"),
  importSessionBtn: document.getElementById("importSessionBtn"),
  importSessionFile: document.getElementById("importSessionFile"),
  exportScoreKeeperBtn: document.getElementById("exportScoreKeeperBtn"),
  sessionStatus: document.getElementById("sessionStatus"),
  winnerBanner: document.getElementById("winnerBanner"),
  scoreBoard: document.getElementById("scoreBoard"),
  leaderText: document.getElementById("leaderText"),
  opponentTop: document.getElementById("opponentTop"),
  opponentLeft: document.getElementById("opponentLeft"),
  opponentRight: document.getElementById("opponentRight"),
  humanSeat: document.getElementById("humanSeat"),
  drawPileBtn: document.getElementById("drawPileBtn"),
  drawPileCount: document.getElementById("drawPileCount"),
  discardPile: document.getElementById("discardPile"),
  declaredSuit: document.getElementById("declaredSuit"),
  suitControls: document.getElementById("suitControls"),
  passTurnBtn: document.getElementById("passTurnBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  historySummary: document.getElementById("historySummary"),
  historyOrderBtn: document.getElementById("historyOrderBtn"),
  historyWrap: document.getElementById("historyWrap"),
};

const escapeHtml = window.GameRoom?.escapeHtml || ((value) => String(value ?? ""));
const uid = window.GameRoom?.uid || (() => Math.random().toString(36).slice(2, 10));
const cloneJson = window.GameRoom?.cloneJson || ((value) => JSON.parse(JSON.stringify(value)));
const downloadJson = window.GameRoom?.downloadJson || fallbackDownloadJson;
const readStoredJson = window.GameRoom?.readStoredJson || ((key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)));
const writeStoredJson = window.GameRoom?.writeStoredJson || ((key, value) => (localStorage.setItem(key, JSON.stringify(value)), true));
const clampInteger = window.GameRoom?.clampInteger || ((value, min, max, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.trunc(numeric))) : fallback;
});
const setupBotNames = window.GameRoom?.setupBotNames || ((count, humanName) => BOT_NAMES.filter((name) => name !== humanName).slice(0, count));
const setupBotDifficulties = window.GameRoom?.setupBotDifficulties || ((count) => Array.from({ length: count }, () => "medium"));
const difficultyLabel = window.GameRoom?.difficultyLabel || ((value) => value.charAt(0).toUpperCase() + value.slice(1));
const normalizeBotDifficulty = window.GameRoom?.normalizeBotDifficulty || ((value) => BOT_DIFFICULTIES.includes(value) ? value : "medium");
const toggleHistorySortDir = window.GameRoom?.toggleHistorySortDir || ((value) => value === "desc" ? "asc" : "desc");
const orderedHistory = window.GameRoom?.orderedHistory || ((entries, dir) => dir === "desc" ? entries.slice().reverse() : entries.slice());
const renderHistorySortControl = window.GameRoom?.renderHistorySortControl || ((button, dir) => { button.textContent = dir === "desc" ? "Newest First" : "Oldest First"; });
const sessionExportBundle = window.GameRoom?.sessionExportBundle || ((options) => options);
const scoreKeeperExportBundle = window.GameRoom?.scoreKeeperExportBundle || ((options) => options);
const scoreKeeperPlayers = window.GameRoom?.scoreKeeperPlayers || ((players) => players.map(({ id, name }) => ({ id, name })));
const scoreKeeperRound = window.GameRoom?.scoreKeeperRound || ((index, scores, options = {}) => ({ n: index + 1, scores, ...options }));
const scoreKeeperPayloadBase = window.GameRoom?.scoreKeeperPayloadBase || ((options) => options);
const sessionStatusText = window.GameRoom?.sessionStatusText || ((options) => options.sessions?.length ? `${options.sessions.length} saved sessions on this device.` : "No saved sessions yet. Save on this device or download a JSON backup copy.");
const sessionToggleLabel = window.GameRoom?.sessionToggleLabel || ((expanded) => expanded ? "Hide Sessions" : "Sessions");
const sessionSelectPlaceholder = window.GameRoom?.sessionSelectPlaceholder || (() => "Saved sessions on this device");
const sessionSaveButtonLabel = window.GameRoom?.sessionSaveButtonLabel || (() => "Save Session");
const winnerBannerMarkup = window.GameRoom?.winnerBannerMarkup || ((options) => `<strong>${escapeHtml(options.winnerName)}</strong><span>${escapeHtml(options.message)}</span>`);
const slugify = window.GameRoom?.slugify || ((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "session");

function bindEvents() {
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.gameStarted && !state.winnerId && !window.confirm("Restart this Crazy 8s table?")) return;
    startNewGame();
  });
  els.playerCount.addEventListener("change", () => {
    ensureSetupBotNames();
    renderBotNameFields();
  });
  els.shuffleBotNamesBtn.addEventListener("click", () => {
    syncSetupBotDifficultiesFromInputs();
    shuffleSetupBotNames();
    renderBotNameFields({ syncFromInputs: false });
  });
  els.samePlayersBtn.addEventListener("click", () => {
    if (!state.gameStarted || !state.winnerId || !state.players.length) return;
    startNewGame({ samePlayers: true });
  });
  els.resetTableBtn.addEventListener("click", () => {
    if (state.gameStarted && !state.winnerId && !window.confirm("Reset this Crazy 8s table?")) return;
    resetState();
    shuffleSetupBotNames();
    renderBotNameFields({ syncFromInputs: false });
    render();
  });
  els.drawPileBtn.addEventListener("click", drawForHuman);
  els.passTurnBtn.addEventListener("click", passHumanTurn);
  els.nextRoundBtn.addEventListener("click", dealNextRound);
  els.humanHand.addEventListener("click", handleHandClick);
  els.suitControls.addEventListener("click", handleSuitChoice);
  els.sessionToggleBtn.addEventListener("click", () => {
    state.sessionExpanded = !state.sessionExpanded;
    renderSessionControls();
  });
  els.historyOrderBtn.addEventListener("click", () => {
    state.historySortDir = toggleHistorySortDir(state.historySortDir);
    renderHistory();
  });
  els.saveSessionBtn.addEventListener("click", saveSession);
  els.loadSessionBtn.addEventListener("click", loadSelectedSession);
  els.deleteSessionBtn.addEventListener("click", deleteSelectedSession);
  els.downloadSessionBtn.addEventListener("click", downloadSession);
  els.importSessionBtn.addEventListener("click", () => els.importSessionFile.click());
  els.importSessionFile.addEventListener("change", () => importSessionFile(els.importSessionFile.files?.[0]));
  els.exportScoreKeeperBtn.addEventListener("click", exportScoreKeeper);
}

function startNewGame(options = {}) {
  const samePlayers = Boolean(options.samePlayers);
  const previousPlayers = samePlayers ? state.players.map((player) => ({
    id: player.id,
    name: player.name,
    bot: player.bot,
    difficulty: player.difficulty,
  })) : [];
  const targetScore = samePlayers ? state.targetScore : readTargetScore();
  const playerCount = samePlayers ? previousPlayers.length : readPlayerCount();
  resetState();
  state.gameStarted = true;
  state.sessionExpanded = false;
  state.targetScore = targetScore;
  state.playerCount = playerCount;
  state.players = samePlayers && previousPlayers.length >= 2
    ? previousPlayers.map((player) => createPlayer(player.id, player.name, player.bot, player.difficulty))
    : createPlayers();
  dealRound();
}

function resetState() {
  cancelPendingBotTurn();
  clearDealAnimationTimer();
  clearDiscardAnimationTimer();
  clearDrawAnimationTimers();
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.roundNumber = 1;
  state.targetScore = DEFAULT_TARGET_SCORE;
  state.playerCount = DEFAULT_PLAYER_COUNT;
  state.currentPlayerIndex = 0;
  state.stage = "setup";
  state.drawPile = [];
  state.discardPile = [];
  state.currentSuit = null;
  state.pendingEightCardId = null;
  state.drawsThisTurn = 0;
  state.dealAnimationActive = false;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.roundHistory = [];
  state.historySortDir = "desc";
  state.sessionExpanded = true;
  state.winnerId = null;
  state.notice = "";
}

function createPlayers() {
  const humanName = cleanName(els.humanName.value, "Rick");
  const botCount = readPlayerCount() - 1;
  syncSetupBotDifficultiesFromInputs();
  ensureSetupBotNames();
  return [
    createPlayer("p1", humanName, false, "human"),
    ...Array.from({ length: botCount }, (_, index) =>
      createPlayer(`p${index + 2}`, cleanName(state.setupBotNames[index], `Bot ${index + 1}`), true, state.setupBotDifficulties[index])),
  ];
}

function createPlayer(id, name, bot, difficulty = "medium") {
  return {
    id,
    name: cleanName(name, bot ? "Bot" : "Player"),
    bot: Boolean(bot),
    difficulty: bot ? normalizeBotDifficulty(difficulty, { kind: "standard" }) : "human",
    score: 0,
    hand: [],
  };
}

function dealRound() {
  cancelPendingBotTurn();
  clearDealAnimationTimer();
  clearDiscardAnimationTimer();
  clearDrawAnimationTimers();
  const deck = shuffle(createDeck());
  state.players.forEach((player) => {
    player.hand = [];
  });
  for (let cardIndex = 0; cardIndex < DEAL_SIZE; cardIndex += 1) {
    state.players.forEach((player) => {
      player.hand.push(deck.pop());
    });
  }
  state.drawPile = deck;
  state.discardPile = [];
  revealStarterDiscard();
  state.currentPlayerIndex = (state.roundNumber - 1) % state.players.length;
  state.stage = "playing";
  state.drawsThisTurn = 0;
  state.pendingEightCardId = null;
  state.dealAnimationActive = true;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.busy = false;
  state.notice = `${currentPlayer().name} starts round ${state.roundNumber}.`;
  sortHands();
  render();
  startDealAnimationTimer();
  scheduleBotTurnIfNeeded();
}

function dealNextRound() {
  if (!state.gameStarted || state.stage !== "roundOver") return;
  state.roundNumber += 1;
  state.stage = "playing";
  dealRound();
}

function revealStarterDiscard() {
  while (state.drawPile.length) {
    const card = state.drawPile.pop();
    if (card.rank === "8") {
      state.drawPile.splice(Math.floor(Math.random() * (state.drawPile.length + 1)), 0, card);
      continue;
    }
    state.discardPile.push(card);
    state.currentSuit = card.suit;
    return;
  }
}

function handleHandClick(event) {
  const button = event.target.closest("[data-card-id]");
  if (!button || !isHumanTurn() || state.stage !== "playing" || state.busy || state.dealAnimationActive || state.pendingEightCardId) return;
  const card = humanPlayer().hand.find((entry) => entry.id === button.dataset.cardId);
  if (!card || !isPlayable(card)) {
    state.notice = card ? `${cardLabel(card)} cannot be played on ${topDiscardLabel()}.` : "";
    renderNotice();
    return;
  }
  playCard(humanPlayer(), card);
}

function drawForHuman() {
  const player = currentPlayer();
  if (!isHumanTurn() || state.stage !== "playing" || state.busy || state.dealAnimationActive || state.pendingEightCardId) return;
  if (legalCards(player).length || state.drawsThisTurn >= MAX_DRAWS_PER_TURN || !canDrawCard()) return;
  const card = drawOne(player);
  if (!card) return;
  state.drawsThisTurn += 1;
  const remaining = Math.max(0, MAX_DRAWS_PER_TURN - state.drawsThisTurn);
  state.notice = isPlayable(card)
    ? `${player.name} drew ${cardLabel(card)}. It can be played.`
    : remaining
      ? `${player.name} drew one card. ${remaining} draw${remaining === 1 ? "" : "s"} left this turn.`
      : `${player.name} drew a fifth card and must pass if still blocked.`;
  render();
}

function passHumanTurn() {
  if (!isHumanTurn() || state.stage !== "playing" || state.busy || state.dealAnimationActive || state.pendingEightCardId) return;
  if (legalCards(currentPlayer()).length) {
    state.notice = "You have a playable card.";
    renderNotice();
    return;
  }
  if (state.drawsThisTurn < MAX_DRAWS_PER_TURN && canDrawCard()) {
    state.notice = `Draw up to ${MAX_DRAWS_PER_TURN} cards before passing.`;
    renderNotice();
    return;
  }
  advanceTurn(`${currentPlayer().name} passed.`);
}

function handleSuitChoice(event) {
  const button = event.target.closest("[data-suit]");
  if (!button || !isHumanTurn() || !state.pendingEightCardId) return;
  declareSuit(button.dataset.suit, humanPlayer());
}

function playCard(player, card, options = {}) {
  if (!isPlayable(card)) return false;
  player.hand = player.hand.filter((entry) => entry.id !== card.id);
  state.discardPile.push(card);
  state.currentSuit = card.suit;
  state.drawsThisTurn = 0;
  markDiscardAnimation(card.id, seatDirection(playerIndex(player)));
  if (card.rank === "8" && !options.declaredSuit) {
    state.pendingEightCardId = card.id;
    state.notice = `${player.name} played an 8. Choose the next suit.`;
    render();
    return true;
  }
  if (card.rank === "8") {
    state.currentSuit = options.declaredSuit;
  }
  state.notice = `${player.name} played ${cardLabel(card)}${card.rank === "8" ? ` and called ${suitLabel(state.currentSuit)}` : ""}.`;
  if (player.hand.length === 0) {
    finishRound(player);
    return true;
  }
  advanceTurn();
  return true;
}

function declareSuit(suit, player) {
  if (!SUITS.includes(suit)) return;
  state.currentSuit = suit;
  state.pendingEightCardId = null;
  state.notice = `${player.name} called ${suitLabel(suit)}.`;
  if (player.hand.length === 0) {
    finishRound(player);
    return;
  }
  advanceTurn();
}

function advanceTurn(message = "") {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.drawsThisTurn = 0;
  state.busy = false;
  if (message) state.notice = message;
  render();
  scheduleBotTurnIfNeeded();
}

function scheduleBotTurnIfNeeded() {
  cancelPendingBotTurn();
  if (!state.gameStarted || state.stage !== "playing" || state.dealAnimationActive || state.pendingEightCardId || !currentPlayer()?.bot) return;
  state.busy = true;
  render();
  const token = ++botTurnToken;
  botTurnTimer = window.setTimeout(() => {
    if (token !== botTurnToken) return;
    takeBotTurn();
  }, BOT_TURN_DELAY_MS);
}

function takeBotTurn() {
  const player = currentPlayer();
  if (!player?.bot || state.stage !== "playing") return;
  let playable = legalCards(player);
  if (playable.length) {
    const card = chooseBotCard(player, playable);
    const declaredSuit = card.rank === "8" ? chooseBotSuit(player, card) : null;
    playCard(player, card, { declaredSuit });
    state.pendingEightCardId = null;
    return;
  }
  let draws = 0;
  let drawnCard = null;
  while (draws < MAX_DRAWS_PER_TURN && !playable.length && canDrawCard()) {
    drawnCard = drawOne(player);
    draws += drawnCard ? 1 : 0;
    playable = legalCards(player);
  }
  if (playable.length) {
    const preferredDrawnCard = drawnCard && isPlayable(drawnCard) ? drawnCard : null;
    const card = preferredDrawnCard || chooseBotCard(player, playable);
    const declaredSuit = card.rank === "8" ? chooseBotSuit(player, card) : null;
    playCard(player, card, { declaredSuit });
    state.pendingEightCardId = null;
    return;
  }
  advanceTurn(`${player.name} drew ${draws} and passed.`);
}

function chooseBotCard(player, playable) {
  const nonEights = playable.filter((card) => card.rank !== "8");
  if (!nonEights.length) return playable[0];
  if (player.hand.length <= 2) return playable[0];
  return nonEights.sort((left, right) => cardPointValue(right) - cardPointValue(left))[0];
}

function chooseBotSuit(player, playedCard) {
  const counts = Object.fromEntries(SUITS.map((suit) => [suit, 0]));
  player.hand.filter((card) => card.id !== playedCard.id).forEach((card) => {
    counts[card.suit] += 1;
  });
  return SUITS.slice().sort((left, right) => counts[right] - counts[left])[0] || playedCard.suit;
}

function drawOne(player) {
  if (!state.drawPile.length) recycleDiscardPile();
  const card = state.drawPile.pop();
  if (card) {
    player.hand.push(card);
    markDrawAnimation(card.id);
  }
  sortHands();
  return card;
}

function canDrawCard() {
  return state.drawPile.length > 0 || state.discardPile.length > 1;
}

function recycleDiscardPile() {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile.pop();
  state.drawPile = shuffle(state.discardPile);
  state.discardPile = [top];
}

function finishRound(winner) {
  const playerEntries = state.players.map((player) => {
    const handPoints = player.id === winner.id ? 0 : player.hand.reduce((sum, card) => sum + cardPointValue(card), 0);
    return {
      id: player.id,
      name: player.name,
      handPoints,
      cardsLeft: player.hand.length,
    };
  });
  const winnerScore = playerEntries
    .filter((player) => player.id !== winner.id)
    .reduce((sum, player) => sum + player.handPoints, 0);
  winner.score += winnerScore;
  const entry = {
    roundNumber: state.roundNumber,
    winnerId: winner.id,
    winnerName: winner.name,
    winnerScore,
    players: playerEntries,
    totals: Object.fromEntries(state.players.map((player) => [player.id, player.score])),
    ts: Date.now(),
  };
  state.roundHistory.push(entry);
  state.stage = "roundOver";
  state.busy = false;
  const gameWinner = state.players
    .filter((player) => player.score >= state.targetScore)
    .sort((left, right) => right.score - left.score)[0];
  if (gameWinner) {
    state.winnerId = gameWinner.id;
    state.stage = "gameOver";
    state.notice = `${gameWinner.name} wins the game at ${gameWinner.score} points.`;
  } else {
    state.notice = `${winner.name} emptied their hand and scored ${winnerScore}.`;
  }
  render();
}

function isPlayable(card) {
  const top = topDiscard();
  if (!top) return true;
  return card.rank === "8" || card.suit === state.currentSuit || card.rank === top.rank;
}

function legalCards(player) {
  return player.hand.filter(isPlayable);
}

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${rank}-${suit}-${uid()}`, rank, suit })));
}

function shuffle(cards) {
  const copy = cards.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sortHands() {
  state.players.forEach((player) => {
    player.hand.sort((left, right) => SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit) || RANKS.indexOf(left.rank) - RANKS.indexOf(right.rank));
  });
}

function render() {
  renderSetupPanel();
  renderSessionControls();
  renderStatus();
  renderScoreBoard();
  renderSeats();
  renderPiles();
  renderActionControls();
  renderHumanHand();
  renderHistory();
  renderNotice();
  if (state.winnerId) {
    const winner = state.players.find((player) => player.id === state.winnerId);
    els.winnerBanner.hidden = false;
    els.winnerBanner.innerHTML = winnerBannerMarkup({
      kicker: "Game winner",
      winnerName: winner?.name || "Winner",
      message: `Final score: ${winner?.score || 0}.`,
    });
  } else {
    els.winnerBanner.hidden = true;
  }
}

function renderSetupPanel() {
  const isActiveGame = state.gameStarted && !state.winnerId;
  const canReusePlayers = state.gameStarted && Boolean(state.winnerId) && state.players.length >= 2;
  els.setupFields.hidden = isActiveGame;
  els.samePlayersBtn.hidden = !canReusePlayers;
  els.setupSummary.hidden = !isActiveGame;
  if (!isActiveGame) {
    els.setupSummary.innerHTML = "";
    return;
  }
  els.setupSummary.innerHTML = `
    <strong>${escapeHtml(state.players.map((player) => player.name).join(" vs "))}</strong>
    <span>${state.players.length} players • Target ${state.targetScore}</span>
  `;
}

function renderBotNameFields(options = {}) {
  if (options.syncFromInputs !== false) {
    syncSetupBotDifficultiesFromInputs();
  }
  ensureSetupBotNames();
  const botCount = Math.max(1, readPlayerCount() - 1);
  els.botNameFields.innerHTML = state.setupBotNames.slice(0, botCount).map((name, index) => `
    <div class="bot-setup-row">
      <label class="field">
        <span>Bot ${index + 1} name</span>
        <input name="botName${index + 1}" data-bot-index="${index}" type="text" maxlength="18" autocomplete="off" value="${escapeHtml(name)}" />
      </label>
      <label class="field">
        <span>Difficulty</span>
        <select name="botDifficulty${index + 1}" data-bot-difficulty-index="${index}">
          ${BOT_DIFFICULTIES.map((difficulty) => `
            <option value="${difficulty}" ${state.setupBotDifficulties[index] === difficulty ? "selected" : ""}>${difficultyLabel(difficulty)}</option>
          `).join("")}
        </select>
      </label>
    </div>
  `).join("");
}

function renderStatus() {
  const player = currentPlayer();
  els.statusText.textContent = !state.gameStarted
    ? "Deal a table to begin."
    : state.stage === "gameOver"
      ? "Game complete."
      : state.stage === "roundOver"
        ? "Round complete."
        : player?.bot
          ? `${player.name} is thinking.`
          : "Your turn. Play, draw up to five, or pass after the draw limit.";
  els.roundValue.textContent = state.gameStarted ? String(state.roundNumber) : "-";
  els.turnValue.textContent = player?.name || "-";
  els.suitValue.textContent = state.currentSuit ? `${SUIT_SYMBOLS[state.currentSuit]} ${suitLabel(state.currentSuit)}` : "-";
  els.drawValue.textContent = state.gameStarted ? String(state.drawPile.length) : "-";
}

function renderScoreBoard() {
  if (!state.players.length) {
    els.scoreBoard.innerHTML = "";
    return;
  }
  els.scoreBoard.innerHTML = state.players.map((player) => `
    <article class="score-card ${player.id === currentPlayer()?.id ? "current" : ""} ${player.id === state.winnerId ? "winner" : ""}">
      <strong>${escapeHtml(player.name)}</strong>
      <span>${player.score} points</span>
      <div class="score-meta">${player.hand.length} cards ${player.bot ? `• ${difficultyLabel(player.difficulty)}` : "• you"}</div>
    </article>
  `).join("");
}

function renderSeats() {
  const seats = [els.humanSeat, els.opponentLeft, els.opponentTop, els.opponentRight];
  seats.forEach((seat) => { seat.innerHTML = ""; seat.hidden = true; });
  state.players.forEach((player, index) => {
    const seat = seats[index];
    if (!seat) return;
    seat.hidden = false;
    seat.classList.toggle("current", player.id === currentPlayer()?.id && state.stage === "playing");
    seat.innerHTML = `
      <div class="seat-name">${escapeHtml(player.name)}</div>
      <div class="seat-details">${player.hand.length} cards • ${player.score} pts</div>
      <div class="mini-hand">${renderMiniHand(player.hand.length, index, player)}</div>
    `;
  });
}

function renderMiniHand(count, playerIndexValue, player) {
  return Array.from({ length: Math.min(count, 8) }, (_item, index) => {
    const dealIndex = playerIndexValue * DEAL_SIZE + index;
    const isFreshDraw = player?.hand?.[player.hand.length - 1]
      && index === Math.min(count, 8) - 1
      && state.drawingToHandIds.includes(player.hand[player.hand.length - 1].id);
    const classes = [
      "playing-card",
      "card-back",
      state.dealAnimationActive ? "dealt" : "",
      isFreshDraw ? `draw-to-${seatDirection(playerIndexValue)}` : "",
    ].filter(Boolean).join(" ");
    const style = state.dealAnimationActive ? ` style="--deal-index: ${dealIndex};"` : "";
    return `<span class="${classes}"${style}></span>`;
  }).join("");
}

function renderPiles() {
  const top = topDiscard();
  const canHumanDraw = isHumanTurn()
    && state.stage === "playing"
    && !state.busy
    && !state.dealAnimationActive
    && !state.pendingEightCardId
    && !legalCards(humanPlayer()).length
    && state.drawsThisTurn < MAX_DRAWS_PER_TURN
    && canDrawCard();
  els.drawPileBtn.disabled = !canHumanDraw;
  els.drawPileCount.textContent = String(state.drawPile.length);
  const discardMotionClass = top?.id === state.discardAnimationCardId
    ? `discard-card-motion play-from-${state.discardAnimationDirection}`
    : "discard-card-motion";
  els.discardPile.innerHTML = top
    ? `<div class="${discardMotionClass}">${renderCard(top)}</div><span class="seat-details">Discard</span>`
    : `<span class="seat-details">No discard</span>`;
  els.declaredSuit.innerHTML = state.currentSuit
    ? `<span class="declared-chip">${SUIT_SYMBOLS[state.currentSuit]} Current suit: ${suitLabel(state.currentSuit)}</span>`
    : "";
}

function renderActionControls() {
  if (!state.gameStarted) {
    els.actionHint.textContent = "Your controls will appear once the game starts.";
    els.actionControls.innerHTML = "";
    return;
  }
  if (state.stage === "playing" && isHumanTurn()) {
    const canPlay = legalCards(humanPlayer()).length > 0;
    const canDraw = !canPlay && state.drawsThisTurn < MAX_DRAWS_PER_TURN && canDrawCard();
    const canPass = !canPlay && !state.pendingEightCardId && !canDraw && (state.drawsThisTurn > 0 || !canDrawCard());
    els.actionHint.textContent = state.pendingEightCardId
      ? "Pick the suit everyone must follow next."
      : canPlay
        ? "Play a highlighted card."
        : canDraw
          ? `No play available. Draw up to ${MAX_DRAWS_PER_TURN - state.drawsThisTurn} more.`
          : "No play available after the draw limit. Pass to continue.";
    els.actionControls.innerHTML = `
      <button class="btn btn-primary" type="button" data-action="draw" ${!canDraw ? "disabled" : ""}>Draw Card</button>
      <button class="btn" type="button" data-action="pass" ${!canPass ? "disabled" : ""}>Pass</button>
    `;
    els.actionControls.querySelector("[data-action='draw']")?.addEventListener("click", drawForHuman);
    els.actionControls.querySelector("[data-action='pass']")?.addEventListener("click", passHumanTurn);
  } else {
    els.actionHint.textContent = state.stage === "gameOver"
      ? "Game complete. Start again with the same players or reset the table."
      : state.stage === "roundOver"
        ? "Deal the next round when ready."
        : `${currentPlayer()?.name || "Bot"} is taking a turn.`;
    els.actionControls.innerHTML = "";
  }
}

function renderHumanHand() {
  const player = humanPlayer();
  els.suitControls.hidden = !state.pendingEightCardId || !isHumanTurn();
  els.passTurnBtn.hidden = !(state.stage === "playing" && isHumanTurn() && !legalCards(player).length && !state.pendingEightCardId && (state.drawsThisTurn >= MAX_DRAWS_PER_TURN || !canDrawCard()));
  els.nextRoundBtn.hidden = state.stage !== "roundOver";
  if (!player) {
    els.handSummary.textContent = "Start a game to see your cards.";
    els.humanHand.innerHTML = "";
    return;
  }
  els.handSummary.textContent = `${player.hand.length} cards in hand${isHumanTurn() && state.stage === "playing" ? " • your turn" : ""}.`;
  els.humanHand.innerHTML = player.hand.map((card) => {
    const legal = isHumanTurn() && state.stage === "playing" && !state.busy && !state.dealAnimationActive && !state.pendingEightCardId && isPlayable(card);
    const dealIndex = state.players.indexOf(player) * DEAL_SIZE + player.hand.indexOf(card);
    const freshDraw = state.drawingToHandIds.includes(card.id);
    const classes = [
      "card-button",
      state.dealAnimationActive ? "dealt" : "",
      freshDraw ? "draw-to-bottom" : "",
      legal ? "legal" : "illegal",
    ].filter(Boolean).join(" ");
    const style = state.dealAnimationActive ? ` style="--deal-index: ${dealIndex};"` : "";
    return `
      <button class="${classes}" type="button" data-card-id="${card.id}" aria-label="${cardLabel(card)}"${style}>
        ${renderCard(card)}
      </button>
    `;
  }).join("");
}

function renderHistory() {
  renderHistorySortControl(els.historyOrderBtn, state.historySortDir, state.roundHistory.length);
  els.historySummary.textContent = state.roundHistory.length
    ? `${state.roundHistory.length} completed round${state.roundHistory.length === 1 ? "" : "s"}.`
    : "Completed rounds will appear here.";
  if (!state.roundHistory.length || !state.players.length) {
    els.historyWrap.innerHTML = "";
    return;
  }
  const header = `
    <div class="history-row history-header-row">
      <strong>Round</strong>
      ${state.players.map((player) => `
        <span class="history-player-head">
          <span class="history-player-name">${escapeHtml(player.name)}</span>
          <span class="history-player-points">${Number(player.score) || 0} pts</span>
        </span>
      `).join("")}
    </div>
  `;
  const rows = orderedHistory(state.roundHistory, state.historySortDir, { newestAt: "end" }).map((entry) => `
    <div class="history-row">
      <strong>#${entry.roundNumber}</strong>
      ${state.players.map((player) => {
        const roundPlayer = entry.players.find((item) => item.id === player.id);
        const marker = player.id === entry.winnerId ? `<span class="history-marker">Won +${entry.winnerScore}</span>` : `${roundPlayer?.handPoints || 0} hand pts`;
        return `<span>${marker}</span>`;
      }).join("")}
    </div>
  `).join("");
  els.historyWrap.innerHTML = header + rows;
}

function renderNotice() {
  els.eventNotice.hidden = !state.notice;
  els.eventNotice.textContent = state.notice;
}

function renderCard(card) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return `
    <span class="playing-card ${red ? "red" : ""} ${card.rank === "8" ? "wild" : ""}">
      <span class="card-corner"><span>${card.rank}</span><span>${SUIT_SYMBOLS[card.suit]}</span></span>
      <span class="card-suit-center">${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-corner bottom"><span>${card.rank}</span><span>${SUIT_SYMBOLS[card.suit]}</span></span>
    </span>
  `;
}

function saveSession() {
  if (!state.gameStarted) {
    showSessionStatus("Start a game before saving.");
    return;
  }
  const sessions = readSavedSessions();
  const now = Date.now();
  const record = normalizeCrazy8sSessionRecord({
    id: uid(),
    name: defaultSessionName(),
    payload: sessionSnapshot(),
    createdAt: now,
    updatedAt: now,
  });
  writeSavedSessions([record, ...sessions]);
  showSessionStatus(`Saved ${record.name}.`);
  renderSessionControls(record.id);
}

function loadSelectedSession() {
  const session = selectedSavedSession();
  if (!session) return;
  restoreSessionSnapshot(session.payload);
  showSessionStatus(`Loaded ${session.name}.`);
}

function deleteSelectedSession() {
  const session = selectedSavedSession();
  if (!session) return;
  if (!window.confirm(`Delete saved session "${session.name}"?`)) return;
  writeSavedSessions(readSavedSessions().filter((entry) => entry.id !== session.id));
  showSessionStatus(`Deleted ${session.name}.`);
  renderSessionControls();
}

function downloadSession() {
  if (!state.gameStarted) {
    showSessionStatus("Start a game before downloading.");
    return;
  }
  const snapshot = sessionSnapshot();
  const bundle = sessionExportBundle({
    app: "crazy8s-table",
    version: SESSION_EXPORT_VERSION,
    sessionName: defaultSessionName(),
    payload: snapshot,
  });
  downloadJson(`${slugify(defaultSessionName())}.json`, bundle);
  showSessionStatus("Session downloaded.");
}

async function importSessionFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = parseImportedSession(parsed, file.name);
    if (!imported) {
      showSessionStatus("That file is not a valid Crazy 8s session.");
      return;
    }
    const nextSessions = [imported, ...readSavedSessions().filter((session) => session.id !== imported.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt);
    if (!writeSavedSessions(nextSessions)) {
      showSessionStatus("Unable to import that session.");
      return;
    }
    restoreSessionSnapshot(imported.payload);
    renderSessionControls(imported.id);
    showSessionStatus(`Session imported: ${imported.name}.`);
  } catch {
    showSessionStatus("Import failed. Check that the file contains valid JSON.");
  } finally {
    els.importSessionFile.value = "";
  }
}

function exportScoreKeeper() {
  if (!state.roundHistory.length) {
    showSessionStatus("Complete at least one round before exporting to ScoreKeeper.");
    return;
  }
  const snapshot = sessionSnapshot();
  const payload = scoreKeeperExportBundle({
    version: 1,
    sourceGame: "crazy8s-table",
    scorekeeperPreset: "crazy8s",
    sessionName: defaultSessionName(),
    scorekeeperPayload: scoreKeeperPayload(snapshot),
    sourcePayload: snapshot,
  });
  downloadJson(`${slugify(defaultSessionName())}-scorekeeper.json`, payload);
  showSessionStatus("ScoreKeeper export downloaded.");
}

function scoreKeeperPayload(snapshot) {
  const players = scoreKeeperPlayers(snapshot.players, cleanName);
  const rounds = snapshot.roundHistory.map((entry, index) => {
    const scores = Object.fromEntries(players.map((player) => [
      player.id,
      player.id === entry.winnerId ? Number(entry.winnerScore) || 0 : 0,
    ]));
    return scoreKeeperRound(index, scores, {
      n: Number(entry.roundNumber) || index + 1,
      ts: entry.ts,
      extra: {
        crazy8sWinnerId: entry.winnerId,
        crazy8sHandPoints: Object.fromEntries((entry.players || []).map((player) => [player.id, player.handPoints])),
      },
    });
  });
  return scoreKeeperPayloadBase({
    presetKey: "crazy8s",
    target: snapshot.targetScore,
    winMode: "high",
    players,
    rounds,
    winnerId: snapshot.winnerId,
    historySortDir: "desc",
    presetNote: "Winner-only scoring: round winner receives the total of opponents' hand points.",
  });
}

function sessionSnapshot() {
  return cloneJson({
    gameStarted: state.gameStarted,
    players: state.players,
    roundNumber: state.roundNumber,
    targetScore: state.targetScore,
    playerCount: state.playerCount,
    currentPlayerIndex: state.currentPlayerIndex,
    stage: state.stage,
    drawPile: state.drawPile,
    discardPile: state.discardPile,
    currentSuit: state.currentSuit,
    pendingEightCardId: state.pendingEightCardId,
    drawsThisTurn: state.drawsThisTurn,
    roundHistory: state.roundHistory,
    historySortDir: state.historySortDir,
    setupBotNames: state.setupBotNames,
    setupBotDifficulties: state.setupBotDifficulties,
    winnerId: state.winnerId,
    notice: state.notice,
  });
}

function restoreSessionSnapshot(snapshot) {
  cancelPendingBotTurn();
  state.gameStarted = Boolean(snapshot.gameStarted);
  state.players = Array.isArray(snapshot.players) ? snapshot.players.map((player, index) => ({
    ...createPlayer(player.id || `p${index + 1}`, player.name, player.bot, player.difficulty),
    score: Number(player.score) || 0,
    hand: Array.isArray(player.hand) ? player.hand : [],
  })) : [];
  state.roundNumber = clampInteger(snapshot.roundNumber, 1, 999, 1);
  state.targetScore = clampInteger(snapshot.targetScore, 25, 500, DEFAULT_TARGET_SCORE);
  state.playerCount = clampInteger(snapshot.playerCount || state.players.length, 2, 4, DEFAULT_PLAYER_COUNT);
  state.currentPlayerIndex = clampInteger(snapshot.currentPlayerIndex, 0, Math.max(0, state.players.length - 1), 0);
  state.stage = ["setup", "playing", "roundOver", "gameOver"].includes(snapshot.stage) ? snapshot.stage : "playing";
  state.drawPile = Array.isArray(snapshot.drawPile) ? snapshot.drawPile : [];
  state.discardPile = Array.isArray(snapshot.discardPile) ? snapshot.discardPile : [];
  state.currentSuit = SUITS.includes(snapshot.currentSuit) ? snapshot.currentSuit : topDiscard()?.suit || null;
  state.pendingEightCardId = typeof snapshot.pendingEightCardId === "string" ? snapshot.pendingEightCardId : null;
  state.drawsThisTurn = clampInteger(
    snapshot.drawsThisTurn ?? (snapshot.drewThisTurn ? 1 : 0),
    0,
    MAX_DRAWS_PER_TURN,
    0,
  );
  state.dealAnimationActive = false;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.roundHistory = Array.isArray(snapshot.roundHistory) ? snapshot.roundHistory : [];
  state.historySortDir = snapshot.historySortDir === "asc" ? "asc" : "desc";
  state.setupBotNames = Array.isArray(snapshot.setupBotNames) ? snapshot.setupBotNames : [];
  state.setupBotDifficulties = Array.isArray(snapshot.setupBotDifficulties) ? snapshot.setupBotDifficulties : [];
  state.winnerId = snapshot.winnerId || null;
  state.notice = snapshot.notice || "";
  state.sessionExpanded = false;
  sortHands();
  render();
  scheduleBotTurnIfNeeded();
}

function parseImportedSession(json, filename = "") {
  if (!json || typeof json !== "object") return null;
  const payload = json.app === "crazy8s-table" && json.payload && typeof json.payload === "object"
    ? json.payload
    : json.payload && typeof json.payload === "object"
      ? json.payload
      : json;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.players)) return null;
  const fallbackName = filename ? slugify(filename.replace(/\.json$/i, "")) : defaultSessionName();
  const providedName = typeof json.session?.name === "string" && json.session.name.trim()
    ? json.session.name.trim()
    : typeof json.name === "string" && json.name.trim()
      ? json.name.trim()
      : fallbackName;
  const now = Date.now();
  return normalizeCrazy8sSessionRecord({
    id: uid(),
    name: providedName,
    payload: cloneJson(payload),
    createdAt: now,
    updatedAt: now,
  });
}

function renderSessionControls(selectedId = els.savedSessionSelect.value) {
  const sessions = readSavedSessions();
  const selectedSession = sessions.find((session) => session.id === selectedId);
  const selectedValue = selectedSession ? selectedSession.id : "";
  els.sessionTools.hidden = !state.sessionExpanded;
  els.sessionToggleBtn.textContent = sessionToggleLabel(state.sessionExpanded);
  els.sessionToggleBtn.setAttribute("aria-expanded", String(state.sessionExpanded));
  els.savedSessionSelect.innerHTML = sessions.length
    ? [`<option value="">${escapeHtml(sessionSelectPlaceholder())}</option>`, ...sessions.map((session) =>
      `<option value="${session.id}" ${session.id === selectedValue ? "selected" : ""}>${escapeHtml(sessionOptionLabel(session))}</option>`)].join("")
    : `<option value="">${escapeHtml(sessionSelectPlaceholder())}</option>`;
  els.savedSessionSelect.value = selectedValue;
  els.savedSessionSelect.disabled = sessions.length === 0;
  els.saveSessionBtn.textContent = sessionSaveButtonLabel(null);
  els.loadSessionBtn.disabled = !selectedValue;
  els.deleteSessionBtn.disabled = !selectedValue;
  els.saveSessionBtn.disabled = !state.gameStarted;
  els.downloadSessionBtn.disabled = !state.gameStarted;
  els.exportScoreKeeperBtn.disabled = !state.roundHistory.length;
  if (els.sessionStatus.dataset.sessionManual !== "true") {
    els.sessionStatus.textContent = sessionStatusText({ sessions });
  }
}

function readSavedSessions() {
  const raw = readStoredJson(STORAGE_SESSIONS_KEY, []);
  return Array.isArray(raw)
    ? raw.map(normalizeCrazy8sSessionRecord).filter(Boolean).sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
}

function writeSavedSessions(sessions) {
  return writeStoredJson(STORAGE_SESSIONS_KEY, sessions);
}

function normalizeCrazy8sSessionRecord(session) {
  if (!session || typeof session !== "object") return null;
  const payload = session.payload || session.snapshot;
  if (!payload || typeof payload !== "object") return null;
  if (window.GameRoom?.normalizeSessionRecord) {
    return window.GameRoom.normalizeSessionRecord({ ...session, payload }, { fallbackName: "Crazy 8s Session" });
  }
  const createdAt = Number(session.createdAt) || Date.now();
  return {
    id: String(session.id || uid()),
    name: String(session.name || "Crazy 8s Session").trim() || "Crazy 8s Session",
    payload: cloneJson(payload),
    createdAt,
    updatedAt: Number(session.updatedAt) || createdAt,
  };
}

function selectedSavedSession() {
  return readSavedSessions().find((session) => session.id === els.savedSessionSelect.value);
}

function sessionOptionLabel(session) {
  if (window.GameRoom?.sessionOptionLabel) {
    return window.GameRoom.sessionOptionLabel(session, { roundKey: "roundNumber", roundLabel: "Round" });
  }
  return `${session.name} • Round ${session.payload?.roundNumber || 1}`;
}

function showSessionStatus(message) {
  els.sessionStatus.dataset.sessionManual = "true";
  els.sessionStatus.textContent = message;
}

function defaultSessionName() {
  const human = state.players.find((player) => !player.bot)?.name || "Crazy 8s";
  return `${human} Crazy 8s Round ${state.roundNumber}`;
}

function cleanName(value, fallback = "Player") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function readTargetScore() {
  return clampInteger(els.targetScore.value, 25, 500, DEFAULT_TARGET_SCORE);
}

function readPlayerCount() {
  return clampInteger(els.playerCount.value, 2, 4, DEFAULT_PLAYER_COUNT);
}

function ensureSetupBotNames() {
  const botCount = Math.max(1, readPlayerCount() - 1);
  const existing = Array.isArray(state.setupBotNames) ? state.setupBotNames.slice(0, botCount) : [];
  const missing = botCount - existing.length;
  if (missing > 0) {
    existing.push(...setupBotNames(missing, els.humanName.value || "Rick"));
  }
  state.setupBotNames = existing;
  state.setupBotDifficulties = setupBotDifficulties(botCount, state.setupBotDifficulties, { kind: "standard" });
}

function shuffleSetupBotNames() {
  state.setupBotNames = setupBotNames(Math.max(1, readPlayerCount() - 1), els.humanName.value || "Rick");
}

function syncSetupBotDifficultiesFromInputs() {
  const inputs = Array.from(els.botNameFields.querySelectorAll("[data-bot-index]"));
  if (inputs.length) {
    inputs.forEach((input) => {
      state.setupBotNames[Number(input.dataset.botIndex)] = cleanName(input.value, `Bot ${Number(input.dataset.botIndex) + 1}`);
    });
  }
  const selects = Array.from(els.botNameFields.querySelectorAll("[data-bot-difficulty-index]"));
  if (selects.length) {
    selects.forEach((select) => {
      state.setupBotDifficulties[Number(select.dataset.botDifficultyIndex)] = normalizeBotDifficulty(select.value, { kind: "standard" });
    });
  }
}

function currentPlayer() {
  return state.players[state.currentPlayerIndex] || null;
}

function playerIndex(player) {
  return state.players.findIndex((entry) => entry.id === player?.id);
}

function humanPlayer() {
  return state.players.find((player) => !player.bot) || null;
}

function isHumanTurn() {
  return currentPlayer()?.id === humanPlayer()?.id;
}

function topDiscard() {
  return state.discardPile[state.discardPile.length - 1] || null;
}

function topDiscardLabel() {
  const card = topDiscard();
  return card ? cardLabel(card) : "the discard";
}

function cardLabel(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

function suitLabel(suit) {
  return suit ? suit.charAt(0).toUpperCase() + suit.slice(1) : "";
}

function cardPointValue(card) {
  return RANK_VALUES[card.rank] || 0;
}

function cancelPendingBotTurn() {
  botTurnToken += 1;
  if (botTurnTimer) {
    window.clearTimeout(botTurnTimer);
    botTurnTimer = null;
  }
}

function startDealAnimationTimer() {
  clearDealAnimationTimer();
  state.dealAnimationTimer = window.setTimeout(() => {
    state.dealAnimationTimer = null;
    state.dealAnimationActive = false;
    renderSeats();
    renderHumanHand();
    scheduleBotTurnIfNeeded();
  }, DEAL_ANIMATION_MS);
}

function clearDealAnimationTimer() {
  if (!state.dealAnimationTimer) return;
  window.clearTimeout(state.dealAnimationTimer);
  state.dealAnimationTimer = null;
}

function markDiscardAnimation(cardId, direction) {
  clearDiscardAnimationTimer();
  state.discardAnimationCardId = cardId;
  state.discardAnimationDirection = direction;
  state.discardAnimationTimer = window.setTimeout(() => {
    state.discardAnimationTimer = null;
    state.discardAnimationCardId = "";
    state.discardAnimationDirection = "";
    renderPiles();
  }, PLAY_ANIMATION_MS);
}

function clearDiscardAnimationTimer() {
  if (state.discardAnimationTimer) {
    window.clearTimeout(state.discardAnimationTimer);
    state.discardAnimationTimer = null;
  }
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
}

function markDrawAnimation(cardId) {
  state.drawingToHandIds = [...new Set([...state.drawingToHandIds, cardId])];
  const timer = window.setTimeout(() => {
    state.drawingToHandIds = state.drawingToHandIds.filter((id) => id !== cardId);
    state.drawAnimationTimers = state.drawAnimationTimers.filter((entry) => entry.cardId !== cardId);
    renderSeats();
    renderHumanHand();
  }, DRAW_ANIMATION_MS);
  state.drawAnimationTimers.push({ cardId, timer });
}

function clearDrawAnimationTimers() {
  state.drawAnimationTimers.forEach((entry) => window.clearTimeout(entry.timer));
  state.drawAnimationTimers = [];
  state.drawingToHandIds = [];
}

function seatDirection(index) {
  return ["bottom", "left", "top", "right"][index] || "bottom";
}

function fallbackDownloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

shuffleSetupBotNames();
ensureSetupBotNames();
bindEvents();
renderBotNameFields();
render();
