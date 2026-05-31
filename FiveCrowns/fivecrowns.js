const BOT_NAMES = window.GameRoom?.BOT_NAMES || ["Nick", "Sam", "Nate", "Garth", "Kyle", "Kip"];
const BOT_DIFFICULTIES = window.GameRoom?.botDifficultyLevels?.("standard") || ["easy", "medium", "hard"];
const DEFAULT_PLAYER_COUNT = 4;
const TOTAL_ROUNDS = 11;
const BOT_TURN_DELAY_MS = 850;
const DEAL_ANIMATION_MS = 900;
const PLAY_ANIMATION_MS = 620;
const DRAW_ANIMATION_MS = 540;
const STORAGE_SESSIONS_KEY = "dashboard.fivecrowns.sessions";
const STORAGE_ACTIVE_KEY = "dashboard.fivecrowns.active";
const SESSION_EXPORT_VERSION = 1;
const SUITS = ["clubs", "diamonds", "spades", "hearts", "stars"];
const SUIT_SYMBOLS = { clubs: "♣", diamonds: "♦", spades: "♠", hearts: "♥", stars: "★" };
const SUIT_LABELS = { clubs: "Clubs", diamonds: "Diamonds", spades: "Spades", hearts: "Hearts", stars: "Stars" };
const SUIT_CLASSES = { clubs: "suit-clubs", diamonds: "suit-diamonds", spades: "suit-spades", hearts: "suit-hearts", stars: "suit-stars" };
const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
const FACE_VALUES = { J: 11, Q: 12, K: 13 };

