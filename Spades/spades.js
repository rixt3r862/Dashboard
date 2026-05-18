const BOT_NAMES = window.GameRoom?.BOT_NAMES || ["Nick", "Sam", "Nate", "Garth", "Kyle", "Kip"];
const BOT_COUNT = 3;
const BOT_DIFFICULTIES = window.GameRoom?.botDifficultyLevels?.("spades") || window.GameRoom?.botDifficultyLevels?.("standard") || ["easy", "medium", "hard"];
const DEFAULT_TARGET_SCORE = 500;
const BOT_TURN_DELAY_MS = 850;
const DEAL_ANIMATION_MS = 1250;
const TRICK_PAUSE_MS = 1200;
const TRICK_COLLECT_MS = 720;
const SPADE_BURST_MS = 950;
const STORAGE_SESSIONS_KEY = "dashboard.spades.sessions";
const SESSION_EXPORT_VERSION = 1;
const SUITS = ["clubs", "diamonds", "spades", "hearts"];
const SUIT_SYMBOLS = {
  clubs: "♣",
  diamonds: "♦",
  spades: "♠",
  hearts: "♥",
};
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUES = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));

let botTurnTimer = null;
let botTurnToken = 0;

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  teams: [],
  handNumber: 1,
  targetScore: DEFAULT_TARGET_SCORE,
  dealerIndex: 3,
  stage: "setup",
  currentPlayerIndex: 0,
  trickNumber: 1,
  trick: [],
  pendingTrickTimer: null,
  trickCollectTimer: null,
  pendingTrickWinnerIndex: null,
  dealAnimationTimer: null,
  dealAnimationActive: false,
  playAnimationTimer: null,
  playingToTableIds: [],
  spadesBroken: false,
  handHistory: [],
  historySortDir: "desc",
  setupBotNames: [],
  setupBotDifficulties: ["medium", "medium", "medium"],
  sessionExpanded: true,
  winnerTeamId: null,
  notice: "",
  spadeBurstTimer: null,
  spadeBurstSymbols: [],
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
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
  bidValue: document.getElementById("bidValue"),
  leadSuitValue: document.getElementById("leadSuitValue"),
  spadesValue: document.getElementById("spadesValue"),
  actionHint: document.getElementById("actionHint"),
  bidControls: document.getElementById("bidControls"),
  humanBid: document.getElementById("humanBid"),
  confirmBidBtn: document.getElementById("confirmBidBtn"),
  nextHandBtn: document.getElementById("nextHandBtn"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
  sessionTools: document.getElementById("sessionTools"),
  sessionToggleBtn: document.getElementById("sessionToggleBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  downloadSessionBtn: document.getElementById("downloadSessionBtn"),
  importSessionBtn: document.getElementById("importSessionBtn"),
  exportScoreKeeperBtn: document.getElementById("exportScoreKeeperBtn"),
  importSessionFile: document.getElementById("importSessionFile"),
  sessionStatus: document.getElementById("sessionStatus"),
  eventNotice: document.getElementById("eventNotice"),
  winnerBanner: document.getElementById("winnerBanner"),
  scoreBoard: document.getElementById("scoreBoard"),
  leaderText: document.getElementById("leaderText"),
  opponentTop: document.getElementById("opponentTop"),
  opponentLeft: document.getElementById("opponentLeft"),
  opponentRight: document.getElementById("opponentRight"),
  humanSeat: document.getElementById("humanSeat"),
  trickCards: document.getElementById("trickCards"),
  spadeBurst: document.getElementById("spadeBurst"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  historySummary: document.getElementById("historySummary"),
  historyOrderBtn: document.getElementById("historyOrderBtn"),
  historyWrap: document.getElementById("historyWrap"),
};

function bindEvents() {
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.gameStarted && !state.winnerTeamId && !window.confirm("Restart this Spades table?")) return;
    startNewGame();
  });
  els.samePlayersBtn.addEventListener("click", () => {
    if (!state.gameStarted || !state.winnerTeamId || !state.players.length) return;
    startNewGame({ samePlayers: true });
  });
  els.shuffleBotNamesBtn.addEventListener("click", () => {
    shuffleSetupBotNames();
    renderBotNameFields();
  });
  els.resetTableBtn.addEventListener("click", () => {
    if (state.gameStarted && !state.winnerTeamId && !window.confirm("Reset this Spades table?")) return;
    resetState();
    shuffleSetupBotNames();
    renderBotNameFields();
    render();
  });
  els.confirmBidBtn.addEventListener("click", confirmHumanBid);
  els.nextHandBtn.addEventListener("click", dealNextHand);
  els.humanHand.addEventListener("click", handleHandClick);
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

function renderBotNameFields() {
  syncSetupBotDifficultiesFromInputs();
  ensureSetupBotNames();
  els.botNameFields.innerHTML = state.setupBotNames.map((name, index) => `
    <div class="bot-setup-row">
      <label class="field">
        <span>Bot ${index + 1} name</span>
        <input name="botName${index + 1}" data-bot-index="${index}" type="text" maxlength="18" autocomplete="off" value="${escapeHtml(name)}" />
      </label>
      <label class="field">
        <span>Difficulty</span>
        <select name="botDifficulty${index + 1}" data-bot-difficulty-index="${index}">
          ${BOT_DIFFICULTIES.map((difficulty) => `
            <option value="${difficulty}" ${state.setupBotDifficulties[index] === difficulty ? "selected" : ""}>
              ${difficultyLabel(difficulty)}
            </option>
          `).join("")}
        </select>
      </label>
    </div>
  `).join("");
}

function startNewGame(options = {}) {
  const samePlayers = Boolean(options.samePlayers);
  const previousPlayers = samePlayers
    ? state.players.map((player) => ({
      id: player.id,
      name: player.name,
      bot: player.bot,
      difficulty: player.difficulty,
    }))
    : [];
  const targetScore = samePlayers ? state.targetScore : readTargetScore();
  resetState();
  state.gameStarted = true;
  state.sessionExpanded = false;
  state.targetScore = targetScore;
  state.players = samePlayers && previousPlayers.length === 4
    ? previousPlayers.map((player) => createPlayer(player.id, player.name, player.bot, player.difficulty))
    : createPlayers();
  state.setupBotNames = state.players.filter((player) => player.bot).map((player) => player.name);
  state.setupBotDifficulties = state.players.filter((player) => player.bot).map((player) => normalizeDifficulty(player.difficulty));
  state.teams = createTeams();
  dealHand();
}

