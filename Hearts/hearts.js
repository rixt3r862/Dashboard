const BOT_NAMES = ["Nova", "Juno", "Kite"];
const BOT_DIFFICULTIES = ["easy", "normal", "hard"];
const DEFAULT_TARGET_SCORE = 100;
const BOT_TURN_DELAY_MS = 1050;
const DEAL_ANIMATION_MS = 1250;
const PASS_ANIMATION_MS = 720;
const PLAY_ANIMATION_MS = 620;
const BREAK_BURST_MS = 980;
const MOON_BURST_MS = 3600;
const TRICK_PAUSE_MS = 1800;
const TRICK_COLLECT_MS = 720;
const TRAM_PAUSE_MS = 1250;
const PASS_DIRECTIONS = ["left", "right", "across", "hold"];
const STORAGE_SESSIONS_KEY = "dashboard.hearts.sessions";
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

const state = {
  gameStarted: false,
  busy: false,
  players: [],
  handNumber: 1,
  targetScore: DEFAULT_TARGET_SCORE,
  passDirectionIndex: 0,
  stage: "setup",
  currentPlayerIndex: 0,
  trickNumber: 1,
  trick: [],
  trickPauseTimer: null,
  trickCollectTimer: null,
  tramClaimTimer: null,
  dealAnimationTimer: null,
  dealAnimationActive: false,
  passAnimationTimer: null,
  passingOutIds: [],
  passingOutDirection: "",
  passingInIds: [],
  passingInDirection: "",
  playingToTableIds: [],
  playAnimationTimers: [],
  breakBurstTimer: null,
  breakBurstType: "",
  breakBurstSymbols: [],
  moonBurstTimer: null,
  moonBurstPlayerId: "",
  moonBurstSymbols: [],
  pendingTrickWinnerIndex: null,
  pendingTrickPoints: 0,
  heartsBroken: false,
  selectedPassIds: [],
  passedToHumanIds: [],
  handHistory: [],
  historySortDir: "asc",
  setupBotDifficulties: ["normal", "normal", "normal"],
  sessionExpanded: true,
  tramBadgePlayerId: "",
  tramPlayerId: "",
  winnerId: null,
  notice: "",
};

const els = {
  setupForm: document.getElementById("setupForm"),
  humanName: document.getElementById("humanName"),
  targetScore: document.getElementById("targetScore"),
  setupFields: document.getElementById("setupFields"),
  setupSummary: document.getElementById("setupSummary"),
  botNameFields: document.getElementById("botNameFields"),
  resetTableBtn: document.getElementById("resetTableBtn"),
  statusText: document.getElementById("statusText"),
  roundValue: document.getElementById("roundValue"),
  turnValue: document.getElementById("turnValue"),
  passValue: document.getElementById("passValue"),
  heartsValue: document.getElementById("heartsValue"),
  actionHint: document.getElementById("actionHint"),
  passControls: document.getElementById("passControls"),
  passSelectionText: document.getElementById("passSelectionText"),
  confirmPassBtn: document.getElementById("confirmPassBtn"),
  tramBtn: document.getElementById("tramBtn"),
  nextHandBtn: document.getElementById("nextHandBtn"),
  savedSessionSelect: document.getElementById("savedSessionSelect"),
  sessionPanel: document.getElementById("sessionPanel"),
  sessionTools: document.getElementById("sessionTools"),
  sessionToggleBtn: document.getElementById("sessionToggleBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  downloadSessionBtn: document.getElementById("downloadSessionBtn"),
  exportScoreKeeperBtn: document.getElementById("exportScoreKeeperBtn"),
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
  breakBurst: document.getElementById("breakBurst"),
  moonBurst: document.getElementById("moonBurst"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  historySummary: document.getElementById("historySummary"),
  historyOrderBtn: document.getElementById("historyOrderBtn"),
  historyWrap: document.getElementById("historyWrap"),
};

function bindEvents() {
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.gameStarted && !state.winnerId && !window.confirm("Restart this Hearts table?")) return;
    startNewGame();
  });
  els.resetTableBtn.addEventListener("click", () => {
    if (state.gameStarted && !state.winnerId && !window.confirm("Reset this Hearts table?")) return;
    resetState();
    render();
  });
  els.confirmPassBtn.addEventListener("click", confirmHumanPass);
  els.tramBtn.addEventListener("click", handleTram);
  els.nextHandBtn.addEventListener("click", dealNextHand);
  els.humanHand.addEventListener("click", handleHandClick);
  els.sessionToggleBtn.addEventListener("click", () => {
    state.sessionExpanded = !state.sessionExpanded;
    renderSessionControls();
  });
  els.historyOrderBtn.addEventListener("click", () => {
    state.historySortDir = state.historySortDir === "asc" ? "desc" : "asc";
    renderHistory();
  });
  els.saveSessionBtn.addEventListener("click", saveSession);
  els.loadSessionBtn.addEventListener("click", loadSelectedSession);
  els.deleteSessionBtn.addEventListener("click", deleteSelectedSession);
  els.downloadSessionBtn.addEventListener("click", downloadSession);
  els.exportScoreKeeperBtn.addEventListener("click", exportScoreKeeper);
}