let botTurnTimer = null;
let botTurnToken = 0;
const animatedMeldRevealKeys = new Set();

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  roundNumber: 1,
  playerCount: DEFAULT_PLAYER_COUNT,
  dealerIndex: 0,
  currentPlayerIndex: 0,
  stage: "setup",
  turnPhase: "draw",
  drawPile: [],
  discardPile: [],
  drawnCardId: "",
  finalTurnsRemaining: 0,
  wentOutPlayerId: null,
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
  handSortMode: "suit",
  roundWinnerId: null,
  winnerId: null,
  notice: "",
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
  playerCount: document.getElementById("playerCount"),
  setupFields: document.getElementById("setupFields"),
  setupSummary: document.getElementById("setupSummary"),
  botNameFields: document.getElementById("botNameFields"),
  shuffleBotNamesBtn: document.getElementById("shuffleBotNamesBtn"),
  samePlayersBtn: document.getElementById("samePlayersBtn"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  wildValue: document.getElementById("wildValue"),
  drawValue: document.getElementById("drawValue"),
  actionHint: document.getElementById("actionHint"),
  actionControls: document.getElementById("actionControls"),
  drawStockActionBtn: document.getElementById("drawStockActionBtn"),
  drawDiscardActionBtn: document.getElementById("drawDiscardActionBtn"),
  discardActionBtn: document.getElementById("discardActionBtn"),
  eventNotice: document.getElementById("eventNotice"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
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
  handPanelTitle: document.getElementById("handPanelTitle"),
  humanSeatSummary: document.getElementById("humanSeatSummary"),
  mobileRoundValue: document.getElementById("mobileRoundValue"),
  mobileTurnValue: document.getElementById("mobileTurnValue"),
  mobileWildValue: document.getElementById("mobileWildValue"),
  mobileDeckValue: document.getElementById("mobileDeckValue"),
  opponentTop: document.getElementById("opponentTop"),
  opponentExtra: document.getElementById("opponentExtra"),
  opponentLeft: document.getElementById("opponentLeft"),
  opponentRight: document.getElementById("opponentRight"),
  humanSeat: document.getElementById("humanSeat"),
  drawPileBtn: document.getElementById("drawPileBtn"),
  drawPileCount: document.getElementById("drawPileCount"),
  discardPileBtn: document.getElementById("discardPileBtn"),
  discardPile: document.getElementById("discardPile"),
  roundBadge: document.getElementById("roundBadge"),
  sortHandBtn: document.getElementById("sortHandBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  deadwoodPreview: document.getElementById("deadwoodPreview"),
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
const removeStoredJson = window.GameRoom?.removeStoredJson || ((key) => (localStorage.removeItem(key), true));
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
const winnerBannerMarkup = window.GameRoom?.winnerBannerMarkup || ((options) => `<strong>${escapeHtml(options.winnerName)}</strong><span>${escapeHtml(options.message)}</span>`);
const slugify = window.GameRoom?.slugify || ((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "session");

function bindEvents() {
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.gameStarted && state.stage !== "gameOver" && !window.confirm("Restart this 5 Crowns table?")) return;
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
    if (!state.gameStarted || state.stage !== "gameOver" || !state.players.length) return;
    startNewGame({ samePlayers: true });
  });
  els.resetTableBtn.addEventListener("click", () => {
    if (state.gameStarted && state.stage !== "gameOver" && !window.confirm("Reset this 5 Crowns table?")) return;
    resetState();
    shuffleSetupBotNames();
    renderBotNameFields({ syncFromInputs: false });
    render();
  });
  els.drawPileBtn.addEventListener("click", () => drawForHuman("stock"));
  els.discardPileBtn.addEventListener("click", () => drawForHuman("discard"));
  els.drawStockActionBtn.addEventListener("click", () => drawForHuman("stock"));
  els.drawDiscardActionBtn.addEventListener("click", () => drawForHuman("discard"));
  els.humanHand.addEventListener("click", handleHandClick);
  els.sortHandBtn.addEventListener("click", () => {
    state.handSortMode = state.handSortMode === "suit" ? "rank" : "suit";
    sortHands();
    renderHumanHand();
  });
  els.nextRoundBtn.addEventListener("click", dealNextRound);
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
  const playerCount = samePlayers ? previousPlayers.length : readPlayerCount();
  resetState();
  state.gameStarted = true;
  state.sessionExpanded = false;
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
  animatedMeldRevealKeys.clear();
  removeStoredJson(STORAGE_ACTIVE_KEY);
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.roundNumber = 1;
  state.playerCount = DEFAULT_PLAYER_COUNT;
  state.dealerIndex = 0;
  state.currentPlayerIndex = 0;
  state.stage = "setup";
  state.turnPhase = "draw";
  state.drawPile = [];
  state.discardPile = [];
  state.drawnCardId = "";
  state.finalTurnsRemaining = 0;
  state.wentOutPlayerId = null;
  state.dealAnimationActive = false;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.roundHistory = [];
  state.historySortDir = "desc";
  state.sessionExpanded = true;
  state.handSortMode = "suit";
  state.roundWinnerId = null;
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
    ...Array.from({ length: botCount }, (_item, index) =>
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
  animatedMeldRevealKeys.clear();
  const deck = shuffle(createDeck());
  const handSize = currentHandSize();
  state.players.forEach((player) => {
    player.hand = [];
  });
  for (let cardIndex = 0; cardIndex < handSize; cardIndex += 1) {
    state.players.forEach((player) => {
      player.hand.push(deck.pop());
    });
  }
  state.drawPile = deck;
  state.discardPile = [state.drawPile.pop()].filter(Boolean);
  state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.length;
  state.stage = "playing";
  state.turnPhase = "draw";
  state.drawnCardId = "";
  state.finalTurnsRemaining = 0;
  state.wentOutPlayerId = null;
  state.roundWinnerId = null;
  state.dealAnimationActive = true;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.busy = false;
  state.notice = `${currentPlayer().name} starts the ${wildRankLabel()} round.`;
  sortHands();
  render();
  startDealAnimationTimer();
  scheduleBotTurnIfNeeded();
}

function dealNextRound() {
  if (!state.gameStarted || state.stage !== "roundOver") return;
  state.roundNumber += 1;
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  dealRound();
}

function handleHandClick(event) {
  const button = event.target.closest("[data-card-id]");
  if (!button || !isHumanTurn() || state.stage !== "playing" || state.busy || state.dealAnimationActive || state.turnPhase !== "discard") return;
  const card = humanPlayer().hand.find((entry) => entry.id === button.dataset.cardId);
  if (!card) return;
  discardCard(humanPlayer(), card);
}

function drawForHuman(source) {
  if (!isHumanTurn() || state.stage !== "playing" || state.busy || state.dealAnimationActive || state.turnPhase !== "draw") return;
  drawForCurrentPlayer(source);
}

function drawForCurrentPlayer(source) {
  const player = currentPlayer();
  const card = source === "discard" ? drawFromDiscard(player) : drawFromStock(player);
  if (!card) {
    state.notice = source === "discard" ? "The discard pile is empty." : "The stock pile is empty.";
    renderNotice();
    return null;
  }
  state.drawnCardId = card.id;
  state.turnPhase = "discard";
  state.notice = `${player.name} drew from the ${source === "discard" ? "discard" : "stock"} pile.`;
  sortHands();
  render();
  return card;
}

function discardCard(player, card) {
  player.hand = player.hand.filter((entry) => entry.id !== card.id);
  state.discardPile.push(card);
  state.drawnCardId = "";
  markDiscardAnimation(card.id, seatDirection(playerIndex(player)));
  sortHands();
  if (!state.wentOutPlayerId && canGoOut(player.hand)) {
    state.wentOutPlayerId = player.id;
    state.finalTurnsRemaining = state.players.length - 1;
    state.notice = `${player.name} went out. Everyone else gets one final turn.`;
  }
  if (state.wentOutPlayerId && player.id !== state.wentOutPlayerId) {
    state.finalTurnsRemaining -= 1;
  }
  if (state.wentOutPlayerId && state.finalTurnsRemaining <= 0) {
    finishRound();
    return;
  }
  advanceTurn();
}

function advanceTurn() {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.wentOutPlayerId && currentPlayer()?.id === state.wentOutPlayerId) {
    finishRound();
    return;
  }
  state.turnPhase = "draw";
  state.busy = false;
  render();
  scheduleBotTurnIfNeeded();
}

function scheduleBotTurnIfNeeded() {
  cancelPendingBotTurn();
  if (!state.gameStarted || state.stage !== "playing" || state.dealAnimationActive || !currentPlayer()?.bot) return;
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
  const discard = topDiscard();
  const currentScore = minDeadwoodScore(player.hand);
  const discardChoice = discard ? bestDiscardChoice(player.hand.concat(discard)) : null;
  const shouldTakeDiscard = Boolean(
    discardChoice &&
      (discardChoice.score < currentScore || discardChoice.card?.id !== discard.id),
  );
  drawForCurrentPlayer(shouldTakeDiscard ? "discard" : "stock");
  const choice = bestDiscardChoice(player.hand);
  discardCard(player, choice.card || player.hand[player.hand.length - 1]);
}

function drawFromStock(player) {
  if (!state.drawPile.length) recycleDiscardPile();
  const card = state.drawPile.pop();
  if (card) {
    player.hand.push(card);
    markDrawAnimation(card.id);
  }
  return card;
}

function drawFromDiscard(player) {
  const card = state.discardPile.pop();
  if (card) {
    player.hand.push(card);
    markDrawAnimation(card.id);
  }
  return card;
}

function recycleDiscardPile() {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile.pop();
  state.drawPile = shuffle(state.discardPile);
  state.discardPile = [top];
}

function finishRound() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const playerEntries = state.players.map((player) => {
    const deadwood = minDeadwoodScore(player.hand);
    player.score += deadwood;
    return {
      id: player.id,
      name: player.name,
      deadwood,
      cardsLeft: player.hand.length,
    };
  });
  const roundLow = Math.min(...playerEntries.map((entry) => entry.deadwood));
  const lowPlayers = playerEntries.filter((entry) => entry.deadwood === roundLow);
  const wentOut = state.players.find((player) => player.id === state.wentOutPlayerId);
  const roundWinner = lowPlayers.find((entry) => entry.id === wentOut?.id) || lowPlayers[0];
  const entry = {
    roundNumber: state.roundNumber,
    handSize: currentHandSize(),
    wildRank: currentWildRank(),
    winnerId: roundWinner?.id || "",
    winnerName: roundWinner?.name || "",
    wentOutPlayerId: state.wentOutPlayerId,
    wentOutPlayerName: wentOut?.name || "",
    players: playerEntries,
    totals: Object.fromEntries(state.players.map((player) => [player.id, player.score])),
    ts: Date.now(),
  };
  state.roundHistory.push(entry);
  state.stage = state.roundNumber >= TOTAL_ROUNDS ? "gameOver" : "roundOver";
  state.busy = false;
  state.roundWinnerId = roundWinner?.id || null;
  if (state.stage === "gameOver") {
    const lowScore = Math.min(...state.players.map((player) => player.score));
    const winner = state.players.find((player) => player.score === lowScore);
    state.winnerId = winner?.id || null;
    state.notice = `${winner?.name || "Winner"} wins 5 Crowns with ${lowScore} points.`;
  } else {
    state.notice = `${wentOut?.name || "A player"} went out. ${wildRankLabel()} round scored.`;
  }
  render();
}

