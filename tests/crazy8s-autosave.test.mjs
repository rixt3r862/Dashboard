import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../Crazy8s/crazy8s.js", import.meta.url), "utf8");
const key = "dashboard.crazy8s.autosave.v1";
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
  window.GameDialog = { setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, confirm: async () => true };
  const context = vm.createContext({ window, localStorage, document: { getElementById: node },
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(source.slice(0, source.lastIndexOf("\nshuffleSetupBotNames();")), context);
  const run = expression => vm.runInContext(expression, context);
  // Exercise real state transitions, snapshots, and timers; omit visual DOM rendering.
  run(`renderBotNameFields = () => {};
    prepareNextGameSetupNames = () => {};
    shuffleSetupBotNames = () => {};
    for (const name of ["renderSetupPanel", "renderStatus", "renderSessionControls",
      "renderScoreBoard", "renderSeats", "renderTrick", "renderMoonBurst",
      "renderHumanHand", "renderActions", "renderHistory", "renderPiles", "renderActionControls", "renderNotice"]) globalThis[name] = () => {};
    bindEvents();`);
  return { saved, run, node, timers,
    deal() { run('state.players = ["Human", "A", "B", "C"].map((name, i) => createPlayer("p"+i, name, i > 0)); state.gameStarted = true; dealRound();'); },
    snapshot() { return JSON.parse(run("JSON.stringify(sessionSnapshot())")); },
    flush() { const item = timers.entries().next().value; if (item) { timers.delete(item[0]); item[1](); } return !!item; },
  };
}



test("named draw rule restores with a legacy default", () => {
  const first = table(); first.deal();
  first.run('state.drawRule = "one"; state.drawsThisTurn = 1; saveAutosave();');
  const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
  assert.equal(next.run("drawLimit()"), 1);
  assert.equal(next.node("drawRule").value, "one");
  const legacy = first.snapshot(); delete legacy.drawRule;
  const old = table(new Map([[key, JSON.stringify(legacy)]]));
  assert.equal(old.run("restoreAutosave()"), true);
  assert.equal(old.run("drawLimit()"), 5);
});

test("human and bot draw limits use the same selected rule", () => {
  for (const rule of ["one", "five"]) {
    const h = table(); h.deal();
    h.run(`state.drawRule = "${rule}"; state.stage = "playing"; state.currentPlayerIndex = 0;
      state.dealAnimationActive = false; legalCards = () => []; isPlayable = () => false;
      canDrawCard = () => true; let draws = 0; drawOne = () => { draws++; return {rank:"2",suit:"clubs"}; };
      cardLabel = () => "2"; for(let i=0;i<8;i++)drawForHuman();`);
    assert.equal(h.run("draws"), rule === "one" ? 1 : 5);
    h.run('draws = 0; state.currentPlayerIndex = 1; takeBotTurn();');
    assert.equal(h.run("draws"), rule === "one" ? 1 : 5);
  }
});

test("draw allowance and two-player settings survive refresh", () => {
  const first = table(); first.deal();
  first.run('state.players[1].difficulty = "hard"; state.drawsThisTurn = 4; render();');
  const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
  assert.equal(next.snapshot().drawsThisTurn, 4);
  assert.equal(next.snapshot().players[1].difficulty, "hard");
  assert.equal(next.run("state.busy"), false);
  assert.equal(next.run("state.dealAnimationActive"), false);
  next.run('state.players = state.players.slice(0,2); state.playerCount = 2; dealRound();');
  const two = table(next.saved); assert.equal(two.run("restoreAutosave()"), true);
  assert.equal(two.node("playerCount").value, "2");
});

test("refresh while choosing an eight suit, including a last card, scores once", () => {
  for (const lastCard of [false, true]) {
    const first = table(); first.deal();
    first.run(`clearDealAnimationTimer(); state.dealAnimationActive = false;
      const deck = createDeck(); const eight = deck.find(c => c.rank === "8");
      const others = deck.filter(c => c.id !== eight.id);
      state.players.forEach((p,i) => p.hand = i === 0 ? [eight] : [others.pop()]);
      if (!${lastCard}) state.players[0].hand.push(others.pop());
      state.discardPile = [others.pop()]; state.drawPile = others;
      state.currentPlayerIndex = 0; state.targetScore = 25;
      playCard(state.players[0], eight);`);
    const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
    assert.ok(next.snapshot().pendingEightCardId);
    next.run('declareSuit("hearts", humanPlayer());');
    assert.equal(next.snapshot().currentSuit, "hearts");
    assert.equal(next.snapshot().pendingEightCardId, null);
    const expected = next.snapshot();
    const again = table(next.saved); assert.equal(again.run("restoreAutosave()"), true);
    assert.deepEqual(again.snapshot().players.map(p=>p.score), expected.players.map(p=>p.score));
    assert.equal(again.snapshot().roundHistory.length, lastCard ? 1 : 0);
    if (lastCard) assert.equal(again.snapshot().stage, "gameOver");
  }
});

test("pending bot turn resumes and preserves the deck", () => {
  const first = table(); first.deal();
  first.run('state.currentPlayerIndex = 1; render();');
  const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
  assert.ok(next.timers.size);
  next.flush();
  assert.equal(next.run("validAutosave(sessionSnapshot())"), true);
  assert.ok(next.snapshot().currentPlayerIndex !== 1 || next.snapshot().stage !== "playing");
});

test("invalid saves and storage errors leave setup usable; reset preserves named sessions", async () => {
  for (const raw of ["{broken", "null", '{"game":"crazy8s"}']) {
    const next = table(new Map([[key,raw]])); assert.equal(next.run("restoreAutosave()"), false);
    next.run("render()"); assert.equal(next.saved.get(key), raw);
  }
  const first = table(); first.deal();
  const bad = first.snapshot(); bad.drawPile[0] = bad.players[0].hand[0];
  assert.equal(table(new Map([[key,JSON.stringify(bad)]])).run("restoreAutosave()"), false);
  first.saved.set("dashboard.crazy8s.sessions", "named sessions");
  await first.node("resetTableBtn").handlers.click();
  assert.equal(first.saved.has(key), false);
  assert.equal(first.saved.get("dashboard.crazy8s.sessions"), "named sessions");
  const blocked = table(new Map(), true); blocked.deal();
  assert.match(blocked.node("autosaveStatus").textContent, /Unable to autosave/);
});