function renderBotNameFields() {
  els.botNameFields.innerHTML = BOT_NAMES.map((name, index) => `
    <div class="bot-setup-row">
      <label class="field">
        <span>Bot ${index + 1} name</span>
        <input data-bot-index="${index}" type="text" maxlength="18" autocomplete="off" value="${escapeHtml(name)}" />
      </label>
      <label class="field">
        <span>Difficulty</span>
        <select data-bot-difficulty-index="${index}">
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

function startNewGame() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearTramClaimTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
  clearMoonBurstTimer();
  resetState();
  state.gameStarted = true;
  state.sessionExpanded = false;
  state.targetScore = readTargetScore();
  state.players = createPlayers();
  dealHand();
}

function resetState() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearTramClaimTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
  clearMoonBurstTimer();
  state.gameStarted = false;
  state.busy = false;
  state.players = [];
  state.handNumber = 1;
  state.targetScore = DEFAULT_TARGET_SCORE;
  state.passDirectionIndex = 0;
  state.stage = "setup";
  state.currentPlayerIndex = 0;
  state.trickNumber = 1;
  state.trick = [];
  state.tramClaimTimer = null;
  state.dealAnimationActive = false;
  state.passingOutIds = [];
  state.passingOutDirection = "";
  state.passingInIds = [];
  state.passingInDirection = "";
  state.playingToTableIds = [];
  state.playAnimationTimers = [];
  state.breakBurstType = "";
  state.breakBurstSymbols = [];
  state.moonBurstPlayerId = "";
  state.moonBurstSymbols = [];
  state.pendingTrickWinnerIndex = null;
  state.pendingTrickPoints = 0;
  state.heartsBroken = false;
  state.selectedPassIds = [];
  state.passedToHumanIds = [];
  state.handHistory = [];
  state.historySortDir = "asc";
  state.setupBotDifficulties = ["normal", "normal", "normal"];
  state.sessionExpanded = true;
  state.tramBadgePlayerId = "";
  state.tramPlayerId = "";
  state.winnerId = null;
  state.notice = "";
}

function readTargetScore() {
  const value = Number(els.targetScore.value);
  if (!Number.isFinite(value)) return DEFAULT_TARGET_SCORE;
  return Math.max(25, Math.min(500, Math.round(value)));
}

function createPlayers() {
  const humanName = (els.humanName.value || "Rick").trim() || "Rick";
  const botInputs = [...els.botNameFields.querySelectorAll("[data-bot-index]")];
  const botDifficultyInputs = [...els.botNameFields.querySelectorAll("[data-bot-difficulty-index]")];
  const botNames = botInputs.map((input, index) => input.value.trim() || BOT_NAMES[index]);
  const botDifficulties = botDifficultyInputs.map((input) => normalizeDifficulty(input.value));
  state.setupBotDifficulties = BOT_NAMES.map((_, index) => botDifficulties[index] || "normal");
  return [
    createPlayer("p0", humanName, false),
    createPlayer("p1", botNames[0] || "Nova", true, state.setupBotDifficulties[0]),
    createPlayer("p2", botNames[1] || "Juno", true, state.setupBotDifficulties[1]),
    createPlayer("p3", botNames[2] || "Kite", true, state.setupBotDifficulties[2]),
  ];
}

function createPlayer(id, name, bot, difficulty = "normal") {
  return {
    id,
    name,
    bot,
    difficulty: bot ? normalizeDifficulty(difficulty) : "human",
    hand: [],
    taken: [],
    score: 0,
    handPoints: 0,
  };
}

function dealHand() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearTramClaimTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
  clearMoonBurstTimer();
  const deck = shuffle(createDeck());
  state.players.forEach((player) => {
    player.hand = [];
    player.taken = [];
    player.handPoints = 0;
  });
  deck.forEach((card, index) => state.players[index % state.players.length].hand.push(card));
  state.players.forEach((player) => sortHand(player.hand));
  state.trick = [];
  state.trickNumber = 1;
  state.dealAnimationActive = true;
  state.passingOutIds = [];
  state.passingOutDirection = "";
  state.passingInIds = [];
  state.passingInDirection = "";
  state.playingToTableIds = [];
  state.breakBurstType = "";
  state.breakBurstSymbols = [];
  state.moonBurstPlayerId = "";
  state.moonBurstSymbols = [];
  state.pendingTrickWinnerIndex = null;
  state.pendingTrickPoints = 0;
  state.heartsBroken = false;
  state.selectedPassIds = [];
  state.passedToHumanIds = [];
  state.tramBadgePlayerId = "";
  state.winnerId = null;
  const direction = currentPassDirection();
  state.stage = direction === "hold" ? "playing" : "passing";
  if (state.stage === "passing") {
    handleBotPasses();
    state.notice = `${passLabel(direction)}: choose three cards to pass.`;
  } else {
    state.notice = "Hold hand. No passing this time.";
    startFirstTrick();
  }
  render();
  startDealAnimationTimer();
}

function dealNextHand() {
  if (!state.gameStarted || state.stage !== "hand-end" || state.winnerId) return;
  state.handNumber += 1;
  state.passDirectionIndex = (state.passDirectionIndex + 1) % PASS_DIRECTIONS.length;
  dealHand();
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        value: RANK_VALUES[rank],
      });
    }
  }
  return deck;
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
  hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.value - b.value);
  return hand;
}

function currentPassDirection() {
  return PASS_DIRECTIONS[state.passDirectionIndex];
}

function passLabel(direction = currentPassDirection()) {
  return {
    left: "Pass left",
    right: "Pass right",
    across: "Pass across",
    hold: "Hold",
  }[direction];
}

function passTargetIndex(playerIndex) {
  const direction = currentPassDirection();
  if (direction === "left") return (playerIndex + 1) % 4;
  if (direction === "right") return (playerIndex + 3) % 4;
  if (direction === "across") return (playerIndex + 2) % 4;
  return playerIndex;
}

function handleBotPasses() {
  state.players.forEach((player, playerIndex) => {
    if (!player.bot) return;
    player.pendingPass = chooseBotPassCards(player).map((card) => card.id);
  });
}

function chooseBotPassCards(player) {
  const sorted = player.hand.slice().sort((a, b) => botPassRisk(b, player.difficulty) - botPassRisk(a, player.difficulty));
  if (player.difficulty === "easy") return shuffle(sorted.slice(0, 7)).slice(0, 3);
  return sorted.slice(0, 3);
}

function botPassRisk(card, difficulty = "normal") {
  if (isQueenOfSpades(card)) return 100;
  if (card.suit === "hearts") return (difficulty === "hard" ? 38 : 30) + card.value;
  if (card.suit === "spades" && card.value > 10) return (difficulty === "hard" ? 34 : 20) + card.value;
  if (difficulty === "hard" && card.value >= 12) return 10 + card.value;
  return card.value;
}

function confirmHumanPass() {
  if (state.stage !== "passing" || state.selectedPassIds.length !== 3) return;
  state.passingOutIds = state.selectedPassIds.slice();
  state.passingOutDirection = currentPassDirection();
  state.stage = "passing-out";
  state.notice = `${passLabel()}: sending your selected cards.`;
  render();
  clearPassAnimationTimer();
  state.passAnimationTimer = window.setTimeout(resolveHumanPass, PASS_ANIMATION_MS);
}

function resolveHumanPass() {
  state.passAnimationTimer = null;
  state.players[0].pendingPass = state.selectedPassIds.slice();
  const passes = state.players.map((player, playerIndex) => ({
    from: playerIndex,
    to: passTargetIndex(playerIndex),
    cards: player.hand.filter((card) => player.pendingPass.includes(card.id)),
  }));
  passes.forEach(({ from, cards }) => {
    state.players[from].hand = state.players[from].hand.filter(
      (card) => !cards.some((passed) => passed.id === card.id),
    );
  });
  passes.forEach(({ to, cards }) => {
    state.players[to].hand.push(...cards);
  });
  state.passedToHumanIds = passes
    .filter((entry) => entry.to === 0)
    .flatMap((entry) => entry.cards.map((card) => card.id));
  state.passingInIds = state.passedToHumanIds.slice();
  state.passingInDirection = currentPassDirection();
  state.players.forEach((player) => {
    sortHand(player.hand);
    delete player.pendingPass;
  });
  state.selectedPassIds = [];
  state.passingOutIds = [];
  state.passingOutDirection = "";
  state.notice = "Cards passed. The 2 of clubs leads.";
  state.stage = "playing";
  startFirstTrick();
  render();
  window.setTimeout(() => {
    state.passingInIds = [];
    state.passingInDirection = "";
    render();
  }, PASS_ANIMATION_MS);
  runBotTurns();
}

function startFirstTrick() {
  const starterIndex = state.players.findIndex((player) => player.hand.some(isTwoOfClubs));
  state.currentPlayerIndex = starterIndex >= 0 ? starterIndex : 0;
}

function handleHandClick(event) {
  const button = event.target.closest("[data-card-id]");
  if (!button) return;
  const cardId = button.dataset.cardId;
  if (state.stage === "passing") {
    togglePassSelection(cardId);
    return;
  }
  if (state.stage === "playing" && state.currentPlayerIndex === 0 && !state.busy) {
    playHumanCard(cardId);
  }
}

function togglePassSelection(cardId) {
  const selected = state.selectedPassIds.includes(cardId);
  if (selected) {
    state.selectedPassIds = state.selectedPassIds.filter((id) => id !== cardId);
  } else if (state.selectedPassIds.length < 3) {
    state.selectedPassIds.push(cardId);
  }
  render();
}

function playHumanCard(cardId) {
  const player = state.players[0];
  const card = player.hand.find((entry) => entry.id === cardId);
  if (!card || !isLegalPlay(player, card)) {
    state.notice = "That card is not legal for this trick.";
    render();
    return;
  }
  playCard(0, card);
  render();
  runBotTurns();
}

function runBotTurns() {
  if (state.busy || state.stage !== "playing") return;
  if (!state.players[state.currentPlayerIndex]?.bot) return;
  const tramCandidate = findTramCandidate();
  if (tramCandidate?.bot) {
    state.busy = true;
    state.notice = `${tramCandidate.name} can claim the rest.`;
    render();
    window.setTimeout(() => {
      state.busy = false;
      if (findTramCandidate()?.id === tramCandidate.id) beginTramClaim(tramCandidate);
    }, Math.round(BOT_TURN_DELAY_MS * 0.72));
    return;
  }
  state.busy = true;
  window.setTimeout(() => {
    if (state.stage === "playing" && state.players[state.currentPlayerIndex]?.bot) {
      const index = state.currentPlayerIndex;
      const card = chooseBotPlay(state.players[index]);
      playCard(index, card);
    }
    state.busy = false;
    render();
    if (state.stage === "playing" && state.players[state.currentPlayerIndex]?.bot) runBotTurns();
  }, BOT_TURN_DELAY_MS);
}

function chooseBotPlay(player) {
  if (player.difficulty === "easy") return chooseEasyBotPlay(player);
  if (player.difficulty === "hard") return chooseHardBotPlay(player);
  return chooseNormalBotPlay(player);
}

function chooseEasyBotPlay(player) {
  const legal = legalCards(player);
  const ledSuit = state.trick[0]?.card.suit;
  if (ledSuit && !legal.some((card) => card.suit === ledSuit)) {
    const points = legal.filter((card) => card.suit === "hearts" || isQueenOfSpades(card));
    if (points.length && Math.random() > 0.35) return randomCard(points);
  }
  return randomCard(legal);
}

function chooseNormalBotPlay(player) {
  const legal = legalCards(player);
  const ledSuit = state.trick[0]?.card.suit;
  if (!ledSuit) {
    const safeLeads = legal.filter((card) => card.suit !== "hearts" && !isQueenOfSpades(card));
    return lowestCard(safeLeads.length ? safeLeads : legal);
  }
  const following = legal.filter((card) => card.suit === ledSuit);
  if (following.length) {
    const currentWinner = currentTrickWinner();
    const winningValue = currentWinner?.card.value ?? 0;
    const under = following.filter((card) => card.value < winningValue);
    if (under.length) return highestCard(under);
    if (trickPointValue(state.trick.map((play) => play.card)) > 0) return lowestCard(following);
    return lowestCard(following);
  }
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;
  const pointCards = legal.filter((card) => card.suit === "hearts");
  if (pointCards.length) return highestCard(pointCards);
  return highestCard(legal);
}

function chooseHardBotPlay(player) {
  const legal = legalCards(player);
  const ledSuit = state.trick[0]?.card.suit;
  if (!ledSuit) {
    const safeLeads = legal.filter((card) => card.suit !== "hearts" && !isQueenOfSpades(card));
    const lowRisk = safeLeads.filter((card) => !isTopRemainingCard(card, player));
    return lowestCard(lowRisk.length ? lowRisk : safeLeads.length ? safeLeads : legal);
  }
  const following = legal.filter((card) => card.suit === ledSuit);
  if (following.length) {
    const currentWinner = currentTrickWinner();
    const winningValue = currentWinner?.card.value ?? 0;
    const under = following.filter((card) => card.value < winningValue);
    if (under.length) return highestCard(under);
    const dangerousTrick = trickPointValue(state.trick.map((play) => play.card)) > 0;
    if (dangerousTrick) return lowestCard(following);
    const over = following.filter((card) => card.value > winningValue);
    return lowestCard(over.length ? over : following);
  }
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;
  const hearts = legal.filter((card) => card.suit === "hearts");
  if (hearts.length) return highestCard(hearts);
  const spades = legal.filter((card) => card.suit === "spades" && card.value > 10);
  if (spades.length) return highestCard(spades);
  return highestCard(legal);
}

function playCard(playerIndex, card) {
  const player = state.players[playerIndex];
  player.hand = player.hand.filter((entry) => entry.id !== card.id);
  if (playerIndex === 0) state.passedToHumanIds = [];
  const breaksHearts = !state.heartsBroken && (card.suit === "hearts" || isQueenOfSpades(card));
  if (card.suit === "hearts" || isQueenOfSpades(card)) state.heartsBroken = true;
  if (breaksHearts) triggerBreakBurst(isQueenOfSpades(card) ? "spade" : "heart");
  state.trick.push({ playerIndex, card });
  markCardPlayingToTable(card.id);
  state.notice = `${player.name} played ${cardLabel(card)}.`;
  if (state.trick.length === 4) {
    beginTrickPause();
    return;
  }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
}

function beginTrickPause() {
  const winner = currentTrickWinner();
  const cards = state.trick.map((play) => play.card);
  const points = trickPointValue(cards);
  state.stage = "trick-complete";
  state.currentPlayerIndex = winner.playerIndex;
  state.pendingTrickWinnerIndex = winner.playerIndex;
  state.pendingTrickPoints = points;
  state.notice = `${state.players[winner.playerIndex].name} takes this trick for ${points} point${points === 1 ? "" : "s"}.`;
  render();
  clearTrickPauseTimer();
  state.trickPauseTimer = window.setTimeout(beginTrickCollectAnimation, TRICK_PAUSE_MS);
}

function beginTrickCollectAnimation() {
  if (state.stage !== "trick-complete" || state.pendingTrickWinnerIndex === null) return;
  state.trickPauseTimer = null;
  state.stage = "trick-collecting";
  render();
  clearTrickCollectTimer();
  state.trickCollectTimer = window.setTimeout(resolveCompletedTrick, TRICK_COLLECT_MS);
}

function resolveCompletedTrick() {
  if (state.stage !== "trick-collecting" || state.pendingTrickWinnerIndex === null) return;
  state.trickCollectTimer = null;
  const winnerIndex = state.pendingTrickWinnerIndex;
  const cards = state.trick.map((play) => play.card);
  state.players[winnerIndex].taken.push(...cards);
  state.trick = [];
  state.pendingTrickWinnerIndex = null;
  state.pendingTrickPoints = 0;
  if (state.players.every((player) => player.hand.length === 0)) {
    completeHand();
  } else {
    state.trickNumber += 1;
    state.stage = "playing";
  }
  render();
  if (state.stage === "playing") runBotTurns();
}

function clearTrickPauseTimer() {
  if (!state.trickPauseTimer) return;
  window.clearTimeout(state.trickPauseTimer);
  state.trickPauseTimer = null;
}

function clearTrickCollectTimer() {
  if (!state.trickCollectTimer) return;
  window.clearTimeout(state.trickCollectTimer);
  state.trickCollectTimer = null;
}

function clearTramClaimTimer() {
  if (!state.tramClaimTimer) return;
  window.clearTimeout(state.tramClaimTimer);
  state.tramClaimTimer = null;
}

function markCardPlayingToTable(cardId) {
  state.playingToTableIds = [...new Set([...state.playingToTableIds, cardId])];
  const timer = window.setTimeout(() => {
    state.playingToTableIds = state.playingToTableIds.filter((id) => id !== cardId);
    state.playAnimationTimers = state.playAnimationTimers.filter((entry) => entry !== timer);
    render();
  }, PLAY_ANIMATION_MS);
  state.playAnimationTimers.push(timer);
}

function clearPlayAnimationTimers() {
  state.playAnimationTimers.forEach((timer) => window.clearTimeout(timer));
  state.playAnimationTimers = [];
}

function triggerBreakBurst(type) {
  clearBreakBurstTimer();
  const symbol = type === "spade" ? "♠" : "♥";
  state.breakBurstType = type;
  state.breakBurstSymbols = Array.from({ length: 12 }, (_, index) => ({
    symbol,
    delay: index % 4,
    distance: 4.1 + (index % 4) * 0.75,
  }));
  state.breakBurstTimer = window.setTimeout(() => {
    state.breakBurstTimer = null;
    state.breakBurstType = "";
    state.breakBurstSymbols = [];
    renderTrick();
  }, BREAK_BURST_MS);
}

function clearBreakBurstTimer() {
  if (!state.breakBurstTimer) return;
  window.clearTimeout(state.breakBurstTimer);
  state.breakBurstTimer = null;
}

function triggerMoonBurst(playerId) {
  clearMoonBurstTimer();
  state.moonBurstPlayerId = playerId;
  const symbols = ["✦", "✶", "✷", "✹", "★", "☾", "●"];
  state.moonBurstSymbols = Array.from({ length: 56 }, (_, index) => ({
    symbol: symbols[index % symbols.length],
    delay: index % 14,
    distance: 4.7 + (index % 9) * 0.55,
    cluster: index % 4,
    size: 1 + (index % 5) * 0.16,
  }));
  state.moonBurstTimer = window.setTimeout(() => {
    state.moonBurstTimer = null;
    state.moonBurstPlayerId = "";
    state.moonBurstSymbols = [];
    render();
  }, MOON_BURST_MS);
}

function clearMoonBurstTimer() {
  if (!state.moonBurstTimer) return;
  window.clearTimeout(state.moonBurstTimer);
  state.moonBurstTimer = null;
}

function startDealAnimationTimer() {
  clearDealAnimationTimer();
  state.dealAnimationTimer = window.setTimeout(() => {
    state.dealAnimationTimer = null;
    state.dealAnimationActive = false;
    render();
    if (state.stage === "playing") runBotTurns();
  }, DEAL_ANIMATION_MS);
}

function clearDealAnimationTimer() {
  if (!state.dealAnimationTimer) return;
  window.clearTimeout(state.dealAnimationTimer);
  state.dealAnimationTimer = null;
}

function clearPassAnimationTimer() {
  if (!state.passAnimationTimer) return;
  window.clearTimeout(state.passAnimationTimer);
  state.passAnimationTimer = null;
}

function currentTrickWinner() {
  if (!state.trick.length) return null;
  const ledSuit = state.trick[0].card.suit;
  return state.trick
    .filter((play) => play.card.suit === ledSuit)
    .reduce((best, play) => (play.card.value > best.card.value ? play : best));
}

function completeHand() {
  const handPoints = state.players.map((player) => trickPointValue(player.taken));
  const moonIndex = handPoints.findIndex((points) => points === 26);
  const moonPlayerId = moonIndex >= 0 ? state.players[moonIndex].id : "";
  if (moonIndex >= 0) {
    state.players.forEach((player, index) => {
      player.handPoints = index === moonIndex ? 0 : 26;
      player.score += player.handPoints;
    });
    state.notice = `${state.players[moonIndex].name} shot the moon. Everyone else takes 26.`;
    triggerMoonBurst(moonPlayerId);
  } else {
    state.players.forEach((player, index) => {
      player.handPoints = handPoints[index];
      player.score += player.handPoints;
    });
  }
  state.handHistory.unshift({
    handNumber: state.handNumber,
    pass: passLabel(),
    points: state.players.map((player) => player.handPoints),
    scores: state.players.map((player) => player.score),
    moonPlayerId,
    tramPlayerId: state.tramPlayerId,
  });
  state.tramPlayerId = "";
  const atLimit = state.players.some((player) => player.score >= state.targetScore);
  if (atLimit) {
    state.winnerId = state.players.slice().sort((a, b) => a.score - b.score)[0].id;
    state.stage = "game-end";
  } else {
    state.stage = "hand-end";
  }
}

function legalCards(player) {
  if (state.stage !== "playing") return [];
  const hand = player.hand;
  if (!state.trick.length) {
    if (hand.some(isTwoOfClubs)) return hand.filter(isTwoOfClubs);
    const nonHearts = hand.filter((card) => card.suit !== "hearts");
    return state.heartsBroken || !nonHearts.length ? hand.slice() : nonHearts;
  }
  const ledSuit = state.trick[0].card.suit;
  const follow = hand.filter((card) => card.suit === ledSuit);
  if (follow.length) return follow;
  if (isFirstTrick()) {
    const safe = hand.filter((card) => card.suit !== "hearts" && !isQueenOfSpades(card));
    return safe.length ? safe : hand.slice();
  }
  return hand.slice();
}

function isLegalPlay(player, card) {
  return legalCards(player).some((entry) => entry.id === card.id);
}

function isFirstTrick() {
  return state.trickNumber === 1;
}

function trickPointValue(cards) {
  return cards.reduce((sum, card) => sum + (card.suit === "hearts" ? 1 : 0) + (isQueenOfSpades(card) ? 13 : 0), 0);
}

function isQueenOfSpades(card) {
  return card.rank === "Q" && card.suit === "spades";
}

function isTwoOfClubs(card) {
  return card.rank === "2" && card.suit === "clubs";
}

function lowestCard(cards) {
  return cards.slice().sort((a, b) => a.value - b.value)[0];
}

function highestCard(cards) {
  return cards.slice().sort((a, b) => b.value - a.value)[0];
}

function randomCard(cards) {
  return cards[Math.floor(Math.random() * cards.length)];
}

function normalizeDifficulty(value) {
  return BOT_DIFFICULTIES.includes(value) ? value : "normal";
}

function difficultyLabel(value) {
  return {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
  }[normalizeDifficulty(value)];
}

function orderedHistory() {
  const history = state.handHistory.slice();
  return state.historySortDir === "asc" ? history.reverse() : history;
}

function isTopRemainingCard(card, owner) {
  return state.players.every((player) => (
    player === owner || !player.hand.some((entry) => entry.suit === card.suit && entry.value > card.value)
  ));
}

function findTramCandidate() {
  if (state.stage !== "playing" || state.trick.length || state.dealAnimationActive || state.tramClaimTimer) return null;
  const player = state.players[state.currentPlayerIndex];
  if (!player || player.hand.length < 2) return null;
  const ownsEveryLead = player.hand.every((card) => isTopRemainingCard(card, player));
  return ownsEveryLead ? player : null;
}

function handleTram() {
  const player = findTramCandidate();
  if (!player || player.bot) return;
  beginTramClaim(player);
}

function beginTramClaim(player) {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearPlayAnimationTimers();
  clearTramClaimTimer();
  state.busy = true;
  state.tramBadgePlayerId = player.id;
  state.tramPlayerId = player.id;
  state.notice = `${player.name} claims the rest of the tricks.`;
  render();
  state.tramClaimTimer = window.setTimeout(() => completeTramClaim(player.id), TRAM_PAUSE_MS);
}

function completeTramClaim(playerId) {
  state.tramClaimTimer = null;
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || state.stage !== "playing") {
    state.busy = false;
    render();
    return;
  }
  const remainingCards = state.players.flatMap((entry) => entry.hand);
  state.players.forEach((entry) => {
    entry.hand = [];
  });
  player.taken.push(...remainingCards);
  state.trick = [];
  state.tramBadgePlayerId = player.id;
  state.tramPlayerId = player.id;
  state.notice = `${player.name} claimed the rest of the tricks.`;
  state.busy = false;
  completeHand();
  render();
}

function sessionSnapshot() {
  return {
    version: SESSION_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    game: "hearts",
    gameStarted: state.gameStarted,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      bot: player.bot,
      difficulty: player.difficulty,
      hand: player.hand,
      taken: player.taken,
      score: player.score,
      handPoints: player.handPoints,
      pendingPass: player.pendingPass || [],
    })),
    handNumber: state.handNumber,
    targetScore: state.targetScore,
    passDirectionIndex: state.passDirectionIndex,
    stage: state.stage,
    currentPlayerIndex: state.currentPlayerIndex,
    trickNumber: state.trickNumber,
    trick: state.trick,
    heartsBroken: state.heartsBroken,
    selectedPassIds: state.selectedPassIds,
    passedToHumanIds: state.passedToHumanIds,
    handHistory: state.handHistory,
    historySortDir: state.historySortDir,
    setupBotDifficulties: state.setupBotDifficulties,
    sessionExpanded: state.sessionExpanded,
    tramBadgePlayerId: state.tramBadgePlayerId,
    winnerId: state.winnerId,
    notice: state.notice,
  };
}

function restoreSessionSnapshot(snapshot) {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearTramClaimTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
  clearMoonBurstTimer();
  Object.assign(state, {
    gameStarted: Boolean(snapshot.gameStarted),
    players: (snapshot.players || []).map((player) => ({
      id: player.id,
      name: player.name,
      bot: Boolean(player.bot),
      difficulty: player.bot ? normalizeDifficulty(player.difficulty) : "human",
      hand: player.hand || [],
      taken: player.taken || [],
      score: Number(player.score) || 0,
      handPoints: Number(player.handPoints) || 0,
      pendingPass: Array.isArray(player.pendingPass) ? player.pendingPass : [],
    })),
    handNumber: Number(snapshot.handNumber) || 1,
    targetScore: Number(snapshot.targetScore) || DEFAULT_TARGET_SCORE,
    passDirectionIndex: Number(snapshot.passDirectionIndex) || 0,
    stage: normalizeStage(snapshot.stage),
    currentPlayerIndex: Number(snapshot.currentPlayerIndex) || 0,
    trickNumber: Number(snapshot.trickNumber) || 1,
    trick: snapshot.trick || [],
    trickPauseTimer: null,
    trickCollectTimer: null,
    dealAnimationTimer: null,
    dealAnimationActive: false,
    tramClaimTimer: null,
    passAnimationTimer: null,
    passingOutIds: [],
    passingOutDirection: "",
    passingInIds: [],
    passingInDirection: "",
    playingToTableIds: [],
    playAnimationTimers: [],
    breakBurstTimer: null,
    breakBurstType: "",
    breakBurstSymbols: [],
    moonBurstTimer: null,
    moonBurstPlayerId: "",
    moonBurstSymbols: [],
    pendingTrickWinnerIndex: null,
    pendingTrickPoints: 0,
    heartsBroken: Boolean(snapshot.heartsBroken),
    selectedPassIds: snapshot.selectedPassIds || [],
    passedToHumanIds: snapshot.passedToHumanIds || [],
    handHistory: snapshot.handHistory || [],
    historySortDir: snapshot.historySortDir === "desc" ? "desc" : "asc",
    setupBotDifficulties: snapshot.setupBotDifficulties || ["normal", "normal", "normal"],
    sessionExpanded: snapshot.sessionExpanded !== false,
    tramBadgePlayerId: snapshot.tramBadgePlayerId || "",
    tramPlayerId: "",
    winnerId: snapshot.winnerId || null,
    notice: snapshot.notice || "Session loaded.",
    busy: false,
  });
  if (state.stage === "passing-out" || state.stage === "trick-complete" || state.stage === "trick-collecting") {
    state.stage = "playing";
  }
  if (state.stage === "passing") {
    state.players.forEach((player) => {
      if (player.bot && (!Array.isArray(player.pendingPass) || player.pendingPass.length !== 3)) {
        player.pendingPass = chooseBotPassCards(player).map((card) => card.id);
      }
    });
  }
  render();
  if (state.stage === "playing") runBotTurns();
}

function normalizeStage(stage) {
  return ["setup", "passing", "passing-out", "playing", "trick-complete", "trick-collecting", "hand-end", "game-end"].includes(stage)
    ? stage
    : "setup";
}

function readSavedSessions() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_SESSIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedSessions(sessions) {
  window.localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
}

function saveSession() {
  if (!state.gameStarted) {
    showSessionStatus("Start a game before saving.");
    return;
  }
  const name = window.prompt("Save this Hearts session as:", defaultSessionName());
  if (!name) return;
  const sessions = readSavedSessions();
  const id = `${Date.now()}`;
  sessions.unshift({ id, name: name.trim(), savedAt: new Date().toISOString(), snapshot: sessionSnapshot() });
  writeSavedSessions(sessions);
  showSessionStatus(`Saved ${name.trim()}.`);
  renderSessionControls(id);
}

function loadSelectedSession() {
  const session = selectedSavedSession();
  if (!session) return;
  restoreSessionSnapshot(session.snapshot);
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
  downloadJson(`${slugify(defaultSessionName())}.json`, snapshot);
  showSessionStatus("Session downloaded.");
}

function exportScoreKeeper() {
  if (!state.handHistory.length) {
    showSessionStatus("Complete at least one hand before exporting to ScoreKeeper.");
    return;
  }
  const snapshot = sessionSnapshot();
  const payload = {
    app: "dashboard-game-export",
    version: 1,
    sourceGame: "hearts-table",
    scorekeeperPreset: "hearts",
    exportedAt: new Date().toISOString(),
    session: {
      name: defaultSessionName(),
    },
    scorekeeperPayload: scoreKeeperPayload(snapshot),
    sourcePayload: snapshot,
  };
  downloadJson(`${slugify(defaultSessionName())}-scorekeeper.json`, payload);
  showSessionStatus("ScoreKeeper export downloaded.");
}

function scoreKeeperPayload(snapshot) {
  const players = snapshot.players.map((player) => ({ id: player.id, name: player.name }));
  const rounds = snapshot.handHistory.slice().reverse().map((entry) => ({
    n: Number(entry.handNumber),
    scores: Object.fromEntries(players.map((player, index) => [player.id, entry.points[index] || 0])),
    ts: Date.now(),
  }));
  const winnerId = snapshot.winnerId || null;
  const winnerMilestones = winnerId
    ? [{ winnerId, roundN: rounds.length, target: snapshot.targetScore, ts: Date.now() }]
    : [];
  return {
    mode: winnerId ? "finished" : "playing",
    presetKey: "hearts",
    customGameName: "",
    heartsDeckCount: 1,
    target: snapshot.targetScore,
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
    historySortDir: "asc",
    showHistoryTotals: true,
    spadesPartnerIndex: 2,
    presetNote: "Lowest score wins. Hearts are 1 point and the queen of spades is 13.",
    skyjoCurrentRoundWentOutPlayerId: null,
    rummikubCurrentRoundWinnerId: null,
    currentSessionId: null,
  };
}

function selectedSavedSession() {
  const id = els.savedSessionSelect.value;
  return readSavedSessions().find((session) => session.id === id);
}

function renderSessionControls(selectedId = els.savedSessionSelect.value) {
  const sessions = readSavedSessions();
  els.sessionTools.hidden = !state.sessionExpanded;
  els.sessionPanel.classList.toggle("collapsed", !state.sessionExpanded);
  els.sessionToggleBtn.textContent = state.sessionExpanded ? "Hide" : "Show";
  els.sessionToggleBtn.setAttribute("aria-expanded", String(state.sessionExpanded));
  els.savedSessionSelect.innerHTML = sessions.length
    ? sessions.map((session) => `<option value="${session.id}" ${session.id === selectedId ? "selected" : ""}>${escapeHtml(session.name)}</option>`).join("")
    : `<option value="">No saved sessions</option>`;
  const hasSaved = sessions.length > 0;
  els.loadSessionBtn.disabled = !hasSaved;
  els.deleteSessionBtn.disabled = !hasSaved;
  els.saveSessionBtn.disabled = !state.gameStarted;
  els.downloadSessionBtn.disabled = !state.gameStarted;
  els.exportScoreKeeperBtn.disabled = !state.handHistory.length;
}

function showSessionStatus(message) {
  els.sessionStatus.textContent = message;
}

function defaultSessionName() {
  const human = state.players.find((player) => !player.bot)?.name || "Hearts";
  return `${human} Hearts Hand ${state.handNumber}`;
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "hearts-session";
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  renderSetupPanel();
  renderStatus();
  renderSessionControls();
  renderScoreBoard();
  renderSeats();
  renderTrick();
  renderMoonBurst();
  renderHumanHand();
  renderActions();
  renderHistory();
}

function renderSetupPanel() {
  const isActiveGame = state.gameStarted && !state.winnerId;
  els.setupFields.hidden = isActiveGame;
  els.setupSummary.hidden = !isActiveGame;
  if (!isActiveGame) {
    els.setupSummary.innerHTML = "";
    return;
  }
  const human = state.players.find((player) => !player.bot);
  const bots = state.players
    .filter((player) => player.bot)
    .map((player) => `${player.name} (${difficultyLabel(player.difficulty)})`)
    .join(", ");
  els.setupSummary.innerHTML = `
    <strong>${escapeHtml(human?.name || "Player")} at the table</strong>
    <span>Target ${state.targetScore} · Bots: ${escapeHtml(bots)}</span>
  `;
}

function renderStatus() {
  const current = state.players[state.currentPlayerIndex];
  els.roundValue.textContent = state.gameStarted ? String(state.handNumber) : "-";
  els.turnValue.textContent = current && state.stage === "playing" ? current.name : "-";
  els.passValue.textContent = state.gameStarted ? passLabel() : "-";
  els.heartsValue.textContent = state.gameStarted ? (state.heartsBroken ? "Broken" : "Closed") : "-";
  if (!state.gameStarted) {
    els.statusText.textContent = "Deal a table to begin.";
  } else if (state.stage === "passing") {
    els.statusText.textContent = `${passLabel()}. Waiting on your three cards.`;
  } else if (state.stage === "passing-out") {
    els.statusText.textContent = state.notice || "Passing selected cards.";
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
    els.leaderText.textContent = "Lowest score wins when someone reaches the target.";
    return;
  }
  const lowScore = Math.min(...state.players.map((player) => player.score));
  const leader = state.players.find((player) => player.score === lowScore);
  els.leaderText.textContent = `Target ${state.targetScore}; low score ${leader.name} at ${lowScore}`;
  els.scoreBoard.innerHTML = state.players.map((player, index) => `
    <div class="score-card ${index === state.currentPlayerIndex && state.stage === "playing" ? "current" : ""} ${player.id === state.winnerId ? "winner" : ""} ${player.id === state.moonBurstPlayerId ? "moon-flash" : ""}">
      <strong>${escapeHtml(player.name)} · ${player.score}</strong>
      <span class="score-meta">Hand ${player.handPoints} · Points taken this hand ${trickPointValue(player.taken)}</span>
    </div>
  `).join("");
  const winner = state.players.find((player) => player.id === state.winnerId);
  const targetHitPlayer = state.players.find((player) => player.score >= state.targetScore);
  const scoreLabel = winner?.bot ? `${winner.name}'s Final Score` : "Your Final Score";
  els.winnerBanner.hidden = !winner;
  els.winnerBanner.innerHTML = winner
    ? `
      <span class="starter-kicker">Game winner</span>
      <strong>Congratulations, ${escapeHtml(winner.name)}!</strong>
      <span>${escapeHtml(targetHitPlayer?.name ?? winner.name)} hit ${escapeHtml(state.targetScore)}. ${escapeHtml(scoreLabel)}: ${escapeHtml(winner.score)} points.</span>
    `
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
      element.className = element.className.replace(" current", "");
      return;
    }
    element.hidden = false;
    element.classList.toggle("current", index === state.currentPlayerIndex && state.stage === "playing");
    element.classList.toggle("moon-flash", player.id === state.moonBurstPlayerId);
    element.classList.toggle("tram-claim", player.id === state.tramBadgePlayerId);
    element.innerHTML = `
      <div class="seat-name">${escapeHtml(player.name)}</div>
      ${player.id === state.tramBadgePlayerId ? `<div class="tram-chip">TRAM</div>` : ""}
      <div class="mini-hand">${renderMiniHand(player.hand.length)}</div>
    `;
  });
}