function bestDiscardChoice(cards) {
  let best = { card: cards[0] || null, score: Infinity };
  cards.forEach((card) => {
    const remaining = cards.filter((entry) => entry.id !== card.id);
    const score = minDeadwoodScore(remaining);
    const tieBreak = cardPointValue(card);
    const bestTie = best.card ? cardPointValue(best.card) : -1;
    if (score < best.score || (score === best.score && tieBreak > bestTie)) {
      best = { card, score };
    }
  });
  return best;
}

function canGoOut(cards) {
  return minDeadwoodScore(cards) === 0;
}

function minDeadwoodScore(cards) {
  return bestMeldLayout(cards).score;
}

function bestMeldLayout(cards) {
  if (!cards.length) return { score: 0, melds: [], deadwood: [] };
  const count = cards.length;
  const fullMask = (1 << count) - 1;
  const melds = validMelds(cards);
  const memo = new Map();
  const solve = (mask) => {
    if (mask === 0) return { score: 0, melds: [] };
    if (memo.has(mask)) return memo.get(mask);
    let best = { score: sumMask(cards, mask), melds: [] };
    for (const meld of melds) {
      if ((mask & meld.mask) === meld.mask) {
        const next = solve(mask ^ meld.mask);
        const candidate = { score: next.score, melds: [meld, ...next.melds] };
        if (isBetterMeldLayout(candidate, best)) {
          best = candidate;
        }
      }
    }
    memo.set(mask, best);
    return best;
  };
  const best = solve(fullMask);
  const meldMask = best.melds.reduce((mask, meld) => mask | meld.mask, 0);
  return {
    score: best.score,
    melds: best.melds
      .slice()
      .sort((left, right) => firstMaskIndex(left.mask) - firstMaskIndex(right.mask))
      .map((meld) => ({
        type: meld.type,
        cards: cards.filter((_card, index) => meld.mask & (1 << index)),
      })),
    deadwood: cards.filter((_card, index) => !(meldMask & (1 << index))),
  };
}

function isBetterMeldLayout(candidate, best) {
  if (candidate.score !== best.score) return candidate.score < best.score;
  const candidateCards = candidate.melds.reduce((sum, meld) => sum + bitCount(meld.mask), 0);
  const bestCards = best.melds.reduce((sum, meld) => sum + bitCount(meld.mask), 0);
  if (candidateCards !== bestCards) return candidateCards > bestCards;
  return candidate.melds.length > best.melds.length;
}

function firstMaskIndex(mask) {
  for (let index = 0; index < 31; index += 1) {
    if (mask & (1 << index)) return index;
  }
  return 31;
}

function validMelds(cards) {
  const melds = [];
  const total = 1 << cards.length;
  for (let mask = 0; mask < total; mask += 1) {
    if (bitCount(mask) < 3) continue;
    const group = cards.filter((_card, index) => mask & (1 << index));
    if (isBook(group)) {
      melds.push({ mask, type: "Book" });
    } else if (isRun(group)) {
      melds.push({ mask, type: "Run" });
    }
  }
  return melds;
}

