export function totalsByPlayerId(players, rounds) {
  const totals = Object.fromEntries(players.map((p) => [p.id, 0]));
  for (const r of rounds) {
    for (const p of players) {
      const v = Number(r.scores?.[p.id] ?? 0);
      totals[p.id] += Number.isFinite(v) ? v : 0;
    }
  }
  return totals;
}

export function adjustSkyjoRoundScores(players, round) {
  const out = {};
  for (const p of players) {
    const raw = Number(round?.scores?.[p.id] ?? 0);
    out[p.id] = Number.isFinite(raw) ? raw : 0;
  }

  const wentOutId = round?.skyjoWentOutPlayerId || null;
  if (!wentOutId || !(wentOutId in out)) return out;

  const wentOutScore = Number(out[wentOutId] ?? 0);
  // Official rule: only positive scores can be doubled.
  if (wentOutScore <= 0) return out;

  const otherHasLessOrEqual = players.some((p) => {
    if (p.id === wentOutId) return false;
    return Number(out[p.id] ?? 0) <= wentOutScore;
  });
  if (otherHasLessOrEqual) out[wentOutId] = wentOutScore * 2;
  return out;
}

export function totalsByTeamId(teams, playerTotals) {
  const totals = {};
  if (!teams) return totals;
  for (const t of teams) {
    totals[t.id] = t.members.reduce(
      (sum, pid) => sum + (playerTotals[pid] ?? 0),
      0,
    );
  }
  return totals;
}

export function determineWinnerFromTotals(entries, winMode, target) {
  if (winMode === "low") {
    const gameOver = entries.some((x) => (x.total ?? 0) >= target);
    if (!gameOver) return null;
    const sorted = [...entries].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
    return sorted[0]?.id ?? null;
  }

  const eligible = entries.filter((x) => (x.total ?? 0) >= target);
  if (!eligible.length) return null;
  eligible.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  return eligible[0].id;
}

export function normalizeHeartsShootMoonScores(players, scores) {
  if (!Array.isArray(players) || !scores) {
    return { scores, shooterId: null };
  }

  const ids = players.map((p) => p.id);
  if (!ids.length) return { scores, shooterId: null };

  const normalized = Object.fromEntries(
    ids.map((id) => {
      const v = Number(scores[id] ?? 0);
      return [id, Number.isFinite(v) ? Math.trunc(v) : 0];
    }),
  );

  const shooters = ids.filter((id) => normalized[id] === 26);
  if (shooters.length !== 1) {
    return { scores: normalized, shooterId: null };
  }

  const shooterId = shooters[0];
  const othersAreZero = ids
    .filter((id) => id !== shooterId)
    .every((id) => normalized[id] === 0);
  if (!othersAreZero) {
    return { scores: normalized, shooterId: null };
  }

  const moonScores = Object.fromEntries(ids.map((id) => [id, 26]));
  moonScores[shooterId] = 0;
  return { scores: moonScores, shooterId };
}

export function validateRoundScores({
  scores,
  players,
  presetKey,
  contextLabel = "round",
  minScore = -10000,
  maxScore = 10000,
  messages = {},
}) {
  const wholeNumbersMsg = messages.wholeNumbers || "Scores must be whole numbers.";
  const outOfRangeMsg =
    messages.outOfRange ||
    (({ name, value }) => `Score for ${name} looks out of range (${value}).`);
  const phase10YesNoMsg =
    messages.phase10YesNo || "Phase 10 scores must be Yes/No only.";
  const heartsTotalWarningMsg =
    messages.heartsTotalWarning ||
    (({ contextLabel: ctx, total, normalTotal, shootMoonTotal }) =>
      `Hearts ${ctx} total is ${total} (typical is ${normalTotal}, or ${shootMoonTotal} when someone shoots the moon).`);

  for (const p of players) {
    const v = scores[p.id];
    if (!Number.isInteger(v)) {
      return {
        ok: false,
        error: wholeNumbersMsg,
      };
    }

    if (v < minScore || v > maxScore) {
      return {
        ok: false,
        error: outOfRangeMsg({ name: p.name, value: v }),
      };
    }
  }

  if (presetKey === "phase10") {
    for (const p of players) {
      const v = Number(scores[p.id] ?? 0);
      if (v !== 0 && v !== 1) {
        return {
          ok: false,
          error: phase10YesNoMsg,
        };
      }
    }
  }

  const warnings = [];
  if (presetKey === "hearts") {
    const total = players.reduce((sum, p) => sum + Number(scores[p.id] ?? 0), 0);
    const normalTotal = 26;
    const shootMoonTotal = 26 * Math.max(0, players.length - 1);
    const validTotals = new Set([normalTotal, shootMoonTotal]);
    if (!validTotals.has(total)) {
      warnings.push(
        heartsTotalWarningMsg({
          contextLabel,
          total,
          normalTotal,
          shootMoonTotal,
        }),
      );
    }
  }

  if (warnings.length) {
    return {
      ok: true,
      warning: warnings.join(" "),
    };
  }

  return { ok: true };
}
