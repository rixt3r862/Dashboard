import test from "node:test";
import assert from "node:assert/strict";
import {
  determineWinnerFromTotals,
  totalsByPlayerId,
  totalsByTeamId,
  validateRoundScores,
} from "../js/rules.mjs";

test("high-score winner requires target and picks highest eligible", () => {
  const entries = [
    { id: "a", total: 140 },
    { id: "b", total: 170 },
    { id: "c", total: 160 },
  ];
  assert.equal(determineWinnerFromTotals(entries, "high", 150), "b");
  assert.equal(determineWinnerFromTotals(entries, "high", 200), null);
});

test("low-score winner waits until someone reaches target, then picks lowest", () => {
  const beforeEnd = [
    { id: "a", total: 50 },
    { id: "b", total: 60 },
    { id: "c", total: 70 },
  ];
  assert.equal(determineWinnerFromTotals(beforeEnd, "low", 100), null);

  const ended = [
    { id: "a", total: 120 },
    { id: "b", total: 97 },
    { id: "c", total: 103 },
  ];
  assert.equal(determineWinnerFromTotals(ended, "low", 100), "b");
});

test("Phase 10 validation only allows Yes/No values (1/0)", () => {
  const players = [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ];
  const ok = validateRoundScores({
    scores: { p1: 1, p2: 0 },
    players,
    presetKey: "phase10",
  });
  assert.equal(ok.ok, true);

  const bad = validateRoundScores({
    scores: { p1: 2, p2: 0 },
    players,
    presetKey: "phase10",
  });
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /Yes\/No/i);
});

test("Hearts validation allows normal total or shoot-the-moon total", () => {
  const players4 = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ];

  const normal = validateRoundScores({
    scores: { a: 10, b: 8, c: 5, d: 3 }, // 26
    players: players4,
    presetKey: "hearts",
  });
  assert.equal(normal.ok, true);
  assert.equal(normal.warning, undefined);

  const moon = validateRoundScores({
    scores: { a: 78, b: 0, c: 0, d: 0 }, // 78 for 4 players
    players: players4,
    presetKey: "hearts",
  });
  assert.equal(moon.ok, true);
  assert.equal(moon.warning, undefined);

  const odd = validateRoundScores({
    scores: { a: 20, b: 20, c: 20, d: 20 }, // 80
    players: players4,
    presetKey: "hearts",
  });
  assert.equal(odd.ok, true);
  assert.match(String(odd.warning), /Hearts round total is 80/i);
});

test("team totals are summed from player totals (Spades-style)", () => {
  const players = [
    { id: "p1", name: "P1" },
    { id: "p2", name: "P2" },
    { id: "p3", name: "P3" },
    { id: "p4", name: "P4" },
  ];
  const rounds = [
    { n: 1, scores: { p1: 50, p2: 40, p3: 30, p4: 20 } },
    { n: 2, scores: { p1: -10, p2: 10, p3: 5, p4: 15 } },
  ];
  const teams = [
    { id: "A", members: ["p1", "p3"] },
    { id: "B", members: ["p2", "p4"] },
  ];

  const byPlayer = totalsByPlayerId(players, rounds);
  assert.deepEqual(byPlayer, {
    p1: 40,
    p2: 50,
    p3: 35,
    p4: 35,
  });

  const byTeam = totalsByTeamId(teams, byPlayer);
  assert.deepEqual(byTeam, {
    A: 75,
    B: 85,
  });
});