function isBook(cards) {
  const naturalRanks = cards.filter((card) => !isWild(card)).map((card) => card.rank);
  return naturalRanks.length === 0 || new Set(naturalRanks).size === 1;
}

function isRun(cards) {
  const naturals = cards.filter((card) => !isWild(card));
  if (!naturals.length) return true;
  if (new Set(naturals.map((card) => card.suit)).size !== 1) return false;
  const values = naturals.map(rankSortValue).sort((left, right) => left - right);
  if (new Set(values).size !== values.length) return false;
  let gaps = 0;
  for (let index = 1; index < values.length; index += 1) {
    gaps += values[index] - values[index - 1] - 1;
  }
  return gaps <= cards.length - naturals.length;
}

function bitCount(mask) {
  let count = 0;
  for (let value = mask; value; value >>= 1) count += value & 1;
  return count;
}

function sumMask(cards, mask) {
  return cards.reduce((sum, card, index) => mask & (1 << index) ? sum + cardPointValue(card) : sum, 0);
}

function createDeck() {
  const cards = [];
  for (let deckIndex = 0; deckIndex < 2; deckIndex += 1) {
    SUITS.forEach((suit) => {
      RANKS.forEach((rank) => cards.push({ id: `${deckIndex}-${rank}-${suit}-${uid()}`, rank, suit }));
    });
    for (let jokerIndex = 0; jokerIndex < 3; jokerIndex += 1) {
      cards.push({ id: `${deckIndex}-JOKER-${jokerIndex}-${uid()}`, rank: "Joker", suit: "joker" });
    }
  }
  return cards;
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
    player.hand.sort((left, right) => {
      const wildSort = Number(isWild(right)) - Number(isWild(left));
      if (wildSort) return wildSort;
      if (state.handSortMode === "rank") {
        return rankSortValue(left) - rankSortValue(right)
          || SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit);
      }
      return SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit)
        || rankSortValue(left) - rankSortValue(right);
    });
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
  persistActiveGame();
}

function persistActiveGame() {
  if (!state.gameStarted) {
    removeStoredJson(STORAGE_ACTIVE_KEY);
    return;
  }
  writeStoredJson(STORAGE_ACTIVE_KEY, {
    savedAt: Date.now(),
    payload: sessionSnapshot(),
  });
}

function restoreActiveGame() {
  const saved = readStoredJson(STORAGE_ACTIVE_KEY, null);
  const payload = saved?.payload || saved;
  if (!payload?.gameStarted || !Array.isArray(payload.players) || !payload.players.length) return false;
  restoreSessionSnapshot(payload);
  return true;
}

function renderSetupPanel() {
  const isActiveGame = state.gameStarted && state.stage !== "gameOver";
  const canReusePlayers = state.gameStarted && state.stage === "gameOver" && state.players.length >= 2;
  els.setupFields.hidden = isActiveGame;
  els.samePlayersBtn.hidden = !canReusePlayers;
  els.setupSummary.hidden = !isActiveGame;
  if (!isActiveGame) {
    els.setupSummary.innerHTML = "";
    return;
  }
  els.setupSummary.innerHTML = `
    <strong>${escapeHtml(state.players.map((player) => player.name).join(" vs "))}</strong>
    <span>${state.players.length} players • Round ${state.roundNumber} of ${TOTAL_ROUNDS}</span>
  `;
}

function renderBotNameFields(options = {}) {
  if (options.syncFromInputs !== false) syncSetupBotDifficultiesFromInputs();
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
          : state.turnPhase === "draw"
            ? "Draw from the stock or discard pile."
            : "Discard one card to end your turn.";
  els.roundValue.textContent = state.gameStarted ? `${state.roundNumber}/${TOTAL_ROUNDS}` : "-";
  els.turnValue.textContent = player?.name || "-";
  els.wildValue.textContent = state.gameStarted ? wildRankLabel() : "-";
  els.drawValue.textContent = state.gameStarted ? String(state.drawPile.length) : "-";
  if (els.mobileRoundValue) els.mobileRoundValue.textContent = els.roundValue.textContent;
  if (els.mobileTurnValue) els.mobileTurnValue.textContent = els.turnValue.textContent;
  if (els.mobileWildValue) els.mobileWildValue.textContent = els.wildValue.textContent;
  if (els.mobileDeckValue) els.mobileDeckValue.textContent = els.drawValue.textContent;
}

