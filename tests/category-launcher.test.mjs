import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
function page(category, initial = {}, blocked = false) {
  const saved = new Map(Object.entries(initial)), nodes = new Map(), events = {};
  function element() {
    return { children: [], dataset: {}, handlers: {}, attrs: {}, textContent: "",
      append(...items) { this.children.push(...items); },
      appendChild(item) { this.append(item); },
      replaceChildren(...items) { this.children = items; },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(key, handler) { this.handlers[key] = handler; },
      querySelectorAll() { return this.children.map(item => item.children[1]); },
      focus() {},
    };
  }
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const document = { getElementById: node, createElement: element,
    documentElement: { classList: { toggle() { return false; } } },
    addEventListener(key, handler) { events[key] = handler; } };
  const window = { localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem(key, value) { if (blocked) throw Error("Blocked"); saved.set(key, value); },
  }, matchMedia: () => ({ matches: false }),
    addEventListener(key, handler) { events[key] = handler; } };
  const context = vm.createContext({ window, document });
  vm.runInContext(read("shared/app-catalog.js"), context);
  vm.runInContext(read("shared/category-launcher.js"), context);
  window.CategoryLauncher.init(category, window.DashboardCatalog.forCategory(category));
  return { saved, node, events };
}

test("category pin controls preserve other Dashboard favorites and toggle accessibly", () => {
  const p = page("time", { "dash.pinnedApps": '["./Notepad.html"]' });
  p.node("appsGrid").children[0].children[1].handlers.click();
  assert.deepEqual(JSON.parse(p.saved.get("dash.pinnedApps")), ["./Notepad.html", "./clock.html"]);
  assert.equal(p.node("favorites").children[0].href, "../clock.html");
  assert.equal(p.node("appsGrid").children[0].children[1].attrs["aria-pressed"], "true");
  p.node("appsGrid").children[0].children[1].handlers.click();
  assert.deepEqual(JSON.parse(p.saved.get("dash.pinnedApps")), ["./Notepad.html"]);
});

test("tool navigation records canonical URLs and recent shortcuts refresh on return", () => {
  const p = page("time");
  const anchor = p.node("appsGrid").children[0].children[0];
  p.events.click({ target: { closest: () => anchor } });
  assert.equal(JSON.parse(p.saved.get("dash.recentApps"))[0].url, "./clock.html");
  p.events.pageshow();
  assert.equal(p.node("activity").children[0].href, "../clock.html");
});

test("Game Room resumes only supported saved games and updates after storage events", () => {
  const p = page("games");
  assert.equal(p.node("activity").children.length, 0);
  p.saved.set("dashboard.hearts.autosave.v1", JSON.stringify({
    gameStarted: true, stage: "playing", handNumber: 4,
    players: [{ name: "A" }, { name: "B" }],
  }));
  p.events.storage({ key: "dashboard.hearts.autosave.v1" });
  assert.equal(p.node("activity").children[0].attrs["aria-label"], "Resume Hearts, Hand 4");
});

test("malformed storage and failed writes leave launcher navigation usable", () => {
  const p = page("time", { "dash.pinnedApps": "{}", "dash.recentApps": "{bad" }, true);
  assert.equal(p.node("appsGrid").children.length, 5);
  p.node("appsGrid").children[0].children[1].handlers.click();
  assert.match(p.node("launcherStatus").textContent, /Unable to save/);
  assert.equal(p.node("favorites").children.length, 0);
});