function renderMiniHand(count) {
  return Array.from({ length: count }, (_, index) => (
    renderCardBack(state.dealAnimationActive ? { className: "dealt", dealIndex: index } : {})
  )).join("");
}

function seatDirection(playerIndex) {
  return ["bottom", "left", "top", "right"][playerIndex] || "bottom";
}

function renderTrick() {
  const burstType = state.breakBurstType;
  els.breakBurst.hidden = !burstType;
  els.breakBurst.className = `break-burst ${burstType ? `break-burst-${burstType}` : ""}`;
  els.breakBurst.innerHTML = burstType
    ? state.breakBurstSymbols.map((entry, index) => (
      `<span style="--burst-index: ${index}; --burst-delay: ${entry.delay}; --burst-distance: ${entry.distance}rem;">${entry.symbol}</span>`
    )).join("")
    : "";
  els.trickCards.innerHTML = state.trick.length
    ? state.trick.map((play) => `
      <div class="trick-play ${state.playingToTableIds.includes(play.card.id) ? `play-from-${seatDirection(play.playerIndex)}` : ""} ${state.stage === "trick-collecting" ? `collect-to-${seatDirection(state.pendingTrickWinnerIndex)}` : ""}">
        ${renderCard(play.card)}
        <span class="trick-player">${escapeHtml(state.players[play.playerIndex].name)}</span>
      </div>
    `).join("")
    : "";
}

