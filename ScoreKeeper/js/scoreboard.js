export function createScoreboardController(deps) {
  const {
    state,
    els,
    PRESETS,
    PRESET_BACKGROUNDS,
    PRESET_TINT_OVERRIDES,
    isPhase10,
    escapeHtml,
    totalsByPlayerId,
    totalsByTeamId,
    leaderIdFromTotals,
    phase10CurrentPhase,
    entityName,
    renderHistoryTable,
  } = deps;

  function winnerCongratsLine(name) {
    const lines = [
      `Great game, ${name}!`,
      `${name}, you crushed it.`,
      `${name} takes the win.`,
      `Nice finish, ${name}.`,
      `${name} on top. Well played.`,
    ];
    const seed = `${state.winnerId || ""}-${state.rounds.length}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return lines[hash % lines.length];
  }

  function renderScoreboard() {
    const playerTotals = totalsByPlayerId();

    let entries = [];
    const thisRoundById = {};

    if (state.teams) {
      const teamTotals = totalsByTeamId(playerTotals);
      entries = state.teams.map((t) => ({
        id: t.id,
        name: t.name,
        total: teamTotals[t.id] ?? 0,
      }));

      for (const t of state.teams) {
        thisRoundById[t.id] = t.members.reduce(
          (sum, pid) => sum + Number(state.lastRoundScores?.[pid] ?? 0),
          0,
        );
      }

      els.colHeadEntity.textContent = "Team";
    } else {
      entries = state.players.map((p) => ({
        id: p.id,
        name: p.name,
        total: playerTotals[p.id] ?? 0,
      }));
      for (const p of state.players) {
        thisRoundById[p.id] = Number(state.lastRoundScores?.[p.id] ?? 0);
      }
      els.colHeadEntity.textContent = "Player";
    }

    const leader = leaderIdFromTotals(
      entries.map((e) => ({ id: e.id, total: e.total })),
    );
    const winner = state.winnerId;

    let entriesToShow = [...entries];
    if (state.sortByTotal) {
      entriesToShow.sort((a, b) =>
        state.winMode === "low" ? a.total - b.total : b.total - a.total,
      );
    }

    els.scoreboardBody.innerHTML = "";
    for (const e of entriesToShow) {
      const tr = document.createElement("tr");
      if (e.id === winner) tr.classList.add("winner");
      else if (e.id === leader) tr.classList.add("leader");

      const tdName = document.createElement("td");
      if (isPhase10() && !state.teams) {
        const current = phase10CurrentPhase(e.total);
        tdName.innerHTML = `<div class="name">${escapeHtml(e.name)}</div><div class="sub">Current phase: ${current}</div>`;
      } else {
        tdName.innerHTML = `<div class="name">${escapeHtml(e.name)}</div>`;
      }

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
      els.winnerText.textContent = `🏆 Winner: ${name} (${winnerTotal})`;

      const rulesLine =
        state.winMode === "low"
          ? `Target was ${state.target}. Game ends when someone reaches ${state.target}; lowest total wins.`
          : `Target was ${state.target}. First to reach the target wins.`;
      els.winnerSub.textContent = `🎉 ${winnerCongratsLine(name)} ${rulesLine}`;

      els.winnerBanner.classList.add("show");
    } else {
      els.winnerBanner.classList.remove("show");
    }
  }

  function updateScoreboardTitle() {
    const playing = state.mode === "playing" || state.mode === "finished";
    const presetLabel = PRESETS[state.presetKey]?.label || "";
    const showGameLabel = playing && state.presetKey !== "custom" && presetLabel;
    els.scoreboardTitle.textContent = showGameLabel
      ? `${presetLabel} Scoreboard`
      : "Scoreboard";
  }

  function setScoreboardTint(rgb) {
    if (!Array.isArray(rgb) || rgb.length !== 3) {
      els.scoreboardCard.style.removeProperty("--scoreboard-tint-rgb");
      return;
    }
    const [r, g, b] = rgb.map((x) =>
      Math.max(0, Math.min(255, Number(x) || 0)),
    );
    els.scoreboardCard.style.setProperty(
      "--scoreboard-tint-rgb",
      `${r}, ${g}, ${b}`,
    );
  }

  function dominantColorFromImage(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;

    const maxSide = 64;
    const scale = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;

    const bins = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] / 255;
      if (a < 0.15) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const light = (max + min) / 510;
      if (light > 0.97 || light < 0.03) continue;

      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const key = `${qr},${qg},${qb}`;
      const score = a * (0.7 + sat * 1.4);

      bins.set(key, (bins.get(key) || 0) + score);
    }

    let bestKey = null;
    let bestScore = -1;
    for (const [key, score] of bins.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    if (!bestKey) return null;
    return bestKey.split(",").map((x) => Number.parseInt(x, 10));
  }

  function refreshScoreboardTintFromImage() {
    const override = PRESET_TINT_OVERRIDES[state.presetKey];
    if (override) {
      setScoreboardTint(override);
      return;
    }

    try {
      const rgb = dominantColorFromImage(els.scoreboardBgImage);
      setScoreboardTint(rgb);
    } catch {
      setScoreboardTint(null);
    }
  }

  function hideScoreboardBackgroundImage() {
    els.scoreboardBgImage.hidden = true;
    els.scoreboardBgImage.removeAttribute("src");
  }

  function updateScoreboardBackground() {
    const playing = state.mode === "playing" || state.mode === "finished";
    const bgSrc = playing ? PRESET_BACKGROUNDS[state.presetKey] : null;
    if (bgSrc) {
      els.scoreboardBgImage.src = bgSrc;
      els.scoreboardBgImage.hidden = false;
      els.scoreboardCard.classList.add("has-bg");
      if (
        els.scoreboardBgImage.complete &&
        els.scoreboardBgImage.naturalWidth > 0
      ) {
        refreshScoreboardTintFromImage();
      }
    } else {
      hideScoreboardBackgroundImage();
      els.scoreboardCard.classList.remove("has-bg");
      setScoreboardTint(null);
    }
  }

  function bindEvents() {
    els.scoreboardBgImage.addEventListener("load", refreshScoreboardTintFromImage);
    els.scoreboardBgImage.addEventListener("error", () => {
      hideScoreboardBackgroundImage();
      els.scoreboardCard.classList.remove("has-bg");
      setScoreboardTint(null);
    });
  }

  return {
    renderScoreboard,
    renderWinnerBanner,
    updateScoreboardTitle,
    updateScoreboardBackground,
    bindEvents,
  };
}
