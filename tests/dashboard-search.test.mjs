import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const catalog = scripts.find((script) => script.includes("const LINKS ="));
const dashboard = scripts.find((script) => script.includes("function allLinks()"));

function setup(saved = new Map()) {
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  // Run the page's catalog and data helpers without its DOM rendering/bootstrap.
  vm.runInContext(catalog, context);
  vm.runInContext('const DASHBOARD_PINS_KEY = "dash.pinnedApps";', context);
  vm.runInContext(dashboard.slice(dashboard.indexOf("      function allLinks()"), dashboard.indexOf("      function scorekeeperStatus()")), context);
  return (expression) => vm.runInContext(expression, context);
}

test("empty search retains category navigation and hides unpinned nested apps", () => {
  const run = setup();
  assert.equal(run('visibleLinks().some(item => item.name === "Time Tools")'), true);
  assert.equal(run('visibleLinks("  ").some(item => item.name === "Timer")'), false);
});

test("search finds every catalog app including nested games, ignoring case and whitespace", () => {
  const run = setup();
  assert.equal(run('allLinks().every(app => visibleLinks(`  ${app.name.toUpperCase()}  `).some(result => result.url === app.url))'), true);
  assert.equal(run('visibleLinks("countdown").some(item => item.name === "Timer")'), true);
  assert.equal(run('visibleLinks("/Hearts/").some(item => item.name === "Hearts")'), true);
  assert.equal(run('visibleLinks("no-such-app-123").length'), 0);
});

test("nested pins survive reload, appear without search, and can be removed", () => {
  const saved = new Map();
  let run = setup(saved);
  run('togglePinned("./Timer.html")');
  run = setup(saved);
  assert.equal(run('visibleLinks().some(item => item.name === "Timer")'), true);
  assert.equal(run('visibleLinks("Hearts").some(item => item.name === "Timer")'), false);
  run('togglePinned("./Timer.html")');
  assert.equal(run('visibleLinks().some(item => item.name === "Timer")'), false);
  assert.equal(run('visibleLinks("Timer").some(item => item.name === "Timer")'), true);
});

test("SkyJo desktop and phone layouts are separately searchable and pinnable", () => {
  const run = setup();
  assert.equal(run('visibleLinks("SkyJo").length'), 2);
  assert.equal(run('visibleLinks("SkyJo").filter(item => item.name.toLowerCase() === "skyjo")[0].url'), "./SkyJo/index.html");
  run('togglePinned("./SkyJo/index.html")');
  assert.equal(run('visibleLinks().filter(item => item.name.startsWith("SkyJo")).length'), 1);
});