function renderMoonBurst() {
  if (!els.moonBurst) return;
  const active = Boolean(state.moonBurstPlayerId);
  els.moonBurst.hidden = !active;
  els.moonBurst.innerHTML = active
    ? state.moonBurstSymbols.map((entry, index) => (
      `<span class="moon-spark moon-cluster-${entry.cluster}" style="--burst-index: ${index}; --burst-delay: ${entry.delay}; --burst-distance: ${entry.distance}rem; --spark-scale: ${entry.size};">${entry.symbol}</span>`
    )).join("")
    : "";
}

function renderHumanHand() {
  const human = state.players[0];
  if (!human) {
    els.handSummary.textContent = "Start a game to see your cards.";
    els.humanHand.innerHTML = "";
    return;
  }
  const legal = new Set(legalCards(human).map((card) => card.id));
  els.handSummary.textContent = state.stage === "passing"
    ? "Select exactly three cards to pass."
    : `${human.hand.length} cards in hand. ${state.stage === "playing" && state.currentPlayerIndex === 0 ? "Your turn." : ""}`;
  els.humanHand.innerHTML = human.hand.map((card, index) => {
    const selected = state.selectedPassIds.includes(card.id);
    const passingOut = state.passingOutIds.includes(card.id);
    const passingIn = state.passingInIds.includes(card.id);
    const isHumanTurn = state.stage === "playing" && state.currentPlayerIndex === 0;
    const playable = isHumanTurn && legal.has(card.id);
    const illegal = isHumanTurn && !legal.has(card.id);
    const passedIn = state.passedToHumanIds.includes(card.id);
    const dealStyle = state.dealAnimationActive ? ` style="--deal-index: ${index};"` : "";
    const passDirectionClass = passingOut ? ` passing-${state.passingOutDirection}` : "";
    const passInDirectionClass = passingIn ? ` passing-${state.passingInDirection}` : "";
    return `
      <button class="card-button ${state.dealAnimationActive ? "dealt" : ""} ${passingOut ? `passing-out${passDirectionClass}` : ""} ${passingIn ? `passing-in${passInDirectionClass}` : ""} ${selected ? "selected" : ""} ${passedIn ? "passed-in" : ""} ${playable ? "legal" : ""} ${illegal ? "illegal" : ""}" type="button" data-card-id="${card.id}" aria-label="${cardLabel(card)}"${dealStyle}>
        ${renderCard(card)}
      </button>
    `;
  }).join("");
}