function renderScoreBoard() {
  if (!state.players.length) {
    els.leaderText.textContent = "Scores, hand sizes, and round status will appear here.";
    els.scoreBoard.innerHTML = `<div class="empty-board">Start a game to populate the table.</div>`;
    return;
  }
  const leader = [...state.players].sort((left, right) => left.score - right.score)[0];
  els.leaderText.textContent = leader
    ? `${leader.name} has the low score at ${leader.score} points.`
    : "Lowest score wins after the king round.";
  const botPlayers = state.players.filter((player) => player.bot);
  els.scoreBoard.style.gridTemplateColumns = `repeat(${Math.min(botPlayers.length || 1, 4)}, minmax(0, 1fr))`;
  els.scoreBoard.innerHTML = botPlayers.map((player) => `
    <article class="player-card ${player.id === currentPlayer()?.id ? "current" : ""} ${player.id === state.winnerId ? "winner" : ""} ${player.id === state.wentOutPlayerId ? "out" : ""}">
      <div class="player-head">
        <h3 class="player-name">${escapeHtml(player.name)}</h3>
        <span class="badge ${player.id === state.winnerId ? "gold" : ""}">${difficultyLabel(player.difficulty)}</span>
      </div>
      <div class="player-stats">
        <span class="stat-pill gold">${player.score} pts</span>
        <span class="stat-pill">${player.hand.length} in hand</span>
      </div>
      <div class="player-mini-hand" aria-label="${escapeHtml(player.name)} has ${player.hand.length} cards">
        ${renderPlayerMiniHand(player)}
      </div>
      <div class="score-meta">${player.id === currentPlayer()?.id && state.stage === "playing" ? "Current turn" : player.id === state.wentOutPlayerId ? "Went out" : indexLabel(player)}</div>
    </article>
  `).join("");
}

function renderPlayerMiniHand(player) {
  if (shouldShowMeldLayout(player)) {
    return renderMeldLayout(player.hand, { animationKey: meldAnimationKey(player, "summary") });
  }
  const visibleCount = Math.min(player.hand.length, 10);
  const overflow = Math.max(0, player.hand.length - visibleCount);
  return `
    <div class="mini-card-row">
      ${Array.from({ length: visibleCount }, (_item, index) => `<span class="playing-card card-back mini-card" style="--mini-index: ${index};"></span>`).join("")}
      ${overflow ? `<span class="mini-card-overflow">+${overflow}</span>` : ""}
    </div>
  `;
}

function renderMeldLayout(cards, options = {}) {
  const fullSize = options.size === "full";
  const animate = shouldAnimateMeldReveal(options.animationKey);
  const layout = bestMeldLayout(cards);
  const rowClass = fullSize ? "full-meld-card-row" : "mini-card-row face-up-mini-row meld-card-row";
  const cardRenderer = fullSize ? renderFullMeldCard : renderMiniFaceCard;
  const heading = fullSize ? `<div class="meld-layout-heading">Scored Melds</div>` : "";
  const melds = layout.melds.map((meld, meldIndex) => `
    <div class="meld-group meld-${meld.type.toLowerCase()}" style="--meld-group-index: ${meldIndex};">
      <span class="meld-label">${meld.type} Meld</span>
      <div class="${rowClass}">
        ${meld.cards.map((card, index) => cardRenderer(card, index)).join("")}
      </div>
    </div>
  `).join("");
  const deadwood = layout.deadwood.length
    ? `
      <div class="meld-group meld-deadwood" style="--meld-group-index: ${layout.melds.length};">
        <span class="meld-label">Deadwood ${layout.score}</span>
        <div class="${rowClass}">
          ${layout.deadwood.map((card, index) => cardRenderer(card, index)).join("")}
        </div>
      </div>
    `
    : "";
  return `<div class="meld-layout ${fullSize ? "full-meld-layout" : ""} ${animate ? "" : "meld-no-animation"}">${heading}${melds}${deadwood}</div>`;
}

function shouldAnimateMeldReveal(key) {
  if (!key) return true;
  if (animatedMeldRevealKeys.has(key)) return false;
  animatedMeldRevealKeys.add(key);
  return true;
}

function renderFullMeldCard(card, index) {
  return `<span class="meld-face-card" style="--meld-index: ${index};">${renderCard(card)}</span>`;
}

function renderMiniFaceCard(card, index) {
  return renderCard(card).replace(
    "playing-card",
    `playing-card mini-card face-up-mini-card`,
  ).replace(
    ">",
    ` style="--mini-index: ${index};">`,
  );
}

function renderSeats() {
  const seats = [els.humanSeat, els.opponentLeft, els.opponentTop, els.opponentRight, els.opponentExtra];
  if (!seats.some(Boolean)) return;
  seats.filter(Boolean).forEach((seat) => { seat.innerHTML = ""; seat.hidden = true; });
  state.players.forEach((player, index) => {
    const seat = seats[index];
    if (!seat) return;
    seat.hidden = false;
    seat.classList.toggle("current", player.id === currentPlayer()?.id && state.stage === "playing");
    seat.classList.toggle("round-winner", player.id === state.roundWinnerId && state.stage === "roundOver");
    seat.classList.toggle("game-winner", player.id === state.winnerId && state.stage === "gameOver");
    seat.innerHTML = `
      <div class="seat-name">${escapeHtml(player.name)}</div>
      <div class="seat-details">${player.hand.length} cards • ${player.score} pts${index === state.dealerIndex ? " • dealer" : ""}</div>
      <div class="mini-hand">${renderMiniHand(player.hand.length, index, player)}</div>
    `;
  });
}

