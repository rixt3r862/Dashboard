import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustSkyjoRoundScores,
  determinePhase10Winner,
  determineWinnerFromTotals,
  heartsRoundPenaltyTotal,
  normalizeHeartsShootMoonScores,
  normalizeRummikubRoundScores,
  phase10CompletionMap,
  phase10ProgressByPlayerId,
  rummikubWinsByPlayerId,
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

test("low-score games do not declare a winner while the best total is tied", () => {
  const tiedAtEnd = [
    { id: "a", total: 104 },
    { id: "b", total: 88 },
    { id: "c", total: 88 },
  ];

  assert.equal(determineWinnerFromTotals(tiedAtEnd, "low", 100), null);
});

test("Phase 10 validation allows normal leftover hand points", () => {
  const players = [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ];
  const ok = validateRoundScores({
    scores: { p1: 0, p2: 37 },
    players,
    presetKey: "phase10",
  });
  assert.equal(ok.ok, true);
});

test("Phase 10 completion map honors explicit metadata and legacy yes/no rounds", () => {
  const players = [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ];

  assert.deepEqual(
    phase10CompletionMap(players, {
      scores: { p1: 55, p2: 10 },
      phase10CompletedByPlayerId: { p1: 1, p2: 0 },
    }),
    { p1: true, p2: false },
  );

  assert.deepEqual(
    phase10CompletionMap(players, {
      scores: { p1: 1, p2: 0 },
    }),
    { p1: true, p2: false },
  );
});

test("Phase 10 winner is first to finish final phase with lowest points as same-round tiebreak", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  const rounds = [
    { n: 1, scores: { a: 20, b: 35, c: 40 }, phase10CompletedByPlayerId: { a: 1, b: 1, c: 0 } },
    { n: 2, scores: { a: 15, b: 10, c: 25 }, phase10CompletedByPlayerId: { a: 1, b: 0, c: 1 } },
    { n: 3, scores: { a: 5, b: 8, c: 9 }, phase10CompletedByPlayerId: { a: 1, b: 1, c: 1 } },
  ];

  assert.equal(determinePhase10Winner(players, rounds, 3), "a");
});

test("Phase 10 progress tracks both points and completed phases", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const rounds = [
    { n: 1, scores: { a: 0, b: 35 }, phase10CompletedByPlayerId: { a: 1, b: 0 } },
    { n: 2, scores: { a: 22, b: 0 }, phase10CompletedByPlayerId: { a: 0, b: 1 } },
  ];

  assert.deepEqual(phase10ProgressByPlayerId(players, rounds, 10), {
    a: {
      completedPhases: 1,
      currentPhase: 2,
      points: 22,
      reachedTarget: false,
    },
    b: {
      completedPhases: 1,
      currentPhase: 2,
      points: 35,
      reachedTarget: false,
    },
  });
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

test("Hearts supports multi-deck round totals and shoot-the-moon normalization", () => {
  const players4 = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ];

  assert.equal(heartsRoundPenaltyTotal(2), 52);

  const normal = validateRoundScores({
    scores: { a: 20, b: 12, c: 15, d: 5 }, // 52
    players: players4,
    presetKey: "hearts",
    heartsDeckCount: 2,
  });
  assert.equal(normal.ok, true);
  assert.equal(normal.warning, undefined);

  const normalizedMoon = normalizeHeartsShootMoonScores(
    players4,
    { a: 52, b: 0, c: 0, d: 0 },
    2,
  );
  assert.deepEqual(normalizedMoon.scores, {
    a: 0,
    b: 52,
    c: 52,
    d: 52,
  });
});

test("Rummikub normalizes rack totals into official round scores", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];

  const normalized = normalizeRummikubRoundScores(
    players,
    { a: 0, b: 18, c: 27 },
    "a",
  );
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.scores, { a: 45, b: -18, c: -27 });

  const poolEmpty = normalizeRummikubRoundScores(
    players,
    { a: 8, b: 15, c: 22 },
    "a",
  );
  assert.equal(poolEmpty.ok, true);
  assert.deepEqual(poolEmpty.scores, { a: 21, b: -15, c: -22 });
});

test("Rummikub winner uses games won first and score second", () => {
  const entries = [
    { id: "a", wins: 2, total: 40 },
    { id: "b", wins: 3, total: 10 },
    { id: "c", wins: 3, total: 28 },
  ];
  assert.equal(determineWinnerFromTotals(entries, "rummikub", 3), "c");
});

test("Rummikub tracks games won from round winner markers", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  const rounds = [
    { rummikubWinnerId: "a", scores: { a: 32, b: -12, c: -20 } },
    { rummikubWinnerId: "b", scores: { a: -5, b: 14, c: -9 } },
    { rummikubWinnerId: "a", scores: { a: 25, b: -11, c: -14 } },
  ];
  assert.deepEqual(rummikubWinsByPlayerId(players, rounds), { a: 2, b: 1, c: 0 });
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

test("SkyJo went-out player doubles only when another player is lower or equal", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];

  const doubled = adjustSkyjoRoundScores(players, {
    scores: { a: 8, b: 4, c: 10 },
    skyjoWentOutPlayerId: "a",
  });
  assert.deepEqual(doubled, { a: 16, b: 4, c: 10 });

  const tieAlsoDoubles = adjustSkyjoRoundScores(players, {
    scores: { a: 5, b: 5, c: 12 },
    skyjoWentOutPlayerId: "a",
  });
  assert.deepEqual(tieAlsoDoubles, { a: 10, b: 5, c: 12 });

  const noDoubleWhenStrictLowest = adjustSkyjoRoundScores(players, {
    scores: { a: 3, b: 4, c: 12 },
    skyjoWentOutPlayerId: "a",
  });
  assert.deepEqual(noDoubleWhenStrictLowest, { a: 3, b: 4, c: 12 });

  const noDoubleWhenNonPositive = adjustSkyjoRoundScores(players, {
    scores: { a: -2, b: 1, c: 7 },
    skyjoWentOutPlayerId: "a",
  });
  assert.deepEqual(noDoubleWhenNonPositive, { a: -2, b: 1, c: 7 });
});
