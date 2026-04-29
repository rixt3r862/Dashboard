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

export function normalizeDeckCount(deckCount = 1, maxDecks = 4) {
  const parsed = Number.parseInt(deckCount, 10);
  return Number.isInteger(parsed)
    ? Math.max(1, Math.min(maxDecks, parsed))
    : 1;
}

export function heartsRoundPenaltyTotal(deckCount = 1) {
  return 26 * normalizeDeckCount(deckCount);
}

export function rummikubRackTotalsByPlayerId(players, round) {
  const ids = Array.isArray(players) ? players.map((p) => p.id) : [];
  const explicit = round?.rummikubRackTotalsByPlayerId;
  if (explicit && typeof explicit === "object") {
    return Object.fromEntries(
      ids.map((id) => {
        const value = Number(explicit[id] ?? 0);
        return [id, Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0];
      }),
    );
  }

  const winnerId =
    typeof round?.rummikubWinnerId === "string" ? round.rummikubWinnerId : null;
  return Object.fromEntries(
    ids.map((id) => {
      if (winnerId && id === winnerId) return [id, 0];
      const value = Math.abs(Number(round?.scores?.[id] ?? 0));
      return [id, Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0];
    }),
  );
}

export function rummikubWinsByPlayerId(players, rounds) {
  const wins = Object.fromEntries((players || []).map((p) => [p.id, 0]));
  for (const round of rounds || []) {
    const winnerId =
      typeof round?.rummikubWinnerId === "string" ? round.rummikubWinnerId : null;
    if (winnerId && winnerId in wins) {
      wins[winnerId] += 1;
      continue;
    }
    const entries = (players || []).map((player) => ({
      id: player.id,
      score: Number(round?.scores?.[player.id] ?? 0),
    }));
    const bestScore = Math.max(...entries.map((entry) => entry.score));
    const winners = entries.filter((entry) => entry.score === bestScore);
    if (winners.length === 1 && winners[0].id in wins) {
      wins[winners[0].id] += 1;
    }
  }
  return wins;
}

export function normalizeRummikubRoundScores(players, rackTotalsByPlayerId, winnerId) {
  if (!Array.isArray(players) || !players.length) {
    return {
      ok: false,
      error: "Rummikub requires players before scoring a round.",
    };
  }
  if (!winnerId || !players.some((player) => player.id === winnerId)) {
    return {
      ok: false,
      error: "Rummikub: select the round winner.",
    };
  }

  const rackTotals = {};
  for (const player of players) {
    const raw = Number(rackTotalsByPlayerId?.[player.id] ?? 0);
    if (!Number.isInteger(raw) || raw < 0) {
      return {
        ok: false,
        error: "Rummikub rack totals must be whole numbers at 0 or higher.",
      };
    }
    rackTotals[player.id] = raw;
  }

  const winnerRackTotal = Number(rackTotals[winnerId] ?? 0);
  const lowestRackTotal = Math.min(...Object.values(rackTotals));
  if (winnerRackTotal > lowestRackTotal) {
    return {
      ok: false,
      error: "Rummikub: the winner must have the lowest rack total for the round.",
    };
  }

  const scores = Object.fromEntries(players.map((player) => [player.id, 0]));
  let winnerScore = 0;
  for (const player of players) {
    if (player.id === winnerId) continue;
    const rackTotal = Number(rackTotals[player.id] ?? 0);
    scores[player.id] = -rackTotal;
    winnerScore += rackTotal - winnerRackTotal;
  }
  scores[winnerId] = winnerScore;

  return {
    ok: true,
    scores,
    rackTotals,
    winnerId,
  };
}

export function phase10CompletionMap(players, round) {
  const ids = Array.isArray(players) ? players.map((p) => p.id) : [];
  const explicit = round?.phase10CompletedByPlayerId;
  if (explicit && typeof explicit === "object") {
    return Object.fromEntries(
      ids.map((id) => [id, Number(explicit[id] ?? 0) > 0]),
    );
  }

  const legacyPhase10Round = ids.length
    ? ids.every((id) => {
        const value = Number(round?.scores?.[id] ?? 0);
        return value === 0 || value === 1;
      })
    : false;

  return Object.fromEntries(
    ids.map((id) => {
      const raw = Number(round?.scores?.[id] ?? 0);
      return [id, legacyPhase10Round && raw > 0];
    }),
  );
}

export function phase10ProgressByPlayerId(players, rounds, target = 10) {
  const normalizedTarget = Math.max(1, Number(target) || 10);
  const progress = Object.fromEntries(
    players.map((p) => [
      p.id,
      {
        completedPhases: 0,
        currentPhase: 1,
        points: 0,
        reachedTarget: false,
      },
    ]),
  );

  for (const round of rounds) {
    const completedMap = phase10CompletionMap(players, round);
    for (const player of players) {
      const entry = progress[player.id];
      const rawPoints = Number(round?.scores?.[player.id] ?? 0);
      entry.points += Number.isFinite(rawPoints) ? rawPoints : 0;
      if (completedMap[player.id]) {
        entry.completedPhases += 1;
      }
      entry.reachedTarget = entry.completedPhases >= normalizedTarget;
      entry.currentPhase = entry.reachedTarget
        ? normalizedTarget
        : Math.max(1, Math.min(normalizedTarget, entry.completedPhases + 1));
    }
  }

  return progress;
}

