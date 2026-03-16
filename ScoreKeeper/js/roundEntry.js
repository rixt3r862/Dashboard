import { bindSelectOnFocusAndClick } from "./inputUx.js";
import { phase10CompletionMap } from "./rules.mjs";

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
    onSkyjoMarkGoOut,
    onRoundInputsChanged,
  } = deps;

  function ensureCurrentRoundScores() {
    const next = {};
    for (const p of state.players) {
      const v = Number(state.currentRoundScores?.[p.id] ?? 0);
      next[p.id] = Number.isFinite(v) ? Math.trunc(v) : 0;
    }
    state.currentRoundScores = next;
  }

  function ensureCurrentPhase10Completions() {
    const next = {};
    for (const p of state.players) {
      next[p.id] = Number(state.currentRoundPhase10Completed?.[p.id] ?? 0) > 0 ? 1 : 0;
    }
    state.currentRoundPhase10Completed = next;
  }

  function readRoundScores() {
    ensureCurrentRoundScores();
    return { ...state.currentRoundScores };
  }

  function readPhase10Completions() {
    ensureCurrentPhase10Completions();
    return { ...state.currentRoundPhase10Completed };
  }

  function closeRoundHelperForm() {
    state.activeRoundHelper = null;
    els.roundHelperForm.innerHTML = "";
    els.roundHelperForm.style.display = "none";
  }

  function renderHeartsRoundTotal(scoresByPlayerId) {
    if (!els.roundHeartsTotal) return;
    if (!state.players.length || state.presetKey !== "hearts") {
      els.roundHeartsTotal.hidden = true;
      els.roundHeartsTotal.textContent = "";
      return;
    }
    const total = state.players.reduce(
      (sum, p) => sum + Number(scoresByPlayerId?.[p.id] ?? 0),
      0,
    );
    const shootMoonTotal = 26 * Math.max(0, state.players.length - 1);
    const isShootMoonTotal = shootMoonTotal > 26 && total === shootMoonTotal;
    els.roundHeartsTotal.hidden = false;
    els.roundHeartsTotal.textContent = isShootMoonTotal
      ? `Round Total: ${total} (Shoot the Moon)`
      : `Round Total: ${total} / 26`;
  }

  function setRoundScoreInputValue(playerId, value, opts = {}) {
    const { silent = false } = opts;
    if (!state.players.some((p) => p.id === playerId)) return;
    const n = Number.parseInt(value, 10);
    state.currentRoundScores[playerId] = Number.isNaN(n) ? 0 : n;
    if (!silent) {
      showMsg(els.roundMsg, "");
      renderRoundPreview();
      return;
    }
    renderHeartsRoundTotal(state.currentRoundScores);
  }

  function setPhase10CompletionValue(playerId, value, opts = {}) {
    const { silent = false } = opts;
    if (!state.players.some((p) => p.id === playerId)) return;
    ensureCurrentPhase10Completions();
    state.currentRoundPhase10Completed[playerId] = Number(value) > 0 ? 1 : 0;
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

  function applyPhase10Completions(completionsByPlayerId) {
    for (const p of state.players) {
      if (!(p.id in completionsByPlayerId)) continue;
      setPhase10CompletionValue(p.id, completionsByPlayerId[p.id], {
        silent: true,
      });
    }
    renderRoundPreview();
  }

  function roundActionZeroAll() {
    const scores = Object.fromEntries(state.players.map((p) => [p.id, 0]));
    applyRoundScores(scores);
    if (isPhase10()) {
      applyPhase10Completions(
        Object.fromEntries(state.players.map((p) => [p.id, 0])),
      );
    }
    showMsg(els.roundMsg, "");
    setLive("Cleared round scores.");
  }

  function roundActionRepeatLast() {
    if (!state.rounds.length) {
      showMsg(els.roundMsg, "No previous round to repeat.");
      return;
    }
    const lastRound = state.rounds[state.rounds.length - 1];
    applyRoundScores(lastRound.scores || {});
    if (isPhase10()) {
      applyPhase10Completions(phase10CompletionMap(state.players, lastRound));
    }
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
    const scores = Object.fromEntries(state.players.map((p) => [p.id, n]));
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

  function roundActionMarkWinnerZero(winnerId) {
    if (!winnerId) return;
    const scores = readRoundScores();
    scores[winnerId] = 0;
    applyRoundScores(scores);
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    setLive("Marked winner as 0 for this round.");
  }

  function roundActionSkyjoMarkGoOut(playerId) {
    if (!playerId) return;
    onSkyjoMarkGoOut?.(playerId);
    closeRoundHelperForm();
  }

  function openRoundHelperForm(action) {
    state.activeRoundHelper = action;
    if (action === "set_all") {
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <input id="helperSetAllValue" class="round-helper-input" type="number" inputmode="numeric" placeholder="Score" aria-label="Set all score value" />
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_set_all" aria-label="Apply set all score">Apply</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel set all">Cancel</button>
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
          <select id="helperMoonShooter" class="round-helper-input" aria-label="Player who shot the moon">${options}</select>
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_hearts_moon" aria-label="Apply shoot the moon and add round">Apply & Add Round</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel shoot the moon">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      return;
    }

    if (action === "mark_winner_zero") {
      const options = state.players
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperWinnerPlayer" class="round-helper-input" aria-label="Round winner">${options}</select>
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_mark_winner_zero" aria-label="Set winner to zero">Set Winner = 0</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel set winner to zero">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const sel = $("helperWinnerPlayer");
      if (sel) sel.focus();
      return;
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
      { key: "repeat_last", label: "🔁 Repeat Last", ariaLabel: "Repeat last round scores" },
      { key: "set_all", label: "🧮 Set All...", ariaLabel: "Set all players to one score" },
      { key: "zero_all", label: "🧹 Zero All", ariaLabel: "Set all players to zero" },
    ];

    if (state.presetKey === "hearts") {
      actions.push({
        key: "hearts_moon",
        label: "🌙 Shoot Moon...",
        ariaLabel: "Record shoot the moon",
      });
    }
    if (state.presetKey === "uno" || state.presetKey === "crazy8s") {
      actions.push({
        key: "mark_winner_zero",
        label: "🏁 Winner = 0...",
        ariaLabel: "Mark winner as zero for this round",
      });
    }
    els.roundHelperButtons.innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="round-helper-btn" data-round-helper="${a.key}" aria-label="${escapeHtml(a.ariaLabel)}">${escapeHtml(a.label)}</button>`,
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
      renderHeartsRoundTotal(null);
      onRoundInputsChanged?.();
      return;
    }

    els.roundPreview.style.display = "block";
    const scores = readRoundScores();
    const phase10Completions = isPhase10() ? readPhase10Completions() : {};
    renderHeartsRoundTotal(scores);
    const isSkyjo = state.presetKey === "skyjo" && !isPhase10();
    const valueLabel = isPhase10() ? "Points & Phase" : "Score";

    const rows = state.players
      .map((p) => {
        const rawVal = Number(scores[p.id] ?? 0);
        const val = Number.isFinite(rawVal) ? rawVal : 0;
        const phaseComplete = Number(phase10Completions[p.id] ?? 0) > 0;
        const displayVal = isPhase10() ? (phaseComplete ? "PH+" : "") : "";
        const playerNameEsc = escapeHtml(p.name);
        const skyjoWentOutUi = isSkyjo
          ? `
            <label class="round-preview-out">
              <input type="radio" name="skyjoWentOutPlayer" data-preview-action="went-out" data-player-id="${p.id}" ${
                state.skyjoCurrentRoundWentOutPlayerId === p.id ? "checked" : ""
              } aria-label="${playerNameEsc} went out this round" />
            </label>
          `
          : "";
        const actions = isPhase10()
          ? `
            <span class="round-preview-score-controls">
              <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-5" aria-label="Decrease ${playerNameEsc} score by 5">-5</button>
              <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-1" aria-label="Decrease ${playerNameEsc} score by 1">-1</button>
              <input type="number" inputmode="numeric" class="round-preview-input" data-preview-action="input" data-player-id="${p.id}" value="${val}" aria-label="Points left for ${playerNameEsc}" />
              <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="1" aria-label="Increase ${playerNameEsc} score by 1">+1</button>
              <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="5" aria-label="Increase ${playerNameEsc} score by 5">+5</button>
            </span>
            <span class="round-preview-phase-toggle" aria-label="${playerNameEsc} phase completion">
              <span class="round-preview-phase-label">Phase</span>
              <button type="button" class="round-preview-btn ${
                !phaseComplete ? "active" : ""
              }" data-preview-action="phase" data-player-id="${
                p.id
              }" data-value="0" aria-label="Mark ${playerNameEsc} as not completing a phase">No</button>
              <button type="button" class="round-preview-btn ${
                phaseComplete ? "active" : ""
              }" data-preview-action="phase" data-player-id="${
                p.id
              }" data-value="1" aria-label="Mark ${playerNameEsc} as completing a phase">Yes</button>
            </span>
          `
          : `
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-5" aria-label="Decrease ${playerNameEsc} score by 5">-5</button>
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="-1" aria-label="Decrease ${playerNameEsc} score by 1">-1</button>
            <input type="number" inputmode="numeric" class="round-preview-input" data-preview-action="input" data-player-id="${p.id}" value="${val}" aria-label="Score for ${playerNameEsc}" />
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="1" aria-label="Increase ${playerNameEsc} score by 1">+1</button>
            <button type="button" class="round-preview-btn" data-preview-action="add" data-player-id="${p.id}" data-delta="5" aria-label="Increase ${playerNameEsc} score by 5">+5</button>
            ${isSkyjo ? "" : skyjoWentOutUi}
          `;

        if (isSkyjo) {
          return `
            <div class="round-preview-item skyjo">
              <span class="round-preview-name">${playerNameEsc}</span>
              <span class="round-preview-right">
                <span class="round-preview-value">${displayVal}</span>
                <span class="round-preview-actions${isPhase10() ? " phase10" : ""}">${actions}</span>
              </span>
              ${skyjoWentOutUi}
            </div>
          `;
        }

        return `
          <div class="round-preview-item">
            <span class="round-preview-name">${playerNameEsc}</span>
            <span class="round-preview-right">
              <span class="round-preview-value">${displayVal}</span>
              <span class="round-preview-actions${isPhase10() ? " phase10" : ""}">${actions}</span>
            </span>
          </div>
        `;
      })
      .join("");

    if (isSkyjo) {
      els.roundPreviewBody.innerHTML = `
        <div class="round-preview-cols skyjo">
          <span>Player</span>
          <span>${valueLabel}</span>
          <span>Out</span>
        </div>
        ${rows}
      `;
    } else {
      els.roundPreviewBody.innerHTML = `
        <div class="round-preview-cols">
          <span>Player</span>
          <span>${valueLabel}</span>
        </div>
        ${rows}
      `;
    }
    renderRoundHelpers();
    onRoundInputsChanged?.();
  }

  function clearRoundInputs() {
    state.currentRoundScores = Object.fromEntries(
      state.players.map((p) => [p.id, 0]),
    );
    state.currentRoundPhase10Completed = Object.fromEntries(
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

      if (action === "phase") {
        const raw = Number.parseInt(btn.getAttribute("data-value"), 10);
        const val = Number.isNaN(raw) ? 0 : raw;
        setPhase10CompletionValue(playerId, val);
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
      const previewAction = target.getAttribute("data-preview-action");
      if (previewAction === "went-out") {
        const playerId = target.getAttribute("data-player-id");
        if (!playerId || !target.checked) return;
        roundActionSkyjoMarkGoOut(playerId);
        return;
      }
      if (previewAction !== "input") return;
      const playerId = target.getAttribute("data-player-id");
      if (!playerId) return;
      setRoundScoreInputValue(playerId, target.value, { silent: true });
      onRoundInputsChanged?.();
    });

    els.roundPreviewBody.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;
      const playerId = target.getAttribute("data-player-id");
      if (!playerId) return;
      setRoundScoreInputValue(playerId, target.value, { silent: true });
      onRoundInputsChanged?.();
    });

    els.roundPreviewBody.addEventListener("keydown", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-preview-action") !== "input") return;

      const inputs = Array.from(
        els.roundPreviewBody.querySelectorAll(
          'input[data-preview-action="input"]',
        ),
      );
      const currentIdx = inputs.indexOf(target);
      if (currentIdx < 0) return;

      const playerId = target.getAttribute("data-player-id");
      if (playerId) {
        setRoundScoreInputValue(playerId, target.value, { silent: true });
      }

      if (e.key === "Tab") {
        const nextIdx = currentIdx + (e.shiftKey ? -1 : 1);
        const nextInput = inputs[nextIdx];
        if (nextInput instanceof HTMLInputElement) {
          e.preventDefault();
          nextInput.focus();
          nextInput.select();
        }
        return;
      }

      if (e.key !== "Enter") return;
      e.preventDefault();

      const nextInput = inputs[currentIdx + 1];
      if (nextInput instanceof HTMLInputElement) {
        nextInput.focus();
        nextInput.select();
        return;
      }

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
      if (action === "mark_winner_zero") openRoundHelperForm("mark_winner_zero");
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
      if (action === "apply_mark_winner_zero") {
        const winnerId = $("helperWinnerPlayer")?.value ?? "";
        roundActionMarkWinnerZero(winnerId);
        return;
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
      if (state.activeRoundHelper === "mark_winner_zero") {
        const winnerId = $("helperWinnerPlayer")?.value ?? "";
        roundActionMarkWinnerZero(winnerId);
      }
    });

    bindSelectOnFocusAndClick(
      els.roundPreviewBody,
      'input[data-preview-action="input"]',
    );
    bindSelectOnFocusAndClick(els.roundHelperForm, "input.round-helper-input");
  }

  return {
    ensureCurrentRoundScores,
    readRoundScores,
    readPhase10Completions,
    setRoundScoreInputValue,
    setPhase10CompletionValue,
    applyRoundScores,
    applyPhase10Completions,
    renderRoundPreview,
    clearRoundInputs,
    closeRoundHelperForm,
    bindEvents,
  };
}
