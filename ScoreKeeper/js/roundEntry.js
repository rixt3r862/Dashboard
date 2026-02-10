export function createRoundEntryController(deps) {
  const {
    state,
    els,
    isPhase10,
    showMsg,
    setLive,
    escapeHtml,
    $,
    onAddRound,
  } = deps;

  function ensureCurrentRoundScores() {
    const next = {};
    for (const p of state.players) {
      const v = Number(state.currentRoundScores?.[p.id] ?? 0);
      if (isPhase10()) {
        next[p.id] = v > 0 ? 1 : 0;
      } else {
        next[p.id] = Number.isFinite(v) ? Math.trunc(v) : 0;
      }
    }
    state.currentRoundScores = next;
  }

  function readRoundScores() {
    ensureCurrentRoundScores();
    return { ...state.currentRoundScores };
  }

  function selectInputValue(input) {
    if (!(input instanceof HTMLInputElement)) return;
    requestAnimationFrame(() => {
      input.select();
    });
  }

  function closeRoundHelperForm() {
    state.activeRoundHelper = null;
    els.roundHelperForm.innerHTML = "";
    els.roundHelperForm.style.display = "none";
  }

  function setRoundScoreInputValue(playerId, value, opts = {}) {
    const { silent = false } = opts;
    if (!state.players.some((p) => p.id === playerId)) return;
    if (isPhase10()) {
      state.currentRoundScores[playerId] = Number(value) > 0 ? 1 : 0;
    } else {
      const n = Number.parseInt(value, 10);
      state.currentRoundScores[playerId] = Number.isNaN(n) ? 0 : n;
    }
    if (!silent) {
      showMsg(els.roundMsg, "");
      renderRoundPreview();
    }
  }

  function applyRoundScores(scoresByPlayerId) {
    for (const p of state.players) {
      if (!(p.id in scoresByPlayerId)) continue;
      setRoundScoreInputValue(p.id, scoresByPlayerId[p.id], { silent: true });
    }
    renderRoundPreview();
  }

  function roundActionZeroAll() {
    const scores = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    applyRoundScores(scores);
    showMsg(els.roundMsg, "");
    setLive("Cleared round scores.");
  }

  function roundActionRepeatLast() {
    if (!state.rounds.length) {
      showMsg(els.roundMsg, "No previous round to repeat.");
      return;
    }
    applyRoundScores(state.rounds[state.rounds.length - 1].scores || {});
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    setLive("Loaded previous round scores.");
  }

  function roundActionSetAll(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n)) {
      showMsg(els.roundMsg, "Enter a whole number.");
      return;
    }
    const val = isPhase10() ? (n <= 0 ? 0 : 1) : n;
    const scores = Object.fromEntries(state.players.map((p) => [p.id, val]));
    applyRoundScores(scores);
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    setLive("Applied score to all players.");
  }

  function roundActionHeartsShootMoon(shooterId) {
    if (!shooterId) return;
    const scores = Object.fromEntries(state.players.map((p) => [p.id, 26]));
    scores[shooterId] = 0;
    applyRoundScores(scores);
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    onAddRound();
  }

  function roundActionWinnerRoundPoints(winnerId, points) {
    if (!winnerId) return;
    const pointsN = Number.parseInt(points, 10);
    if (!Number.isInteger(pointsN) || pointsN < 0) {
      showMsg(els.roundMsg, "Winner points must be 0 or more.");
      return;
    }

    const scores = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    scores[winnerId] = pointsN;
    applyRoundScores(scores);
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    setLive("Applied winner-only round points.");
  }

  function openRoundHelperForm(action) {
    state.activeRoundHelper = action;
    if (action === "set_all") {
      if (isPhase10()) {
        els.roundHelperForm.innerHTML = `
          <div class="round-helper-form-row">
            <button type="button" class="round-helper-btn" data-helper-form-action="apply_set_all" data-set-all-value="0">No</button>
            <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_set_all" data-set-all-value="1">Yes</button>
            <button type="button" class="round-helper-btn" data-helper-form-action="cancel">Cancel</button>
          </div>
        `;
        els.roundHelperForm.style.display = "block";
        return;
      }

      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <input id="helperSetAllValue" class="round-helper-input" type="number" inputmode="numeric" placeholder="Score" />
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_set_all">Apply</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const inp = $("helperSetAllValue");
      if (inp) inp.focus();
      return;
    }

    if (action === "hearts_moon") {
      const options = state.players
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperMoonShooter" class="round-helper-input">${options}</select>
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_hearts_moon">Apply & Add Round</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      return;
    }

    if (action === "winner_round") {
      const options = state.players
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperWinnerPlayer" class="round-helper-input">${options}</select>
          <input id="helperWinnerPoints" class="round-helper-input" type="number" inputmode="numeric" placeholder="Winner points" min="0" />
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_winner_round">Apply</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const inp = $("helperWinnerPoints");
      if (inp) inp.focus();
    }
  }

  function renderRoundHelpers() {
    const playing = state.mode === "playing" || state.mode === "finished";
    if (!playing || !state.players.length) {
      els.roundHelperBar.style.display = "none";
      els.roundHelperButtons.innerHTML = "";
      closeRoundHelperForm();
      return;
    }

    const actions = [
      { key: "repeat_last", label: "🔁 Repeat Last" },
      { key: "set_all", label: "🧮 Set All..." },
      { key: "zero_all", label: "🧹 Zero All" },
    ];

    if (state.presetKey === "hearts") {
      actions.push({ key: "hearts_moon", label: "🌙 Shoot Moon..." });
    }
    if (state.presetKey === "uno" || state.presetKey === "crazy8s") {
      actions.push({ key: "winner_round", label: "🏆 Set Winner Round..." });
    }

    els.roundHelperButtons.innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="round-helper-btn" data-round-helper="${a.key}">${escapeHtml(a.label)}</button>`,
      )
      .join("");
    els.roundHelperBar.style.display = "block";

    const available = new Set(actions.map((a) => a.key));
    if (state.activeRoundHelper && available.has(state.activeRoundHelper)) {
      openRoundHelperForm(state.activeRoundHelper);
    } else {
      closeRoundHelperForm();
    }
  }

  function renderRoundPreview() {
    if (!state.players.length) {
      els.roundPreview.style.display = "none";
      els.roundPreviewBody.innerHTML = "";
      return;
    }

    els.roundPreview.style.display = "block";
    const scores = readRoundScores();
    const valueLabel = isPhase10() ? "Phase Completed" : "Score";

    const rows = state.players
      .map((p) => {
        const rawVal = Number(scores[p.id] ?? 0);
        const val = Number.isFinite(rawVal) ? rawVal : 0;
        const displayVal = isPhase10() ? (val > 0 ? "Yes" : "No") : "";
        const actions = isPhase10()
          ? `
            <button type="button" class="round-preview-btn ${
              val <= 0 ? "active" : ""
            }" data-preview-action="set" data-player-id="${
              p.id
            }" data-value="0">No</button>
            <button type="button" class="round-preview-btn ${
              val > 0 ? "active" : ""
            }" data-preview-action="set" data-player-id="${
              p.id
            }" data-value="1">Yes</button>
          `
          : `
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-5">-5</button>
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-1">-1</button>
            <input type="number" inputmode="numeric" class="round-preview-input" data-preview-action="input" data-player-id="${p.id}" value="${val}" />
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="1">+1</button>
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="5">+5</button>
          `;

        return `
          <div class="round-preview-item">
            <span class="round-preview-name">${escapeHtml(p.name)}</span>
            <span class="round-preview-right">
              <span class="round-preview-value">${displayVal}</span>
              <span class="round-preview-actions">${actions}</span>
            </span>
          </div>
        `;
      })
      .join("");

    els.roundPreviewBody.innerHTML = `
      <div class="round-preview-cols">
        <span>Player</span>
        <span>${valueLabel}</span>
      </div>
      ${rows}
    `;
    renderRoundHelpers();
  }

  function clearRoundInputs() {
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    renderRoundPreview();
  }

  function bindEvents() {
    els.roundPreviewBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-preview-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-preview-action");
      const playerId = btn.getAttribute("data-player-id");
      if (!playerId) return;

      if (action === "set") {
        const raw = Number.parseInt(btn.getAttribute("data-value"), 10);
        const val = Number.isNaN(raw) ? 0 : raw;
        setRoundScoreInputValue(playerId, val);
        return;
      }

      if (action === "add") {
        const deltaRaw = Number.parseInt(btn.getAttribute("data-delta"), 10);
        const delta = Number.isNaN(deltaRaw) ? 0 : deltaRaw;
        const scores = readRoundScores();
        const current = Number(scores[playerId] ?? 0);
        setRoundScoreInputValue(playerId, current + delta);
      }
    });

    els.roundPreviewBody.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;
      const playerId = target.getAttribute("data-player-id");
      if (!playerId) return;
      setRoundScoreInputValue(playerId, target.value);
    });

    els.roundPreviewBody.addEventListener("focusin", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;
      selectInputValue(target);
    });

    els.roundPreviewBody.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;
      selectInputValue(target);
    });

    els.roundPreviewBody.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;
      e.preventDefault();
      onAddRound();
    });

    els.roundHelperButtons.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-round-helper]");
      if (!btn) return;
      const action = btn.getAttribute("data-round-helper");
      if (!action) return;

      if (action === "repeat_last") roundActionRepeatLast();
      if (action === "set_all") openRoundHelperForm("set_all");
      if (action === "zero_all") roundActionZeroAll();
      if (action === "hearts_moon") openRoundHelperForm("hearts_moon");
      if (action === "winner_round") openRoundHelperForm("winner_round");
    });

    els.roundHelperForm.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-helper-form-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-helper-form-action");
      if (!action) return;

      if (action === "cancel") {
        closeRoundHelperForm();
        return;
      }
      if (action === "apply_set_all") {
        const v =
          btn.getAttribute("data-set-all-value") ??
          $("helperSetAllValue")?.value ??
          "";
        roundActionSetAll(v);
        return;
      }
      if (action === "apply_hearts_moon") {
        const shooterId = $("helperMoonShooter")?.value ?? "";
        roundActionHeartsShootMoon(shooterId);
        return;
      }
      if (action === "apply_winner_round") {
        const winnerId = $("helperWinnerPlayer")?.value ?? "";
        const points = $("helperWinnerPoints")?.value ?? "";
        roundActionWinnerRoundPoints(winnerId, points);
      }
    });

    els.roundHelperForm.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (
        !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      )
        return;
      e.preventDefault();

      if (state.activeRoundHelper === "set_all") {
        const v = $("helperSetAllValue")?.value ?? "";
        roundActionSetAll(v);
      }
      if (state.activeRoundHelper === "hearts_moon") {
        const shooterId = $("helperMoonShooter")?.value ?? "";
        roundActionHeartsShootMoon(shooterId);
      }
      if (state.activeRoundHelper === "winner_round") {
        const winnerId = $("helperWinnerPlayer")?.value ?? "";
        const points = $("helperWinnerPoints")?.value ?? "";
        roundActionWinnerRoundPoints(winnerId, points);
      }
    });

    els.roundHelperForm.addEventListener("focusin", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.classList.contains("round-helper-input")) return;
      selectInputValue(target);
    });

    els.roundHelperForm.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.classList.contains("round-helper-input")) return;
      selectInputValue(target);
    });
  }

  return {
    ensureCurrentRoundScores,
    readRoundScores,
    setRoundScoreInputValue,
    applyRoundScores,
    renderRoundPreview,
    clearRoundInputs,
    closeRoundHelperForm,
    bindEvents,
  };
}
