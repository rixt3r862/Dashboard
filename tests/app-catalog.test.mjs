import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const window = {};
vm.runInNewContext(read("shared/app-catalog.js"), { window });
const catalog = window.DashboardCatalog;

function progressSave(app) {
  const s = { players: [{ name: "A" }, { name: "B" }], gameStarted: true,
    stage: "playing", phase: "playing", turnStage: "draw", mode: "playing",
    roundNumber: 3, handNumber: 2, rounds: [{}, {}] };
  return app.resume.wrapper ? { [app.resume.wrapper]: s } : s;
}

test("all eight game saves produce one canonical resume shortcut each", () => {
  const apps = catalog.apps.filter(app => app.resume);
  assert.equal(apps.length, 8);
  const saves = new Map(apps.map(app => [app.resume.key, JSON.stringify(progressSave(app))]));
  const list = catalog.resumableApps({ getItem: key => saves.get(key) });
  assert.equal(list.length, 8);
  assert.equal(list.filter(app => app.name.startsWith("SkyJo")).length, 1);
  assert.equal(list.find(app => app.name === "Hearts").progress, "Hand 2");
  assert.equal(list.find(app => app.name === "ScoreKeeper").progress, "Round 3");
});

test("completed and reset games do not appear; between-round saves remain available", () => {
  for (const app of catalog.apps.filter(app => app.resume)) {
    const raw = progressSave(app);
    const s = app.resume.wrapper ? raw[app.resume.wrapper] : raw;
    const storage = { getItem: key => key === app.resume.key ? JSON.stringify(raw) : null };
    s.stage = "roundOver"; s.turnStage = "round-end"; s.phase = "roundOver";
    assert.equal(catalog.resumableApps(storage).length, 1, app.name);
    s.stage = "gameOver"; s.turnStage = "game-over"; s.phase = "finished"; s.mode = "finished";
    assert.equal(catalog.resumableApps(storage).length, 0, app.name);
    s.stage = "playing"; s.turnStage = "draw"; s.phase = "playing"; s.mode = "setup";
    s.gameStarted = false; s.players = [];
    assert.equal(catalog.resumableApps(storage).length, 0, app.name);
  }
});

test("corrupt or blocked storage does not prevent valid resume shortcuts", () => {
  assert.equal(catalog.resumableApps({ getItem() { throw Error("Blocked"); } }).length, 0);
  const app = catalog.apps.find(app => app.name === "Hearts");
  const list = catalog.resumableApps({ getItem: key =>
    key === app.resume.key ? JSON.stringify(progressSave(app)) : "{bad" });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "Hearts");
});

test("catalog URLs are unique and resolve to existing local apps", () => {
  assert.equal(new Set(catalog.apps.map(app => app.url)).size, catalog.apps.length);
  for (const app of catalog.apps) {
    assert.ok(app.url.startsWith("./"), app.name);
    const target = new URL(app.url, root);
    target.search = "";
    assert.ok(existsSync(target), app.url);
    if (app.iconImg) assert.ok(existsSync(new URL(app.iconImg, root)));
  }
});

test("category links preserve ordering, metadata, and canonical recent-history keys", () => {
  const expected = {
    games: ["Skip-Bo", "Phase 10", "SkyJo", "SkyJo Mobile", "Hearts", "Spades", "Crazy 8s", "5 Crowns", "ScoreKeeper"],
    time: ["Clock", "24h to 12h Helper", "Timer", "Time Unit Converter", "Date Math Tool"],
  };
  for (const [category, names] of Object.entries(expected)) {
    const entries = catalog.forCategory(category);
    assert.deepEqual(Array.from(entries, app => app.name), names);
    const page = category === "games" ? "Games/index.html" : "TimeTools/index.html";
    for (const app of entries) {
      assert.equal(new URL(app.href, new URL(page, root)).href, new URL(app.dashboardUrl, root).href);
      assert.ok(catalog.apps.some(item => item.url === app.dashboardUrl));
      assert.ok(app.desc && app.icon);
      if (category === "time") assert.ok(app.tag && app.meta.length);
    }
  }
});

test("each launcher loads the catalog before consuming its data", () => {
  for (const [page, variable] of [["index.html", "LINKS"], ["Games/index.html", "GAME_APPS"], ["TimeTools/index.html", "TIME_APPS"]]) {
    const html = read(page);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    const context = vm.createContext({ window: {} });
    let consumed = false;
    for (const [, attributes, body] of scripts) {
      const src = attributes.match(/src="([^"]*app-catalog\.js)"/)?.[1];
      if (src) {
        assert.doesNotMatch(attributes, /\b(?:async|defer)\b/);
        vm.runInContext(readFileSync(new URL(src, new URL(page, root)), "utf8"), context);
      }
      const declaration = body.split("\n").find(line => line.includes("const " + variable + " ="));
      if (declaration) {
        vm.runInContext(declaration, context);
        assert.ok(vm.runInContext(variable + ".length", context) > 0);
        consumed = true;
      }
    }
    assert.ok(consumed, page);
  }
  assert.ok(read("sw.js").includes('"./shared/app-catalog.js"'));
});
