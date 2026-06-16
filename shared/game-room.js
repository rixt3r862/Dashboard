(function initGameRoomShared(global) {
  const BOT_NAMES = [
    "Nick", "Sam", "Nate", "Garth", "Kyle", "Kip", "Oliver", "Benny",
    "Nyle", "Eddie", "Jack", "Scott", "Alex", "Henry", "Hank", "Harry",
    "Dan", "George", "Mike", "Simon", "Steve", "Clark", "Bruce", "Grayson",
    "Alfie", "Matt", "Patrick", "Lee", "Louie", "François", "Jace", "Finn",
    "Sebastian", "Ethan", "Ash", "Hunter", "Jax", "West", "Seth",
    "Roman", "Gabriel", "Dominic", "Luca", "Julian", "Theo", "Xavier", "Damien",
    "Elijah", "Rhys", "Tristan", "Adrian", "Mason", "Caleb", "Levi", "Everett",
    "Beckett", "Declan", "Maddox", "Sawyer", "Colton", "Wyatt", "Reid", "Jasper",
    "Rowan", "Emmett", "Holden", "Dean", "Wesley", "Brooks", "Asher", "Sterling",
    "Landon", "Blake", "Cooper", "Gideon", "Silas", "Elias", "Archer", "Knox",
    "Callum", "Damon", "Zane", "Chase", "Logan", "Cade", "Troy", "Victor",
    "Rafael", "Marco", "Dante", "Vincent", "Lucien", "Stefan", "Nikolai", "Ivan",
    "Cassian", "Orion", "Phoenix", "Malcolm", "Lennox", "Killian", "August", "Tobias",
    "Corbin", "Paxton", "Remington", "Briggs", "Ryker", "Colt", "Easton", "Hudson",
    "Axel", "Bennett", "Walker", "Jonas", "Kieran", "Sullivan", "Lawson", "Thatcher",
    "Camden", "Conrad", "Vaughn", "Pierce", "Ellis", "Grant", "Joaquin", "Emilio",
    "Valentin", "Marcel", "Thierry", "Alaric", "Nikolás", "Rocco", "Stellan", "Dorian",
    "Bodhi", "Baylor", "Montgomery", "Royce", "Branson", "Crosby", "Dashiell", "Fletcher", "Gannon", "Hendrix", "Jensen", "Keaton", "Lennon", "Maverick", "Orson", "Quentin", "Ranger", "Soren", "Tatum", "Ulric", "Viggo", "Wilder", "Xander", "Yale", "Zander", "Zeke",
  ];
  const BOT_DIFFICULTY_SETS = {
    hearts: ["easy", "medium", "hard"],
    spades: ["easy", "medium", "hard"],
    standard: ["easy", "medium", "hard"],
  };

  function randomBotNames(count, excludedNames = []) {
    const used = new Set(
      excludedNames
        .map((name) => String(name || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const pool = BOT_NAMES.filter((name) => !used.has(name.toLowerCase()));
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return Array.from({ length: count }, (_, index) => pool[index] || `Bot ${index + 1}`);
  }

  function setupBotNames(count, humanName = "", fallbackHumanName = "Player") {
    const excludedHumanName = String(humanName || fallbackHumanName).trim() || fallbackHumanName;
    return randomBotNames(count, [excludedHumanName]);
  }

  function botDifficultyLevels(kind = "standard") {
    return [...(BOT_DIFFICULTY_SETS[kind] || BOT_DIFFICULTY_SETS.standard)];
  }

  function normalizeBotDifficulty(value, options = {}) {
    const levels = options.levels || botDifficultyLevels(options.kind);
    const fallback = options.fallback || levels[1] || levels[0] || "medium";
    const aliases = options.aliases || {};
    const normalized = aliases[value] || value;
    return levels.includes(normalized) ? normalized : fallback;
  }

  function difficultyLabel(value, options = {}) {
    const normalized = normalizeBotDifficulty(value, options);
    const labels = options.labels || {};
    return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function setupBotDifficulties(count, difficulties = [], options = {}) {
    return Array.from({ length: count }, (_, index) =>
      normalizeBotDifficulty(Array.isArray(difficulties) ? difficulties[index] : undefined, options),
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function winnerBannerMarkup(options = {}) {
    const winnerName = options.winnerName || "Player";
    const kicker = options.kicker || "Game winner";
    const message = options.message || "";
    return `
      <span class="starter-kicker">${escapeHtml(kicker)}</span>
      <strong>Congratulations, ${escapeHtml(winnerName)}!</strong>
      <span>${escapeHtml(message)}</span>
    `;
  }

  function normalizeHistorySortDir(value, fallback = "desc") {
    if (value === "asc" || value === "desc") return value;
    return fallback === "asc" ? "asc" : "desc";
  }

  function toggleHistorySortDir(value) {
    return normalizeHistorySortDir(value) === "desc" ? "asc" : "desc";
  }

  function historySortLabel(value) {
    return normalizeHistorySortDir(value) === "desc" ? "Newest First" : "Oldest First";
  }

  function orderedHistory(entries, sortDir = "desc", options = {}) {
    const history = Array.isArray(entries) ? entries.slice() : [];
    const newestAt = options.newestAt === "start" ? "start" : "end";
    const normalizedSortDir = normalizeHistorySortDir(sortDir);
    const alreadyOrdered =
      (normalizedSortDir === "desc" && newestAt === "start") ||
      (normalizedSortDir === "asc" && newestAt === "end");
    return alreadyOrdered ? history : history.reverse();
  }

  function renderHistorySortControl(button, sortDir, historyLength = 0) {
    if (!button) return;
    button.textContent = historySortLabel(sortDir);
    button.disabled = Number(historyLength) <= 1;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(value, fallback = "session") {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback;
  }

  function sanitizeFileName(value, fallback = "session") {
    const base = String(value || fallback)
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return base || fallback;
  }

  function exportDateStamp(date = new Date()) {
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}-${date.getFullYear()}`;
  }

  function exportTimeStamp(date = new Date()) {
    const rawHours = Number(date.getHours()) || 0;
    const suffix = rawHours >= 12 ? "PM" : "AM";
    const hours = String(rawHours % 12 || 12).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}${minutes}${suffix}`;
  }

  function exportPlayerNameSegment(payload, normalizeName = (value) => value) {
    const names = Array.isArray(payload?.players)
      ? payload.players
          .map((player) => sanitizeFileName(normalizeName(player?.name, "")).slice(0, 8))
          .filter(Boolean)
      : [];
    return names.length ? names.join("_") : "session";
  }

  function exportFileName(gameKey, payload, options = {}) {
    const when = options.when || new Date();
    const scoreKeeperPrefix = options.scoreKeeper ? "scorekeeper_" : "";
    return `${exportDateStamp(when)}_${scoreKeeperPrefix}${gameKey}_${exportPlayerNameSegment(payload, options.normalizeName)}_${exportTimeStamp(when)}.json`;
  }

  function clampInteger(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(numeric)));
  }

  function timestampValue(value, fallback = Date.now()) {
    if (Number.isFinite(Number(value))) return Number(value);
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  function normalizeSessionRecord(session, options = {}) {
    if (!session || typeof session !== "object") return null;
    if (typeof session.id !== "string" || !session.id) return null;
    const payloadKey = options.payloadKey || "payload";
    const payload = session[payloadKey];
    if (!payload || typeof payload !== "object") return null;
    const createdAt = timestampValue(session.createdAt ?? session.savedAt);
    const updatedAt = timestampValue(session.updatedAt, createdAt);
    const normalizeName = options.normalizeName || ((value, fallback) => String(value || fallback || "").trim() || fallback);
    const fallbackName = options.fallbackName || "Game Session";
    return {
      id: session.id,
      name: normalizeName(session.name, fallbackName),
      payload: cloneJson(payload),
      createdAt,
      updatedAt,
    };
  }

  function sessionOptionLabel(session, options = {}) {
    const payload = session?.payload || {};
    const players = Array.isArray(payload.players) ? payload.players.length : 0;
    const roundKey = options.roundKey || "roundNumber";
    const round = clampInteger(payload[roundKey], 1, 999, 1);
    const roundLabel = options.roundLabel || "Round";
    return `${session?.name || "Session"} • ${players}P • ${roundLabel} ${round}`;
  }

  function sessionSelectPlaceholder() {
    return "Saved sessions on this device";
  }

  function sessionSaveButtonLabel(currentSession = null) {
    return currentSession ? "Update Session" : "Save Session";
  }

  function sessionToggleLabel(expanded) {
    return expanded ? "Hide Sessions" : "Sessions";
  }

  function sessionStatusText(options = {}) {
    if (options.message) return String(options.message);
    const sessions = Array.isArray(options.sessions) ? options.sessions : [];
    if (!sessions.length) {
      return "No saved sessions yet. Save on this device or download a JSON backup copy.";
    }
    const sessionNoun = sessions.length === 1 ? "session" : "sessions";
    if (options.currentSession?.name) {
      return `${sessions.length} saved ${sessionNoun}. Current session: ${options.currentSession.name}.`;
    }
    return `${sessions.length} saved ${sessionNoun} on this device.`;
  }

  function defaultSessionName(payload = {}, options = {}) {
    const normalizeName = options.normalizeName || ((value) => String(value || "").trim());
    const names = Array.isArray(payload.players)
      ? payload.players.map((player) => normalizeName(player?.name, "")).filter(Boolean)
      : [];
    const gameName = options.gameName || "Game";
    const lead = names.slice(0, options.nameCount || 3).join(", ") || gameName;
    const roundKey = options.roundKey || "roundNumber";
    const round = clampInteger(payload[roundKey], 1, 999, 1);
    const roundLabel = options.roundLabel || "Round";
    return `${lead} - ${roundLabel} ${round}`;
  }

  function sessionExportBundle(options = {}) {
    return {
      app: options.app,
      version: options.version ?? 1,
      exportedAt: options.exportedAt || new Date().toISOString(),
      session: {
        id: options.sessionId ?? null,
        name: options.sessionName || "Session",
      },
      payload: options.payload,
    };
  }

  function scoreKeeperExportBundle(options = {}) {
    return {
      app: "dashboard-game-export",
      version: options.version ?? 1,
      sourceGame: options.sourceGame,
      scorekeeperPreset: options.scorekeeperPreset,
      exportedAt: options.exportedAt || new Date().toISOString(),
      session: {
        id: options.sessionId ?? null,
        name: options.sessionName || "Session",
      },
      scorekeeperPayload: options.scorekeeperPayload,
      sourcePayload: options.sourcePayload,
    };
  }

  function scoreKeeperPlayers(players = [], normalizeName = (value, fallback) => String(value || fallback || "").trim() || fallback) {
    return Array.isArray(players)
      ? players.map((player, index) => ({
        id: String(player?.id || `p-${index + 1}`),
        name: normalizeName(player?.name, `Player ${index + 1}`),
      }))
      : [];
  }

  function scoreKeeperScores(players = [], scoreForPlayer = () => 0) {
    return Object.fromEntries(players.map((player, index) => {
      const score = Number(scoreForPlayer(player, index));
      return [player.id, Number.isFinite(score) ? Math.trunc(score) : 0];
    }));
  }

  function scoreKeeperWinnerId(winnerId, players = []) {
    const ids = new Set(players.map((player) => player.id));
    return ids.has(winnerId) ? winnerId : null;
  }

  function scoreKeeperRound(index, scores, options = {}) {
    return {
      n: Number.isFinite(Number(options.n)) ? Math.trunc(Number(options.n)) : index + 1,
      scores,
      ts: Number(options.ts) || Date.now(),
      ...(options.extra || {}),
    };
  }

  function scoreKeeperPayloadBase(options = {}) {
    const players = Array.isArray(options.players) ? options.players : [];
    const rounds = Array.isArray(options.rounds) ? options.rounds : [];
    const winnerId = options.winnerId || null;
    const target = options.target ?? 0;
    const winnerMilestones = Array.isArray(options.winnerMilestones)
      ? options.winnerMilestones
      : winnerId
        ? [{ winnerId, roundN: rounds.length, target, ts: Date.now() }]
        : [];
    return {
      mode: options.mode || (winnerId ? "finished" : "playing"),
      presetKey: options.presetKey,
      customGameName: options.customGameName || "",
      heartsDeckCount: options.heartsDeckCount ?? 1,
      target,
      winMode: options.winMode,
      players,
      roundEntryOrder: options.roundEntryOrder || players.map((player) => player.id),
      playerInactiveRanges: options.playerInactiveRanges || {},
      teams: options.teams ?? null,
      rounds,
      winnerId,
      quizTieIds: options.quizTieIds || [],
      gameState: options.gameState || (winnerId ? "completed" : "in_progress"),
      firstWinnerAt: options.firstWinnerAt ?? winnerMilestones[0] ?? null,
      finalWinnerAt: options.finalWinnerAt ?? winnerMilestones[winnerMilestones.length - 1] ?? null,
      winnerMilestones,
      sortByTotal: Boolean(options.sortByTotal),
      historySortDir: options.historySortDir || "desc",
      showHistoryTotals: options.showHistoryTotals !== false,
      spadesPartnerIndex: options.spadesPartnerIndex ?? 3,
      presetNote: options.presetNote || "",
      skyjoCurrentRoundWentOutPlayerId: options.skyjoCurrentRoundWentOutPlayerId ?? null,
      rummikubCurrentRoundWinnerId: options.rummikubCurrentRoundWinnerId ?? null,
      currentSessionId: options.currentSessionId ?? null,
    };
  }

  function scoreKeeperPayloadFromRounds(options = {}) {
    const payload = options.payload || {};
    const rawPlayers = Array.isArray(options.players) ? options.players : payload.players;
    const rawHistory = Array.isArray(options.history)
      ? options.history
      : payload[options.historyKey || "roundHistory"];
    if (!Array.isArray(rawPlayers) || !Array.isArray(rawHistory)) return null;

    const players = scoreKeeperPlayers(rawPlayers, options.normalizeName);
    if (!players.length || !rawHistory.length) return null;

    const scoreForRound = typeof options.scoreForRound === "function"
      ? options.scoreForRound
      : () => 0;
    const rounds = rawHistory.map((entry, index) => {
      const scores = scoreKeeperScores(players, (player, playerIndex) =>
        scoreForRound(entry, player, playerIndex, index));
      const roundOptions = typeof options.roundOptions === "function"
        ? options.roundOptions(entry, index, players, scores) || {}
        : {};
      return scoreKeeperRound(index, scores, {
        ts: entry?.ts,
        ...roundOptions,
      });
    });

    const target = typeof options.target === "function"
      ? options.target(payload)
      : options.target;
    const winnerId = scoreKeeperWinnerId(options.winnerId ?? payload.winnerId, players);
    return scoreKeeperPayloadBase({
      presetKey: options.presetKey,
      target,
      winMode: options.winMode,
      players,
      rounds,
      winnerId,
      historySortDir: options.historySortDir || "desc",
      presetNote: options.presetNote || "",
      ...options.baseOptions,
    });
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    if (global.document?.body) global.document.body.appendChild(link);
    link.click();
    if (typeof link.remove === "function") link.remove();
    const revoke = () => URL.revokeObjectURL(url);
    if (typeof global.setTimeout === "function") {
      global.setTimeout(revoke, 0);
    } else {
      revoke();
    }
  }

  function readStoredJson(key, fallback = null, onError = null) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      if (typeof onError === "function") onError();
      return fallback;
    }
  }

  function writeStoredJson(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function removeStoredItem(key) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  global.GameRoom = {
    ...(global.GameRoom || {}),
    BOT_DIFFICULTY_SETS,
    BOT_NAMES,
    botDifficultyLevels,
    cloneJson,
    clampInteger,
    defaultSessionName,
    difficultyLabel,
    downloadJson,
    escapeHtml,
    exportDateStamp,
    exportFileName,
    exportPlayerNameSegment,
    exportTimeStamp,
    historySortLabel,
    normalizeHistorySortDir,
    randomBotNames,
    readStoredJson,
    removeStoredItem,
    orderedHistory,
    renderHistorySortControl,
    sanitizeFileName,
    normalizeSessionRecord,
    normalizeBotDifficulty,
    scoreKeeperExportBundle,
    scoreKeeperPayloadBase,
    scoreKeeperPayloadFromRounds,
    scoreKeeperPlayers,
    scoreKeeperRound,
    scoreKeeperScores,
    scoreKeeperWinnerId,
    sessionExportBundle,
    sessionOptionLabel,
    sessionSaveButtonLabel,
    sessionSelectPlaceholder,
    sessionStatusText,
    sessionToggleLabel,
    setupBotDifficulties,
    setupBotNames,
    slugify,
    toggleHistorySortDir,
    uid,
    winnerBannerMarkup,
    writeStoredJson,
  };
})(window);