function renderMiniHand(count, playerIndexValue, player) {
  return Array.from({ length: Math.min(count, 8) }, (_item, index) => {
    const dealIndex = playerIndexValue * currentHandSize() + index;
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
  const canDraw = isHumanTurn() && state.stage === "playing" && !state.busy && !state.dealAnimationActive && state.turnPhase === "draw";
  els.drawPileBtn.disabled = !canDraw || (!state.drawPile.length && state.discardPile.length <= 1);
  els.discardPileBtn.disabled = !canDraw || !state.discardPile.length;
  els.drawPileCount.textContent = String(state.drawPile.length);
  const top = topDiscard();
  const discardMotionClass = top?.id === state.discardAnimationCardId
    ? ` class="discard-card-motion play-from-${state.discardAnimationDirection}"`
    : "";
  els.discardPile.innerHTML = top
    ? `<div${discardMotionClass}>${renderCard(top)}</div><span class="seat-details">Discard</span>`
    : `<span class="seat-details">No discard</span>`;
  els.roundBadge.innerHTML = roundBadgeMarkup();
}

function roundBadgeMarkup() {
  if (!state.gameStarted) return "";
  if (state.stage === "gameOver") {
    const winner = state.players.find((player) => player.id === state.winnerId);
    return winner ? `<span class="declared-chip declared-chip-game">Game winner: ${escapeHtml(winner.name)} • ${winner.score} pts</span>` : "";
  }
  if (state.stage === "roundOver") {
    return `<span class="declared-chip declared-chip-round">Round ${state.roundNumber} scored • Wild ${wildRankLabel()}</span>`;
  }
  return `<span class="declared-chip">Wild rank: ${wildRankLabel()} • ${currentHandSize()} cards</span>`;
}

function renderActionControls() {
  const isPlayableHumanTurn = state.gameStarted && state.stage === "playing" && isHumanTurn();
  const canDraw = isPlayableHumanTurn && state.turnPhase === "draw" && !state.busy && !state.dealAnimationActive;
  const canDiscard = isPlayableHumanTurn && state.turnPhase === "discard" && !state.busy && !state.dealAnimationActive;
  els.drawStockActionBtn.disabled = !canDraw;
  els.drawDiscardActionBtn.disabled = !canDraw || !topDiscard();
  els.discardActionBtn.disabled = true;
  els.discardActionBtn.textContent = canDiscard ? "Discard a Card" : "Waiting to Discard";
  if (!state.gameStarted) {
    els.actionHint.textContent = "Your controls will appear once the game starts.";
    return;
  }
  if (isPlayableHumanTurn) {
    els.actionHint.textContent = canDraw
      ? "Choose the stock pile for mystery or the discard pile for its visible top card."
      : "Pick one card from your hand to discard. The app checks whether you can go out.";
  } else {
    els.actionHint.textContent = state.stage === "gameOver"
      ? "Game complete. Start again with the same players or reset the table."
      : state.stage === "roundOver"
        ? "Deal the next round when ready."
        : `${currentPlayer()?.name || "Bot"} is taking a turn.`;
  }
}

function renderHumanHand() {
  const player = humanPlayer();
  els.sortHandBtn.textContent = `Sort by ${state.handSortMode === "suit" ? "Rank" : "Suit"}`;
  els.sortHandBtn.title = `Switch to ${state.handSortMode === "suit" ? "rank-first" : "suit-first"} sorting`;
  els.sortHandBtn.disabled = !player?.hand?.length;
  els.nextRoundBtn.disabled = state.stage !== "roundOver";
  if (!player) {
    if (els.handPanelTitle) els.handPanelTitle.textContent = "Your Hand";
    els.handSummary.textContent = "Start a game to see your cards.";
    els.humanHand.innerHTML = "";
    if (els.humanSeatSummary) els.humanSeatSummary.innerHTML = "";
    els.deadwoodPreview.hidden = true;
    return;
  }
  const deadwood = minDeadwoodScore(player.hand);
  if (els.handPanelTitle) els.handPanelTitle.textContent = player.name;
  els.deadwoodPreview.hidden = !state.gameStarted;
  els.deadwoodPreview.textContent = `Deadwood ${deadwood}`;
  els.handSummary.textContent = `${player.hand.length} cards in hand${isHumanTurn() && state.stage === "playing" ? ` • ${state.turnPhase === "draw" ? "draw" : "discard"}` : ""}.`;
  if (els.humanSeatSummary) {
    els.humanSeatSummary.innerHTML = `
      <div class="player-stats">
        <span class="stat-pill gold">${player.score} pts</span>
        <span class="stat-pill">Wild ${escapeHtml(wildRankLabel())}</span>
        <span class="stat-pill">${state.roundNumber}/${TOTAL_ROUNDS}</span>
      </div>
    `;
  }
  if (shouldShowMeldLayout(player)) {
    els.handSummary.textContent = `${player.hand.length} cards in hand • ${player.id === state.wentOutPlayerId ? "went out" : "round scored"}.`;
    els.humanHand.innerHTML = renderMeldLayout(player.hand, { size: "full", animationKey: meldAnimationKey(player, "hand") });
    return;
  }
  els.humanHand.innerHTML = player.hand.map((card, index) => {
    const legal = isHumanTurn() && state.stage === "playing" && !state.busy && !state.dealAnimationActive && state.turnPhase === "discard";
    const dealIndex = state.players.indexOf(player) * currentHandSize() + player.hand.indexOf(card);
    const freshDraw = state.drawingToHandIds.includes(card.id);
    const drawnCard = state.drawnCardId === card.id;
    const classes = [
      "card-button",
      state.dealAnimationActive ? "dealt" : "",
      freshDraw ? "draw-to-bottom" : "",
      drawnCard ? "drawn-card" : "",
      legal ? "legal" : "illegal",
    ].filter(Boolean).join(" ");
    const styleVars = [`--hand-index: ${index};`];
    if (state.dealAnimationActive) styleVars.push(`--deal-index: ${dealIndex};`);
    return `
      <button class="${classes}" type="button" data-card-id="${card.id}" aria-label="${cardLabel(card)}" style="${styleVars.join(" ")}">
        ${renderCard(card)}
      </button>
    `;
  }).join("");
}

function shouldShowMeldLayout(player) {
  return Boolean(player?.hand?.length)
    && (player.id === state.wentOutPlayerId || state.stage === "roundOver" || state.stage === "gameOver");
}

function meldAnimationKey(player, surface) {
  return `${state.roundNumber}:${player.id}:${surface}`;
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
  const columns = `4.5rem repeat(${state.players.length}, minmax(8rem, 1fr))`;
  const header = `
    <div class="history-row history-header-row" style="grid-template-columns: ${columns};">
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
    <div class="history-row" style="grid-template-columns: ${columns};">
      <strong>#${entry.roundNumber}<br><span class="seat-details">${escapeHtml(entry.wildRank)}</span></strong>
      ${state.players.map((player) => {
        const roundPlayer = entry.players.find((item) => item.id === player.id);
        const marker = player.id === entry.wentOutPlayerId ? `<span class="history-marker">Out • ${roundPlayer?.deadwood || 0}</span>` : `${roundPlayer?.deadwood || 0} pts`;
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
  if (card.rank === "Joker") {
    return `
      <span class="playing-card wild joker-card">
        <span class="wild-badge">WILD</span>
        <span class="card-corner"><span>Joker</span><span class="suit-mark">♛</span></span>
        <span class="card-suit-center"><span class="suit-mark">♛</span></span>
        <span class="card-corner bottom"><span>Joker</span><span class="suit-mark">♛</span></span>
      </span>
    `;
  }
  const suitClass = SUIT_CLASSES[card.suit] || "";
  return `
    <span class="playing-card ${suitClass} ${isWild(card) ? "wild" : ""}">
      ${isWild(card) ? `<span class="wild-badge">WILD</span>` : ""}
      <span class="card-corner"><span>${card.rank}</span><span class="suit-mark">${SUIT_SYMBOLS[card.suit]}</span></span>
      <span class="card-suit-center"><span class="suit-mark">${SUIT_SYMBOLS[card.suit]}</span></span>
      <span class="card-corner bottom"><span>${card.rank}</span><span class="suit-mark">${SUIT_SYMBOLS[card.suit]}</span></span>
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
  const record = normalizeFiveCrownsSessionRecord({
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
  const bundle = sessionExportBundle({
    app: "fivecrowns-table",
    version: SESSION_EXPORT_VERSION,
    sessionName: defaultSessionName(),
    payload: sessionSnapshot(),
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
      showSessionStatus("That file is not a valid 5 Crowns session.");
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
    sourceGame: "fivecrowns-table",
    scorekeeperPreset: "fivecrowns",
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
    const scores = Object.fromEntries(players.map((player) => {
      const roundPlayer = entry.players.find((item) => item.id === player.id);
      return [player.id, Number(roundPlayer?.deadwood) || 0];
    }));
    return scoreKeeperRound(index, scores, {
      n: Number(entry.roundNumber) || index + 1,
      ts: entry.ts,
      extra: {
        fiveCrownsWildRank: entry.wildRank,
        fiveCrownsWentOutPlayerId: entry.wentOutPlayerId,
      },
    });
  });
  return scoreKeeperPayloadBase({
    presetKey: "fivecrowns",
    target: TOTAL_ROUNDS,
    winMode: "low",
    players,
    rounds,
    winnerId: snapshot.winnerId,
    historySortDir: "desc",
    presetNote: "Fixed 11-round 5 Crowns session. Lowest cumulative deadwood score wins.",
  });
}

function sessionSnapshot() {
  return cloneJson({
    gameStarted: state.gameStarted,
    players: state.players,
    roundNumber: state.roundNumber,
    playerCount: state.playerCount,
    dealerIndex: state.dealerIndex,
    currentPlayerIndex: state.currentPlayerIndex,
    stage: state.stage,
    turnPhase: state.turnPhase,
    drawPile: state.drawPile,
    discardPile: state.discardPile,
    drawnCardId: state.drawnCardId,
    finalTurnsRemaining: state.finalTurnsRemaining,
    wentOutPlayerId: state.wentOutPlayerId,
    roundHistory: state.roundHistory,
    historySortDir: state.historySortDir,
    setupBotNames: state.setupBotNames,
    setupBotDifficulties: state.setupBotDifficulties,
    handSortMode: state.handSortMode,
    roundWinnerId: state.roundWinnerId,
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
  state.roundNumber = clampInteger(snapshot.roundNumber, 1, TOTAL_ROUNDS, 1);
  state.playerCount = clampInteger(snapshot.playerCount || state.players.length, 2, 5, DEFAULT_PLAYER_COUNT);
  state.dealerIndex = clampInteger(snapshot.dealerIndex, 0, Math.max(0, state.players.length - 1), 0);
  state.currentPlayerIndex = clampInteger(snapshot.currentPlayerIndex, 0, Math.max(0, state.players.length - 1), 0);
  state.stage = ["setup", "playing", "roundOver", "gameOver"].includes(snapshot.stage) ? snapshot.stage : "playing";
  state.turnPhase = snapshot.turnPhase === "discard" ? "discard" : "draw";
  state.drawPile = Array.isArray(snapshot.drawPile) ? snapshot.drawPile : [];
  state.discardPile = Array.isArray(snapshot.discardPile) ? snapshot.discardPile : [];
  state.drawnCardId = typeof snapshot.drawnCardId === "string" ? snapshot.drawnCardId : "";
  state.finalTurnsRemaining = clampInteger(snapshot.finalTurnsRemaining, 0, 20, 0);
  state.wentOutPlayerId = snapshot.wentOutPlayerId || null;
  state.dealAnimationActive = false;
  state.discardAnimationCardId = "";
  state.discardAnimationDirection = "";
  state.drawingToHandIds = [];
  state.roundHistory = Array.isArray(snapshot.roundHistory) ? snapshot.roundHistory : [];
  state.historySortDir = snapshot.historySortDir === "asc" ? "asc" : "desc";
  state.setupBotNames = Array.isArray(snapshot.setupBotNames) ? snapshot.setupBotNames : [];
  state.setupBotDifficulties = Array.isArray(snapshot.setupBotDifficulties) ? snapshot.setupBotDifficulties : [];
  state.handSortMode = snapshot.handSortMode === "rank" ? "rank" : "suit";
  const latestRound = state.roundHistory[state.roundHistory.length - 1] || null;
  state.roundWinnerId = snapshot.roundWinnerId || (state.stage === "roundOver" ? latestRound?.winnerId : null) || null;
  state.winnerId = snapshot.winnerId || null;
  state.notice = snapshot.notice || "";
  state.sessionExpanded = false;
  sortHands();
  render();
  scheduleBotTurnIfNeeded();
}

function parseImportedSession(json, filename = "") {
  if (!json || typeof json !== "object") return null;
  const payload = json.app === "fivecrowns-table" && json.payload && typeof json.payload === "object"
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
  return normalizeFiveCrownsSessionRecord({
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
    ? raw.map(normalizeFiveCrownsSessionRecord).filter(Boolean).sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
}

function writeSavedSessions(sessions) {
  return writeStoredJson(STORAGE_SESSIONS_KEY, sessions);
}

function normalizeFiveCrownsSessionRecord(session) {
  if (!session || typeof session !== "object") return null;
  const payload = session.payload || session.snapshot;
  if (!payload || typeof payload !== "object") return null;
  if (window.GameRoom?.normalizeSessionRecord) {
    return window.GameRoom.normalizeSessionRecord({ ...session, payload }, { fallbackName: "5 Crowns Session" });
  }
  const createdAt = Number(session.createdAt) || Date.now();
  return {
    id: String(session.id || uid()),
    name: String(session.name || "5 Crowns Session").trim() || "5 Crowns Session",
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
  const human = state.players.find((player) => !player.bot)?.name || "5 Crowns";
  return `${human} 5 Crowns Round ${state.roundNumber}`;
}

function cleanName(value, fallback = "Player") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function readPlayerCount() {
  return clampInteger(els.playerCount.value, 2, 5, DEFAULT_PLAYER_COUNT);
}

function ensureSetupBotNames() {
  const botCount = Math.max(1, readPlayerCount() - 1);
  const existing = Array.isArray(state.setupBotNames) ? state.setupBotNames.slice(0, botCount) : [];
  const missing = botCount - existing.length;
  if (missing > 0) existing.push(...setupBotNames(missing, els.humanName.value || "Rick"));
  state.setupBotNames = existing;
  state.setupBotDifficulties = setupBotDifficulties(botCount, state.setupBotDifficulties, { kind: "standard" });
}

function shuffleSetupBotNames() {
  state.setupBotNames = setupBotNames(Math.max(1, readPlayerCount() - 1), els.humanName.value || "Rick");
}

function syncSetupBotDifficultiesFromInputs() {
  Array.from(els.botNameFields.querySelectorAll("[data-bot-index]")).forEach((input) => {
    state.setupBotNames[Number(input.dataset.botIndex)] = cleanName(input.value, `Bot ${Number(input.dataset.botIndex) + 1}`);
  });
  Array.from(els.botNameFields.querySelectorAll("[data-bot-difficulty-index]")).forEach((select) => {
    state.setupBotDifficulties[Number(select.dataset.botDifficultyIndex)] = normalizeBotDifficulty(select.value, { kind: "standard" });
  });
}

function currentPlayer() {
  return state.players[state.currentPlayerIndex] || null;
}

function indexLabel(player) {
  const index = playerIndex(player);
  if (index === state.dealerIndex) return "Dealer";
  if (player.id === state.roundWinnerId) return "Low round";
  return player.bot ? "Bot player" : "Human player";
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

function currentHandSize() {
  return state.roundNumber + 2;
}

function currentWildRank() {
  return RANKS[state.roundNumber - 1] || "K";
}

function wildRankLabel() {
  return currentWildRank();
}

function isWild(card) {
  return card?.rank === "Joker" || card?.rank === currentWildRank();
}

function cardLabel(card) {
  return card.rank === "Joker" ? "Joker" : `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

function cardPointValue(card) {
  if (card.rank === "Joker") return 50;
  if (card.rank === currentWildRank()) return 20;
  return RANK_VALUES[card.rank] || 0;
}

function rankSortValue(card) {
  return FACE_VALUES[card.rank] || Number(card.rank) || 99;
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
    render();
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
  return ["bottom", "left", "top", "right", "top"][index] || "bottom";
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
if (!restoreActiveGame()) {
  render();
}
