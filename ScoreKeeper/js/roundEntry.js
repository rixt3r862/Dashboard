import { bindSelectOnFocusAndClick } from "./inputUx.js";
import {
  heartsRoundPenaltyTotal,
  phase10CompletionMap,
  phase10ProgressByPlayerId,
} from "./rules.mjs";

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
    activePlayers,
    inactivePlayers,
    retirePlayer,
    unretirePlayer,
    renamePlayer,
    save,
  } = deps;
  let draggingRoundEntryPlayerId = null;

  function clearRoundEntryDragIndicators() {
    els.roundPreviewBody
      .querySelectorAll(".round-preview-item.drop-before, .round-preview-item.drop-after")
      .forEach((row) => {
        row.classList.remove("drop-before", "drop-after");
      });
  }

  function orderedPlayers() {
    const playersById = new Map(activePlayers().map((p) => [p.id, p]));
    const ordered = Array.isArray(state.roundEntryOrder)
      ? state.roundEntryOrder
          .map((id) => playersById.get(id))
          .filter(Boolean)
      : [];
    for (const player of activePlayers()) {
      if (!ordered.some((entry) => entry.id === player.id)) ordered.push(player);
    }
    state.roundEntryOrder = ordered.map((player) => player.id);
    return ordered;
  }

  function moveRoundEntryPlayer(playerId, direction) {
    const orderedIds = orderedPlayers().map((player) => player.id);
    const currentIdx = orderedIds.indexOf(playerId);
    if (currentIdx < 0) return;
    const nextIdx = currentIdx + direction;
    if (nextIdx < 0 || nextIdx >= orderedIds.length) return;
    [orderedIds[currentIdx], orderedIds[nextIdx]] = [
      orderedIds[nextIdx],
      orderedIds[currentIdx],
    ];
    state.roundEntryOrder = orderedIds;
    save?.();
    renderRoundPreview();
    setLive(`Moved ${activePlayers().find((player) => player.id === playerId)?.name || "player"} ${direction < 0 ? "up" : "down"} in round entry.`);
  }

  function reorderRoundEntryPlayer(draggedId, targetId, placeAfter = false) {
    const orderedIds = orderedPlayers().map((player) => player.id);
    const fromIdx = orderedIds.indexOf(draggedId);
    const targetIdx = orderedIds.indexOf(targetId);
    if (fromIdx < 0 || targetIdx < 0) return;

    const [dragged] = orderedIds.splice(fromIdx, 1);
    let insertIdx = targetIdx;
    if (fromIdx < targetIdx) insertIdx -= 1;
    if (placeAfter) insertIdx += 1;
    insertIdx = Math.max(0, Math.min(orderedIds.length, insertIdx));
    orderedIds.splice(insertIdx, 0, dragged);

    state.roundEntryOrder = orderedIds;
    save?.();
    renderRoundPreview();
    const playerName =
      activePlayers().find((player) => player.id === draggedId)?.name || "player";
    setLive(`Moved ${playerName} in round entry.`);
  }

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
    if (!activePlayers().length || state.presetKey !== "hearts") {
      els.roundHeartsTotal.hidden = true;
      els.roundHeartsTotal.textContent = "";
      return;
    }
    const roundPenaltyTotal = heartsRoundPenaltyTotal(state.heartsDeckCount);
    const total = activePlayers().reduce(
      (sum, p) => sum + Number(scoresByPlayerId?.[p.id] ?? 0),
      0,
    );
    const shootMoonTotal = roundPenaltyTotal * Math.max(0, activePlayers().length - 1);
    const isShootMoonTotal = shootMoonTotal > roundPenaltyTotal && total === shootMoonTotal;
    els.roundHeartsTotal.hidden = false;
    els.roundHeartsTotal.textContent = isShootMoonTotal
      ? `Round Total: ${total} (Shoot the Moon)`
      : `Round Total: ${total} / ${roundPenaltyTotal}`;
  }

  function shouldShowSkyjoNegativeOutHint(playerId) {
    if (state.presetKey !== "skyjo" || isPhase10()) return false;
    if (state.skyjoCurrentRoundWentOutPlayerId !== playerId) return false;
    const score = Number(state.currentRoundScores?.[playerId] ?? 0);
    return Number.isFinite(score) && score <= 0;
  }

  function syncSkyjoOutScoreHints() {
    if (!els.roundPreviewBody) return;
    els.roundPreviewBody.querySelectorAll("[data-preview-row]").forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const playerId = row.getAttribute("data-preview-row");
      if (!playerId) return;
      const right = row.querySelector(".round-preview-right");
      if (!(right instanceof HTMLElement)) return;
      const existing = right.querySelector(".round-preview-note.skyjo-note");
      if (shouldShowSkyjoNegativeOutHint(playerId)) {
        if (!existing) {
          const note = document.createElement("span");
          note.className = "round-preview-note skyjo-note";
          note.textContent = "2x does not apply for 0 or - out scores.";
          right.appendChild(note);
        }
      } else if (existing) {
        existing.remove();
      }
    });
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
    syncSkyjoOutScoreHints();
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
    const scores = Object.fromEntries(activePlayers().map((p) => [p.id, 0]));
    applyRoundScores(scores);
    if (isPhase10()) {
      applyPhase10Completions(
        Object.fromEntries(activePlayers().map((p) => [p.id, 0])),
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
      applyPhase10Completions(phase10CompletionMap(activePlayers(), lastRound));
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
    const scores = Object.fromEntries(activePlayers().map((p) => [p.id, n]));
    applyRoundScores(scores);
    closeRoundHelperForm();
    showMsg(els.roundMsg, "");
    setLive("Applied score to all players.");
  }

  function roundActionHeartsShootMoon(shooterId) {
    if (!shooterId) return;
    const scores = Object.fromEntries(
      activePlayers().map((p) => [p.id, heartsRoundPenaltyTotal(state.heartsDeckCount)]),
    );
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

  function roundActionRetirePlayer(playerId) {
    if (!playerId) return;
    retirePlayer?.(playerId);
    closeRoundHelperForm();
  }

  function roundActionUnretirePlayer(playerId) {
    if (!playerId) return;
    unretirePlayer?.(playerId);
    closeRoundHelperForm();
  }

  function roundActionRenamePlayer(playerId, nextName) {
    if (!playerId) return;
    const renamed = renamePlayer?.(playerId, nextName);
    if (renamed) closeRoundHelperForm();
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
      const options = activePlayers()
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
      const options = activePlayers()
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

    if (action === "rename_player") {
      const options = state.players
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      const initialName = escapeHtml(state.players[0]?.name ?? "");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperRenamePlayer" class="round-helper-input" aria-label="Player to rename">${options}</select>
          <input id="helperRenamePlayerValue" class="round-helper-input" type="text" value="${initialName}" placeholder="New player name" aria-label="New player name" maxlength="40" />
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_rename_player" aria-label="Rename selected player">Rename</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel rename player">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const input = $("helperRenamePlayerValue");
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }

    if (action === "retire_player") {
      const options = activePlayers()
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperRetirePlayer" class="round-helper-input" aria-label="Player to retire">${options}</select>
          <button type="button" class="round-helper-btn danger" data-helper-form-action="apply_retire_player" aria-label="Retire selected player">Retire Player</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel retire player">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const sel = $("helperRetirePlayer");
      if (sel) sel.focus();
      return;
    }

    if (action === "unretire_player") {
      const options = inactivePlayers()
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
        )
        .join("");
      els.roundHelperForm.innerHTML = `
        <div class="round-helper-form-row">
          <select id="helperUnretirePlayer" class="round-helper-input" aria-label="Player to unretire">${options}</select>
          <button type="button" class="round-helper-btn primary" data-helper-form-action="apply_unretire_player" aria-label="Bring selected player back">Bring Back</button>
          <button type="button" class="round-helper-btn" data-helper-form-action="cancel" aria-label="Cancel unretire player">Cancel</button>
        </div>
      `;
      els.roundHelperForm.style.display = "block";
      const sel = $("helperUnretirePlayer");
      if (sel) sel.focus();
      return;
    }

  }

  function renderRoundHelpers() {
    const playing = state.mode === "playing" || state.mode === "finished";
    if (!playing || !activePlayers().length) {
      els.roundHelperBar.style.display = "none";
      els.roundHelperButtons.innerHTML = "";
      closeRoundHelperForm();
      return;
    }

    const actions = [
      { key: "repeat_last", label: "🔁 Repeat Last", ariaLabel: "Repeat last round scores" },
      { key: "set_all", label: "🧮 Set All...", ariaLabel: "Set all players to one score" },
      { key: "zero_all", label: "🧹 Zero All", ariaLabel: "Set all players to zero" },
      {
        key: "rename_player",
        label: "✏️ Rename...",
        ariaLabel: "Rename a player",
        tooltip: "Change a player's name without affecting past scores.",
      },
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
    if (state.mode === "playing" && !state.teams && activePlayers().length > 2) {
      actions.push({
        key: "retire_player",
        label: "Retire...",
        ariaLabel: "Retire a player from future rounds",
        tooltip: "Remove a player from future rounds while keeping their history.",
      });
    }
    if (state.mode === "playing" && !state.teams && inactivePlayers().length) {
      actions.push({
        key: "unretire_player",
        label: "Unretire...",
        ariaLabel: "Bring a retired player back into future rounds",
        tooltip: "Bring a retired player back for future rounds without filling missed rounds.",
      });
    }
    els.roundHelperButtons.innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="round-helper-btn" data-round-helper="${a.key}" aria-label="${escapeHtml(a.ariaLabel)}"${a.tooltip ? ` title="${escapeHtml(a.tooltip)}"` : ""}>${escapeHtml(a.label)}</button>`,
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
    if (!activePlayers().length) {
      els.roundPreview.style.display = "none";
      els.roundPreviewBody.innerHTML = "";
      renderHeartsRoundTotal(null);
      onRoundInputsChanged?.();
      return;
    }

    els.roundPreview.style.display = "block";
    const scores = readRoundScores();
    const phase10Completions = isPhase10() ? readPhase10Completions() : {};
    const phase10Progress = isPhase10()
      ? phase10ProgressByPlayerId(state.players, state.rounds, state.target)
      : {};
    renderHeartsRoundTotal(scores);
    const isSkyjo = state.presetKey === "skyjo" && !isPhase10();
    const valueLabel = isPhase10() ? "Points & Phase" : "Score";

    const ordered = orderedPlayers();
    const rows = ordered
      .map((p) => {
        const rawVal = Number(scores[p.id] ?? 0);
        const val = Number.isFinite(rawVal) ? rawVal : 0;
        const phaseComplete = Number(phase10Completions[p.id] ?? 0) > 0;
        const phaseNumber = Number(phase10Progress[p.id]?.currentPhase ?? 1);
        const phaseLabel = `Phase ${phaseNumber}`;
        const playerNameEsc = escapeHtml(p.name);
        const showSkyjoNegativeOutHint = shouldShowSkyjoNegativeOutHint(p.id);
        const rowClass = phaseComplete && isPhase10() ? " phase10-complete" : "";
        const moveControls = `
          <button
            type="button"
            class="round-preview-order-handle"
            draggable="true"
            data-preview-action="drag-handle"
            data-player-id="${p.id}"
            aria-label="Drag to reorder ${playerNameEsc}. Use arrow keys to move."
            title="Drag to reorder"
          >
            <span class="round-preview-order-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        `;
        const playerCell = `
          <span class="round-preview-player">
            <span class="round-preview-name">${playerNameEsc}</span>
          </span>
        `;
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
              <button
                type="button"
                class="round-preview-btn round-preview-phase-btn ${phaseComplete ? "active" : ""}"
                data-preview-action="phase-toggle"
                data-player-id="${p.id}"
                aria-label="Toggle ${playerNameEsc} ${phaseLabel} completion"
                aria-pressed="${phaseComplete ? "true" : "false"}"
                title="${phaseComplete ? `${playerNameEsc} completed ${phaseLabel}` : `Mark ${playerNameEsc} ${phaseLabel} complete`}"
              >${phaseLabel}</button>
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
            <div class="round-preview-item skyjo" data-preview-row="${p.id}">
              ${playerCell}
              <span class="round-preview-right">
              <span class="round-preview-value"></span>
              <span class="round-preview-actions${isPhase10() ? " phase10" : ""}">${actions}</span>
              ${
                showSkyjoNegativeOutHint
                  ? `<span class="round-preview-note skyjo-note">2x does not apply for 0 or - out scores.</span>`
                  : ""
              }
            </span>
            ${skyjoWentOutUi}
            ${moveControls}
          </div>
          `;
        }

        return `
          <div class="round-preview-item${rowClass}" data-preview-row="${p.id}">
            ${playerCell}
            <span class="round-preview-right">
            <span class="round-preview-value"></span>
            <span class="round-preview-actions${isPhase10() ? " phase10" : ""}">${actions}</span>
          </span>
          ${moveControls}
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
      if (action === "drag-handle") return;
      const playerId = btn.getAttribute("data-player-id");
      if (!playerId) return;

      if (action === "set") {
        const raw = Number.parseInt(btn.getAttribute("data-value"), 10);
        const val = Number.isNaN(raw) ? 0 : raw;
        setRoundScoreInputValue(playerId, val);
        return;
      }

      if (action === "phase-toggle") {
        const current = Number(readPhase10Completions()[playerId] ?? 0) > 0 ? 1 : 0;
        setPhase10CompletionValue(playerId, current ? 0 : 1);
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
      if (
        target instanceof HTMLButtonElement &&
        target.getAttribute("data-preview-action") === "drag-handle"
      ) {
        const playerId = target.getAttribute("data-player-id");
        if (!playerId) return;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveRoundEntryPlayer(playerId, -1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveRoundEntryPlayer(playerId, 1);
          return;
        }
      }
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
      if (action === "rename_player") openRoundHelperForm("rename_player");
      if (action === "hearts_moon") openRoundHelperForm("hearts_moon");
      if (action === "mark_winner_zero") openRoundHelperForm("mark_winner_zero");
      if (action === "retire_player") openRoundHelperForm("retire_player");
      if (action === "unretire_player") openRoundHelperForm("unretire_player");
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
      if (action === "apply_rename_player") {
        const playerId = $("helperRenamePlayer")?.value ?? "";
        const nextName = $("helperRenamePlayerValue")?.value ?? "";
        roundActionRenamePlayer(playerId, nextName);
        return;
      }
      if (action === "apply_retire_player") {
        const playerId = $("helperRetirePlayer")?.value ?? "";
        roundActionRetirePlayer(playerId);
        return;
      }
      if (action === "apply_unretire_player") {
        const playerId = $("helperUnretirePlayer")?.value ?? "";
        roundActionUnretirePlayer(playerId);
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
      if (state.activeRoundHelper === "rename_player") {
        const playerId = $("helperRenamePlayer")?.value ?? "";
        const nextName = $("helperRenamePlayerValue")?.value ?? "";
        roundActionRenamePlayer(playerId, nextName);
      }
      if (state.activeRoundHelper === "retire_player") {
        const playerId = $("helperRetirePlayer")?.value ?? "";
        roundActionRetirePlayer(playerId);
      }
      if (state.activeRoundHelper === "unretire_player") {
        const playerId = $("helperUnretirePlayer")?.value ?? "";
        roundActionUnretirePlayer(playerId);
      }
    });

    bindSelectOnFocusAndClick(
      els.roundPreviewBody,
      'input[data-preview-action="input"]',
    );
    bindSelectOnFocusAndClick(els.roundHelperForm, "input.round-helper-input");

    els.roundHelperForm.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.id !== "helperRenamePlayer") return;
      const player = state.players.find((entry) => entry.id === target.value);
      const input = $("helperRenamePlayerValue");
      if (!(input instanceof HTMLInputElement)) return;
      input.value = player?.name ?? "";
      input.focus();
      input.select();
    });

    els.roundPreviewBody.addEventListener("dragstart", (e) => {
      const target = e.target;
      const handle =
        target instanceof Element
          ? target.closest('[data-preview-action="drag-handle"]')
          : null;
      if (!(handle instanceof HTMLElement)) return;
      const playerId = handle.getAttribute("data-player-id");
      if (!playerId) return;
      draggingRoundEntryPlayerId = playerId;
      const row = handle.closest("[data-preview-row]");
      if (row instanceof HTMLElement) row.classList.add("is-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", playerId);
        if (row instanceof HTMLElement) {
          const rect = row.getBoundingClientRect();
          const offsetX = Math.max(12, Math.round(e.clientX - rect.left));
          const offsetY = Math.max(12, Math.round(e.clientY - rect.top));
          e.dataTransfer.setDragImage(row, offsetX, offsetY);
        }
      }
    });

    els.roundPreviewBody.addEventListener("dragover", (e) => {
      const target =
        e.target instanceof Element
          ? e.target.closest("[data-preview-row]")
          : null;
      if (!(target instanceof HTMLElement) || !draggingRoundEntryPlayerId) return;
      e.preventDefault();
      const targetId = target.getAttribute("data-preview-row");
      clearRoundEntryDragIndicators();
      if (!targetId || targetId === draggingRoundEntryPlayerId) return;
      const rect = target.getBoundingClientRect();
      const placeAfter = e.clientY > rect.top + rect.height / 2;
      target.classList.add(placeAfter ? "drop-after" : "drop-before");
    });

    els.roundPreviewBody.addEventListener("drop", (e) => {
      const target =
        e.target instanceof Element
          ? e.target.closest("[data-preview-row]")
          : null;
      if (!(target instanceof HTMLElement) || !draggingRoundEntryPlayerId) return;
      e.preventDefault();
      const targetId = target.getAttribute("data-preview-row");
      clearRoundEntryDragIndicators();
      if (!targetId || targetId === draggingRoundEntryPlayerId) return;
      const rect = target.getBoundingClientRect();
      const placeAfter = e.clientY > rect.top + rect.height / 2;
      reorderRoundEntryPlayer(draggingRoundEntryPlayerId, targetId, placeAfter);
      draggingRoundEntryPlayerId = null;
    });

    els.roundPreviewBody.addEventListener("dragend", () => {
      draggingRoundEntryPlayerId = null;
      clearRoundEntryDragIndicators();
      els.roundPreviewBody
        .querySelectorAll(".round-preview-item.is-dragging")
        .forEach((row) => row.classList.remove("is-dragging"));
    });
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
