import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const sharedScriptPath = path.join(repoRoot, "shared/game-room.js");

function loadGameRoom(options = {}) {
  const randomValues = [...(options.randomValues ?? [])];
  const fakeMath = Object.create(Math);
  fakeMath.random = () => (randomValues.length ? randomValues.shift() : 0.123456789);

  const createdLinks = [];
  const createdUrls = [];
  const appendedLinks = [];
  const revokedUrls = [];
  const storage = new Map(Object.entries(options.storage ?? {}));
  const storageCalls = {
    get: [],
    remove: [],
    set: [],
  };

  class FakeBlob {
    constructor(parts, blobOptions) {
      this.parts = parts;
      this.options = blobOptions;
    }
  }

  const context = {
    Blob: FakeBlob,
    Math: fakeMath,
    URL: {
      createObjectURL(blob) {
        const url = `blob:test-${createdUrls.length + 1}`;
        createdUrls.push({ blob, url });
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
    document: {
      body: {
        appendChild(link) {
          appendedLinks.push(link);
        },
      },
      createElement(tagName) {
        assert.equal(tagName, "a");
        const link = {
          clickCount: 0,
          download: "",
          href: "",
          removeCount: 0,
          click() {
            this.clickCount += 1;
          },
          remove() {
            this.removeCount += 1;
          },
        };
        createdLinks.push(link);
        return link;
      },
    },
    setTimeout(callback) {
      callback();
    },
    window: options.window ?? {},
  };

  context.window.document = context.document;
  context.window.setTimeout = context.setTimeout;

  context.window.localStorage = options.localStorage ?? {
    getItem(key) {
      storageCalls.get.push(key);
      return storage.has(key) ? storage.get(key) : null;
    },
    removeItem(key) {
      storageCalls.remove.push(key);
      storage.delete(key);
    },
    setItem(key, value) {
      storageCalls.set.push([key, value]);
      storage.set(key, value);
    },
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(sharedScriptPath, "utf8"), context, {
    filename: sharedScriptPath,
  });

  return {
    appendedLinks,
    context,
    createdLinks,
    createdUrls,
    gameRoom: context.window.GameRoom,
    revokedUrls,
    storage,
    storageCalls,
  };
}

function normalizeMarkup(value) {
  return value.replace(/\s+/g, " ").trim();
}

test("GameRoom exposes the shared bot-name list without duplicates", () => {
  const { gameRoom } = loadGameRoom();
  const requiredNames = [
    "François",
    "Finn",
    "Sebastian",
    "Ethan",
    "Ash",
    "Hunter",
    "Jax",
    "West",
    "Seth",
  ];

  for (const name of requiredNames) {
    assert.ok(gameRoom.BOT_NAMES.includes(name), `${name} should be available`);
  }

  assert.equal(new Set(gameRoom.BOT_NAMES).size, gameRoom.BOT_NAMES.length);
});

test("randomBotNames returns unique names, honors exclusions, and preserves BOT_NAMES", () => {
  const { gameRoom } = loadGameRoom({ randomValues: [0.1, 0.2, 0.3, 0.4, 0.5] });
  const before = [...gameRoom.BOT_NAMES];
  const names = gameRoom.randomBotNames(3, [" nick ", "SAM"]);

  assert.equal(names.length, 3);
  assert.equal(new Set(names).size, names.length);
  assert.ok(!names.some((name) => ["nick", "sam"].includes(name.toLowerCase())));
  assert.deepEqual(Array.from(gameRoom.BOT_NAMES), before);
});

test("randomBotNames fills overlarge requests with Bot N fallbacks", () => {
  const { gameRoom } = loadGameRoom();
  const names = gameRoom.randomBotNames(gameRoom.BOT_NAMES.length + 2);

  assert.equal(names.length, gameRoom.BOT_NAMES.length + 2);
  assert.equal(names.at(-2), `Bot ${gameRoom.BOT_NAMES.length + 1}`);
  assert.equal(names.at(-1), `Bot ${gameRoom.BOT_NAMES.length + 2}`);
});

test("setupBotNames excludes the current human player with a fallback name", () => {
  const { gameRoom } = loadGameRoom();

  const names = gameRoom.setupBotNames(3, " nick ", "Rick");
  assert.equal(names.length, 3);
  assert.ok(!names.some((name) => name.toLowerCase() === "nick"));

  const fallbackExcludedNames = gameRoom.setupBotNames(gameRoom.BOT_NAMES.length, "", "Sam");
  assert.ok(!fallbackExcludedNames.some((name) => name.toLowerCase() === "sam"));
});

test("difficulty helpers normalize shared bot levels and legacy aliases", () => {
  const { gameRoom } = loadGameRoom();

  assert.deepEqual(Array.from(gameRoom.botDifficultyLevels("standard")), ["easy", "medium", "hard"]);
  assert.deepEqual(Array.from(gameRoom.botDifficultyLevels("hearts")), ["easy", "medium", "hard"]);
  assert.equal(gameRoom.normalizeBotDifficulty("hard", { kind: "standard" }), "hard");
  assert.equal(gameRoom.normalizeBotDifficulty("normal", { kind: "standard" }), "medium");
  assert.equal(gameRoom.normalizeBotDifficulty("normal", { aliases: { normal: "medium" }, kind: "hearts" }), "medium");
  assert.equal(gameRoom.normalizeBotDifficulty("medium", { kind: "hearts" }), "medium");
  assert.equal(gameRoom.difficultyLabel("hard", { kind: "standard" }), "Hard");
  assert.equal(gameRoom.difficultyLabel("medium", { kind: "hearts" }), "Medium");
  assert.deepEqual(Array.from(gameRoom.setupBotDifficulties(4, ["easy", "bogus", "hard"], { kind: "standard" })), [
    "easy",
    "medium",
    "hard",
    "medium",
  ]);
});

test("escapeHtml escapes unsafe characters and stringifies safe values", () => {
  const { gameRoom } = loadGameRoom();

  assert.equal(gameRoom.escapeHtml(`A&B <tag> "quote" 'tick'`), "A&amp;B &lt;tag&gt; &quot;quote&quot; &#039;tick&#039;");
  assert.equal(gameRoom.escapeHtml(null), "");
  assert.equal(gameRoom.escapeHtml(undefined), "");
  assert.equal(gameRoom.escapeHtml(42), "42");
  assert.equal(gameRoom.escapeHtml(false), "false");
});

test("winnerBannerMarkup renders and escapes the shared winner banner", () => {
  const { gameRoom } = loadGameRoom();

  assert.equal(
    normalizeMarkup(gameRoom.winnerBannerMarkup({
      winnerName: `Rick <script>`,
      message: `Rick & Sam hit 100. Your Final Score: 42 points.`,
    })),
    normalizeMarkup(`
      <span class="starter-kicker">Game winner</span>
      <strong>Congratulations, Rick &lt;script&gt;!</strong>
      <span>Rick &amp; Sam hit 100. Your Final Score: 42 points.</span>
    `),
  );
});

test("history sort helpers normalize, toggle, label, order, and render controls", () => {
  const { gameRoom } = loadGameRoom();
  const history = [{ id: "oldest" }, { id: "middle" }, { id: "newest" }];
  const button = { disabled: false, textContent: "" };

  assert.equal(gameRoom.normalizeHistorySortDir("asc"), "asc");
  assert.equal(gameRoom.normalizeHistorySortDir("bad"), "desc");
  assert.equal(gameRoom.normalizeHistorySortDir("bad", "asc"), "asc");
  assert.equal(gameRoom.toggleHistorySortDir("desc"), "asc");
  assert.equal(gameRoom.toggleHistorySortDir("asc"), "desc");
  assert.equal(gameRoom.historySortLabel("desc"), "Newest First");
  assert.equal(gameRoom.historySortLabel("asc"), "Oldest First");

  assert.deepEqual(gameRoom.orderedHistory(history, "desc", { newestAt: "end" }).map((entry) => entry.id), [
    "newest",
    "middle",
    "oldest",
  ]);
  assert.deepEqual(gameRoom.orderedHistory(history, "asc", { newestAt: "end" }).map((entry) => entry.id), [
    "oldest",
    "middle",
    "newest",
  ]);
  assert.deepEqual(gameRoom.orderedHistory(history, "desc", { newestAt: "start" }).map((entry) => entry.id), [
    "oldest",
    "middle",
    "newest",
  ]);
  assert.deepEqual(history.map((entry) => entry.id), ["oldest", "middle", "newest"]);

  gameRoom.renderHistorySortControl(button, "desc", 1);
  assert.equal(button.textContent, "Newest First");
  assert.equal(button.disabled, true);
  gameRoom.renderHistorySortControl(button, "asc", 2);
  assert.equal(button.textContent, "Oldest First");
  assert.equal(button.disabled, false);
});

test("uid returns the expected eight-character base-36 slice", () => {
  const randomValue = 0.123456789;
  const { gameRoom } = loadGameRoom({ randomValues: [randomValue] });

  assert.equal(gameRoom.uid(), randomValue.toString(36).slice(2, 10));
  assert.equal(gameRoom.uid().length, 8);
});

test("cloneJson deep-clones JSON-safe values", () => {
  const { gameRoom } = loadGameRoom();
  const original = {
    active: true,
    count: 3,
    nested: { cards: ["A", "K"] },
    skipped: undefined,
  };
  const clone = gameRoom.cloneJson(original);

  assert.deepEqual(JSON.parse(JSON.stringify(clone)), {
    active: true,
    count: 3,
    nested: { cards: ["A", "K"] },
  });

  clone.nested.cards.push("Q");
  assert.deepEqual(original.nested.cards, ["A", "K"]);
});

test("slugify normalizes labels and falls back for empty slugs", () => {
  const { gameRoom } = loadGameRoom();

  assert.equal(gameRoom.slugify("  Hearts Night: Rick & Sam!  "), "hearts-night-rick-sam");
  assert.equal(gameRoom.slugify("---"), "session");
  assert.equal(gameRoom.slugify("***", "backup"), "backup");
});

test("export filename helpers format session and ScoreKeeper names consistently", () => {
  const { gameRoom } = loadGameRoom();
  const when = new Date(2026, 4, 17, 21, 5);
  const payload = {
    players: [
      { name: "Rick Mosher" },
      { name: "François!" },
      { name: "VeryLongPlayerName" },
    ],
  };

  assert.equal(gameRoom.sanitizeFileName(" Rick & Sam.json "), "Rick-Sam.json");
  assert.equal(gameRoom.exportDateStamp(when), "May-17-2026");
  assert.equal(gameRoom.exportTimeStamp(when), "0905PM");
  assert.equal(gameRoom.exportPlayerNameSegment(payload), "Rick-Mos_Fran-ois_VeryLong");
  assert.equal(gameRoom.exportFileName("skyjo", payload, { when }), "May-17-2026_skyjo_Rick-Mos_Fran-ois_VeryLong_0905PM.json");
  assert.equal(
    gameRoom.exportFileName("phase10", payload, { scoreKeeper: true, when }),
    "May-17-2026_scorekeeper_phase10_Rick-Mos_Fran-ois_VeryLong_0905PM.json",
  );
});

test("session helpers normalize records, option labels, and default names", () => {
  const { gameRoom } = loadGameRoom();
  const payload = {
    players: [{ name: " Rick " }, { name: "Sam" }, { name: "" }, { name: "Alex" }],
    roundNumber: 7,
  };
  const normalized = gameRoom.normalizeSessionRecord({
    id: "session-1",
    name: "  Friday Table  ",
    payload,
    createdAt: 100,
    updatedAt: 200,
  }, {
    fallbackName: "SkyJo Session",
    normalizeName: (value, fallback = "") => String(value || "").trim() || fallback,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), {
    id: "session-1",
    name: "Friday Table",
    payload,
    createdAt: 100,
    updatedAt: 200,
  });
  normalized.payload.players[0].name = "Changed";
  assert.equal(payload.players[0].name, " Rick ");

  assert.equal(gameRoom.normalizeSessionRecord({ id: "", payload }, { fallbackName: "Session" }), null);
  assert.equal(gameRoom.normalizeSessionRecord({ id: "bad" }, { fallbackName: "Session" }), null);
  assert.equal(gameRoom.sessionOptionLabel(normalized), "Friday Table • 4P • Round 7");
  assert.deepEqual(JSON.parse(JSON.stringify(gameRoom.normalizeSessionRecord({
    id: "legacy-hearts",
    name: "  Old Hearts  ",
    payload,
    savedAt: "2026-05-17T12:00:00.000Z",
  }))), {
    id: "legacy-hearts",
    name: "Old Hearts",
    payload,
    createdAt: Date.parse("2026-05-17T12:00:00.000Z"),
    updatedAt: Date.parse("2026-05-17T12:00:00.000Z"),
  });
  assert.equal(
    gameRoom.sessionOptionLabel(normalized, { roundKey: "handNumber", roundLabel: "Hand" }),
    "Friday Table • 4P • Hand 1",
  );
  assert.equal(
    gameRoom.defaultSessionName(payload, {
      gameName: "SkyJo",
      normalizeName: (value) => String(value || "").trim(),
    }),
    "Rick, Sam, Alex - Round 7",
  );
});

test("session UI language helpers keep controls consistent", () => {
  const { gameRoom } = loadGameRoom();
  const currentSession = { name: "Friday Table" };

  assert.equal(gameRoom.sessionSelectPlaceholder(), "Saved sessions on this device");
  assert.equal(gameRoom.sessionSaveButtonLabel(null), "Save Session");
  assert.equal(gameRoom.sessionSaveButtonLabel(currentSession), "Update Session");
  assert.equal(gameRoom.sessionToggleLabel(true), "Hide Sessions");
  assert.equal(gameRoom.sessionToggleLabel(false), "Sessions");
  assert.equal(
    gameRoom.sessionStatusText({ sessions: [] }),
    "No saved sessions yet. Save on this device or download a JSON backup copy.",
  );
  assert.equal(
    gameRoom.sessionStatusText({ sessions: [currentSession], currentSession }),
    "1 saved session. Current session: Friday Table.",
  );
  assert.equal(
    gameRoom.sessionStatusText({ sessions: [currentSession, { name: "Sunday Table" }] }),
    "2 saved sessions on this device.",
  );
  assert.equal(
    gameRoom.sessionStatusText({ message: "Session saved: Friday Table.", sessions: [] }),
    "Session saved: Friday Table.",
  );
});

test("export bundle helpers build session and ScoreKeeper wrapper payloads", () => {
  const { gameRoom } = loadGameRoom();
  const exportedAt = "2026-05-17T21:05:00.000Z";
  const sourcePayload = { players: [{ name: "Rick" }] };
  const scorekeeperPayload = { presetKey: "skyjo", rounds: [] };

  assert.deepEqual(JSON.parse(JSON.stringify(gameRoom.sessionExportBundle({
    app: "skyjo-table",
    version: 2,
    exportedAt,
    sessionId: "session-1",
    sessionName: "Friday Table",
    payload: sourcePayload,
  }))), {
    app: "skyjo-table",
    version: 2,
    exportedAt,
    session: {
      id: "session-1",
      name: "Friday Table",
    },
    payload: sourcePayload,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(gameRoom.scoreKeeperExportBundle({
    version: 2,
    sourceGame: "skyjo-table",
    scorekeeperPreset: "skyjo",
    exportedAt,
    sessionId: "session-1",
    sessionName: "Friday Table",
    scorekeeperPayload,
    sourcePayload,
  }))), {
    app: "dashboard-game-export",
    version: 2,
    sourceGame: "skyjo-table",
    scorekeeperPreset: "skyjo",
    exportedAt,
    session: {
      id: "session-1",
      name: "Friday Table",
    },
    scorekeeperPayload,
    sourcePayload,
  });
});

test("ScoreKeeper player and round helpers normalize common export structures", () => {
  const { gameRoom } = loadGameRoom();
  const players = gameRoom.scoreKeeperPlayers([
    { id: "rick", name: " Rick " },
    { id: "", name: "" },
  ], (value, fallback) => String(value || "").trim() || fallback);
  const scores = gameRoom.scoreKeeperScores(players, (player, index) =>
    player.id === "rick" ? "12.9" : index === 1 ? "bad" : 0,
  );
  const round = gameRoom.scoreKeeperRound(2, scores, {
    n: "7",
    ts: "9000",
    extra: { phase10OutPlayerId: "rick" },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(players)), [
    { id: "rick", name: "Rick" },
    { id: "p-2", name: "Player 2" },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(scores)), { rick: 12, "p-2": 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(round)), {
    n: 7,
    scores: { rick: 12, "p-2": 0 },
    ts: 9000,
    phase10OutPlayerId: "rick",
  });
  assert.equal(gameRoom.scoreKeeperWinnerId("rick", players), "rick");
  assert.equal(gameRoom.scoreKeeperWinnerId("missing", players), null);
});

test("ScoreKeeper payload base fills common dashboard export fields", () => {
  const { gameRoom } = loadGameRoom();
  const players = [{ id: "p1", name: "Rick" }, { id: "p2", name: "Sam" }];
  const rounds = [{ n: 1, scores: { p1: 0, p2: 26 }, ts: 123 }];
  const payload = gameRoom.scoreKeeperPayloadBase({
    presetKey: "hearts",
    target: 100,
    winMode: "low",
    players,
    rounds,
    winnerId: "p1",
    historySortDir: "asc",
    presetNote: "Lowest score wins.",
  });

  assert.equal(payload.mode, "finished");
  assert.equal(payload.presetKey, "hearts");
  assert.equal(payload.target, 100);
  assert.equal(payload.winMode, "low");
  assert.deepEqual(payload.players, players);
  assert.deepEqual(payload.roundEntryOrder, ["p1", "p2"]);
  assert.deepEqual(payload.rounds, rounds);
  assert.equal(payload.winnerId, "p1");
  assert.equal(payload.gameState, "completed");
  assert.equal(payload.firstWinnerAt.winnerId, "p1");
  assert.equal(payload.finalWinnerAt.winnerId, "p1");
  assert.equal(payload.winnerMilestones.length, 1);
  assert.equal(payload.historySortDir, "asc");
  assert.equal(payload.showHistoryTotals, true);
  assert.equal(payload.skyjoCurrentRoundWentOutPlayerId, null);
  assert.equal(payload.rummikubCurrentRoundWinnerId, null);
  assert.equal(payload.currentSessionId, null);
});

test("ScoreKeeper payload from rounds builds common game exports", () => {
  const { gameRoom } = loadGameRoom();
  const payload = gameRoom.scoreKeeperPayloadFromRounds({
    payload: {
      players: [
        { id: "p1", name: " Rick " },
        { id: "p2", name: "Sam" },
      ],
      winnerId: "p2",
      roundHistory: [
        {
          roundNumber: 4,
          results: {
            p1: { raw: "7" },
            p2: { raw: "3" },
          },
          ts: 1200,
          triggerId: "p1",
        },
      ],
    },
    presetKey: "skyjo",
    target: 100,
    winMode: "low",
    normalizeName: (value, fallback) => String(value || "").trim() || fallback,
    scoreForRound: (round, player) => round.results[player.id].raw,
    roundOptions: (round) => ({
      extra: {
        skyjoSourceRoundNumber: round.roundNumber,
        skyjoWentOutPlayerId: round.triggerId,
      },
    }),
    presetNote: "Lowest score wins.",
  });

  assert.equal(payload.presetKey, "skyjo");
  assert.equal(payload.target, 100);
  assert.equal(payload.winnerId, "p2");
  assert.deepEqual(JSON.parse(JSON.stringify(payload.players)), [
    { id: "p1", name: "Rick" },
    { id: "p2", name: "Sam" },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.rounds)), [{
    n: 1,
    scores: { p1: 7, p2: 3 },
    ts: 1200,
    skyjoSourceRoundNumber: 4,
    skyjoWentOutPlayerId: "p1",
  }]);
  assert.equal(gameRoom.scoreKeeperPayloadFromRounds({ payload: { players: [], roundHistory: [] } }), null);
});

test("downloadJson creates, clicks, and revokes a JSON download link", () => {
  const { appendedLinks, createdLinks, createdUrls, gameRoom, revokedUrls } = loadGameRoom();
  const payload = { game: "Hearts", scores: [0, 26] };

  gameRoom.downloadJson("hearts-session.json", payload);

  assert.equal(createdUrls.length, 1);
  assert.deepEqual(Array.from(createdUrls[0].blob.parts), [JSON.stringify(payload, null, 2)]);
  assert.deepEqual(JSON.parse(JSON.stringify(createdUrls[0].blob.options)), { type: "application/json" });
  assert.equal(createdLinks.length, 1);
  assert.deepEqual(appendedLinks, createdLinks);
  assert.equal(createdLinks[0].href, "blob:test-1");
  assert.equal(createdLinks[0].download, "hearts-session.json");
  assert.equal(createdLinks[0].clickCount, 1);
  assert.equal(createdLinks[0].removeCount, 1);
  assert.deepEqual(revokedUrls, ["blob:test-1"]);
});

test("stored JSON helpers read, write, remove, and fall back safely", () => {
  const { gameRoom, storage, storageCalls } = loadGameRoom({
    storage: {
      bad: "{ nope",
      good: JSON.stringify({ game: "SkyJo", round: 2 }),
    },
  });
  let errorCount = 0;

  assert.deepEqual(JSON.parse(JSON.stringify(gameRoom.readStoredJson("good", null))), { game: "SkyJo", round: 2 });
  assert.equal(gameRoom.readStoredJson("missing", "fallback"), "fallback");
  assert.equal(gameRoom.readStoredJson("bad", "fallback", () => { errorCount += 1; }), "fallback");
  assert.equal(errorCount, 1);

  assert.equal(gameRoom.writeStoredJson("new", { score: 12 }), true);
  assert.equal(storage.get("new"), JSON.stringify({ score: 12 }));
  assert.equal(gameRoom.removeStoredItem("new"), true);
  assert.equal(storage.has("new"), false);
  assert.deepEqual(storageCalls.set, [["new", JSON.stringify({ score: 12 })]]);
  assert.deepEqual(storageCalls.remove, ["new"]);
});

test("GameRoom preserves existing namespace properties", () => {
  const { gameRoom } = loadGameRoom({ window: { GameRoom: { existing: "kept" } } });

  assert.equal(gameRoom.existing, "kept");
  assert.equal(typeof gameRoom.randomBotNames, "function");
});

test("standalone game pages include the shared HTML head checklist", () => {
  const pages = [
    "Games/index.html",
    "Hearts/index.html",
    "SkyJo/index.html",
    "Phase10/index.html",
    "FiveCrowns/index.html",
  ];

  for (const htmlPath of pages) {
    const html = fs.readFileSync(path.join(repoRoot, htmlPath), "utf8");

    assert.match(html, /<link\s+rel="manifest"\s+href="[^"]*app\.webmanifest"/, `${htmlPath} should link the app manifest`);
    assert.match(html, /<script\s+defer\s+src="[^"]*shared\/pwa\.js"/, `${htmlPath} should load the shared PWA script`);
    assert.match(html, /rel="icon"/, `${htmlPath} should include a favicon link`);
    assert.match(html, /rel="apple-touch-icon"/, `${htmlPath} should include an Apple touch icon link`);
  }
});

test("each game loads shared utilities before its game script", () => {
  const pages = [
    { gameScript: "./hearts.js", htmlPath: "Hearts/index.html", sharedScript: "../shared/game-room.js" },
    { gameScript: "./skyjo.js", htmlPath: "SkyJo/index.html", sharedScript: "../shared/game-room.js" },
    { gameScript: "./phase10.js", htmlPath: "Phase10/index.html", sharedScript: "../shared/game-room.js" },
    { gameScript: "./fivecrowns.js", htmlPath: "FiveCrowns/index.html", sharedScript: "../shared/game-room.js" },
  ];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(repoRoot, page.htmlPath), "utf8");
    const sharedIndex = html.indexOf(page.sharedScript);
    const gameIndex = html.indexOf(page.gameScript);

    assert.ok(sharedIndex >= 0, `${page.htmlPath} should load ${page.sharedScript}`);
    assert.ok(gameIndex >= 0, `${page.htmlPath} should load ${page.gameScript}`);
    assert.ok(sharedIndex < gameIndex, `${page.htmlPath} should load shared utilities first`);
  }
});

