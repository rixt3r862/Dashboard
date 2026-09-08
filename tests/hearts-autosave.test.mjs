import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../Hearts/hearts.js", import.meta.url), "utf8");
const key = "dashboard.hearts.autosave.v1";
function table(saved = new Map(), failWrites = false) {
  const nodes = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: "", textContent: "", dataset: {}, handlers: {},
      addEventListener(name, fn) { this.handlers[name] = fn; } });
    return nodes.get(id);
  };
  const localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem(key, value) { if (failWrites) throw Error("Storage full"); saved.set(key, value); },
    removeItem: key => saved.delete(key),
  };
  const window = { localStorage, confirm: () => true,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }, addEventListener() {} };
  const context = vm.createContext({ window, localStorage, document: { getElementById: node },
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(source.slice(0, source.lastIndexOf("\nrenderBotNameFields();")), context);
  const run = expression => vm.runInContext(expression, context);
  // Exercise real state transitions, snapshots, and timers; omit visual DOM rendering.
  run(`renderBotNameFields = () => {};
    prepareNextGameSetupNames = () => {};
    shuffleSetupBotNames = () => {};
    for (const name of ["renderSetupPanel", "renderStatus", "renderSessionControls",
      "renderScoreBoard", "renderSeats", "renderTrick", "renderMoonBurst",
      "renderHumanHand", "renderActions", "renderHistory"]) globalThis[name] = () => {};
    bindEvents();`);
  return { saved, run, node, timers,
    deal() { run('state.players = ["Human", "A", "B", "C"].map((name, i) => createPlayer("p"+i, name, i > 0)); state.gameStarted = true; dealHand();'); },
    snapshot() { return JSON.parse(run("JSON.stringify(sessionSnapshot())")); },
    flush() { const item = timers.entries().next().value; if (item) { timers.delete(item[0]); item[1](); } return !!item; },
  };
}

test("passing selections, names, scores and difficulty survive a fresh page", () => {
  const first = table(); first.deal();
  first.run('state.players[1].difficulty = "hard"; state.players[0].score = 12; togglePassSelection(state.players[0].hand[0].id);');
  const expected = first.snapshot();
  const restored = table(first.saved);
  assert.equal(restored.run("restoreAutosave()"), true);
  assert.deepEqual(restored.snapshot().players, expected.players);
  assert.deepEqual(restored.snapshot().selectedPassIds, expected.selectedPassIds);
  assert.equal(restored.run("state.dealAnimationActive"), false);
  assert.equal(restored.node("humanName").value, "Human");
});

test("refresh during passing completes the exchange once without losing cards", () => {
  const first = table(); first.deal();
  first.run("state.selectedPassIds = state.players[0].hand.slice(0, 3).map(card => card.id); confirmHumanPass();");
  assert.equal(first.snapshot().stage, "passing-out");
  const restored = table(first.saved);
  restored.run("restoreAutosave()");
  assert.equal(restored.snapshot().stage, "playing");
  assert.equal(restored.run("validAutosave(sessionSnapshot())"), true);
  const hand = restored.snapshot().players[0].hand;
  const again = table(restored.saved); again.run("restoreAutosave()");
  assert.deepEqual(again.snapshot().players[0].hand, hand);
});

test("a bot turn resumes and a completed trick is collected exactly once", () => {
  const first = table(); first.deal();
  first.run('state.stage = "playing"; state.dealAnimationActive = false; startFirstTrick(); state.currentPlayerIndex = 1; render();');
  const restored = table(first.saved); restored.run("restoreAutosave()");
  assert.ok(restored.timers.size > 0);
  restored.flush();
  assert.equal(restored.snapshot().trick.length, 1);
  restored.run(`cancelPendingBotTurn(); clearPlayAnimationTimers();
    while (state.trick.length < 4) {
      const index = state.currentPlayerIndex;
      playCard(index, legalCards(state.players[index])[0]);
    }`);
  for (const stage of ["trick-complete", "trick-collecting"]) {
    const saved = new Map(restored.saved);
    const snapshot = JSON.parse(saved.get(key)); snapshot.stage = stage;
    saved.set(key, JSON.stringify(snapshot));
    const next = table(saved); next.run("restoreAutosave()");
    next.flush(); next.flush();
    assert.equal(next.snapshot().trick.length, 0);
    assert.equal(next.snapshot().players.flatMap(player => player.taken).length, 4);
    assert.equal(next.run("validAutosave(sessionSnapshot())"), true);
    const again = table(next.saved); again.run("restoreAutosave()");
    assert.equal(again.snapshot().players.flatMap(player => player.taken).length, 4);
  }
});

test("corrupt autosaves leave setup usable and do not overwrite stored data", () => {
  for (const raw of ["{broken", "null", '{"game":"hearts","players":[]}']) {
    const saved = new Map([[key, raw]]); const next = table(saved);
    assert.equal(next.run("restoreAutosave()"), false);
    next.run("render()");
    assert.equal(saved.get(key), raw);
    assert.equal(next.run("state.gameStarted"), false);
    assert.match(next.node("autosaveStatus").textContent, /could not be restored/);
  }
  const first = table(); first.deal();
  const broken = first.snapshot();
  broken.players[1].hand[0] = broken.players[0].hand[0];
  const next = table(new Map([[key, JSON.stringify(broken)]]));
  assert.equal(next.run("restoreAutosave()"), false);
});

test("reset clears only autosave and storage failure reports an error", () => {
  const first = table(); first.deal();
  first.saved.set("dashboard.hearts.sessions", "named sessions");
  first.node("resetTableBtn").handlers.click();
  assert.equal(first.saved.has(key), false);
  assert.equal(first.saved.get("dashboard.hearts.sessions"), "named sessions");
  const blocked = table(new Map(), true); blocked.deal();
  assert.match(blocked.node("autosaveStatus").textContent, /Unable to autosave/);
  assert.equal(blocked.run("state.gameStarted"), true);
});

test("last-trick recovery preserves hand-end and game-end without scoring twice", () => {
  for (const score of [0, 99]) {
    const first = table(); first.deal();
    first.run(`cancelPendingBotTurn(); clearDealAnimationTimer();
      const deck = createDeck();
      state.players.forEach((player, index) => {
        player.hand = []; player.pendingPass = []; player.score = ${score};
        player.taken = deck.slice(4 + index * 12, 16 + index * 12);
      });
      state.selectedPassIds = [];
      state.trick = deck.slice(0, 4).map((card, playerIndex) => ({card, playerIndex}));
      beginTrickPause();`);
    const next = table(first.saved); next.run("restoreAutosave()");
    next.flush(); next.flush();
    const result = next.snapshot();
    assert.equal(result.stage, score ? "game-end" : "hand-end");
    assert.equal(result.handHistory.length, 1);
    const again = table(next.saved); assert.equal(again.run("restoreAutosave()"), true);
    assert.deepEqual(again.snapshot().players.map(p => p.score), result.players.map(p => p.score));
    assert.equal(again.snapshot().handHistory.length, 1);
    assert.equal(again.snapshot().stage, result.stage);
  }
});

test("an interrupted claim completes once and retains all 52 cards", () => {
  const first = table(); first.deal();
  first.run(`clearDealAnimationTimer(); state.dealAnimationActive = false;
    const remaining = createDeck().filter(card => card.suit === "clubs" && card.value >= 7).reverse();
    state.players.forEach((player, index) => {
      player.hand = remaining.slice(index * 2, index * 2 + 2);
      player.taken = []; player.pendingPass = [];
    });
    state.players[0].taken = createDeck().filter(card => !remaining.some(item => item.id === card.id));
    state.stage = "playing"; state.currentPlayerIndex = 0; state.selectedPassIds = [];
    beginTramClaim(state.players[0]);`);
  const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
  assert.equal(next.snapshot().handHistory.length, 1);
  assert.equal(next.run("validAutosave(sessionSnapshot())"), true);
  const again = table(next.saved); again.run("restoreAutosave()");
  assert.equal(again.snapshot().handHistory.length, 1);
});
