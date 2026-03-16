import { bindSelectOnFocusAndClick } from "./inputUx.js";
import {
  adjustSkyjoRoundScores,
  normalizeHeartsShootMoonScores,
  phase10CompletionMap,
} from "./rules.mjs";

export function createHistoryController(deps) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HISTORY_CARD_BREAKPOINT = 760;
  const GRAPH_LINE_COLORS = [
    "#2563eb",
    "#dc2626",
    "#059669",
    "#7c3aed",
    "#ea580c",
    "#0891b2",
    "#be185d",
    "#65a30d",
    "#0f766e",
    "#4f46e5",
  ];

  const {
    state,
    els,
    isPhase10,
    showMsg,
    setLive,
    applyPhase10UiText,
    save,
    renderAll,
    validateRoundScores,
    totalsByPlayerId,
    totalsByTeamId,
    determineWinnerFromTotals,
  } = deps;

  function recalcAfterHistoryChange(liveText) {
    // History edits can reorder/remove rounds, so reindex round numbers first.
    state.rounds.forEach((r, i) => {
      r.n = i + 1;
    });
    state.lastRoundScores = state.rounds.length
      ? state.rounds[state.rounds.length - 1].scores || {}
      : {};
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );

    const playerTotals = totalsByPlayerId();
    let entries = [];
    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      entries = state.teams.map((t) => ({
        id: t.id,
        total: teamTotals[t.id] ?? 0,
      }));
    } else {
      entries = state.players.map((p) => ({
        id: p.id,
        total: playerTotals[p.id] ?? 0,
      }));
    }

    // Persist a target-aware winner timeline so "continue game" context stays meaningful.
    const winnerMarker = (winnerId) => ({
      winnerId,
      roundN: state.rounds.length,
      target: state.target,
      ts: Date.now(),
    });
    const syncWinnerAnchors = () => {
      if (!Array.isArray(state.winnerMilestones) || !state.winnerMilestones.length) {
        state.firstWinnerAt = null;
        state.finalWinnerAt = null;
        return;
      }
      state.firstWinnerAt = state.winnerMilestones[0];
      state.finalWinnerAt = state.winnerMilestones[state.winnerMilestones.length - 1];
    };
    const pruneMilestones = () => {
      state.winnerMilestones = (state.winnerMilestones || []).filter(
        (m) => Number.isInteger(m.roundN) && m.roundN >= 1 && m.roundN <= state.rounds.length,
      );
      syncWinnerAnchors();
    };
    const appendMilestone = (marker) => {
      const last = state.winnerMilestones?.[state.winnerMilestones.length - 1];
      if (
        last &&
        last.winnerId === marker.winnerId &&
        last.roundN === marker.roundN &&
        last.target === marker.target
      ) {
        return;
      }
      if (!Array.isArray(state.winnerMilestones)) state.winnerMilestones = [];
      state.winnerMilestones.push(marker);
      syncWinnerAnchors();
    };
    pruneMilestones();

    // Free-play keeps scoring and history, but intentionally has no active winner state.
    if (state.gameState === "free_play") {
      state.winnerId = null;
      state.mode = state.players.length ? "playing" : "setup";
    } else {
      const winner = determineWinnerFromTotals(entries);
      if (winner) {
        state.winnerId = winner;
        state.mode = "finished";
        appendMilestone(winnerMarker(winner));
        if (state.gameState !== "extended") {
          state.gameState = "completed";
        }
      } else {
        state.winnerId = null;
        state.mode = state.players.length ? "playing" : "setup";
        if (state.gameState === "extended") {
          if (!state.winnerMilestones?.length) state.gameState = "in_progress";
        } else {
          state.gameState = "in_progress";
          state.winnerMilestones = [];
          syncWinnerAnchors();
        }
      }
    }

    state.bannerDismissed = true;
    state.historyEditingRoundN = null;
    state.activeRoundHelper = null;

    save();
    applyPhase10UiText();
    renderAll();
    if (liveText) setLive(liveText);
  }

  function createSvgNode(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => {
      node.setAttribute(k, String(v));
    });
    return node;
  }

  function adjustedRoundScoresForGraph(round) {
    // Graph and stats should match rules-adjusted scores (for SkyJo doubles, etc.).
    if (state.presetKey === "skyjo") {
      return adjustSkyjoRoundScores(state.players, round);
    }
    const out = {};
    for (const p of state.players) {
      const raw = Number(round?.scores?.[p.id] ?? 0);
      out[p.id] = Number.isFinite(raw) ? raw : 0;
    }
    return out;
  }

  function buildGraphSeries() {
    if (!state.rounds.length || !state.players.length) return [];

    if (isPhase10()) {
      const completionTotals = Object.fromEntries(
        state.players.map((p) => [p.id, 0]),
      );
      return state.players.map((player, idx) => {
        const values = [];
        for (const round of state.rounds) {
          const completedMap = phase10CompletionMap(state.players, round);
          if (completedMap[player.id]) completionTotals[player.id] += 1;
          values.push(completionTotals[player.id]);
        }
        return {
          id: player.id,
          label: player.name || `Player ${idx + 1}`,
          color: GRAPH_LINE_COLORS[idx % GRAPH_LINE_COLORS.length],
          values,
        };
      });
    }

    if (state.teams?.length) {
      // Team graphs are cumulative sums of member round scores.
      const totalsByTeam = Object.fromEntries(state.teams.map((t) => [t.id, 0]));
      return state.teams.map((team, idx) => {
        const values = [];
        for (const round of state.rounds) {
          const adjusted = adjustedRoundScoresForGraph(round);
          const teamRoundTotal = team.members.reduce((sum, pid) => {
            return sum + Number(adjusted?.[pid] ?? 0);
          }, 0);
          totalsByTeam[team.id] += teamRoundTotal;
          values.push(totalsByTeam[team.id]);
        }
        return {
          id: team.id,
          label: team.name || `Team ${idx + 1}`,
          color: GRAPH_LINE_COLORS[idx % GRAPH_LINE_COLORS.length],
          values,
        };
      });
    }

    const totalsByPlayer = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    // Player graphs are cumulative per-round totals to highlight trajectory.
    return state.players.map((player, idx) => {
      const values = [];
      for (const round of state.rounds) {
        const adjusted = adjustedRoundScoresForGraph(round);
        totalsByPlayer[player.id] += Number(adjusted?.[player.id] ?? 0);
        values.push(totalsByPlayer[player.id]);
      }
      return {
        id: player.id,
        label: player.name || `Player ${idx + 1}`,
        color: GRAPH_LINE_COLORS[idx % GRAPH_LINE_COLORS.length],
        values,
      };
    });
  }

  function buildPhase10PointsSeries() {
    if (!state.rounds.length || !state.players.length || !isPhase10()) return [];
    const totalsByPlayer = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    return state.players.map((player, idx) => {
      const values = [];
      for (const round of state.rounds) {
        const adjusted = adjustedRoundScoresForGraph(round);
        totalsByPlayer[player.id] += Number(adjusted?.[player.id] ?? 0);
        values.push(totalsByPlayer[player.id]);
      }
      return {
        id: player.id,
        label: player.name || `Player ${idx + 1}`,
        color: GRAPH_LINE_COLORS[idx % GRAPH_LINE_COLORS.length],
        values,
      };
    });
  }

  function clearGraphPanel(panelEl, graphEl, legendEl, metaEl) {
    if (graphEl) graphEl.innerHTML = "";
    if (legendEl) legendEl.innerHTML = "";
    if (metaEl) metaEl.textContent = "";
    if (panelEl) panelEl.hidden = true;
  }

  function graphBounds(mode, allValues) {
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const span = Math.max(1, rawMax - rawMin);

    if (mode === "phase-progress") {
      return {
        yMin: 0,
        yMax: Math.max(1, state.target || 10, rawMax),
      };
    }

    let yMin = rawMin - Math.max(1, Math.round(span * 0.1));
    let yMax = rawMax + Math.max(1, Math.round(span * 0.1));
    if (yMin > 0) yMin = 0;
    if (yMax === yMin) yMax = yMin + 1;
    return { yMin, yMax };
  }

  function renderGraphPanel({
    panelEl,
    graphEl,
    titleEl,
    metaEl,
    legendEl,
    title,
    metaText,
    ariaLabel,
    series,
    mode = "cumulative-points",
  }) {
    if (!graphEl || !titleEl || !metaEl || !legendEl) return false;

    graphEl.innerHTML = "";
    legendEl.innerHTML = "";
    titleEl.textContent = title;
    metaEl.textContent = "";
    if (panelEl) panelEl.hidden = true;

    const normalizedSeries = series.filter(
      (entry) => Array.isArray(entry.values) && entry.values.length,
    );
    if (!normalizedSeries.length) return false;

    const allValues = normalizedSeries.flatMap((entry) =>
      entry.values.filter((value) => Number.isFinite(value)),
    );
    if (!allValues.length) return false;

    const roundsCount = state.rounds.length;
    const width = Math.max(860, 220 + roundsCount * 64);
    const height = 320;
    const padLeft = 56;
    const padRight = 16;
    const padTop = 14;
    const padBottom = 42;
    const innerW = Math.max(1, width - padLeft - padRight);
    const innerH = Math.max(1, height - padTop - padBottom);
    const { yMin, yMax } = graphBounds(mode, allValues);

    const xFor = (idx) => {
      if (roundsCount <= 1) return padLeft + innerW / 2;
      return padLeft + (innerW * idx) / (roundsCount - 1);
    };
    const yFor = (value) => {
      const t = (value - yMin) / (yMax - yMin);
      return padTop + innerH - t * innerH;
    };

    graphEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    graphEl.setAttribute("aria-label", ariaLabel);

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i += 1) {
      const ratio = i / yTicks;
      const y = padTop + innerH - ratio * innerH;
      const value = Math.round(yMin + ratio * (yMax - yMin));

      const grid = createSvgNode("line", {
        x1: padLeft,
        y1: y,
        x2: padLeft + innerW,
        y2: y,
        class: "history-graph-grid",
      });
      graphEl.appendChild(grid);

      const label = createSvgNode("text", {
        x: padLeft - 8,
        y: y + 4,
        "text-anchor": "end",
        class: "history-graph-label",
      });
      label.textContent = String(value);
      graphEl.appendChild(label);
    }

    const xAxis = createSvgNode("line", {
      x1: padLeft,
      y1: padTop + innerH,
      x2: padLeft + innerW,
      y2: padTop + innerH,
      class: "history-graph-axis",
    });
    graphEl.appendChild(xAxis);

    const yAxis = createSvgNode("line", {
      x1: padLeft,
      y1: padTop,
      x2: padLeft,
      y2: padTop + innerH,
      class: "history-graph-axis",
    });
    graphEl.appendChild(yAxis);

    const xLabelStep = Math.max(1, Math.ceil(roundsCount / 8));
    for (let i = 0; i < roundsCount; i += 1) {
      const isEdge = i === 0 || i === roundsCount - 1;
      if (!isEdge && i % xLabelStep !== 0) continue;
      const x = xFor(i);
      const label = createSvgNode("text", {
        x,
        y: padTop + innerH + 18,
        "text-anchor": "middle",
        class: "history-graph-label",
      });
      label.textContent = String(i + 1);
      graphEl.appendChild(label);
    }

    for (const entry of normalizedSeries) {
      const points = entry.values.map((value, idx) => [xFor(idx), yFor(value)]);
      const d = points
        .map(([x, y], idx) =>
          `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
        )
        .join(" ");

      const path = createSvgNode("path", {
        d,
        class: "history-graph-line",
        stroke: entry.color,
      });
      graphEl.appendChild(path);

      for (const [x, y] of points) {
        const point = createSvgNode("circle", {
          cx: x.toFixed(2),
          cy: y.toFixed(2),
          r: 3,
          class: "history-graph-point",
          fill: entry.color,
        });
        graphEl.appendChild(point);
      }

      const legendItem = document.createElement("span");
      legendItem.className = "history-graph-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "history-graph-legend-swatch";
      swatch.style.background = entry.color;
      swatch.style.borderColor = entry.color;
      legendItem.appendChild(swatch);
      legendItem.append(document.createTextNode(entry.label));
      legendEl.appendChild(legendItem);
    }

    metaEl.textContent = metaText;
    if (panelEl) panelEl.hidden = false;
    return true;
  }

  function renderHistoryGraph() {
    if (
      !els.historyGraphWrap ||
      !els.historyGraph ||
      !els.historyGraphTitle ||
      !els.historyGraphLegend ||
      !els.historyGraphMeta ||
      !els.historyStatsTable
    ) {
      return;
    }

    clearGraphPanel(
      els.historyPrimaryGraphPanel,
      els.historyGraph,
      els.historyGraphLegend,
      els.historyGraphMeta,
    );
    clearGraphPanel(
      els.historyPointsGraphPanel,
      els.historyPointsGraph,
      els.historyPointsGraphLegend,
      els.historyPointsGraphMeta,
    );
    if (els.historyInsights) {
      els.historyInsights.innerHTML = "";
      els.historyInsights.hidden = true;
    }
    els.historyStatsTable.innerHTML = "";

    if (!state.rounds.length || !state.players.length) {
      els.historyGraphWrap.hidden = true;
      return;
    }

    const primarySeries = buildGraphSeries();
    const primaryRendered = renderGraphPanel({
      panelEl: els.historyPrimaryGraphPanel,
      graphEl: els.historyGraph,
      titleEl: els.historyGraphTitle,
      metaEl: els.historyGraphMeta,
      legendEl: els.historyGraphLegend,
      title: isPhase10() ? "Phase Progress" : "Points Trend",
      metaText: isPhase10()
        ? "X: rounds  Y: cumulative phases completed"
        : `X: rounds  Y: cumulative points (${state.teams ? "teams" : "players"})`,
      ariaLabel: isPhase10()
        ? `Round phase progress graph with ${state.rounds.length} rounds and ${primarySeries.length} players.`
        : `Round points trend graph with ${state.rounds.length} rounds and ${primarySeries.length} ${state.teams ? "teams" : "players"}.`,
      series: primarySeries,
      mode: isPhase10() ? "phase-progress" : "cumulative-points",
    });
    if (!primaryRendered) {
      els.historyGraphWrap.hidden = true;
      return;
    }

    if (isPhase10()) {
      renderGraphPanel({
        panelEl: els.historyPointsGraphPanel,
        graphEl: els.historyPointsGraph,
        titleEl: els.historyPointsGraphTitle,
        metaEl: els.historyPointsGraphMeta,
        legendEl: els.historyPointsGraphLegend,
        title: "Points Trend",
        metaText: "X: rounds  Y: cumulative points (players)",
        ariaLabel: `Round points trend graph with ${state.rounds.length} rounds and ${state.players.length} players.`,
        series: buildPhase10PointsSeries(),
        mode: "cumulative-points",
      });
    }

    const analysis = isPhase10()
      ? analyzePhase10History(primarySeries)
      : analyzeHistory(primarySeries);
    renderHistoryInsights(analysis);
    renderHistoryStatsTable(primarySeries, analysis);
    els.historyGraphWrap.hidden = false;
  }

  function formatStatValue(n) {
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n));
  }

  function formatPoints(n) {
    const value = Math.abs(Math.round(Number(n) || 0));
    return `${value} ${value === 1 ? "pt" : "pts"}`;
  }

  function formatEntityList(ids, labelById) {
    const labels = ids
      .map((id) => labelById.get(id))
      .filter((label) => typeof label === "string" && label.trim());
    if (!labels.length) return "No one";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    return `${Math.round(value * 100)}%`;
  }

  function phase10Target() {
    return Math.max(1, Number(state.target) || 10);
  }

  function phase10CurrentPhaseFromCompleted(totalCompleted) {
    const completed = Math.max(0, Math.round(Number(totalCompleted) || 0));
    const target = phase10Target();
    if (completed >= target) return target;
    return Math.max(1, Math.min(target, completed + 1));
  }

  function phase10ProgressLabel(totalCompleted) {
    const completed = Math.max(0, Math.round(Number(totalCompleted) || 0));
    if (completed >= phase10Target()) return "Completed";
    return `Phase ${phase10CurrentPhaseFromCompleted(completed)}`;
  }

  function bestValueForWinMode(values) {
    if (!values.length) return 0;
    return state.winMode === "low" ? Math.min(...values) : Math.max(...values);
  }

  function rankEntries(entries) {
    return [...entries].sort((a, b) => {
      const diff =
        state.winMode === "low" ? a.value - b.value : b.value - a.value;
      if (diff !== 0) return diff;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }

  function pickBestIds(entries) {
    const numeric = entries.filter((entry) => Number.isFinite(entry.value));
    if (!numeric.length) return { bestValue: 0, ids: [] };
    const bestValue = bestValueForWinMode(numeric.map((entry) => entry.value));
    return {
      bestValue,
      ids: numeric
        .filter((entry) => entry.value === bestValue)
        .map((entry) => entry.id),
    };
  }

  function roundScoresByEntity() {
    // Stats rows use round deltas (not cumulative totals), grouped by entity type.
    const rounds = state.rounds.map((round) => adjustedRoundScoresForGraph(round));
    if (state.teams?.length) {
      return state.teams.map((team) => ({
        id: team.id,
        label: team.name || "Team",
        rounds: rounds.map((scores) =>
          team.members.reduce((sum, pid) => sum + Number(scores?.[pid] ?? 0), 0),
        ),
      }));
    }
    return state.players.map((player) => ({
      id: player.id,
      label: player.name || "Player",
      rounds: rounds.map((scores) => Number(scores?.[player.id] ?? 0)),
    }));
  }

  function phase10CompletionRows() {
    return state.players.map((player) => ({
      id: player.id,
      label: player.name || "Player",
      rounds: state.rounds.map((round) =>
        phase10CompletionMap(state.players, round)[player.id] ? 1 : 0,
      ),
    }));
  }

  function analyzePhase10History(series) {
    const rows = phase10CompletionRows();
    if (!rows.length || !state.rounds.length) return null;

    const labelById = new Map(rows.map((row) => [row.id, row.label]));
    const seriesById = new Map(series.map((entry) => [entry.id, entry]));
    const completionCounts = Object.fromEntries(rows.map((row) => [row.id, 0]));
    const bestStreaks = Object.fromEntries(rows.map((row) => [row.id, 0]));
    const currentStreaks = Object.fromEntries(rows.map((row) => [row.id, 0]));
    let leadChanges = 0;
    let lastUniqueLeaderId = null;

    for (let idx = 0; idx < state.rounds.length; idx += 1) {
      for (const row of rows) {
        const completedThisRound = Number(row.rounds[idx] ?? 0) > 0 ? 1 : 0;
        if (completedThisRound) {
          completionCounts[row.id] += 1;
          currentStreaks[row.id] += 1;
          bestStreaks[row.id] = Math.max(
            bestStreaks[row.id],
            currentStreaks[row.id],
          );
        } else {
          currentStreaks[row.id] = 0;
        }
      }

      const cumulativeEntries = rows.map((row) => ({
        id: row.id,
        label: row.label,
        value: Number(seriesById.get(row.id)?.values?.[idx] ?? 0),
      }));
      const leaderState = pickBestIds(cumulativeEntries);
      if (leaderState.ids.length === 1) {
        const leaderId = leaderState.ids[0];
        if (lastUniqueLeaderId && lastUniqueLeaderId !== leaderId) leadChanges += 1;
        lastUniqueLeaderId = leaderId;
      }
    }

    const completionEntries = rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: completionCounts[row.id] ?? 0,
    }));
    const topCompletion = pickBestIds(completionEntries);
    const topCompletionCount = Number(topCompletion.bestValue ?? 0);

    const rateEntries = rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: state.rounds.length
        ? (completionCounts[row.id] ?? 0) / state.rounds.length
        : 0,
    }));
    const topRate = pickBestIds(rateEntries);
    const topRateValue = Number(topRate.bestValue ?? 0);

    const phaseEntries = rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: phase10CurrentPhaseFromCompleted(completionCounts[row.id] ?? 0),
    }));
    const furthestPhase = pickBestIds(phaseEntries);
    const furthestPhaseValue = Number(furthestPhase.bestValue ?? 1);

    const streakEntries = rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: bestStreaks[row.id] ?? 0,
    }));
    const topStreak = pickBestIds(streakEntries);
    const topStreakValue = Number(topStreak.bestValue ?? 0);

    const roundsLabel = `${state.rounds.length} ${state.rounds.length === 1 ? "round" : "rounds"}`;
    let headline = `Phase progress builds after ${roundsLabel}.`;
    if (furthestPhase.ids.length === 1) {
      const leaderId = furthestPhase.ids[0];
      headline = `${labelById.get(leaderId) || "Leader"} is furthest ahead at ${phase10ProgressLabel(
        completionCounts[leaderId] ?? 0,
      )} after ${roundsLabel}.`;
    } else if (furthestPhase.ids.length > 1) {
      headline = `${formatEntityList(
        furthestPhase.ids,
        labelById,
      )} are tied on ${phase10ProgressLabel(topCompletionCount)} after ${roundsLabel}.`;
    }
    const leadChangeText = leadChanges
      ? `There ${leadChanges === 1 ? "has" : "have"} been ${leadChanges} lead ${
          leadChanges === 1 ? "change" : "changes"
        }.`
      : "No lead changes yet.";
    const completionText =
      topCompletionCount > 0
        ? `${formatEntityList(topCompletion.ids, labelById)} ${
            topCompletion.ids.length === 1 ? "has" : "have"
          } completed the most rounds (${topCompletionCount}).`
        : "No phases have been completed yet.";

    return {
      rows,
      seriesById,
      labelById,
      completionCounts,
      bestStreaks,
      leadChanges,
      furthestPhaseIds: furthestPhase.ids,
      furthestPhaseValue,
      topCompletionIds: topCompletion.ids,
      topCompletionCount,
      topRateIds: topRate.ids,
      topRateValue,
      topStreakIds: topStreak.ids,
      topStreakValue,
      story: `${headline} ${leadChangeText} ${completionText}`,
    };
  }

  function analyzeHistory(series) {
    const rows = roundScoresByEntity();
    if (!rows.length || !state.rounds.length) return null;

    const labelById = new Map(rows.map((row) => [row.id, row.label]));
    const seriesById = new Map(series.map((entry) => [entry.id, entry]));
    const roundWins = Object.fromEntries(rows.map((row) => [row.id, 0]));
    const bestStreaks = Object.fromEntries(rows.map((row) => [row.id, 0]));
    const currentStreaks = Object.fromEntries(rows.map((row) => [row.id, 0]));
    let leadChanges = 0;
    let lastUniqueLeaderId = null;
    let biggestSwing = null;

    // Walk each round once to build the summary metrics that power both the
    // "game story" text and the per-player stats table below it.
    for (let idx = 0; idx < state.rounds.length; idx += 1) {
      const roundEntries = rows.map((row) => ({
        id: row.id,
        label: row.label,
        value: Number(row.rounds[idx] ?? 0),
      }));
      const numericRoundEntries = roundEntries.filter((entry) =>
        Number.isFinite(entry.value),
      );
      const spreadValues = numericRoundEntries.map((entry) => entry.value);
      const roundSpread = spreadValues.length
        ? Math.max(...spreadValues) - Math.min(...spreadValues)
        : 0;
      const bestRound = pickBestIds(numericRoundEntries);

      if (!biggestSwing || roundSpread > biggestSwing.spread) {
        biggestSwing = {
          roundN: idx + 1,
          spread: roundSpread,
          winnerIds: bestRound.ids,
        };
      }

      if (bestRound.ids.length === 1) {
        const winnerId = bestRound.ids[0];
        for (const row of rows) {
          currentStreaks[row.id] = row.id === winnerId ? currentStreaks[row.id] + 1 : 0;
          if (row.id === winnerId) {
            roundWins[row.id] += 1;
            bestStreaks[row.id] = Math.max(bestStreaks[row.id], currentStreaks[row.id]);
          }
        }
      } else {
        for (const row of rows) currentStreaks[row.id] = 0;
      }

      const cumulativeEntries = rows.map((row) => ({
        id: row.id,
        label: row.label,
        value: Number(seriesById.get(row.id)?.values?.[idx] ?? 0),
      }));
      const leaderState = pickBestIds(cumulativeEntries);
      if (leaderState.ids.length === 1) {
        const leaderId = leaderState.ids[0];
        if (lastUniqueLeaderId && lastUniqueLeaderId !== leaderId) leadChanges += 1;
        lastUniqueLeaderId = leaderId;
      }
    }

    const standings = rankEntries(
      rows.map((row) => ({
        id: row.id,
        label: row.label,
        value: Number(
          seriesById.get(row.id)?.values?.at(-1) ??
            row.rounds.reduce((sum, score) => sum + score, 0),
        ),
      })),
    );
    const leaderIds = pickBestIds(standings).ids;
    const leaderId = leaderIds.length === 1 ? leaderIds[0] : null;
    const runnerUp = standings[1] ?? null;
    const leadMargin =
      leaderId && runnerUp
        ? Math.abs(Number(standings[0]?.value ?? 0) - runnerUp.value)
        : null;

    const roundWinValues = Object.values(roundWins);
    const topRoundWinCount = roundWinValues.length ? Math.max(...roundWinValues) : 0;
    const topRoundWinIds =
      topRoundWinCount > 0
        ? rows.filter((row) => roundWins[row.id] === topRoundWinCount).map((row) => row.id)
        : [];

    const streakValues = Object.values(bestStreaks);
    const topStreakValue = streakValues.length ? Math.max(...streakValues) : 0;
    const topStreakIds =
      topStreakValue > 0
        ? rows.filter((row) => bestStreaks[row.id] === topStreakValue).map((row) => row.id)
        : [];

    // Turn the numeric summary into a short natural-language recap so the
    // history panel explains what happened instead of only showing raw stats.
    const roundsLabel = `${state.rounds.length} ${state.rounds.length === 1 ? "round" : "rounds"}`;
    let headline = `Game story builds after ${roundsLabel}.`;
    if (leaderId) {
      const leaderLabel = labelById.get(leaderId) || "Leader";
      const marginText = leadMargin === null ? "" : ` by ${formatPoints(leadMargin)}`;
      if (state.gameState === "free_play") {
        headline = `${leaderLabel} leads${marginText} after ${roundsLabel} of free play.`;
      } else if (state.mode === "finished" && state.finalWinnerAt) {
        if (state.finalWinnerAt.roundN < state.rounds.length) {
          headline = `${leaderLabel} first hit the target in Round ${state.finalWinnerAt.roundN} and finished${marginText} ahead after ${roundsLabel}.`;
        } else {
          headline = `${leaderLabel} won${marginText} in Round ${state.finalWinnerAt.roundN}.`;
        }
      } else {
        headline = `${leaderLabel} leads${marginText} after ${roundsLabel}.`;
      }
    } else {
      headline = `The top spot is tied after ${roundsLabel}.`;
    }

    const leadChangeText = leadChanges
      ? `There ${leadChanges === 1 ? "has" : "have"} been ${leadChanges} lead ${
          leadChanges === 1 ? "change" : "changes"
        }.`
      : "No lead changes yet.";
    const roundWinText =
      topRoundWinCount > 0
        ? `${formatEntityList(topRoundWinIds, labelById)} ${
            topRoundWinIds.length === 1 ? "has" : "have"
          } the most round wins (${topRoundWinCount}).`
        : null;

    return {
      rows,
      seriesById,
      labelById,
      roundWins,
      bestStreaks,
      leadChanges,
      biggestSwing,
      leaderId,
      runnerUp,
      leadMargin,
      topRoundWinIds,
      topRoundWinCount,
      topStreakIds,
      topStreakValue,
      story: roundWinText ? `${headline} ${leadChangeText} ${roundWinText}` : `${headline} ${leadChangeText}`,
    };
  }

  function renderHistoryInsights(analysis) {
    if (!els.historyInsights) return;
    els.historyInsights.innerHTML = "";
    els.historyInsights.hidden = true;
    if (!analysis) return;

    if (isPhase10()) {
      const story = document.createElement("p");
      story.className = "history-story";
      story.textContent = analysis.story;
      els.historyInsights.appendChild(story);

      const cards = document.createElement("div");
      cards.className = "history-insights-grid";
      const cardsData = [
        {
          label: "Furthest Phase",
          value:
            analysis.furthestPhaseIds?.length > 0
              ? `${formatEntityList(analysis.furthestPhaseIds, analysis.labelById)} · ${phase10ProgressLabel(
                  analysis.topCompletionCount,
                )}`
              : "No leader yet",
          meta: `Target is ${phase10Target()} phases`,
        },
        {
          label: "Most Completed",
          value:
            analysis.topCompletionCount > 0
              ? `${formatEntityList(analysis.topCompletionIds, analysis.labelById)} · ${analysis.topCompletionCount}`
              : "None yet",
          meta: "Rounds with a completed phase",
        },
        {
          label: "Best Rate",
          value:
            analysis.topRateIds?.length > 0
              ? `${formatEntityList(analysis.topRateIds, analysis.labelById)} · ${formatPercent(analysis.topRateValue)}`
              : "0%",
          meta: "Completed rounds divided by total rounds",
        },
        {
          label: "Best Streak",
          value:
            analysis.topStreakValue > 0
              ? `${formatEntityList(analysis.topStreakIds, analysis.labelById)} · ${analysis.topStreakValue}`
              : "None yet",
          meta: "Consecutive completed rounds",
        },
        {
          label: "Leader Changes",
          value: String(analysis.leadChanges ?? 0),
          meta: "Changes in the cumulative phase leader",
        },
      ];

      for (const cardData of cardsData) {
        const card = document.createElement("article");
        card.className = "history-insight-card";

        const label = document.createElement("span");
        label.className = "history-insight-label";
        label.textContent = cardData.label;
        card.appendChild(label);

        const value = document.createElement("strong");
        value.className = "history-insight-value";
        value.textContent = cardData.value;
        card.appendChild(value);

        const meta = document.createElement("span");
        meta.className = "history-insight-meta";
        meta.textContent = cardData.meta;
        card.appendChild(meta);

        cards.appendChild(card);
      }

      els.historyInsights.appendChild(cards);
      els.historyInsights.hidden = false;
      return;
    }

    const story = document.createElement("p");
    story.className = "history-story";
    story.textContent = analysis.story;
    els.historyInsights.appendChild(story);

    const cards = document.createElement("div");
    cards.className = "history-insights-grid";

    // Keep these cards declarative so the UI copy can be adjusted without
    // touching the DOM construction loop below.
    const cardsData = [
      {
        label: "Leader Changes",
        value: String(analysis.leadChanges),
        meta: analysis.leadChanges
          ? "Unique leaders at the top of the game"
          : "The lead has stayed with one side so far",
      },
      {
        label:
          state.mode === "finished" && state.gameState !== "free_play"
            ? "Winning Margin"
            : "Current Margin",
        value:
          analysis.leaderId && analysis.leadMargin !== null
            ? formatPoints(analysis.leadMargin)
            : "Tie",
        meta:
          analysis.leaderId && analysis.runnerUp
            ? `${analysis.labelById.get(analysis.leaderId) || "Leader"} over ${analysis.runnerUp.label}`
            : "Top spot is level",
      },
      {
        label: "Most Round Wins",
        value:
          analysis.topRoundWinCount > 0
            ? `${formatEntityList(analysis.topRoundWinIds, analysis.labelById)} · ${analysis.topRoundWinCount}`
            : "None yet",
        meta: "Rounds won outright",
      },
      {
        label: "Biggest Swing",
        value:
          analysis.biggestSwing && analysis.biggestSwing.spread > 0
            ? formatPoints(analysis.biggestSwing.spread)
            : "Even",
        meta:
          analysis.biggestSwing && analysis.biggestSwing.spread > 0
            ? `${formatEntityList(analysis.biggestSwing.winnerIds, analysis.labelById)} in Round ${analysis.biggestSwing.roundN}`
            : "No standout round spread yet",
      },
      {
        label: "Best Streak",
        value:
          analysis.topStreakValue > 0
            ? `${formatEntityList(analysis.topStreakIds, analysis.labelById)} · ${analysis.topStreakValue}`
            : "None yet",
        meta: "Consecutive round wins",
      },
    ];

    for (const cardData of cardsData) {
      const card = document.createElement("article");
      card.className = "history-insight-card";

      const label = document.createElement("span");
      label.className = "history-insight-label";
      label.textContent = cardData.label;
      card.appendChild(label);

      const value = document.createElement("strong");
      value.className = "history-insight-value";
      value.textContent = cardData.value;
      card.appendChild(value);

      const meta = document.createElement("span");
      meta.className = "history-insight-meta";
      meta.textContent = cardData.meta;
      card.appendChild(meta);

      cards.appendChild(card);
    }

    els.historyInsights.appendChild(cards);
    els.historyInsights.hidden = false;
  }

  function renderHistoryStatsTable(series, analysis = analyzeHistory(series)) {
    const rows = analysis?.rows || roundScoresByEntity();
    const tbl = els.historyStatsTable;
    tbl.innerHTML = "";
    if (!rows.length || !state.rounds.length) return;

    if (isPhase10()) {
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      const headers = [
        "Player",
        "Completed",
        "Missed",
        "Rate",
        "Current Phase",
        "Best Streak",
        "Last Round",
      ];
      for (const header of headers) {
        const th = document.createElement("th");
        th.textContent = header;
        th.scope = "col";
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      tbl.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of rows) {
        const tr = document.createElement("tr");
        const nameTd = document.createElement("td");
        nameTd.textContent = row.label;
        tr.appendChild(nameTd);

        const roundValues = row.rounds.filter((v) => Number.isFinite(v));
        const completed = Math.max(
          0,
          Math.round(Number(analysis?.completionCounts?.[row.id] ?? 0)),
        );
        const missed = Math.max(0, state.rounds.length - completed);
        const rate = state.rounds.length ? completed / state.rounds.length : 0;
        const currentPhase = phase10ProgressLabel(completed);
        const bestStreak = Math.max(
          0,
          Math.round(Number(analysis?.bestStreaks?.[row.id] ?? 0)),
        );
        const lastRound =
          roundValues.length && Number(roundValues.at(-1)) > 0 ? "Yes" : "No";
        const values = [
          String(completed),
          String(missed),
          formatPercent(rate),
          currentPhase,
          String(bestStreak),
          lastRound,
        ];
        for (const value of values) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.appendChild(td);
        }

        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      return;
    }

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const headers = [
      state.teams?.length ? "Team" : "Player",
      "Total",
      "Avg",
      "Round Wins",
      "Best",
      "Worst",
      "Best Streak",
    ];
    for (const header of headers) {
      const th = document.createElement("th");
      th.textContent = header;
      th.scope = "col";
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const seriesById = analysis?.seriesById || new Map(series.map((s) => [s.id, s]));
    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = row.label;
      tr.appendChild(nameTd);

      const roundValues = row.rounds.filter((v) => Number.isFinite(v));
      const totalFromSeries = Number(seriesById.get(row.id)?.values?.at(-1) ?? 0);
      const total = Number.isFinite(totalFromSeries)
        ? totalFromSeries
        : roundValues.reduce((sum, v) => sum + v, 0);
      const avg = roundValues.length ? total / roundValues.length : 0;
      const minRound = roundValues.length ? Math.min(...roundValues) : 0;
      const maxRound = roundValues.length ? Math.max(...roundValues) : 0;
      const best = state.winMode === "low" ? minRound : maxRound;
      const worst = state.winMode === "low" ? maxRound : minRound;

      const totalTd = document.createElement("td");
      totalTd.textContent = formatStatValue(total);
      tr.appendChild(totalTd);

      const avgTd = document.createElement("td");
      avgTd.textContent = formatStatValue(avg);
      tr.appendChild(avgTd);

      const roundWinsTd = document.createElement("td");
      roundWinsTd.textContent = formatStatValue(analysis?.roundWins?.[row.id] ?? 0);
      tr.appendChild(roundWinsTd);

      const bestTd = document.createElement("td");
      bestTd.textContent = formatStatValue(best);
      tr.appendChild(bestTd);

      const worstTd = document.createElement("td");
      worstTd.textContent = formatStatValue(worst);
      tr.appendChild(worstTd);

      const streakTd = document.createElement("td");
      streakTd.textContent = formatStatValue(analysis?.bestStreaks?.[row.id] ?? 0);
      tr.appendChild(streakTd);

      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
  }

  function beginHistoryEdit(roundN) {
    if (!Number.isInteger(roundN) || roundN < 1) return;
    state.historyEditingRoundN = roundN;
    renderHistoryTable();
  }

  function cancelHistoryEdit() {
    if (state.historyEditingRoundN === null) return;
    state.historyEditingRoundN = null;
    renderHistoryTable();
    showMsg(els.roundMsg, "");
    setLive("History edit canceled.");
  }

  function findHistoryEditInput(roundN, playerId) {
    const selector =
      `[data-history-edit-round="${roundN}"]` +
      `[data-history-edit-score="${playerId}"]`;
    return (
      els.historyTable.querySelector(selector) ||
      els.historyCards?.querySelector(selector) ||
      null
    );
  }

  function readHistoryEditScores(roundN) {
    const scores = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    for (const p of state.players) {
      const inp = findHistoryEditInput(roundN, p.id);
      if (!inp) return null;

      const raw = String(inp.value ?? "").trim();
      const n = raw === "" ? 0 : Number.parseInt(raw, 10);
      if (Number.isNaN(n)) return null;
      scores[p.id] = n;
    }
    return scores;
  }

  function readHistoryEditPhase10Completions(roundN) {
    const completions = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    for (const p of state.players) {
      const selector =
        `[data-history-edit-round="${roundN}"]` +
        `[data-history-edit-phase10="${p.id}"]`;
      const inp =
        els.historyTable.querySelector(selector) ||
        els.historyCards?.querySelector(selector) ||
        null;
      if (!inp) return null;
      completions[p.id] = Number(inp.value ?? 0) > 0 ? 1 : 0;
    }
    return completions;
  }

  function saveHistoryEdit(roundN) {
    const idx = state.rounds.findIndex((r) => r.n === roundN);
    if (idx < 0) return;

    let scores = readHistoryEditScores(roundN);
    if (!scores) {
      showMsg(els.roundMsg, "Round scores must be whole numbers.");
      return;
    }
    if (state.presetKey === "hearts") {
      const normalized = normalizeHeartsShootMoonScores(state.players, scores);
      scores = normalized.scores;
    }
    const validation = validateRoundScores(scores, {
      contextLabel: `round ${roundN}`,
    });
    if (!validation.ok) {
      showMsg(els.roundMsg, validation.error || "Invalid scores.");
      return;
    }
    if (validation.warning) {
      const proceed = window.confirm(
        `${validation.warning} Save changes anyway?`,
      );
      if (!proceed) return;
    }

    state.rounds[idx].scores = scores;
    if (isPhase10()) {
      const completions = readHistoryEditPhase10Completions(roundN);
      if (!completions) {
        showMsg(els.roundMsg, "Phase 10 completion flags could not be read.");
        return;
      }
      state.rounds[idx].phase10CompletedByPlayerId = completions;
    }
    state.rounds[idx].ts = Date.now();
    showMsg(els.roundMsg, "");
    recalcAfterHistoryChange(`Round ${roundN} updated.`);
  }

  function deleteHistoryRound(roundN) {
    const idx = state.rounds.findIndex((r) => r.n === roundN);
    if (idx < 0) return;

    if (!window.confirm(`Delete round ${roundN}? This cannot be undone.`)) return;

    state.rounds.splice(idx, 1);
    showMsg(els.roundMsg, "");
    recalcAfterHistoryChange(`Round ${roundN} deleted.`);
  }

  function shouldUseHistoryCards() {
    if (!els.historyCards) return false;
    if (state.players.length < 4) return false;
    return window.matchMedia(
      `(max-width: ${HISTORY_CARD_BREAKPOINT}px)`,
    ).matches;
  }

  function buildHistoryRows(cols) {
    const phaseCompletionsById = isPhase10()
      ? Object.fromEntries(cols.map((pid) => [pid, 0]))
      : null;
    const rows = [];

    for (const r of state.rounds) {
      const adjustedScores =
        state.presetKey === "skyjo"
          ? adjustSkyjoRoundScores(state.players, r)
          : null;
      const phase10CompletedMap = isPhase10()
        ? phase10CompletionMap(state.players, r)
        : null;
      const rawScoresById = Object.fromEntries(
        cols.map((pid) => {
          const v = Number(r.scores?.[pid] ?? 0);
          return [pid, Number.isFinite(v) ? v : 0];
        }),
      );
      const phaseNumberById = {};
      if (isPhase10() && phaseCompletionsById) {
        for (const pid of cols) {
          if (phase10CompletedMap?.[pid]) {
            phaseNumberById[pid] = phaseCompletionsById[pid] + 1;
          }
        }
      }

      let heartsMoonShooterId = null;
      if (state.presetKey === "hearts" && cols.length) {
        const heartsTotal = cols.reduce((sum, pid) => sum + rawScoresById[pid], 0);
        const shootMoonTotal = 26 * Math.max(0, state.players.length - 1);
        if (heartsTotal === shootMoonTotal) {
          const minScore = Math.min(...cols.map((pid) => rawScoresById[pid]));
          const minPids = cols.filter((pid) => rawScoresById[pid] === minScore);
          if (minPids.length === 1) heartsMoonShooterId = minPids[0];
        }
      }

      const cells = cols.map((pid) => {
        const rawV = rawScoresById[pid];
        const displayV =
          state.presetKey === "skyjo"
            ? Number(adjustedScores?.[pid] ?? rawV)
            : rawV;
        const isSkyjo = state.presetKey === "skyjo";
        const isWentOutCell = isSkyjo && r.skyjoWentOutPlayerId === pid;
        const isDoubledCell =
          isSkyjo && Number.isFinite(rawV) && Number.isFinite(displayV)
            ? displayV > rawV
            : false;
        const isPhase10CompleteCell = !!(isPhase10() && phase10CompletedMap?.[pid]);
        const isHeartsMoonShooter = heartsMoonShooterId === pid;
        const isHeartsMoonRecipient =
          state.presetKey === "hearts" &&
          !!heartsMoonShooterId &&
          pid !== heartsMoonShooterId &&
          rawV > 0;
        return {
          pid,
          rawV,
          displayV,
          playerName: state.players.find((p) => p.id === pid)?.name ?? "Player",
          phaseN: Number(phaseNumberById[pid] ?? 0),
          isWentOutCell,
          isDoubledCell,
          isPhase10CompleteCell,
          isHeartsMoonShooter,
          isHeartsMoonRecipient,
        };
      });

      rows.push({
        roundN: r.n,
        editing: state.historyEditingRoundN === r.n,
        cells,
      });

      if (isPhase10() && phaseCompletionsById) {
        for (const pid of cols) {
          if (phase10CompletedMap?.[pid]) {
            phaseCompletionsById[pid] += 1;
          }
        }
      }
    }
    return rows;
  }

  function buildEditControl(roundN, cell) {
    let input;
    if (isPhase10()) {
      input = document.createElement("div");
      input.className = "history-edit-phase10";

      const pointsInput = document.createElement("input");
      pointsInput.type = "number";
      pointsInput.inputMode = "numeric";
      pointsInput.className = "history-edit-input";
      pointsInput.value = String(Number.isFinite(cell.rawV) ? cell.rawV : 0);
      pointsInput.setAttribute(
        "aria-label",
        `Round ${roundN} points for ${cell.playerName}`,
      );
      pointsInput.setAttribute("data-history-edit-round", String(roundN));
      pointsInput.setAttribute("data-history-edit-score", cell.pid);
      input.appendChild(pointsInput);

      const completionSelect = document.createElement("select");
      completionSelect.className = "history-edit-input history-edit-phase10-select";
      completionSelect.innerHTML = `
        <option value="0">No Phase</option>
        <option value="1">Phase +</option>
      `;
      completionSelect.value = cell.isPhase10CompleteCell ? "1" : "0";
      completionSelect.setAttribute(
        "aria-label",
        `Round ${roundN} phase completion for ${cell.playerName}`,
      );
      completionSelect.setAttribute("data-history-edit-round", String(roundN));
      completionSelect.setAttribute("data-history-edit-phase10", cell.pid);
      input.appendChild(completionSelect);
      return input;
    } else {
      input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.className = "history-edit-input";
      input.value = String(Number.isFinite(cell.rawV) ? cell.rawV : 0);
      input.setAttribute("aria-label", `Round ${roundN} score for ${cell.playerName}`);
    }
    input.setAttribute("data-history-edit-round", String(roundN));
    input.setAttribute("data-history-edit-score", cell.pid);
    return input;
  }

  function appendReadOnlyScore(parent, cell, classTarget) {
    if (cell.isWentOutCell) classTarget.classList.add("history-score-went-out");
    if (cell.isDoubledCell) classTarget.classList.add("history-score-doubled");
    if (cell.isPhase10CompleteCell)
      classTarget.classList.add("history-score-phase10-complete");
    if (cell.isHeartsMoonShooter)
      classTarget.classList.add("history-score-hearts-moon");
    if (cell.isHeartsMoonRecipient)
      classTarget.classList.add("history-score-hearts-moon-plus");

    if (isPhase10()) {
      const valueText = document.createElement("span");
      valueText.className = "history-score-value";
      valueText.textContent = String(Number.isFinite(cell.displayV) ? cell.displayV : 0);
      parent.appendChild(valueText);
    } else if (cell.isDoubledCell) {
      const shown = Number.isFinite(cell.displayV) ? cell.displayV : 0;
      const original = Number.isFinite(cell.rawV) ? cell.rawV : 0;
      const doubledInline = document.createElement("span");
      doubledInline.className = "history-doubled-inline";

      const originalText = document.createElement("span");
      originalText.className = "history-score-value";
      originalText.textContent = `(${original})`;
      doubledInline.appendChild(originalText);

      const doubledBadge = document.createElement("span");
      doubledBadge.className = "history-score-badge doubled";
      doubledBadge.textContent = "2x";
      doubledInline.appendChild(doubledBadge);

      const shownText = document.createElement("span");
      shownText.className = "history-score-value";
      shownText.textContent = String(shown);
      doubledInline.appendChild(shownText);
      parent.appendChild(doubledInline);
    } else {
      const valueText = document.createElement("span");
      valueText.className = "history-score-value";
      valueText.textContent = String(Number.isFinite(cell.displayV) ? cell.displayV : 0);
      parent.appendChild(valueText);
    }

    if (cell.isWentOutCell) {
      const outBadge = document.createElement("span");
      outBadge.className = "history-score-badge out";
      outBadge.textContent = "OUT";
      parent.appendChild(outBadge);
    }
    if (cell.isPhase10CompleteCell) {
      const phaseBadge = document.createElement("span");
      phaseBadge.className = "history-score-badge phase10";
      phaseBadge.textContent = `PH+ ${cell.phaseN > 0 ? cell.phaseN : ""}`.trim();
      parent.appendChild(phaseBadge);
    }
    if (cell.isHeartsMoonShooter) {
      const moonBadge = document.createElement("span");
      moonBadge.className = "history-score-badge hearts-moon";
      moonBadge.textContent = "🌙";
      parent.appendChild(moonBadge);
    }
    if (cell.isHeartsMoonRecipient) {
      const plusBadge = document.createElement("span");
      plusBadge.className = "history-score-badge hearts-plus";
      plusBadge.textContent = "+26";
      parent.appendChild(plusBadge);
    }
  }

  function renderHistoryTable() {
    const cols = state.players.map((p) => p.id);
    const tbl = els.historyTable;
    const cards = els.historyCards;
    const useCards = shouldUseHistoryCards();
    const rows = buildHistoryRows(cols);
    const orderedRows =
      state.historySortDir === "desc" ? [...rows].reverse() : rows;
    tbl.innerHTML = "";
    if (cards) cards.innerHTML = "";
    if (els.btnHistoryOrder) {
      els.btnHistoryOrder.textContent =
        state.historySortDir === "desc"
          ? "Order: Newest first"
          : "Order: Oldest first";
      els.btnHistoryOrder.disabled = rows.length <= 1;
    }

    tbl.hidden = useCards;
    if (cards) cards.hidden = !useCards;

    if (useCards && cards) {
      for (const row of orderedRows) {
        const card = document.createElement("article");
        card.className = "history-round-card";

        const head = document.createElement("div");
        head.className = "history-round-card-head";
        head.textContent = `Round ${row.roundN}`;
        card.appendChild(head);

        const body = document.createElement("div");
        body.className = "history-round-card-body";
        for (const cell of row.cells) {
          const line = document.createElement("div");
          line.className = "history-round-card-line";

          const name = document.createElement("span");
          name.className = "history-round-card-name";
          name.textContent = cell.playerName;
          line.appendChild(name);

          const value = document.createElement("span");
          value.className = "history-round-card-value";
          if (row.editing) {
            value.appendChild(buildEditControl(row.roundN, cell));
          } else {
            const score = document.createElement("span");
            score.className = "history-card-score";
            appendReadOnlyScore(score, cell, score);
            value.appendChild(score);
          }
          line.appendChild(value);
          body.appendChild(line);
        }
        card.appendChild(body);

        const actions = document.createElement("div");
        actions.className = "history-actions history-round-card-actions";
        if (row.editing) {
          actions.innerHTML = `
            <button type="button" class="history-action-btn" data-history-action="save" data-round-n="${row.roundN}" aria-label="Save round ${row.roundN} edits">Save</button>
            <button type="button" class="history-action-btn" data-history-action="cancel" data-round-n="${row.roundN}" aria-label="Cancel round ${row.roundN} edits">Cancel</button>
          `;
        } else {
          actions.innerHTML = `
            <button type="button" class="history-action-btn" data-history-action="edit" data-round-n="${row.roundN}" aria-label="Edit round ${row.roundN}">Edit</button>
            <button type="button" class="history-action-btn danger" data-history-action="delete" data-round-n="${row.roundN}" aria-label="Delete round ${row.roundN}">Delete</button>
          `;
        }
        card.appendChild(actions);
        cards.appendChild(card);
      }
    } else {
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      const th0 = document.createElement("th");
      th0.textContent = "Round";
      th0.scope = "col";
      trh.appendChild(th0);

      for (const pid of cols) {
        const th = document.createElement("th");
        th.textContent =
          state.players.find((p) => p.id === pid)?.name ?? "Player";
        th.scope = "col";
        trh.appendChild(th);
      }
      const thActions = document.createElement("th");
      thActions.textContent = "Actions";
      thActions.scope = "col";
      trh.appendChild(thActions);
      thead.appendChild(trh);
      tbl.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of orderedRows) {
        const tr = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = String(row.roundN);
        tr.appendChild(td0);

        for (const cell of row.cells) {
          const td = document.createElement("td");
          if (row.editing) {
            td.appendChild(buildEditControl(row.roundN, cell));
          } else {
            appendReadOnlyScore(td, cell, td);
          }
          tr.appendChild(td);
        }

        const tdActions = document.createElement("td");
        tdActions.className = "history-actions";
        if (row.editing) {
          tdActions.innerHTML = `
            <button type="button" class="history-action-btn" data-history-action="save" data-round-n="${row.roundN}" aria-label="Save round ${row.roundN} edits">Save</button>
            <button type="button" class="history-action-btn" data-history-action="cancel" data-round-n="${row.roundN}" aria-label="Cancel round ${row.roundN} edits">Cancel</button>
          `;
        } else {
          tdActions.innerHTML = `
            <button type="button" class="history-action-btn" data-history-action="edit" data-round-n="${row.roundN}" aria-label="Edit round ${row.roundN}">Edit</button>
            <button type="button" class="history-action-btn danger" data-history-action="delete" data-round-n="${row.roundN}" aria-label="Delete round ${row.roundN}">Delete</button>
          `;
        }
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
    }

    const baseSummary = state.rounds.length
      ? `Round History (${state.rounds.length})`
      : "Round History (0)";
    const winsCount = Array.isArray(state.winnerMilestones)
      ? state.winnerMilestones.length
      : 0;
    if (state.gameState === "free_play") {
      els.historySummaryText.textContent =
        winsCount > 0
          ? `${baseSummary} • Free Play • ${winsCount} target wins`
          : `${baseSummary} • Free Play`;
    } else if (winsCount > 0) {
      const last = state.winnerMilestones[winsCount - 1];
      els.historySummaryText.textContent = `${baseSummary} • ${winsCount} target wins • Last R${last.roundN}`;
    } else {
      els.historySummaryText.textContent = baseSummary;
    }
    renderHistoryGraph();
  }

  function bindEvents() {
    const onHistoryClick = (e) => {
      const btn = e.target.closest("[data-history-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-history-action");
      const roundN = Number.parseInt(btn.getAttribute("data-round-n"), 10);
      if (!Number.isInteger(roundN) || roundN < 1) return;

      if (action === "edit") beginHistoryEdit(roundN);
      if (action === "cancel") cancelHistoryEdit();
      if (action === "save") saveHistoryEdit(roundN);
      if (action === "delete") deleteHistoryRound(roundN);
    };
    els.historyTable.addEventListener("click", onHistoryClick);
    els.historyCards?.addEventListener("click", onHistoryClick);

    const onHistoryKeydown = (e) => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (
        !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      )
        return;
      const roundN = Number.parseInt(
        target.getAttribute("data-history-edit-round"),
        10,
      );
      if (!Number.isInteger(roundN) || roundN < 1) return;
      e.preventDefault();
      saveHistoryEdit(roundN);
    };
    els.historyTable.addEventListener("keydown", onHistoryKeydown);
    els.historyCards?.addEventListener("keydown", onHistoryKeydown);

    bindSelectOnFocusAndClick(els.historyTable, "input.history-edit-input");
    if (els.historyCards) {
      bindSelectOnFocusAndClick(els.historyCards, "input.history-edit-input");
    }

    window.addEventListener("resize", () => {
      renderHistoryTable();
    });
  }

  return {
    renderHistoryTable,
    bindEvents,
  };
}
