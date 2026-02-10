export function createHistoryController(deps) {
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

  function readHistoryEditScores(roundN) {
    const scores = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    for (const p of state.players) {
      const selector =
        `[data-history-edit-round="${roundN}"]` +
        `[data-history-edit-score="${p.id}"]`;
      const inp = els.historyTable.querySelector(selector);
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

    const scores = readHistoryEditScores(roundN);
    if (!scores) {
      showMsg(els.roundMsg, "Round scores must be whole numbers.");
      return;
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

  function renderHistoryTable() {
    const cols = state.players.map((p) => p.id);
    const tbl = els.historyTable;
    tbl.innerHTML = "";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const th0 = document.createElement("th");
    th0.textContent = "Round";
    trh.appendChild(th0);

    for (const pid of cols) {
      const th = document.createElement("th");
      th.textContent =
        state.players.find((p) => p.id === pid)?.name ?? "Player";
      trh.appendChild(th);
    }
    const thActions = document.createElement("th");
    thActions.textContent = "Actions";
    trh.appendChild(thActions);
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const r of state.rounds) {
      const editing = state.historyEditingRoundN === r.n;
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      td0.textContent = String(r.n);
      tr.appendChild(td0);

      for (const pid of cols) {
        const td = document.createElement("td");
        const v = Number(r.scores?.[pid] ?? 0);
        if (editing) {
          let input;
          if (isPhase10()) {
            input = document.createElement("select");
            input.className = "history-edit-input";
            input.innerHTML = `
              <option value="0">No</option>
              <option value="1">Yes</option>
            `;
            input.value = String(v <= 0 ? 0 : 1);
          } else {
            input = document.createElement("input");
            input.type = "number";
            input.inputMode = "numeric";
            input.className = "history-edit-input";
            input.value = String(Number.isFinite(v) ? v : 0);
          }
          input.setAttribute("data-history-edit-round", String(r.n));
          input.setAttribute("data-history-edit-score", pid);
          td.appendChild(input);
        } else {
          td.textContent = isPhase10()
            ? v > 0
              ? "Yes"
              : "No"
            : String(Number.isFinite(v) ? v : 0);
        }
        tr.appendChild(td);
      }

      const tdActions = document.createElement("td");
      tdActions.className = "history-actions";
      if (editing) {
        tdActions.innerHTML = `
          <button type="button" class="history-action-btn" data-history-action="save" data-round-n="${r.n}">Save</button>
          <button type="button" class="history-action-btn" data-history-action="cancel" data-round-n="${r.n}">Cancel</button>
        `;
      } else {
        tdActions.innerHTML = `
          <button type="button" class="history-action-btn" data-history-action="edit" data-round-n="${r.n}">Edit</button>
          <button type="button" class="history-action-btn danger" data-history-action="delete" data-round-n="${r.n}">Delete</button>
        `;
      }
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);

    els.historySummaryText.textContent = state.rounds.length
      ? `Round History (${state.rounds.length})`
      : "Round History (0)";
  }

  function bindEvents() {
    els.historyTable.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-history-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-history-action");
      const roundN = Number.parseInt(btn.getAttribute("data-round-n"), 10);
      if (!Number.isInteger(roundN) || roundN < 1) return;

      if (action === "edit") beginHistoryEdit(roundN);
      if (action === "cancel") cancelHistoryEdit();
      if (action === "save") saveHistoryEdit(roundN);
      if (action === "delete") deleteHistoryRound(roundN);
    });

    els.historyTable.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      const roundN = Number.parseInt(
        target.getAttribute("data-history-edit-round"),
        10,
      );
      if (!Number.isInteger(roundN) || roundN < 1) return;
      e.preventDefault();
      saveHistoryEdit(roundN);
    });
  }

  return {
    renderHistoryTable,
    bindEvents,
  };
}