function resetState() {
  cancelPendingBotTurn();
  clearPendingTrickTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPlayAnimationTimer();
  clearSpadeBurstTimer();
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.teams = [];
  state.handNumber = 1;
  state.targetScore = DEFAULT_TARGET_SCORE;
  state.dealerIndex = 3;
  state.stage = "setup";
  state.currentPlayerIndex = 0;
  state.trickNumber = 1;
  state.trick = [];
  state.pendingTrickTimer = null;
  state.trickCollectTimer = null;
  state.pendingTrickWinnerIndex = null;
  state.dealAnimationActive = false;
  state.playingToTableIds = [];
  state.spadesBroken = false;
  state.handHistory = [];
  state.historySortDir = "desc";
  state.sessionExpanded = true;
  state.winnerTeamId = null;
  state.notice = "";
  state.spadeBurstSymbols = [];
  state.setupBotDifficulties = ["medium", "medium", "medium"];
}

function createPlayers() {
  const humanName = cleanName(els.humanName.value, "Player 1");
  const botNames = setupBotNamesFromInputs(humanName);
  const botDifficulties = setupBotDifficultiesFromInputs();
  return [
    createPlayer("p1", humanName, false, "human"),
    createPlayer("p2", botNames[0], true, botDifficulties[0]),
    createPlayer("p3", botNames[1], true, botDifficulties[1]),
    createPlayer("p4", botNames[2], true, botDifficulties[2]),
  ];
}

function createPlayer(id, name, bot, difficulty) {
  return {
    id,
    name: cleanName(name, id.toUpperCase()),
    bot: Boolean(bot),
    difficulty: normalizeDifficulty(difficulty),
    hand: [],
    bid: null,
    tricks: 0,
    nilBid: false,
  };
}

function createTeams() {
  return [
    {
      id: "teamA",
      name: `${state.players[0].name} + ${state.players[2].name}`,
      members: [state.players[0].id, state.players[2].id],
      score: 0,
      bags: 0,
    },
    {
      id: "teamB",
      name: `${state.players[1].name} + ${state.players[3].name}`,
      members: [state.players[1].id, state.players[3].id],
      score: 0,
      bags: 0,
    },
  ];
}

function dealHand() {
  cancelPendingBotTurn();
  clearPendingTrickTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPlayAnimationTimer();
  clearSpadeBurstTimer();
  state.stage = "bidding";
  state.trick = [];
  state.pendingTrickWinnerIndex = null;
  state.dealAnimationActive = true;
  state.playingToTableIds = [];
  state.trickNumber = 1;
  state.spadesBroken = false;
  state.notice = "Bid your hand. Your partner is across the table.";
  state.currentPlayerIndex = (state.dealerIndex + 1) % 4;
  const deck = shuffle(createDeck());
  state.players.forEach((player) => {
    player.hand = [];
    player.bid = null;
    player.tricks = 0;
    player.nilBid = false;
  });
  deck.forEach((card, index) => {
    state.players[index % 4].hand.push(card);
  });
  state.players.forEach((player) => sortHand(player.hand));
  const suggested = Math.max(0, Math.min(13, estimateBid(state.players[0])));
  els.humanBid.value = String(suggested);
  autoBidBots();
  render();
  startDealAnimationTimer();
}