test("each standalone game loads shared CSS tokens before local CSS", () => {
  const pages = [
    { htmlPath: "Hearts/index.html", localCss: "./hearts.css", sharedCss: "../shared/game-room.css" },
    { htmlPath: "SkyJo/index.html", localCss: "./skyjo.css", sharedCss: "../shared/game-room.css" },
    { htmlPath: "Phase10/index.html", localCss: "./phase10.css", sharedCss: "../shared/game-room.css" },
    { htmlPath: "FiveCrowns/index.html", localCss: "./fivecrowns.css", sharedCss: "../shared/game-room.css" },
  ];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(repoRoot, page.htmlPath), "utf8");
    const sharedIndex = html.indexOf(page.sharedCss);
    const localIndex = html.indexOf(page.localCss);

    assert.ok(sharedIndex >= 0, `${page.htmlPath} should load ${page.sharedCss}`);
    assert.ok(localIndex >= 0, `${page.htmlPath} should load ${page.localCss}`);
    assert.ok(sharedIndex < localIndex, `${page.htmlPath} should load shared CSS tokens first`);
  }
});

test("each game delegates expected helper wrappers to window.GameRoom", () => {
  const expectations = [
    {
      jsPath: "Hearts/hearts.js",
      helpers: ["BOT_NAMES", "botDifficultyLevels", "randomBotNames", "setupBotNames", "normalizeBotDifficulty", "difficultyLabel", "setupBotDifficulties", "escapeHtml", "winnerBannerMarkup", "normalizeHistorySortDir", "toggleHistorySortDir", "orderedHistory", "renderHistorySortControl", "sessionSelectPlaceholder", "sessionSaveButtonLabel", "sessionToggleLabel", "sessionStatusText", "normalizeSessionRecord", "sessionOptionLabel", "sessionExportBundle", "uid", "cloneJson", "slugify", "downloadJson", "readStoredJson", "writeStoredJson", "scoreKeeperExportBundle", "scoreKeeperPayloadBase", "scoreKeeperPayloadFromRounds", "scoreKeeperPlayers", "scoreKeeperScores", "scoreKeeperWinnerId", "scoreKeeperRound"],
    },
    {
      jsPath: "SkyJo/skyjo.js",
      helpers: ["BOT_NAMES", "botDifficultyLevels", "randomBotNames", "setupBotNames", "normalizeBotDifficulty", "difficultyLabel", "setupBotDifficulties", "escapeHtml", "winnerBannerMarkup", "normalizeHistorySortDir", "toggleHistorySortDir", "orderedHistory", "renderHistorySortControl", "uid", "cloneJson", "readStoredJson", "writeStoredJson", "downloadJson", "sessionExportBundle", "scoreKeeperExportBundle", "scoreKeeperPayloadBase", "scoreKeeperPayloadFromRounds", "scoreKeeperPlayers", "scoreKeeperScores", "scoreKeeperWinnerId", "scoreKeeperRound", "normalizeSessionRecord", "sessionOptionLabel", "sessionSelectPlaceholder", "sessionSaveButtonLabel", "sessionToggleLabel", "sessionStatusText", "defaultSessionName", "sanitizeFileName", "exportDateStamp", "exportTimeStamp", "exportPlayerNameSegment", "exportFileName"],
    },
    {
      jsPath: "Phase10/phase10.js",
      helpers: ["BOT_NAMES", "botDifficultyLevels", "randomBotNames", "setupBotNames", "normalizeBotDifficulty", "difficultyLabel", "setupBotDifficulties", "escapeHtml", "winnerBannerMarkup", "normalizeHistorySortDir", "toggleHistorySortDir", "orderedHistory", "renderHistorySortControl", "uid", "cloneJson", "readStoredJson", "writeStoredJson", "removeStoredItem", "downloadJson", "sessionExportBundle", "scoreKeeperExportBundle", "scoreKeeperPayloadBase", "scoreKeeperPayloadFromRounds", "scoreKeeperPlayers", "scoreKeeperScores", "scoreKeeperWinnerId", "scoreKeeperRound", "normalizeSessionRecord", "sessionOptionLabel", "sessionSelectPlaceholder", "sessionSaveButtonLabel", "sessionToggleLabel", "sessionStatusText", "defaultSessionName", "sanitizeFileName", "exportDateStamp", "exportTimeStamp", "exportPlayerNameSegment", "exportFileName"],
    },
  ];

  for (const expectation of expectations) {
    const source = fs.readFileSync(path.join(repoRoot, expectation.jsPath), "utf8");

    assert.match(source, /window\.GameRoom\?\.BOT_NAMES/, `${expectation.jsPath} should read shared BOT_NAMES`);
    for (const helper of expectation.helpers.filter((name) => name !== "BOT_NAMES")) {
      assert.match(
        source,
        new RegExp(`window\\.GameRoom\\?\\.${helper}|window\\.GameRoom\\.${helper}`),
        `${expectation.jsPath} should delegate ${helper}`,
      );
    }
  }
});
