const BOT_NAMES = ["Nova", "Juno", "Kite"];
const DEFAULT_TARGET_SCORE = 100;
const BOT_TURN_DELAY_MS = 1050;
const DEAL_ANIMATION_MS = 1250;
const PASS_ANIMATION_MS = 720;
const PLAY_ANIMATION_MS = 620;
const BREAK_BURST_MS = 980;
const TRICK_PAUSE_MS = 1800;
const TRICK_COLLECT_MS = 720;
const PASS_DIRECTIONS = ["left", "right", "across", "hold"];
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
  pendingTrickWinnerIndex: null,
  pendingTrickPoints: 0,
  heartsBroken: false,
  selectedPassIds: [],
  passedToHumanIds: [],
  handHistory: [],
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
  nextHandBtn: document.getElementById("nextHandBtn"),
  eventNotice: document.getElementById("eventNotice"),
  winnerBanner: document.getElementById("winnerBanner"),
  scoreBoard: document.getElementById("scoreBoard"),
  leaderText: document.getElementById("leaderText"),
  opponentTop: document.getElementById("opponentTop"),
  opponentLeft: document.getElementById("opponentLeft"),
  opponentRight: document.getElementById("opponentRight"),
  humanSeat: document.getElementById("humanSeat"),
  trickLabel: document.getElementById("trickLabel"),
  trickPoints: document.getElementById("trickPoints"),
  trickCards: document.getElementById("trickCards"),
  breakBurst: document.getElementById("breakBurst"),
  humanHand: document.getElementById("humanHand"),
  handSummary: document.getElementById("handSummary"),
  historySummary: document.getElementById("historySummary"),
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
  els.nextHandBtn.addEventListener("click", dealNextHand);
  els.humanHand.addEventListener("click", handleHandClick);
}

function renderBotNameFields() {
  els.botNameFields.innerHTML = BOT_NAMES.map((name, index) => `
    <label class="field">
      <span>Bot ${index + 1} name</span>
      <input data-bot-index="${index}" type="text" maxlength="18" autocomplete="off" value="${escapeHtml(name)}" />
    </label>
  `).join("");
}

function startNewGame() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
  resetState();
  state.gameStarted = true;
  state.targetScore = readTargetScore();
  state.players = createPlayers();
  dealHand();
}

function resetState() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
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
  state.dealAnimationActive = false;
  state.passingOutIds = [];
  state.passingOutDirection = "";
  state.passingInIds = [];
  state.passingInDirection = "";
  state.playingToTableIds = [];
  state.playAnimationTimers = [];
  state.breakBurstType = "";
  state.breakBurstSymbols = [];
  state.pendingTrickWinnerIndex = null;
  state.pendingTrickPoints = 0;
  state.heartsBroken = false;
  state.selectedPassIds = [];
  state.passedToHumanIds = [];
  state.handHistory = [];
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
  const botNames = botInputs.map((input, index) => input.value.trim() || BOT_NAMES[index]);
  return [
    createPlayer("p0", humanName, false),
    createPlayer("p1", botNames[0] || "Nova", true),
    createPlayer("p2", botNames[1] || "Juno", true),
    createPlayer("p3", botNames[2] || "Kite", true),
  ];
}

function createPlayer(id, name, bot) {
  return {
    id,
    name,
    bot,
    hand: [],
    taken: [],
    score: 0,
    handPoints: 0,
  };
}

function dealHand() {
  clearTrickPauseTimer();
  clearTrickCollectTimer();
  clearDealAnimationTimer();
  clearPassAnimationTimer();
  clearPlayAnimationTimers();
  clearBreakBurstTimer();
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
  state.pendingTrickWinnerIndex = null;
  state.pendingTrickPoints = 0;
  state.heartsBroken = false;
  state.selectedPassIds = [];
  state.passedToHumanIds = [];
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
  return player.hand
    .slice()
    .sort((a, b) => botPassRisk(b) - botPassRisk(a))
    .slice(0, 3);
}

function botPassRisk(card) {
  if (isQueenOfSpades(card)) return 100;
  if (card.suit === "hearts") return 30 + card.value;
  if (card.suit === "spades" && card.value > 10) return 20 + card.value;
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
  if (moonIndex >= 0) {
    state.players.forEach((player, index) => {
      player.handPoints = index === moonIndex ? 0 : 26;
      player.score += player.handPoints;
    });
    state.notice = `${state.players[moonIndex].name} shot the moon. Everyone else takes 26.`;
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
  });
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

function render() {
  renderSetupPanel();
  renderStatus();
  renderScoreBoard();
  renderSeats();
  renderTrick();
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
  const bots = state.players.filter((player) => player.bot).map((player) => player.name).join(", ");
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
    <div class="score-card ${index === state.currentPlayerIndex && state.stage === "playing" ? "current" : ""} ${player.id === state.winnerId ? "winner" : ""}">
      <strong>${escapeHtml(player.name)} · ${player.score}</strong>
      <span class="score-meta">Hand ${player.handPoints} · Taken ${trickPointValue(player.taken)}</span>
    </div>
  `).join("");
  const winner = state.players.find((player) => player.id === state.winnerId);
  els.winnerBanner.hidden = !winner;
  els.winnerBanner.innerHTML = winner
    ? `<strong>${escapeHtml(winner.name)} wins Hearts</strong><span>Lowest score after someone reached ${state.targetScore}.</span>`
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
    element.innerHTML = `
      <div class="seat-name">${escapeHtml(player.name)}</div>
      <div class="turn-badge">${index === state.currentPlayerIndex && state.stage === "playing" ? "Playing" : "Waiting"}</div>
      <div class="seat-detail">${player.hand.length} cards · ${trickPointValue(player.taken)} taken</div>
      <div class="mini-hand">${renderMiniHand(player.hand.length)}</div>
    `;
  });
}

function renderMiniHand(count) {
  const visible = Math.min(5, count);
  return Array.from({ length: visible }, (_, index) => (
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
  els.trickLabel.textContent = state.stage === "trick-complete" || state.stage === "trick-collecting"
    ? "Trick Complete"
    : state.trick.length ? "Current Trick" : "Center Table";
  els.trickPoints.textContent = `${trickPointValue(state.trick.map((play) => play.card))} pts`;
  els.trickCards.innerHTML = state.trick.length
    ? state.trick.map((play) => `
      <div class="trick-play ${state.playingToTableIds.includes(play.card.id) ? `play-from-${seatDirection(play.playerIndex)}` : ""} ${state.stage === "trick-collecting" ? `collect-to-${seatDirection(state.pendingTrickWinnerIndex)}` : ""}">
        ${renderCard(play.card)}
        <span class="trick-player">${escapeHtml(state.players[play.playerIndex].name)}</span>
      </div>
    `).join("")
    : `<div class="trick-player">Cards played to the trick appear here.</div>`;
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
  els.nextHandBtn.hidden = state.stage !== "hand-end";
  if (!state.gameStarted) {
    els.actionHint.textContent = "Your controls will appear once the game starts.";
  } else if (state.stage === "passing") {
    els.actionHint.textContent = "Choose three cards from your hand, then pass them.";
  } else if (state.stage === "passing-out") {
    els.actionHint.textContent = "Passing your selected cards.";
  } else if (state.stage === "playing" && state.currentPlayerIndex === 0) {
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
  els.historyWrap.innerHTML = state.handHistory.map((entry) => `
    <div class="history-row">
      <strong>Hand ${entry.handNumber}</strong>
      ${entry.points.map((points, index) => `<span>${escapeHtml(state.players[index]?.name || `P${index + 1}`)}: ${points}</span>`).join("")}
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
