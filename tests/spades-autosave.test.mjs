import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../Spades/spades.js", import.meta.url), "utf8");
const key = "dashboard.spades.autosave.v1";
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
  vm.runInContext(source.slice(0, source.lastIndexOf("\nshuffleSetupBotNames();")), context);
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
    deal() { run('state.players = ["Human", "A", "B", "C"].map((name, i) => createPlayer("p"+i, name, i > 0)); state.teams = createTeams(); state.gameStarted = true; dealHand();'); },
    snapshot() { return JSON.parse(run("JSON.stringify(sessionSnapshot())")); },
    flush() { const item = timers.entries().next().value; if (item) { timers.delete(item[0]); item[1](); } return !!item; },
  };
}


test("bidding, nil, team bags and difficulty survive refresh", () => {
  const first = table(); first.deal();
  first.node("humanBid").value = "0";
  first.run('state.teams[0].bags = 7; state.teams[0].score = -20; state.players[1].difficulty = "hard"; saveAutosave();');
  const next = table(first.saved);
  assert.equal(next.run("restoreAutosave()"), true);
  assert.equal(next.node("humanBid").value, "0");
  assert.equal(next.snapshot().teams[0].bags, 7);
  assert.equal(next.snapshot().teams[0].score, -20);
  assert.equal(next.snapshot().players[1].difficulty, "hard");
  next.run("confirmHumanBid()");
  const again = table(next.saved); assert.equal(again.run("restoreAutosave()"), true);
  assert.equal(again.snapshot().players[0].nilBid, true);
});

test("a pending bot turn resumes after refresh", () => {
  const first = table(); first.deal();
  first.run('clearDealAnimationTimer(); state.dealAnimationActive = false; state.currentPlayerIndex = 1;');
  first.node("humanBid").value = "3"; first.run("confirmHumanBid()");
  const next = table(first.saved); assert.equal(next.run("restoreAutosave()"), true);
  next.flush();
  assert.equal(next.snapshot().trick.length, 1);
  assert.equal(next.run("validAutosave(sessionSnapshot())"), true);
});

test("collection recovery never credits the same trick twice", () => {
  const first = table(); first.deal();
  first.run('clearDealAnimationTimer(); state.dealAnimationActive = false;');
  first.node("humanBid").value = "3"; first.run("confirmHumanBid()");
  first.run('while (state.trick.length < 4) playCard(state.currentPlayerIndex, legalCards(state.players[state.currentPlayerIndex])[0]);');
  for (const stage of ["trick-complete", "trick-collecting"]) {
    const saved = new Map(first.saved);
    const snapshot = JSON.parse(saved.get(key)); snapshot.stage = stage;
    saved.set(key, JSON.stringify(snapshot));
    const next = table(saved); assert.equal(next.run("restoreAutosave()"), true);
    assert.equal(next.snapshot().trick.length, 0);
    assert.equal(next.snapshot().players.reduce((n,p) => n+p.tricks, 0), 1);
    const again = table(next.saved); assert.equal(again.run("restoreAutosave()"), true);
    assert.equal(again.snapshot().players.reduce((n,p) => n+p.tricks, 0), 1);
  }
});

test("complete hand simulation restores every transition and scores only once", () => {
  let active = table(); active.deal();
  active.node("humanBid").value = "3"; active.run("confirmHumanBid()");
  for (let move = 0; move < 60 && !["hand-end", "game-end"].includes(active.snapshot().stage); move++) {
    if (active.snapshot().stage === "playing") {
      active.run('playCard(state.currentPlayerIndex, legalCards(state.players[state.currentPlayerIndex])[0]);');
    }
    const next = table(active.saved);
    assert.equal(next.run("restoreAutosave()"), true, "move " + move);
    active = next;
  }
  assert.equal(active.snapshot().stage, "hand-end");
  assert.equal(active.snapshot().handHistory.length, 1);
  const teams = active.snapshot().teams;
  const next = table(active.saved); next.run("restoreAutosave()");
  assert.deepEqual(next.snapshot().teams, teams);
  assert.equal(next.snapshot().handHistory.length, 1);
  next.run('state.teams[0].score = 600; state.winnerTeamId = "teamA"; state.stage = "game-end"; render();');
  const winner = table(next.saved); assert.equal(winner.run("restoreAutosave()"), true);
  assert.equal(winner.snapshot().winnerTeamId, "teamA");
  assert.equal(winner.snapshot().stage, "game-end");
});

test("invalid saves and storage failures leave the table usable; reset preserves sessions", () => {
  for (const raw of ["{broken", "null", '{"game":"spades"}']) {
    const next = table(new Map([[key, raw]]));
    assert.equal(next.run("restoreAutosave()"), false);
    next.run("render()");
    assert.equal(next.saved.get(key), raw);
  }
  const first = table(); first.deal();
  const invalid = first.snapshot(); invalid.teams[0].members = ["missing", "missing"];
  assert.equal(table(new Map([[key, JSON.stringify(invalid)]])).run("restoreAutosave()"), false);
  first.saved.set("dashboard.spades.sessions", "named sessions");
  first.node("resetTableBtn").handlers.click();
  assert.equal(first.saved.has(key), false);
  assert.equal(first.saved.get("dashboard.spades.sessions"), "named sessions");
  const blocked = table(new Map(), true); blocked.deal();
  assert.match(blocked.node("autosaveStatus").textContent, /Unable to autosave/);
});
