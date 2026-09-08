import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const window = {};
vm.runInNewContext(read("shared/app-catalog.js"), { window });
const catalog = window.DashboardCatalog;

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
