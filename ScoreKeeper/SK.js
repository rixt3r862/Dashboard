// scorekeeper.js
(() => {
  const STORAGE_KEY = "scorekeeper.v2";

  const PRESETS = {
    custom: { label: "Custom", target: null, winMode: "high", teams: false, notes: "" },
    uno: { label: "Uno", target: 500, winMode: "high", teams: false, notes: "First player to 500 points wins." },
    phase10: { label: "Phase 10", target: 10, winMode: "high", teams: false, notes: "Tracking phases completed (not points)." },
    skyjo: { label: "SkyJo", target: 100, winMode: "low", teams: false, notes: "Lowest score wins. Negative scores possible." },
    hearts: { label: "Hearts", target: 100, winMode: "low", teams: false, notes: "Lowest score wins. Shooting the moon applies." },
    spades: { label: "Spades", target: 500, winMode: "high", teams: true, notes: "Partnership game. Scores are tracked per-player and summed by team." },
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    btnNewGame: $("btnNewGame"),
    btnNewGame2: $("btnNewGame2"),
    btnKeepGoing: $("btnKeepGoing"),
    btnStart: $("btnStart"),
    btnAddRound: $("btnAddRound"),
    btnUndo: $("btnUndo"),
    btnToggleSort: $("btnToggleSort"),
    btnLoadSaved: $("btnLoadSaved"),

    pillStatus: $("pillStatus"),
    pillSaved: $("pillSaved"),

    leftTitle: $("leftTitle"),
    setupPanel: $("setupPanel"),
    roundPanel: $("roundPanel"),
    setupMsg: $("setupMsg"),
    roundMsg: $("roundMsg"),

    presetSelect: $("presetSelect"),
    winModeText: $("winModeText"),

    playerCount: $("playerCount"),
    targetPoints: $("targetPoints"),
    playerNamesWrap: $("playerNamesWrap"),

    teamPreview: $("teamPreview"),
    teamChips: $("teamChips"),
    spadesPartner: $("spadesPartner"),
    // Optional: if your HTML includes this row wrapper, we’ll use it.
    teamPickerRow: $("teamPickerRow"),
    spadesPartnerLabel: $("spadesPartnerLabel"),


    targetPill: $("targetPill"),
    roundPill: $("roundPill"),
    roundInputs: $("roundInputs"),

    winnerBanner: $("winnerBanner"),
    winnerText: $("winnerText"),
    winnerSub: $("winnerSub"),

    scoreboardEmpty: $("scoreboardEmpty"),
    scoreboardArea: $("scoreboardArea"),
    scoreboardBody: $("scoreboardBody"),

    colHeadEntity: $("colHeadEntity"),

    historyDetails: $("historyDetails"),
    historySummaryText: $("historySummaryText"),
    historyTable: $("historyTable"),

    ariaLive: $("ariaLive"),
  };

  // Guard (ignore optional teamPickerRow)
  const required = Object.entries(els)
    .filter(([k, v]) => !["teamPickerRow", "spadesPartnerLabel"].includes(k) && !v)
    .map(([k]) => k);
  if (required.length) {
    console.error("Scorekeeper: missing required element IDs:", required);
    return;
  }

  const state = {
    mode: "setup", // setup | playing | finished
    presetKey: "custom",
    target: 100,
    winMode: "high", // high | low
    players: [], // { id, name }
    teams: null, // null | [{ id, name, members:[playerId]}]
    rounds: [], // { n, scores: { [playerId]: number }, ts }
    lastRoundScores: {}, // for display only
    winnerId: null, // playerId or teamId (depending on mode)
    sortByTotal: false,
    savedExists: false,
    bannerDismissed: false,

    // Preset notes: keep visible during setup
    presetNote: "",

    // Spades partner picker: partner for Player 1 is Player 2|3|4 (default: 2)
    spadesPartnerIndex: 2,
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  function setLive(text) {
    els.ariaLive.textContent = text;
  }

  function clampInt(val, min, max) {
    const n = Number.parseInt(val, 10);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function showMsg(el, text) {
    el.textContent = text;
    el.classList.toggle("show", !!text);
  }

  function detectSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.savedExists = !!raw;
    } catch {
      state.savedExists = false;
    }
    els.btnLoadSaved.style.display = state.savedExists ? "inline-flex" : "none";
    els.pillSaved.style.display = state.savedExists ? "inline-flex" : "none";
  }

  function save() {
    try {
      const payload = {
        mode: state.mode,
        presetKey: state.presetKey,
        target: state.target,
        winMode: state.winMode,
        players: state.players,
        teams: state.teams,
        rounds: state.rounds,
        winnerId: state.winnerId,
        sortByTotal: state.sortByTotal,
        spadesPartnerIndex: state.spadesPartnerIndex,
        presetNote: state.presetNote,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      detectSaved();
    } catch { }
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { }
    detectSaved();
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.players) || !Array.isArray(payload.rounds)) return false;

      state.mode = payload.mode === "playing" || payload.mode === "finished" ? payload.mode : "setup";
      state.presetKey = PRESETS[payload.presetKey] ? payload.presetKey : "custom";
      state.target = Number.isFinite(payload.target) ? payload.target : 100;
      state.winMode = payload.winMode === "low" ? "low" : "high";

      state.players = payload.players.map((p) => ({ id: String(p.id), name: String(p.name) }));
      state.teams = Array.isArray(payload.teams)
        ? payload.teams.map((t) => ({
          id: String(t.id),
          name: String(t.name),
          members: Array.isArray(t.members) ? t.members.map(String) : [],
        }))
        : null;

      state.rounds = payload.rounds.map((r) => ({ n: Number(r.n), scores: r.scores || {}, ts: r.ts || Date.now() }));
      state.winnerId = payload.winnerId || null;
      state.sortByTotal = !!payload.sortByTotal;

      state.lastRoundScores = state.rounds.length ? state.rounds[state.rounds.length - 1].scores || {} : {};
      state.bannerDismissed = false;

      state.spadesPartnerIndex = [2, 3, 4].includes(payload.spadesPartnerIndex) ? payload.spadesPartnerIndex : 2;
      state.presetNote = typeof payload.presetNote === "string" ? payload.presetNote : (PRESETS[state.presetKey]?.notes || "");

      els.presetSelect.value = state.presetKey;
      updateWinModeText();
      maybeRenderTeamPreview();

      renderAll();
      setLive("Saved game loaded.");
      return true;
    } catch {
      return false;
    }
  }

  function newGame() {
    state.mode = "setup";
    state.presetKey = "custom";
    state.target = 100;
    state.winMode = "high";
    state.players = [];
    state.teams = null;
    state.rounds = [];
    state.lastRoundScores = {};
    state.winnerId = null;
    state.sortByTotal = false;
    state.bannerDismissed = false;
    state.presetNote = "";
    state.spadesPartnerIndex = 2;

    els.presetSelect.value = "custom";
    els.playerCount.value = 4;
    els.targetPoints.value = 100;

    updateWinModeText();
    maybeRenderTeamPreview();

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");

    renderSetupInputs();
    renderAll();
    setLive("New game started.");
  }

  function normalizeName(name) {
    return String(name || "").trim();
  }

  function validateSetup(names, target) {
    if (names.length < 2) return "At least 2 players are required.";
    if (!Number.isInteger(target) || target < 1) return "Target must be a positive whole number.";
    if (names.some((n) => !n)) return "All player names are required.";
    const lowered = names.map((n) => n.toLowerCase());
    if (new Set(lowered).size !== lowered.length) return "Player names must be unique (case-insensitive).";
    return "";
  }

  function currentNameInputs() {
    return Array.from(document.querySelectorAll("[data-player-name]")).map((inp) => normalizeName(inp.value));
  }

  function updateWinModeText() {
    els.winModeText.textContent = state.winMode === "low" ? "Lowest score wins" : "Highest score wins";
  }

  function applyPreset(key) {
    const preset = PRESETS[key] || PRESETS.custom;
    state.presetKey = key in PRESETS ? key : "custom";

    if (Number.isInteger(preset.target)) {
      els.targetPoints.value = preset.target;
    }

    state.winMode = preset.winMode === "low" ? "low" : "high";
    updateWinModeText();

    state.presetNote = preset.notes || "";
    showMsg(els.setupMsg, state.presetNote);

    maybeRenderTeamPreview();
    updateStartButtonState();
  }

  function renderSetupInputs() {
    const raw = String(els.playerCount.value ?? "").trim();

    // Allow empty mid-edit without snapping. Keep existing fields; just disable Start.
    if (raw === "") {
      els.btnStart.disabled = true;
      return;
    }

    const n = Number.parseInt(raw, 10);
    const count = Number.isNaN(n) ? 2 : Math.min(12, Math.max(2, n));
    els.playerCount.value = count;

    const existing = currentNameInputs();
    const wrap = els.playerNamesWrap;

    wrap.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const field = document.createElement("div");
      field.className = "field";
      field.style.minWidth = "180px";

      const label = document.createElement("label");
      label.setAttribute("for", `pname_${i}`);
      label.textContent = `Player ${i + 1} name`;

      const input = document.createElement("input");
      input.type = "text";
      input.id = `pname_${i}`;
      input.setAttribute("data-player-name", "1");
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = existing[i] ?? "";

      input.addEventListener("input", () => {
        updateStartButtonState();
        maybeRenderTeamPreview(); // ✅ update partner label/options live
        showMsg(els.setupMsg, state.presetNote);
      });


      field.appendChild(label);
      field.appendChild(input);
      wrap.appendChild(field);
    }

    updateStartButtonState();
    maybeRenderTeamPreview();
  }

  function updateStartButtonState() {
    const target = clampInt(els.targetPoints.value, 1, 1000000);
    const names = currentNameInputs();
    const msg = validateSetup(names, target);

    if (msg) {
      els.btnStart.disabled = true;
      showMsg(els.setupMsg, msg);
      return;
    }

    // Spades: show guidance, but do not disable
    if (state.presetKey === "spades" && names.length !== 4) {
      showMsg(
        els.setupMsg,
        `${state.presetNote ? state.presetNote + " " : ""}Spades is usually 4 players. You can still start, but teams are only auto-made for 4.`,
      );
    } else {
      showMsg(els.setupMsg, state.presetNote);
    }

    els.btnStart.disabled = false;
  }

  function buildTeamsIfNeeded(players) {
    const preset = PRESETS[state.presetKey] || PRESETS.custom;
    if (!preset.teams) return null;

    // Only build teams for exactly 4 players
    if (players.length !== 4) return null;

    // Convert partner (2|3|4) -> index (1|2|3)
    const partnerIdx = Math.min(3, Math.max(1, (state.spadesPartnerIndex ?? 2) - 1));

    const p0 = players[0];
    const partner = players[partnerIdx];

    // Remaining two players become Team B
    const remaining = players
      .map((p, i) => ({ p, i }))
      .filter((x) => x.i !== 0 && x.i !== partnerIdx)
      .map((x) => x.p);

    // Use readable partnership names instead of generic Team A/Team B
    const teamAName = `${p0.name} & ${partner.name}`;
    const teamBName = `${remaining[0].name} & ${remaining[1].name}`;

    return [
      { id: "teamA", name: teamAName, members: [p0.id, partner.id] },
      { id: "teamB", name: teamBName, members: [remaining[0].id, remaining[1].id] },
    ];
  }

  function maybeRenderTeamPreview() {
    const preset = PRESETS[state.presetKey] || PRESETS.custom;

    // Not a teams preset: hide everything and reset spades UI bits
    if (!preset.teams) {
      els.teamPreview.style.display = "none";
      els.teamChips.innerHTML = "";
      els.spadesPartner.innerHTML = "";
      els.spadesPartner.disabled = true;
      if (els.teamPickerRow) els.teamPickerRow.style.display = "none";
      if (els.spadesPartnerLabel) els.spadesPartnerLabel.textContent = "Partner for Player 1";
      return;
    }

    // Teams preset (Spades): show the block
    els.teamPreview.style.display = "block";

    const names = currentNameInputs(); // live input values

    // Update the label live based on Player 1's name (if available)
    const p1Name = names[0] || "Player 1";
    if (els.spadesPartnerLabel) els.spadesPartnerLabel.textContent = `Partner for ${p1Name}`;

    // Need exactly 4 players for partner picking + teams
    if (names.length !== 4) {
      els.teamChips.innerHTML =
        `<div class="chip"><strong>Spades:</strong> enter 4 players to choose teams</div>`;
      els.spadesPartner.innerHTML = "";
      els.spadesPartner.disabled = true;
      if (els.teamPickerRow) els.teamPickerRow.style.display = "none";
      return;
    }

    if (els.teamPickerRow) els.teamPickerRow.style.display = "flex";
    els.spadesPartner.disabled = false;

    // Preserve selection if still valid
    const current = [2, 3, 4].includes(state.spadesPartnerIndex) ? state.spadesPartnerIndex : 2;

    const optName = (i) => (names[i] ? names[i] : `Player ${i + 1}`);
    const options = [
      { val: 2, label: `Player 2 (${optName(1)})` },
      { val: 3, label: `Player 3 (${optName(2)})` },
      { val: 4, label: `Player 4 (${optName(3)})` },
    ];

    els.spadesPartner.innerHTML = options
      .map((o) => `<option value="${o.val}" ${o.val === current ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");

    // Sync state with the actual select value
    const partnerVal = Number(els.spadesPartner.value) || current;
    state.spadesPartnerIndex = [2, 3, 4].includes(partnerVal) ? partnerVal : 2;

    // Compute teams based on selection
    const partnerIdx = state.spadesPartnerIndex - 1;

    const teamA = `${p1Name} & ${names[partnerIdx] || `Player ${state.spadesPartnerIndex}`}`;
    const remaining = [1, 2, 3].filter((i) => i !== partnerIdx);
    const teamB =
      `${names[remaining[0]] || `Player ${remaining[0] + 1}`} & ${names[remaining[1]] || `Player ${remaining[1] + 1}`}`;

    els.teamChips.innerHTML = `
    <div class="chip"><strong>Team 1:</strong> ${escapeHtml(teamA)}</div>
    <div class="chip"><strong>Team 2:</strong> ${escapeHtml(teamB)}</div>
  `;
  }

  function startGame() {
    const target = clampInt(els.targetPoints.value, 1, 1000000);
    const names = currentNameInputs();

    const msg = validateSetup(names, target);
    if (msg) {
      showMsg(els.setupMsg, msg);
      return;
    }

    state.mode = "playing";
    state.target = target;

    state.players = names.map((name) => ({ id: uid(), name }));
    state.teams = buildTeamsIfNeeded(state.players);

    state.rounds = [];
    state.lastRoundScores = {};
    state.winnerId = null;
    state.bannerDismissed = false;

    showMsg(els.setupMsg, "");
    showMsg(els.roundMsg, "");

    save();
    renderAll();
    setLive("Game started.");
  }

  function totalsByPlayerId() {
    const totals = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    for (const r of state.rounds) {
      for (const p of state.players) {
        const v = Number(r.scores?.[p.id] ?? 0);
        totals[p.id] += Number.isFinite(v) ? v : 0;
      }
    }
    return totals;
  }

  function totalsByTeamId(playerTotals) {
    const totals = {};
    if (!state.teams) return totals;
    for (const t of state.teams) {
      totals[t.id] = t.members.reduce((sum, pid) => sum + (playerTotals[pid] ?? 0), 0);
    }
    return totals;
  }

  function leaderIdFromTotals(entries) {
    let best = null;
    for (const e of entries) {
      const t = e.total ?? 0;
      if (best === null) {
        best = e.id;
        continue;
      }
      const bestTotal = entries.find((x) => x.id === best)?.total ?? 0;

      if (state.winMode === "low") {
        if (t < bestTotal) best = e.id;
      } else {
        if (t > bestTotal) best = e.id;
      }
    }
    return best;
  }

  // ✅ FIXED low-score logic:
  // Low-score games (SkyJo/Hearts): game ends when someone reaches/exceeds target; lowest total wins.
  // High-score games (Uno/Spades/etc.): game ends when someone reaches/exceeds target; highest total wins.
  function determineWinnerFromTotals(entries) {
    if (state.winMode === "low") {
      const gameOver = entries.some((x) => (x.total ?? 0) >= state.target);
      if (!gameOver) return null;
      const sorted = [...entries].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
      return sorted[0]?.id ?? null;
    } else {
      const eligible = entries.filter((x) => (x.total ?? 0) >= state.target);
      if (!eligible.length) return null;
      eligible.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
      return eligible[0].id;
    }
  }

  function entityName(id) {
    if (state.teams) {
      return state.teams.find((t) => t.id === id)?.name ?? "Unknown Team";
    }
    return state.players.find((p) => p.id === id)?.name ?? "Unknown";
  }

  function renderRoundInputs() {
    els.roundInputs.innerHTML = "";

    for (const p of state.players) {
      const field = document.createElement("div");
      field.className = "field";
      field.style.minWidth = "180px";

      const label = document.createElement("label");
      label.setAttribute("for", `score_${p.id}`);
      label.textContent = `${p.name} (this round)`;

      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.id = `score_${p.id}`;
      input.setAttribute("data-round-score", p.id);
      input.step = "1";
      input.value = "0";

      const selectAll = () => setTimeout(() => input.select(), 0);
      input.addEventListener("focus", selectAll);
      input.addEventListener("click", selectAll);
      input.addEventListener("touchstart", selectAll, { passive: true });

      input.addEventListener("input", () => showMsg(els.roundMsg, ""));

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const ids = state.players.map((x) => x.id);
          const lastId = ids[ids.length - 1];
          if (p.id === lastId) {
            e.preventDefault();
            addRound();
          }
        }
      });

      field.appendChild(label);
      field.appendChild(input);
      els.roundInputs.appendChild(field);
    }
  }

  function readRoundScores() {
    const scores = {};
    document.querySelectorAll("[data-round-score]").forEach((inp) => {
      const id = inp.getAttribute("data-round-score");
      const raw = String(inp.value ?? "").trim();
      if (raw === "") {
        scores[id] = 0;
        return;
      }
      const n = Number.parseInt(raw, 10);
      scores[id] = Number.isNaN(n) ? 0 : n;
    });
    return scores;
  }

  function clearRoundInputs() {
    const inputs = document.querySelectorAll("[data-round-score]");
    inputs.forEach((inp) => (inp.value = "0"));
    const first = inputs[0];
    if (first) first.focus();
  }

  function addRound() {
    if (state.mode !== "playing") return;

    const scores = readRoundScores();
    for (const p of state.players) {
      const v = scores[p.id];
      if (!Number.isInteger(v)) {
        showMsg(els.roundMsg, "Scores must be whole numbers.");
        return;
      }
    }

    const nextN = state.rounds.length + 1;
    const round = { n: nextN, scores, ts: Date.now() };
    state.rounds.push(round);
    state.lastRoundScores = scores;

    const playerTotals = totalsByPlayerId();
    let entries = [];

    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      entries = state.teams.map((t) => ({ id: t.id, total: teamTotals[t.id] ?? 0 }));
    } else {
      entries = state.players.map((p) => ({ id: p.id, total: playerTotals[p.id] ?? 0 }));
    }

    const w = determineWinnerFromTotals(entries);
    if (w) {
      state.winnerId = w;
      state.mode = "finished";
      state.bannerDismissed = false;
      setLive(`Winner declared: ${entityName(w)}.`);
    } else {
      setLive(`Round ${nextN} added.`);
    }

    save();
    renderAll();

    if (state.mode === "playing") {
      clearRoundInputs();
    }
  }

  function undoLastRound() {
    if (state.rounds.length === 0) return;
    state.rounds.pop();
    state.lastRoundScores = state.rounds.length ? state.rounds[state.rounds.length - 1].scores || {} : {};
    state.winnerId = null;
    state.mode = state.players.length ? "playing" : "setup";
    state.bannerDismissed = true;

    save();
    renderAll();
    setLive("Last round undone.");
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
      th.textContent = state.players.find((p) => p.id === pid)?.name ?? "Player";
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const r of state.rounds) {
      const tr = document.createElement("tr");
      const td0 = document.createElement("td");
      td0.textContent = String(r.n);
      tr.appendChild(td0);

      for (const pid of cols) {
        const td = document.createElement("td");
        const v = Number(r.scores?.[pid] ?? 0);
        td.textContent = String(Number.isFinite(v) ? v : 0);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);

    els.historySummaryText.textContent = state.rounds.length ? `Round History (${state.rounds.length})` : "Round History (0)";
  }

  function renderScoreboard() {
    const playerTotals = totalsByPlayerId();

    let entries = [];
    const thisRoundById = {};

    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      entries = state.teams.map((t) => ({ id: t.id, name: t.name, total: teamTotals[t.id] ?? 0 }));

      for (const t of state.teams) {
        thisRoundById[t.id] = t.members.reduce((sum, pid) => sum + Number(state.lastRoundScores?.[pid] ?? 0), 0);
      }

      els.colHeadEntity.textContent = "Team";
    } else {
      entries = state.players.map((p) => ({ id: p.id, name: p.name, total: playerTotals[p.id] ?? 0 }));
      for (const p of state.players) {
        thisRoundById[p.id] = Number(state.lastRoundScores?.[p.id] ?? 0);
      }
      els.colHeadEntity.textContent = "Player";
    }

    const leader = leaderIdFromTotals(entries.map((e) => ({ id: e.id, total: e.total })));
    const winner = state.winnerId;

    let entriesToShow = [...entries];
    if (state.sortByTotal) {
      entriesToShow.sort((a, b) => (state.winMode === "low" ? a.total - b.total : b.total - a.total));
    }

    els.scoreboardBody.innerHTML = "";
    for (const e of entriesToShow) {
      const tr = document.createElement("tr");
      if (e.id === winner) tr.classList.add("winner");
      else if (e.id === leader) tr.classList.add("leader");

      const tdName = document.createElement("td");
      tdName.innerHTML = `<div class="name">${escapeHtml(e.name)}</div>`;

      const tdTotal = document.createElement("td");
      tdTotal.innerHTML = `<div class="total">${e.total}</div>`;

      const tdThis = document.createElement("td");
      tdThis.textContent = String(thisRoundById[e.id] ?? 0);

      tr.appendChild(tdName);
      tr.appendChild(tdTotal);
      tr.appendChild(tdThis);
      els.scoreboardBody.appendChild(tr);
    }

    renderHistoryTable();
  }

  function renderWinnerBanner() {
    const playerTotals = totalsByPlayerId();
    let winnerTotal = 0;

    if (state.winnerId) {
      if (state.teams) {
        const teamTotals = totalsByTeamId(playerTotals);
        winnerTotal = teamTotals[state.winnerId] ?? 0;
      } else {
        winnerTotal = playerTotals[state.winnerId] ?? 0;
      }
    }

    if (state.mode === "finished" && state.winnerId && !state.bannerDismissed) {
      const name = entityName(state.winnerId);
      els.winnerText.textContent = `Winner: ${name} (${winnerTotal})`;

      els.winnerSub.textContent =
        state.winMode === "low"
          ? `Target was ${state.target}. Game ends when someone reaches ${state.target}; lowest total wins.`
          : `Target was ${state.target}. First to reach the target wins.`;

      els.winnerBanner.classList.add("show");
    } else {
      els.winnerBanner.classList.remove("show");
    }
  }

  function renderMode() {
    const playing = state.mode === "playing" || state.mode === "finished";

    els.setupPanel.style.display = playing ? "none" : "block";
    els.roundPanel.style.display = playing ? "block" : "none";
    els.leftTitle.textContent = playing ? "Round Entry" : "Game Setup";

    els.scoreboardEmpty.style.display = state.players.length ? "none" : "block";
    els.scoreboardArea.style.display = state.players.length ? "block" : "none";

    els.btnToggleSort.disabled = !state.players.length;
    els.btnToggleSort.textContent = state.sortByTotal ? "Sort: Totals" : "Sort: Off";

    els.btnUndo.disabled = !(state.rounds.length > 0);

    els.targetPill.textContent = String(state.target);
    els.roundPill.textContent = String(state.rounds.length + 1);

    const statusText = state.mode === "setup" ? "Setup" : state.mode === "playing" ? "Playing" : "Finished";
    els.pillStatus.innerHTML = `<strong>Status:</strong> ${statusText}`;

    if (playing && els.roundInputs.childElementCount === 0) {
      renderRoundInputs();
    }

    renderWinnerBanner();
  }

  function renderAll() {
    renderMode();
    if (state.players.length) {
      renderScoreboard();
    }
    if (state.mode === "setup") {
      updateStartButtonState();
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
  }

  // Events
  els.presetSelect.addEventListener("change", (e) => applyPreset(e.target.value));

  // Normalize playerCount only after commit (change/blur), not mid-typing
  els.playerCount.addEventListener("change", () => renderSetupInputs());
  els.playerCount.addEventListener("blur", () => renderSetupInputs());

  els.targetPoints.addEventListener("input", () => updateStartButtonState());

  els.btnStart.addEventListener("click", startGame);
  els.btnAddRound.addEventListener("click", addRound);

  els.btnUndo.addEventListener("click", () => {
    showMsg(els.roundMsg, "");
    undoLastRound();
  });

  els.btnNewGame.addEventListener("click", () => {
    clearSaved();
    newGame();
  });

  els.btnNewGame2.addEventListener("click", () => {
    clearSaved();
    newGame();
  });

  els.btnKeepGoing.addEventListener("click", () => {
    state.bannerDismissed = true;
    state.mode = "playing";
    state.winnerId = null;
    save();
    renderAll();
    setLive("Continuing score tracking.");
  });

  els.btnToggleSort.addEventListener("click", () => {
    state.sortByTotal = !state.sortByTotal;
    save();
    renderAll();
  });

  els.btnLoadSaved.addEventListener("click", () => {
    const ok = loadSaved();
    if (!ok) {
      showMsg(els.setupMsg, "No valid saved game found.");
      clearSaved();
    }
  });

  els.spadesPartner.addEventListener("change", () => {
    state.spadesPartnerIndex = Number(els.spadesPartner.value) || 2;
    maybeRenderTeamPreview();
    save();
  });

  // Boot
  detectSaved();
  updateWinModeText();
  renderSetupInputs();
  maybeRenderTeamPreview();

  // Auto-load if saved game is playing/finished
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      if (payload && (payload.mode === "playing" || payload.mode === "finished")) {
        loadSaved();
      } else {
        renderAll();
      }
    } else {
      renderAll();
    }
  } catch {
    renderAll();
  }
})();