export function determinePhase10Winner(players, rounds, target = 10) {
  const normalizedTarget = Math.max(1, Number(target) || 10);
  const completed = Object.fromEntries(players.map((p) => [p.id, 0]));
  const points = Object.fromEntries(players.map((p) => [p.id, 0]));

  for (const round of rounds) {
    const completedMap = phase10CompletionMap(players, round);
    const candidates = [];

    for (const player of players) {
      const rawPoints = Number(round?.scores?.[player.id] ?? 0);
      points[player.id] += Number.isFinite(rawPoints) ? rawPoints : 0;

      const before = completed[player.id];
      if (completedMap[player.id]) {
        completed[player.id] += 1;
      }
      if (before < normalizedTarget && completed[player.id] >= normalizedTarget) {
        candidates.push(player.id);
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => {
        const diff = (points[a] ?? 0) - (points[b] ?? 0);
        if (diff !== 0) return diff;
        return String(a).localeCompare(String(b));
      });
      return candidates[0] ?? null;
    }
  }

  return null;
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
  if (winMode === "quiz") {
    const roundsPlayed = Math.max(
      0,
      ...entries.map((entry) => Number(entry.roundsPlayed ?? 0)),
    );
    if (roundsPlayed < target) return null;
    const sorted = [...entries].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const bestTotal = sorted[0]?.total ?? null;
    if (bestTotal === null) return null;
    const leaders = sorted.filter((entry) => (entry.total ?? 0) === bestTotal);
    return leaders.length === 1 ? leaders[0]?.id ?? null : null;
  }

  if (winMode === "rummikub") {
    const highestWins = Math.max(0, ...entries.map((entry) => Number(entry.wins ?? 0)));
    if (highestWins < target) return null;
    const leaders = entries.filter((entry) => Number(entry.wins ?? 0) === highestWins);
    if (leaders.length === 1) return leaders[0]?.id ?? null;
    leaders.sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0));
    const bestTotal = Number(leaders[0]?.total ?? 0);
    const tiedLeaders = leaders.filter((entry) => Number(entry.total ?? 0) === bestTotal);
    return tiedLeaders.length === 1 ? tiedLeaders[0]?.id ?? null : null;
  }

  if (winMode === "low") {
    // "Low wins" games only end once someone reaches/passes target.
    const gameOver = entries.some((x) => (x.total ?? 0) >= target);
    if (!gameOver) return null;
    // Once game-over is triggered, lowest cumulative score wins.
    const sorted = [...entries].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
    const bestTotal = sorted[0]?.total ?? null;
    if (bestTotal === null) return null;
    const leaders = sorted.filter((entry) => (entry.total ?? 0) === bestTotal);
    return leaders.length === 1 ? leaders[0]?.id ?? null : null;
  }

  // "High wins" games require crossing target and picking the highest eligible total.
  const eligible = entries.filter((x) => (x.total ?? 0) >= target);
  if (!eligible.length) return null;
  eligible.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  return eligible[0].id;
}

export function normalizeHeartsShootMoonScores(players, scores, deckCount = 1) {
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

  const roundPenaltyTotal = heartsRoundPenaltyTotal(deckCount);
  // Apply "shoot the moon" only for a single exact N/0...0 pattern.
  const shooters = ids.filter((id) => normalized[id] === roundPenaltyTotal);
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

  const moonScores = Object.fromEntries(
    ids.map((id) => [id, roundPenaltyTotal]),
  );
  moonScores[shooterId] = 0;
  return { scores: moonScores, shooterId };
}

export function validateRoundScores({
  scores,
  players,
  presetKey,
  heartsDeckCount = 1,
  contextLabel = "round",
  minScore = -10000,
  maxScore = 10000,
  messages = {},
}) {
  const wholeNumbersMsg = messages.wholeNumbers || "Scores must be whole numbers.";
  const outOfRangeMsg =
    messages.outOfRange ||
    (({ name, value }) => `Score for ${name} looks out of range (${value}).`);
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

    if (presetKey === "quiz" && v !== 0 && v !== 1) {
      return {
        ok: false,
        error: `Quiz score for ${p.name} must be 0 or 1.`,
      };
    }
  }

  const warnings = [];
  if (presetKey === "hearts") {
    // Hearts totals outside normal/shoot-moon expectations are warnings, not hard errors.
    const total = players.reduce((sum, p) => sum + Number(scores[p.id] ?? 0), 0);
    const normalTotal = heartsRoundPenaltyTotal(heartsDeckCount);
    const shootMoonTotal = normalTotal * Math.max(0, players.length - 1);
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
