import { bindSelectOnFocusAndClick } from "./inputUx.js";
import { adjustSkyjoRoundScores } from "./rules.mjs";
import { normalizeHeartsShootMoonScores } from "./rules.mjs";

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

    const winner = determineWinnerFromTotals(entries);
    if (winner) {
      state.winnerId = winner;
      state.mode = "finished";
    } else {
      state.winnerId = null;
      state.mode = state.players.length ? "playing" : "setup";
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

    if (state.teams?.length) {
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

  function renderHistoryGraph() {
    if (
      !els.historyGraphWrap ||
      !els.historyGraph ||
      !els.historyGraphLegend ||
      !els.historyGraphMeta ||
      !els.historyStatsTable
    ) {
      return;
    }

    els.historyGraph.innerHTML = "";
    els.historyGraphLegend.innerHTML = "";
    els.historyStatsTable.innerHTML = "";

    if (isPhase10() || !state.rounds.length || !state.players.length) {
      els.historyGraphWrap.hidden = true;
      return;
    }

    const series = buildGraphSeries().filter(
      (entry) => Array.isArray(entry.values) && entry.values.length,
    );
    if (!series.length) {
      els.historyGraphWrap.hidden = true;
      return;
    }

    const allValues = series.flatMap((s) =>
      s.values.filter((v) => Number.isFinite(v)),
    );
    if (!allValues.length) {
      els.historyGraphWrap.hidden = true;
      return;
    }

    const roundsCount = state.rounds.length;
    const width = Math.max(860, 220 + roundsCount * 64);
    const height = 320;
    const padLeft = 56;
    const padRight = 16;
    const padTop = 14;
    const padBottom = 42;
    const innerW = Math.max(1, width - padLeft - padRight);
    const innerH = Math.max(1, height - padTop - padBottom);

    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const span = Math.max(1, rawMax - rawMin);
    let yMin = rawMin - Math.max(1, Math.round(span * 0.1));
    let yMax = rawMax + Math.max(1, Math.round(span * 0.1));
    if (yMin > 0) yMin = 0;
    if (yMax === yMin) yMax = yMin + 1;

    const xFor = (idx) => {
      if (roundsCount <= 1) return padLeft + innerW / 2;
      return padLeft + (innerW * idx) / (roundsCount - 1);
    };
    const yFor = (value) => {
      const t = (value - yMin) / (yMax - yMin);
      return padTop + innerH - t * innerH;
    };

    els.historyGraph.setAttribute("viewBox", `0 0 ${width} ${height}`);
    els.historyGraph.setAttribute(
      "aria-label",
      `Round points trend graph with ${roundsCount} rounds and ${series.length} ${state.teams ? "teams" : "players"}.`,
    );

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
      els.historyGraph.appendChild(grid);

      const label = createSvgNode("text", {
        x: padLeft - 8,
        y: y + 4,
        "text-anchor": "end",
        class: "history-graph-label",
      });
      label.textContent = String(value);
      els.historyGraph.appendChild(label);
    }

    const xAxis = createSvgNode("line", {
      x1: padLeft,
      y1: padTop + innerH,
      x2: padLeft + innerW,
      y2: padTop + innerH,
      class: "history-graph-axis",
    });
    els.historyGraph.appendChild(xAxis);

    const yAxis = createSvgNode("line", {
      x1: padLeft,
      y1: padTop,
      x2: padLeft,
      y2: padTop + innerH,
      class: "history-graph-axis",
    });
    els.historyGraph.appendChild(yAxis);

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
      els.historyGraph.appendChild(label);
    }

    for (const entry of series) {
      const points = entry.values.map((v, idx) => [xFor(idx), yFor(v)]);
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
      els.historyGraph.appendChild(path);

      for (const [x, y] of points) {
        const point = createSvgNode("circle", {
          cx: x.toFixed(2),
          cy: y.toFixed(2),
          r: 3,
          class: "history-graph-point",
          fill: entry.color,
        });
        els.historyGraph.appendChild(point);
      }

      const legendItem = document.createElement("span");
      legendItem.className = "history-graph-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "history-graph-legend-swatch";
      swatch.style.background = entry.color;
      legendItem.appendChild(swatch);
      legendItem.append(document.createTextNode(entry.label));
      els.historyGraphLegend.appendChild(legendItem);
    }

    els.historyGraphMeta.textContent = `X: rounds  Y: cumulative points (${state.teams ? "teams" : "players"})`;
    renderHistoryStatsTable(series);
    els.historyGraphWrap.hidden = false;
  }

  function formatStatValue(n) {
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n));
  }

  function roundScoresByEntity() {
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

  function renderHistoryStatsTable(series) {
    const rows = roundScoresByEntity();
    const tbl = els.historyStatsTable;
    tbl.innerHTML = "";
    if (!rows.length || !state.rounds.length) return;

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const headers = ["Player", "Total", "Avg", "Best", "Worst"];
    for (const header of headers) {
      const th = document.createElement("th");
      th.textContent = header;
      th.scope = "col";
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const seriesById = new Map(series.map((s) => [s.id, s]));
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

      const bestTd = document.createElement("td");
      bestTd.textContent = formatStatValue(best);
      tr.appendChild(bestTd);

      const worstTd = document.createElement("td");
      worstTd.textContent = formatStatValue(worst);
      tr.appendChild(worstTd);

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
      scores[p.id] = isPhase10() ? (n <= 0 ? 0 : 1) : n;
    }
    return scores;
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
      const rawScoresById = Object.fromEntries(
        cols.map((pid) => {
          const v = Number(r.scores?.[pid] ?? 0);
          return [pid, Number.isFinite(v) ? v : 0];
        }),
      );
      const phaseNumberById = {};
      if (isPhase10() && phaseCompletionsById) {
        for (const pid of cols) {
          if (rawScoresById[pid] > 0) {
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
        const isPhase10CompleteCell = isPhase10() && rawV > 0;
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
          if (rawScoresById[pid] > 0) {
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
      input = document.createElement("select");
      input.className = "history-edit-input";
      input.innerHTML = `
        <option value="0">No</option>
        <option value="1">Yes</option>
      `;
      input.value = String(cell.rawV <= 0 ? 0 : 1);
      input.setAttribute(
        "aria-label",
        `Round ${roundN} completion for ${cell.playerName}`,
      );
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

    const valueText = document.createElement("span");
    valueText.className = "history-score-value";
    if (isPhase10()) {
      valueText.textContent = cell.displayV > 0 ? "Yes" : "No";
    } else if (cell.isDoubledCell) {
      const shown = Number.isFinite(cell.displayV) ? cell.displayV : 0;
      const original = Number.isFinite(cell.rawV) ? cell.rawV : 0;
      valueText.textContent = `${shown} (${original})`;
    } else {
      valueText.textContent = String(Number.isFinite(cell.displayV) ? cell.displayV : 0);
    }
    parent.appendChild(valueText);

    if (cell.isWentOutCell) {
      const outBadge = document.createElement("span");
      outBadge.className = "history-score-badge out";
      outBadge.textContent = "OUT";
      parent.appendChild(outBadge);
    }
    if (cell.isDoubledCell) {
      const doubledBadge = document.createElement("span");
      doubledBadge.className = "history-score-badge doubled";
      doubledBadge.textContent = "2x";
      parent.appendChild(doubledBadge);
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
    tbl.innerHTML = "";
    if (cards) cards.innerHTML = "";

    tbl.hidden = useCards;
    if (cards) cards.hidden = !useCards;

    if (useCards && cards) {
      for (const row of rows) {
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
      for (const row of rows) {
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

    els.historySummaryText.textContent = state.rounds.length
      ? `Round History (${state.rounds.length})`
      : "Round History (0)";
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