function dealNextHand() {
  if (state.stage !== "hand-end") return;
  state.handNumber += 1;
  state.dealerIndex = (state.dealerIndex + 1) % 4;
  dealHand();
}

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${rank}-${suit}-${Math.random().toString(36).slice(2, 8)}`,
      suit,
      rank,
      value: RANK_VALUES[rank],
    })),
  );
}

function shuffle(cards) {
  const next = cards.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sortHand(hand) {
  hand.sort((left, right) => {
    const suitDiff = SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit);
    return suitDiff || left.value - right.value;
  });
}

function autoBidBots() {
  state.players.forEach((player) => {
    if (!player.bot) return;
    player.bid = estimateBid(player);
    player.nilBid = player.bid === 0;
  });
}

function estimateBid(player) {
  const spades = player.hand.filter((card) => card.suit === "spades");
  const highCards = player.hand.filter((card) => card.value >= 12);
  const aces = player.hand.filter((card) => card.value === 14);
  let bid = aces.length + spades.filter((card) => card.value >= 11).length;
  bid += highCards.filter((card) => card.suit !== "spades").length > 2 ? 1 : 0;
  bid += spades.length >= 5 ? 1 : 0;
  if (player.bot && player.difficulty === "easy") bid -= Math.random() < 0.42 ? 1 : 0;
  if (player.bot && player.difficulty === "hard") bid += spades.filter((card) => card.value >= 10).length >= 3 ? 1 : 0;
  if (bid <= 1 && highCards.length <= 1 && spades.length <= 2 && Math.random() < 0.35) return 0;
  return Math.max(1, Math.min(7, bid));
}

function confirmHumanBid() {
  if (state.stage !== "bidding") return;
  const bid = clampInteger(els.humanBid.value, 0, 13, 3);
  state.players[0].bid = bid;
  state.players[0].nilBid = bid === 0;
  state.stage = "playing";
  state.notice = `${state.players[0].name} bid ${bid}. ${teamBidLabel(state.teams[0])}.`;
  render();
  scheduleBotTurn();
}

function handleHandClick(event) {
  const button = event.target.closest("[data-card-id]");
  if (!button || !canHumanPlayNow()) return;
  const card = state.players[0].hand.find((entry) => entry.id === button.dataset.cardId);
  if (!card || !legalCards(state.players[0]).some((entry) => entry.id === card.id)) return;
  playCard(0, card);
}

function playCard(playerIndex, card) {
  if (state.stage !== "playing" || playerIndex !== state.currentPlayerIndex) return;
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((entry) => entry.id === card.id);
  if (cardIndex < 0) return;
  player.hand.splice(cardIndex, 1);
  if (card.suit === "spades" && !state.spadesBroken) {
    state.spadesBroken = true;
    triggerSpadeBurst();
    state.notice = `${player.name} broke spades.`;
  } else {
    state.notice = `${player.name} played ${cardLabel(card)}.`;
  }
  state.trick.push({ playerIndex, card });
  markCardPlayingToTable(card.id);
  if (state.trick.length === 4) {
    completeTrick();
    return;
  }
  state.currentPlayerIndex = nextPlayerIndex(playerIndex);
  render();
  scheduleBotTurn();
}

function completeTrick() {
  const winnerIndex = trickWinnerIndex(state.trick);
  const winner = state.players[winnerIndex];
  winner.tricks += 1;
  state.currentPlayerIndex = winnerIndex;
  state.pendingTrickWinnerIndex = winnerIndex;
  state.stage = "trick-complete";
  state.notice = `${winner.name} takes trick ${state.trickNumber}.`;
  render();
  state.pendingTrickTimer = window.setTimeout(() => {
    state.pendingTrickTimer = null;
    state.stage = "trick-collecting";
    render();
    state.trickCollectTimer = window.setTimeout(() => {
      state.trickCollectTimer = null;
      resolveCollectedTrick(winnerIndex);
    }, TRICK_COLLECT_MS);
  }, TRICK_PAUSE_MS);
}

function resolveCollectedTrick(winnerIndex) {
  const winner = state.players[winnerIndex];
  state.trick = [];
  state.playingToTableIds = [];
  state.pendingTrickWinnerIndex = null;
  if (state.players.every((player) => player.hand.length === 0)) {
    completeHand();
    return;
  }
  state.trickNumber += 1;
  state.stage = "playing";
  state.notice = `${winner.name} leads trick ${state.trickNumber}.`;
  render();
  scheduleBotTurn();
}

function completeHand() {
  const teamResults = state.teams.map(scoreTeamHand);
  const roundScores = {};
  for (const result of teamResults) {
    const team = state.teams.find((entry) => entry.id === result.teamId);
    team.score += result.score;
    team.bags += result.bagsWon;
    if (team.bags >= 10) {
      const penalties = Math.floor(team.bags / 10);
      team.score -= penalties * 100;
      team.bags %= 10;
      result.bagPenalty = penalties * 100;
    }
    roundScores[team.id] = result.score - (result.bagPenalty || 0);
  }
  state.handHistory.unshift({
    handNumber: state.handNumber,
    ts: Date.now(),
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
      score: team.score,
      bags: team.bags,
      roundScore: roundScores[team.id],
      bid: teamBid(team),
      tricks: teamTricks(team),
    })),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      bid: player.bid,
      tricks: player.tricks,
      nilBid: player.nilBid,
    })),
  });
  state.winnerTeamId = winningTeamId();
  state.stage = state.winnerTeamId ? "game-end" : "hand-end";
  state.notice = state.winnerTeamId
    ? `${teamById(state.winnerTeamId).name} wins the table.`
    : handSummaryText(teamResults);
  render();
}

function scoreTeamHand(team) {
  const members = team.members.map(playerById);
  const nilResults = members.filter((player) => player.nilBid).map((player) => ({
    playerId: player.id,
    success: player.tricks === 0,
    score: player.tricks === 0 ? 100 : -100,
  }));
  const regularBid = members.reduce((sum, player) => sum + (player.nilBid ? 0 : Number(player.bid) || 0), 0);
  const regularTricks = members.reduce((sum, player) => sum + (player.nilBid ? 0 : player.tricks), 0);
  const madeBid = regularTricks >= regularBid;
  const bidScore = regularBid === 0 ? 0 : madeBid ? regularBid * 10 : regularBid * -10;
  const bagsWon = madeBid ? Math.max(0, regularTricks - regularBid) : 0;
  const nilScore = nilResults.reduce((sum, result) => sum + result.score, 0);
  return {
    teamId: team.id,
    score: bidScore + bagsWon + nilScore,
    bagsWon,
    madeBid,
    nilResults,
    bagPenalty: 0,
  };
}

function winningTeamId() {
  const hit = state.teams.filter((team) => team.score >= state.targetScore);
  if (!hit.length) return null;
  return state.teams.slice().sort((left, right) => right.score - left.score)[0].id;
}

function handSummaryText(results) {
  return results.map((result) => {
    const team = teamById(result.teamId);
    const penalty = result.bagPenalty ? `, ${result.bagPenalty} bag penalty` : "";
    return `${team.name}: ${result.score - result.bagPenalty} this hand${penalty}`;
  }).join(". ");
}

function scheduleBotTurn() {
  cancelPendingBotTurn();
  if (state.stage !== "playing") return;
  const player = state.players[state.currentPlayerIndex];
  if (!player?.bot) return;
  const token = ++botTurnToken;
  botTurnTimer = window.setTimeout(() => {
    if (token !== botTurnToken || state.stage !== "playing") return;
    playCard(state.currentPlayerIndex, chooseBotCard(player));
  }, BOT_TURN_DELAY_MS);
}

function cancelPendingBotTurn() {
  botTurnToken += 1;
  if (botTurnTimer) window.clearTimeout(botTurnTimer);
  botTurnTimer = null;
}

function clearPendingTrickTimer() {
  if (state.pendingTrickTimer) window.clearTimeout(state.pendingTrickTimer);
  state.pendingTrickTimer = null;
}

function clearTrickCollectTimer() {
  if (state.trickCollectTimer) window.clearTimeout(state.trickCollectTimer);
  state.trickCollectTimer = null;
  state.pendingTrickWinnerIndex = null;
}

function startDealAnimationTimer() {
  clearDealAnimationTimer();
  state.dealAnimationTimer = window.setTimeout(() => {
    state.dealAnimationTimer = null;
    state.dealAnimationActive = false;
    render();
  }, DEAL_ANIMATION_MS);
}

function clearDealAnimationTimer() {
  if (!state.dealAnimationTimer) return;
  window.clearTimeout(state.dealAnimationTimer);
  state.dealAnimationTimer = null;
}

function markCardPlayingToTable(cardId) {
  clearPlayAnimationTimer();
  state.playingToTableIds = [cardId];
  state.playAnimationTimer = window.setTimeout(() => {
    state.playAnimationTimer = null;
    state.playingToTableIds = state.playingToTableIds.filter((id) => id !== cardId);
    renderTrick();
  }, 680);
}

function clearPlayAnimationTimer() {
  if (state.playAnimationTimer) window.clearTimeout(state.playAnimationTimer);
  state.playAnimationTimer = null;
  state.playingToTableIds = [];
}

function triggerSpadeBurst() {
  clearSpadeBurstTimer();
  state.spadeBurstSymbols = Array.from({ length: 15 }, (_, index) => ({
    delay: `${Math.random() * 0.16}s`,
    distance: (2.6 + Math.random() * 3.2).toFixed(2),
    symbol: "♠",
  }));
  state.spadeBurstTimer = window.setTimeout(() => {
    state.spadeBurstSymbols = [];
    state.spadeBurstTimer = null;
    renderTrick();
  }, SPADE_BURST_MS);
}

function clearSpadeBurstTimer() {
  if (state.spadeBurstTimer) window.clearTimeout(state.spadeBurstTimer);
  state.spadeBurstTimer = null;
  state.spadeBurstSymbols = [];
}

function chooseBotCard(player) {
  const legal = legalCards(player).slice().sort((left, right) => left.value - right.value);
  const difficulty = normalizeDifficulty(player.difficulty);
  if (difficulty === "easy") return legal[0];
  const winningCard = currentWinningPlay()?.card;
  const canWin = legal.filter((card) => !winningCard || beats(card, winningCard, leadSuit()));
  const partnerWinning = currentWinningPlay() && sameTeam(player.id, state.players[currentWinningPlay().playerIndex].id);
  const needsTricks = player.bid > player.tricks || player.nilBid === false;
  if (player.nilBid) return legal[0];
  if (partnerWinning && difficulty !== "hard") return legal[0];
  if (needsTricks && canWin.length) return canWin.sort((left, right) => left.value - right.value)[0];
  return legal[0];
}

function legalCards(player) {
  if (state.stage !== "playing") return [];
  if (!state.trick.length) {
    if (state.spadesBroken || player.hand.every((card) => card.suit === "spades")) return player.hand.slice();
    return player.hand.filter((card) => card.suit !== "spades");
  }
  const lead = leadSuit();
  const followSuit = player.hand.filter((card) => card.suit === lead);
  return followSuit.length ? followSuit : player.hand.slice();
}

function trickWinnerIndex(trick) {
  return trick.reduce((best, play) => {
    if (!best || beats(play.card, best.card, trick[0].card.suit)) return play;
    return best;
  }, null).playerIndex;
}

function currentWinningPlay() {
  if (!state.trick.length) return null;
  return state.trick.reduce((best, play) => {
    if (!best || beats(play.card, best.card, leadSuit())) return play;
    return best;
  }, null);
}

function beats(card, currentBest, lead) {
  if (card.suit === currentBest.suit) return card.value > currentBest.value;
  if (card.suit === "spades" && currentBest.suit !== "spades") return true;
  if (card.suit !== "spades" && currentBest.suit === "spades") return false;
  return card.suit === lead && currentBest.suit !== lead;
}

function leadSuit() {
  return state.trick[0]?.card?.suit || "";
}

function nextPlayerIndex(index) {
  return (index + 1) % 4;
}

function canHumanPlayNow() {
  return state.stage === "playing" && state.currentPlayerIndex === 0;
}

function sameTeam(leftPlayerId, rightPlayerId) {
  return state.teams.some((team) => team.members.includes(leftPlayerId) && team.members.includes(rightPlayerId));
}

function teamById(teamId) {
  return state.teams.find((team) => team.id === teamId);
}

function playerById(playerId) {
  return state.players.find((player) => player.id === playerId);
}

function teamBid(team) {
  return team.members.reduce((sum, id) => {
    const player = playerById(id);
    return sum + (player?.nilBid ? 0 : Number(player?.bid) || 0);
  }, 0);
}

function teamTricks(team) {
  return team.members.reduce((sum, id) => sum + (Number(playerById(id)?.tricks) || 0), 0);
}

function teamBidLabel(team) {
  return `${team.name} bid ${teamBid(team)}.`;
}

function readTargetScore() {
  return clampInteger(els.targetScore.value, 100, 1000, DEFAULT_TARGET_SCORE);
}

function setupBotNamesFromInputs(humanName) {
  ensureSetupBotNames();
  const names = Array.from(els.botNameFields.querySelectorAll("[data-bot-index]"))
    .map((input, index) => cleanName(input.value, state.setupBotNames[index] || `Bot ${index + 1}`));
  const fallbackNames = setupBotNames(BOT_COUNT, humanName);
  return Array.from({ length: BOT_COUNT }, (_, index) => cleanName(names[index], fallbackNames[index] || `Bot ${index + 1}`));
}

function setupBotDifficultiesFromInputs() {
  const values = Array.from(els.botNameFields.querySelectorAll("[data-bot-difficulty-index]"))
    .map((select) => normalizeDifficulty(select.value));
  state.setupBotDifficulties = setupBotDifficulties(BOT_COUNT, values, { levels: BOT_DIFFICULTIES, fallback: "medium" });
  return state.setupBotDifficulties;
}

function syncSetupBotDifficultiesFromInputs() {
  const selects = Array.from(els.botNameFields?.querySelectorAll("[data-bot-difficulty-index]") || []);
  if (!selects.length) {
    state.setupBotDifficulties = setupBotDifficulties(BOT_COUNT, state.setupBotDifficulties, { levels: BOT_DIFFICULTIES, fallback: "medium" });
    return;
  }
  setupBotDifficultiesFromInputs();
}

function ensureSetupBotNames() {
  if (!Array.isArray(state.setupBotNames) || state.setupBotNames.length !== BOT_COUNT) {
    state.setupBotNames = setupBotNames(BOT_COUNT, cleanName(els.humanName?.value, "Player 1"));
  }
}

function shuffleSetupBotNames() {
  state.setupBotNames = setupBotNames(BOT_COUNT, cleanName(els.humanName?.value, "Player 1"));
}

function sessionSnapshot() {
  return {
    version: SESSION_EXPORT_VERSION,
    gameStarted: state.gameStarted,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      bot: player.bot,
      difficulty: player.difficulty,
      hand: player.hand,
      bid: player.bid,
      tricks: player.tricks,
      nilBid: player.nilBid,
    })),
    teams: state.teams.map((team) => ({ ...team })),
    handNumber: state.handNumber,
    targetScore: state.targetScore,
    dealerIndex: state.dealerIndex,
    stage: state.stage,
    currentPlayerIndex: state.currentPlayerIndex,
    trickNumber: state.trickNumber,
    trick: state.trick,
    spadesBroken: state.spadesBroken,
    handHistory: state.handHistory,
    historySortDir: state.historySortDir,
    winnerTeamId: state.winnerTeamId,
    notice: state.notice,
  };
}

function restoreSessionSnapshot(snapshot) {
  cancelPendingBotTurn();
  clearPendingTrickTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPlayAnimationTimer();
  clearSpadeBurstTimer();
  const payload = cloneJson(snapshot);
  state.gameStarted = Boolean(payload.gameStarted ?? true);
  state.players = Array.isArray(payload.players)
    ? payload.players.map((player, index) => ({
      ...createPlayer(player.id || `p${index + 1}`, player.name, player.bot, player.difficulty),
      hand: Array.isArray(player.hand) ? player.hand : [],
      bid: player.bid ?? null,
      tricks: Number(player.tricks) || 0,
      nilBid: Boolean(player.nilBid),
    }))
    : [];
  state.teams = Array.isArray(payload.teams) && payload.teams.length === 2
    ? payload.teams.map((team) => ({
      id: team.id,
      name: team.name,
      members: Array.isArray(team.members) ? team.members : [],
      score: Number(team.score) || 0,
      bags: Number(team.bags) || 0,
    }))
    : createTeams();
  state.handNumber = clampInteger(payload.handNumber, 1, 999, 1);
  state.targetScore = clampInteger(payload.targetScore, 100, 1000, DEFAULT_TARGET_SCORE);
  state.dealerIndex = clampInteger(payload.dealerIndex, 0, 3, 3);
  state.stage = ["setup", "bidding", "playing", "trick-complete", "trick-collecting", "hand-end", "game-end"].includes(payload.stage) ? payload.stage : "playing";
  state.currentPlayerIndex = clampInteger(payload.currentPlayerIndex, 0, 3, 0);
  state.trickNumber = clampInteger(payload.trickNumber, 1, 13, 1);
  state.trick = Array.isArray(payload.trick) ? payload.trick : [];
  state.pendingTrickWinnerIndex = null;
  state.dealAnimationActive = false;
  state.playingToTableIds = [];
  state.spadesBroken = Boolean(payload.spadesBroken);
  state.handHistory = Array.isArray(payload.handHistory) ? payload.handHistory : [];
  state.historySortDir = normalizeHistorySortDir(payload.historySortDir, "desc");
  state.winnerTeamId = payload.winnerTeamId || null;
  state.notice = String(payload.notice || "");
  state.sessionExpanded = false;
  state.setupBotNames = state.players.filter((player) => player.bot).map((player) => player.name);
  state.setupBotDifficulties = state.players.filter((player) => player.bot).map((player) => normalizeDifficulty(player.difficulty));
  renderBotNameFields();
  render();
  scheduleBotTurn();
}

function readSavedSessions() {
  const sessions = readStoredJson(STORAGE_SESSIONS_KEY, []);
  return Array.isArray(sessions)
    ? sessions.map(normalizeSpadesSessionRecord).filter(Boolean).sort((left, right) => right.updatedAt - left.updatedAt)
    : [];
}

function writeSavedSessions(sessions) {
  return writeStoredJson(STORAGE_SESSIONS_KEY, sessions.map(normalizeSpadesSessionRecord).filter(Boolean));
}

function saveSession() {
  if (!state.gameStarted) {
    showSessionStatus("Start a game before saving.");
    return;
  }
  const name = window.prompt("Save this Spades session as:", defaultSessionName());
  if (!name) return;
  const id = uid();
  const now = Date.now();
  const record = normalizeSpadesSessionRecord({
    id,
    name: name.trim() || defaultSessionName(),
    payload: sessionSnapshot(),
    createdAt: now,
    updatedAt: now,
  });
  writeSavedSessions([record, ...readSavedSessions()]);
  showSessionStatus(`Saved ${record.name}.`);
  renderSessionControls(id);
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
    app: "spades-table",
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
      showSessionStatus("That file is not a valid Spades session.");
      return;
    }
    writeSavedSessions([imported, ...readSavedSessions().filter((session) => session.id !== imported.id)]);
    restoreSessionSnapshot(imported.payload);
    renderSessionControls(imported.id);
    showSessionStatus(`Session imported: ${imported.name}.`);
  } catch {
    showSessionStatus("Import failed. Check that the file contains valid JSON.");
  } finally {
    els.importSessionFile.value = "";
  }
}

function parseImportedSession(json, filename = "") {
  if (!json || typeof json !== "object") return null;
  const payload = json.app === "spades-table" && json.payload && typeof json.payload === "object"
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
  return normalizeSpadesSessionRecord({
    id: uid(),
    name: providedName,
    payload: cloneJson(payload),
    createdAt: now,
    updatedAt: now,
  });
}

function exportScoreKeeper() {
  if (!state.handHistory.length) {
    showSessionStatus("Complete at least one hand before exporting to ScoreKeeper.");
    return;
  }
  const snapshot = sessionSnapshot();
  const payload = scoreKeeperExportBundle({
    version: 1,
    sourceGame: "spades-table",
    scorekeeperPreset: "spades",
    sessionName: defaultSessionName(),
    scorekeeperPayload: scoreKeeperPayload(snapshot),
    sourcePayload: snapshot,
  });
  downloadJson(`${slugify(defaultSessionName())}-scorekeeper.json`, payload);
  showSessionStatus("ScoreKeeper export downloaded.");
}

function scoreKeeperPayload(snapshot) {
  const players = scoreKeeperPlayers(snapshot.players, cleanName);
  const teams = [
    { id: "teamA", name: `${players[0].name} + ${players[2].name}`, members: [players[0].id, players[2].id] },
    { id: "teamB", name: `${players[1].name} + ${players[3].name}`, members: [players[1].id, players[3].id] },
  ];
  const rounds = snapshot.handHistory.slice().reverse().map((entry, index) => {
    const teamRoundScores = Object.fromEntries((entry.teams || []).map((team) => [team.id, Number(team.roundScore) || 0]));
    const scores = Object.fromEntries(players.map((player) => [player.id, 0]));
    teams.forEach((team) => {
      const score = teamRoundScores[team.id] || 0;
      scores[team.members[0]] = score;
    });
    return scoreKeeperRound(index, scores, {
      n: Number(entry.handNumber) || index + 1,
      ts: entry.ts,
      extra: {
        spadesTeamBidsByTeamId: Object.fromEntries((entry.teams || []).map((team) => [
          team.id,
          (team.members || []).reduce((sum, playerId) => {
            const player = (entry.players || []).find((entryPlayer) => entryPlayer.id === playerId);
            return sum + (Number(player?.bid) || 0);
          }, 0),
        ])),
        spadesTeamTricksByTeamId: Object.fromEntries((entry.teams || []).map((team) => [
          team.id,
          (team.members || []).reduce((sum, playerId) => {
            const player = (entry.players || []).find((entryPlayer) => entryPlayer.id === playerId);
            return sum + (Number(player?.tricks) || 0);
          }, 0),
        ])),
        spadesBids: Object.fromEntries((entry.players || []).map((player) => [player.id, player.bid])),
        spadesTricks: Object.fromEntries((entry.players || []).map((player) => [player.id, player.tricks])),
      },
    });
  });
  return scoreKeeperPayloadBase({
    presetKey: "spades",
    target: snapshot.targetScore,
    winMode: "high",
    players,
    rounds,
    winnerId: snapshot.winnerTeamId,
    teams,
    spadesPartnerIndex: 3,
    historySortDir: "desc",
    presetNote: "Partnership Spades export from the single-device table.",
  });
}

function selectedSavedSession() {
  const id = els.savedSessionSelect.value;
  return readSavedSessions().find((session) => session.id === id);
}

function normalizeSpadesSessionRecord(session) {
  if (!session || typeof session !== "object") return null;
  const payload = session.payload || session.snapshot;
  if (!payload || typeof payload !== "object") return null;
  const rawRecord = {
    ...session,
    payload,
    createdAt: session.createdAt ?? session.savedAt,
    updatedAt: session.updatedAt ?? session.savedAt,
  };
  if (window.GameRoom?.normalizeSessionRecord) {
    return window.GameRoom.normalizeSessionRecord(rawRecord, { fallbackName: "Spades Session" });
  }
  if (typeof rawRecord.id !== "string" || !rawRecord.id) return null;
  const createdAt = sessionTimestamp(rawRecord.createdAt);
  return {
    id: rawRecord.id,
    name: String(rawRecord.name || "Spades Session").trim() || "Spades Session",
    payload: cloneJson(payload),
    createdAt,
    updatedAt: sessionTimestamp(rawRecord.updatedAt, createdAt),
  };
}

function showSessionStatus(message) {
  els.sessionStatus.textContent = message;
}

function render() {
  renderSetupPanel();
  renderStatus();
  renderSessionControls();
  renderScoreBoard();
  renderSeats();
  renderTrick();
  renderHumanHand();
  renderActions();
  renderHistory();
}

function renderSetupPanel() {
  const isActiveGame = state.gameStarted && !state.winnerTeamId;
  const canReusePlayers = state.gameStarted && Boolean(state.winnerTeamId) && state.players.length === 4;
  els.setupFields.hidden = isActiveGame;
  els.setupSummary.hidden = !isActiveGame;
  els.samePlayersBtn.hidden = !canReusePlayers;
  if (!isActiveGame) {
    els.setupSummary.innerHTML = "";
    return;
  }
  els.setupSummary.innerHTML = `
    <strong>${escapeHtml(state.players[0]?.name || "Player")} partners with ${escapeHtml(state.players[2]?.name || "Partner")}</strong>
    <span>Target ${state.targetScore} · Opponents: ${escapeHtml(state.players[1]?.name || "Bot")} + ${escapeHtml(state.players[3]?.name || "Bot")}</span>
  `;
}

function renderStatus() {
  const current = state.players[state.currentPlayerIndex];
  els.roundValue.textContent = state.gameStarted ? String(state.handNumber) : "-";
  els.turnValue.textContent = current && ["bidding", "playing"].includes(state.stage) ? current.name : "-";
  els.bidValue.textContent = state.gameStarted ? state.players.map((player) => player.bid ?? "-").join(" / ") : "-";
  els.leadSuitValue.innerHTML = state.gameStarted && leadSuit() ? renderSuitLabel(leadSuit()) : "-";
  els.spadesValue.textContent = state.gameStarted ? (state.spadesBroken ? "Broken" : "Closed") : "-";
  if (!state.gameStarted) {
    els.statusText.textContent = "Deal a table to begin.";
  } else if (state.stage === "bidding") {
    els.statusText.textContent = "Set your bid. Bots have already sized up their hands.";
  } else if (state.stage === "hand-end") {
    els.statusText.textContent = "Hand complete. Deal the next hand when ready.";
  } else if (state.stage === "game-end") {
    els.statusText.textContent = "Game complete.";
  } else if (state.stage === "trick-complete") {
    els.statusText.textContent = state.notice || "Trick complete.";
  } else if (state.stage === "trick-collecting") {
    els.statusText.textContent = state.notice || "Collecting the trick.";
  } else {
    els.statusText.textContent = state.notice || "Play the trick.";
  }
  els.eventNotice.hidden = !state.notice;
  els.eventNotice.textContent = state.notice;
}

function renderScoreBoard() {
  if (!state.players.length) {
    els.scoreBoard.innerHTML = "";
    els.leaderText.textContent = "Highest score wins when a team reaches the target.";
    els.winnerBanner.hidden = true;
    return;
  }
  const leader = state.teams.slice().sort((left, right) => right.score - left.score)[0];
  els.leaderText.textContent = `Target ${state.targetScore}; ${leader.name} leads at ${leader.score}`;
  const teamMarkup = `
    <div class="team-row">
      ${state.teams.map((team) => `
        <div class="team-card ${team.id === leader.id ? "leading" : ""} ${team.id === state.winnerTeamId ? "winner" : ""}">
          <strong>${escapeHtml(team.name)} · ${team.score}</strong>
          <span>Bid ${teamBid(team)} · Tricks ${teamTricks(team)} · Bags ${team.bags}</span>
        </div>
      `).join("")}
    </div>
  `;
  const scorePlayers = state.teams
    .flatMap((team) => team.members.map(playerById))
    .filter(Boolean);
  const playerMarkup = `
    <div class="player-score-row">
      ${scorePlayers.map((player) => `
        <div class="score-card ${state.players[state.currentPlayerIndex]?.id === player.id && state.stage === "playing" ? "current" : ""}">
          <strong>${escapeHtml(player.name)} · ${player.tricks} trick${player.tricks === 1 ? "" : "s"}</strong>
          <span class="score-meta">${escapeHtml(player.bot ? difficultyLabel(player.difficulty) : "Human")} · Bid ${player.bid ?? "-"}${player.nilBid ? " · Nil" : ""} · ${player.hand.length} cards</span>
        </div>
      `).join("")}
    </div>
  `;
  els.scoreBoard.innerHTML = `${teamMarkup}${playerMarkup}`;
  const winner = state.winnerTeamId ? teamById(state.winnerTeamId) : null;
  els.winnerBanner.hidden = !winner;
  els.winnerBanner.innerHTML = winner
    ? winnerBannerMarkup({
      winnerName: winner.name,
      kicker: "Table winner",
      message: `Final score: ${winner.score}. Target was ${state.targetScore}.`,
    })
    : "";
}

function renderSeats() {
  const seatMap = [
    [els.humanSeat, 0],
    [els.opponentLeft, 1],
    [els.opponentTop, 2],
    [els.opponentRight, 3],
  ];
  seatMap.forEach(([element, index]) => {
    const player = state.players[index];
    if (!player) {
      element.innerHTML = "";
      element.hidden = true;
      return;
    }
    element.hidden = false;
    element.classList.toggle("current", index === state.currentPlayerIndex && ["bidding", "playing"].includes(state.stage));
    element.innerHTML = `
      <div class="seat-name">${escapeHtml(player.name)}</div>
      <div class="seat-details">Bid ${player.bid ?? "-"} · Tricks ${player.tricks}</div>
      <div class="mini-hand">${renderMiniHand(player.hand.length)}</div>
    `;
  });
}

function renderMiniHand(count) {
  return Array.from({ length: count }, (_, index) => (
    renderCardBack(state.dealAnimationActive ? { className: "dealt", dealIndex: index } : {})
  )).join("");
}

function renderTrick() {
  els.spadeBurst.hidden = !state.spadeBurstSymbols.length;
  els.spadeBurst.innerHTML = state.spadeBurstSymbols.map((entry, index) => (
    `<span style="--burst-index: ${index}; --burst-delay: ${entry.delay}; --burst-distance: ${entry.distance}rem;">${entry.symbol}</span>`
  )).join("");
  els.trickCards.innerHTML = state.trick.map((play) => `
    <div class="trick-play ${state.playingToTableIds.includes(play.card.id) ? `play-from-${seatDirection(play.playerIndex)}` : ""} ${state.stage === "trick-collecting" ? `collect-to-${seatDirection(state.pendingTrickWinnerIndex)}` : ""}">
      ${renderCard(play.card)}
      <span class="trick-player">${escapeHtml(state.players[play.playerIndex].name)}</span>
    </div>
  `).join("");
}

function seatDirection(playerIndex) {
  return ["bottom", "left", "top", "right"][playerIndex] || "bottom";
}

function renderHumanHand() {
  const human = state.players[0];
  if (!human) {
    els.handSummary.textContent = "Start a game to see your cards.";
    els.humanHand.innerHTML = "";
    return;
  }
  const legal = new Set(legalCards(human).map((card) => card.id));
  els.handSummary.textContent = state.stage === "bidding"
    ? "Review your hand and enter a bid."
    : `${human.hand.length} cards in hand. ${canHumanPlayNow() ? "Your turn." : ""}`;
  els.humanHand.innerHTML = human.hand.map((card, index) => {
    const isHumanTurn = canHumanPlayNow();
    const playable = isHumanTurn && legal.has(card.id);
    const illegal = isHumanTurn && !legal.has(card.id);
    const dealStyle = state.dealAnimationActive ? ` style="--deal-index: ${index};"` : "";
    return `
      <button class="card-button ${state.dealAnimationActive ? "dealt" : ""} ${playable ? "legal" : ""} ${illegal ? "illegal" : ""}" type="button" data-card-id="${card.id}" aria-label="${cardLabel(card)}"${dealStyle}>
        ${renderCard(card)}
      </button>
    `;
  }).join("");
}

function renderActions() {
  els.bidControls.hidden = state.stage !== "bidding";
  els.confirmBidBtn.disabled = state.stage !== "bidding";
  els.nextHandBtn.hidden = state.stage !== "hand-end";
  if (!state.gameStarted) {
    els.actionHint.textContent = "Your controls will appear once the game starts.";
  } else if (state.stage === "bidding") {
    els.actionHint.textContent = "Bid 0 for nil, or bid the number of tricks you expect to take.";
  } else if (canHumanPlayNow()) {
    els.actionHint.textContent = "Play one highlighted legal card.";
  } else if (state.stage === "trick-complete") {
    els.actionHint.textContent = "The completed trick is staying on the table for a moment.";
  } else if (state.stage === "trick-collecting") {
    els.actionHint.textContent = "The trick is moving to the player who took it.";
  } else if (state.stage === "hand-end") {
    els.actionHint.textContent = "Review the score, then deal the next hand.";
  } else if (state.stage === "game-end") {
    els.actionHint.textContent = "Start a new game from the setup panel.";
  } else {
    els.actionHint.textContent = "Bots are playing their cards.";
  }
}

function renderHistory() {
  els.historySummary.textContent = state.handHistory.length
    ? `${state.handHistory.length} completed hand${state.handHistory.length === 1 ? "" : "s"}.`
    : "Completed hands will appear here.";
  renderHistorySortControl(els.historyOrderBtn, state.historySortDir, state.handHistory.length);
  const history = orderedHistory(state.handHistory, state.historySortDir, { newestAt: "start" });
  const header = state.teams.length
    ? `
      <div class="history-row history-header-row">
        <strong>Hand</strong>
        ${state.teams.map((team) => `
          <span class="history-player-head">
            <span class="history-player-name">${escapeHtml(team.name)}</span>
            <span class="history-player-points">${Number(team.score) || 0} pts</span>
          </span>
        `).join("")}
      </div>
    `
    : "";
  els.historyWrap.innerHTML = `${header}${history.map((entry) => `
    <div class="history-row">
      <strong>${entry.handNumber}</strong>
      ${(entry.teams || []).map((team) => `
        <span>${Number(team.roundScore) || 0} <b class="history-marker">Bid ${Number(team.bid) || 0}, ${Number(team.tricks) || 0} tricks</b></span>
      `).join("")}
    </div>
  `).join("")}`;
}

function renderSessionControls(selectedId = els.savedSessionSelect.value) {
  const sessions = readSavedSessions();
  const selected = selectedId && sessions.some((session) => session.id === selectedId) ? selectedId : "";
  els.savedSessionSelect.innerHTML = `<option value="">${escapeHtml(sessionSelectPlaceholder())}</option>`;
  sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = session.id;
    option.textContent = sessionOptionLabel(session);
    option.selected = session.id === selected;
    els.savedSessionSelect.appendChild(option);
  });
  const currentSession = sessions.find((session) => session.id === selected) || null;
  els.savedSessionSelect.disabled = sessions.length === 0;
  els.loadSessionBtn.disabled = !selected;
  els.deleteSessionBtn.disabled = !selected;
  els.saveSessionBtn.disabled = !state.gameStarted;
  els.downloadSessionBtn.disabled = !state.gameStarted;
  els.exportScoreKeeperBtn.disabled = !state.handHistory.length;
  els.saveSessionBtn.textContent = sessionSaveButtonLabel(currentSession);
  els.sessionTools.hidden = !state.sessionExpanded;
  els.sessionToggleBtn.textContent = sessionToggleLabel(state.sessionExpanded);
  els.sessionToggleBtn.setAttribute("aria-expanded", String(state.sessionExpanded));
  if (!els.sessionStatus.textContent || els.sessionStatus.textContent === sessionSelectPlaceholder()) {
    els.sessionStatus.textContent = sessionStatusText({ sessions, currentSession });
  }
}

function renderCard(card) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return `
    <span class="playing-card ${red ? "red" : "black"}">
      <span class="card-corner"><span>${card.rank}</span><span>${SUIT_SYMBOLS[card.suit]}</span></span>
      <span class="card-suit-center">${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-corner bottom"><span>${card.rank}</span><span>${SUIT_SYMBOLS[card.suit]}</span></span>
    </span>
  `;
}

function renderCardBack(options = {}) {
  const className = options.className ? ` ${options.className}` : "";
  const style = Number.isFinite(options.dealIndex) ? ` style="--deal-index: ${options.dealIndex};"` : "";
  return `<span class="playing-card card-back${className}" aria-hidden="true"${style}></span>`;
}

function renderSuitLabel(suit) {
  return `<span class="${suit === "hearts" || suit === "diamonds" ? "red-suit" : ""}">${SUIT_SYMBOLS[suit] || "-"}</span>`;
}

function cardLabel(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

function cleanName(value, fallback = "Player") {
  return String(value || fallback).trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function clampInteger(value, min, max, fallback) {
  if (window.GameRoom?.clampInteger) return window.GameRoom.clampInteger(value, min, max, fallback);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}

function normalizeDifficulty(value) {
  return window.GameRoom?.normalizeBotDifficulty
    ? window.GameRoom.normalizeBotDifficulty(value, { levels: BOT_DIFFICULTIES, fallback: "medium" })
    : BOT_DIFFICULTIES.includes(value) ? value : "medium";
}

function difficultyLabel(value) {
  return window.GameRoom?.difficultyLabel
    ? window.GameRoom.difficultyLabel(value, { levels: BOT_DIFFICULTIES, fallback: "medium" })
    : String(normalizeDifficulty(value)).replace(/^\w/, (char) => char.toUpperCase());
}

function setupBotNames(count, humanName = "") {
  return window.GameRoom?.setupBotNames
    ? window.GameRoom.setupBotNames(count, humanName, "Player 1")
    : Array.from({ length: count }, (_, index) => BOT_NAMES[index] || `Bot ${index + 1}`);
}

function setupBotDifficulties(count, difficulties = [], options = {}) {
  return window.GameRoom?.setupBotDifficulties
    ? window.GameRoom.setupBotDifficulties(count, difficulties, options)
    : Array.from({ length: count }, (_, index) => normalizeDifficulty(difficulties[index]));
}

function defaultSessionName(payload = sessionSnapshot()) {
  return window.GameRoom?.defaultSessionName
    ? window.GameRoom.defaultSessionName(payload, { gameName: "Spades", roundKey: "handNumber", roundLabel: "Hand", nameCount: 4 })
    : `Spades - Hand ${payload.handNumber || 1}`;
}

function sessionOptionLabel(session) {
  return window.GameRoom?.sessionOptionLabel
    ? window.GameRoom.sessionOptionLabel(session, { roundKey: "handNumber", roundLabel: "Hand" })
    : `${session.name} - Hand ${session.payload?.handNumber || 1}`;
}

function sessionSelectPlaceholder() {
  return window.GameRoom?.sessionSelectPlaceholder ? window.GameRoom.sessionSelectPlaceholder() : "Saved sessions on this device";
}

function sessionSaveButtonLabel(currentSession = null) {
  return window.GameRoom?.sessionSaveButtonLabel ? window.GameRoom.sessionSaveButtonLabel(currentSession) : currentSession ? "Update Session" : "Save Session";
}

function sessionToggleLabel(expanded) {
  return window.GameRoom?.sessionToggleLabel ? window.GameRoom.sessionToggleLabel(expanded) : expanded ? "Hide Sessions" : "Sessions";
}

function sessionStatusText(options = {}) {
  return window.GameRoom?.sessionStatusText ? window.GameRoom.sessionStatusText(options) : "No saved sessions yet. Save on this device or download a JSON backup copy.";
}

function normalizeHistorySortDir(value, fallback = "desc") {
  return window.GameRoom?.normalizeHistorySortDir ? window.GameRoom.normalizeHistorySortDir(value, fallback) : value === "asc" ? "asc" : fallback;
}

function toggleHistorySortDir(value) {
  return window.GameRoom?.toggleHistorySortDir ? window.GameRoom.toggleHistorySortDir(value) : normalizeHistorySortDir(value) === "desc" ? "asc" : "desc";
}

function renderHistorySortControl(button, sortDir, historyLength) {
  if (window.GameRoom?.renderHistorySortControl) {
    window.GameRoom.renderHistorySortControl(button, sortDir, historyLength);
    return;
  }
  button.textContent = normalizeHistorySortDir(sortDir) === "desc" ? "Newest First" : "Oldest First";
  button.disabled = historyLength <= 1;
}

function orderedHistory(entries, sortDir, options) {
  return window.GameRoom?.orderedHistory ? window.GameRoom.orderedHistory(entries, sortDir, options) : entries.slice();
}

function cloneJson(value) {
  return window.GameRoom?.cloneJson ? window.GameRoom.cloneJson(value) : JSON.parse(JSON.stringify(value));
}

function uid() {
  return window.GameRoom?.uid ? window.GameRoom.uid() : Math.random().toString(36).slice(2, 10);
}

function slugify(value, fallback = "session") {
  return window.GameRoom?.slugify ? window.GameRoom.slugify(value, fallback) : String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || fallback;
}

function sessionExportBundle(options) {
  return window.GameRoom?.sessionExportBundle ? window.GameRoom.sessionExportBundle(options) : { app: options.app, version: options.version, session: { name: options.sessionName }, payload: options.payload };
}

function scoreKeeperExportBundle(options) {
  return window.GameRoom?.scoreKeeperExportBundle ? window.GameRoom.scoreKeeperExportBundle(options) : options;
}

function scoreKeeperPlayers(players, normalizeName = cleanName) {
  return window.GameRoom?.scoreKeeperPlayers ? window.GameRoom.scoreKeeperPlayers(players, normalizeName) : players.map((player, index) => ({ id: player.id || `p${index + 1}`, name: normalizeName(player.name, `Player ${index + 1}`) }));
}

function scoreKeeperRound(index, scores, options = {}) {
  return window.GameRoom?.scoreKeeperRound ? window.GameRoom.scoreKeeperRound(index, scores, options) : { n: options.n || index + 1, scores, ts: options.ts || Date.now(), ...(options.extra || {}) };
}

function scoreKeeperPayloadBase(options) {
  return window.GameRoom?.scoreKeeperPayloadBase ? window.GameRoom.scoreKeeperPayloadBase(options) : options;
}

function winnerBannerMarkup(options = {}) {
  return window.GameRoom?.winnerBannerMarkup
    ? window.GameRoom.winnerBannerMarkup(options)
    : `<span class="starter-kicker">${escapeHtml(options.kicker || "Winner")}</span><strong>${escapeHtml(options.winnerName || "Team")}</strong><span>${escapeHtml(options.message || "")}</span>`;
}

function downloadJson(filename, payload) {
  if (window.GameRoom?.downloadJson) {
    window.GameRoom.downloadJson(filename, payload);
    return;
  }
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

function readStoredJson(key, fallback = null) {
  return window.GameRoom?.readStoredJson ? window.GameRoom.readStoredJson(key, fallback) : JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
}

function writeStoredJson(key, value) {
  return window.GameRoom?.writeStoredJson ? window.GameRoom.writeStoredJson(key, value) : (localStorage.setItem(key, JSON.stringify(value)), true);
}

function sessionTimestamp(value, fallback = Date.now()) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
  if (window.GameRoom?.escapeHtml) return window.GameRoom.escapeHtml(value);
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

shuffleSetupBotNames();
renderBotNameFields();
bindEvents();
render();