function renderActions() {
  els.passControls.hidden = state.stage !== "passing" && state.stage !== "passing-out";
  els.confirmPassBtn.disabled = state.stage !== "passing" || state.selectedPassIds.length !== 3;
  els.passSelectionText.textContent = `Selected ${state.selectedPassIds.length} of 3 cards.`;
  const tramCandidate = findTramCandidate();
  els.tramBtn.hidden = Boolean(state.tramClaimTimer) || !tramCandidate || tramCandidate.bot;
  els.tramBtn.textContent = tramCandidate ? `TRAM: ${tramCandidate.name}` : "TRAM";
  els.nextHandBtn.hidden = state.stage !== "hand-end";
  if (!state.gameStarted) {
    els.actionHint.textContent = "Your controls will appear once the game starts.";
  } else if (state.stage === "passing") {
    els.actionHint.textContent = "Choose three cards from your hand, then pass them.";
  } else if (state.stage === "passing-out") {
    els.actionHint.textContent = "Passing your selected cards.";
  } else if (state.tramClaimTimer && state.tramPlayerId) {
    const claimant = state.players.find((player) => player.id === state.tramPlayerId);
    els.actionHint.textContent = `${claimant?.name || "A player"} is claiming the rest.`;
  } else if (state.stage === "playing" && state.currentPlayerIndex === 0) {
    els.actionHint.textContent = "Play one highlighted legal card.";
  } else if (tramCandidate?.bot) {
    els.actionHint.textContent = `${tramCandidate.name} is claiming the rest.`;
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
  els.historyOrderBtn.textContent = state.historySortDir === "asc" ? "Oldest First" : "Newest First";
  const history = orderedHistory();
  els.historyWrap.innerHTML = history.map((entry) => `
    <div class="history-row">
      <strong>Hand ${entry.handNumber}${entry.moonPlayerId ? " · Moon" : ""}</strong>
      ${entry.points.map((points, index) => {
        const player = state.players[index];
        const isTramPlayer = player?.id === entry.tramPlayerId;
        return `<span>${escapeHtml(player?.name || `P${index + 1}`)}: ${points}${isTramPlayer ? ` <b class="history-marker">- TRAM</b>` : ""}</span>`;
      }).join("")}
    </div>
  `).join("");
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

function cardLabel(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

renderBotNameFields();
bindEvents();
render();
