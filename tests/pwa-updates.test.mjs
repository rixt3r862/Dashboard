import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function events(extra = {}) {
  const handlers = {};
  return { ...extra, addEventListener(type, fn) { handlers[type] = fn; },
    emit(type, value = {}) { handlers[type]?.(value); } };
}
async function page({ waiting = true, controlled = true } = {}) {
  let reloads = 0;
  let timeout;
  const messages = [];
  const worker = events({ postMessage: message => messages.push(message) });
  const registration = events({ waiting: waiting ? worker : null, installing: null,
    update: async () => {} });
  const serviceWorker = events({ controller: controlled ? {} : null, register: async () => registration });
  const notices = [];
  const location = { hostname: "example.com", reload() { reloads++; } };
  const window = events({ location, setTimeout(fn) { timeout = fn; return 1; },
    clearTimeout() { timeout = null; } });
  const document = {
    currentScript: { dataset: { sw: "./sw.js" } },
    body: { prepend: notice => notices.push(notice) },
    createElement(tag) { return events({ tag, style: {}, children: [], setAttribute() {},
      append(...children) { this.children.push(...children); }, remove() { this.removed = true; } }); },
  };
  vm.runInNewContext(read("shared/pwa.js"), { window, document, location, navigator: { serviceWorker } });
  window.emit("load");
  await Promise.resolve();
  return { registration, serviceWorker, worker, notices, messages, reloads: () => reloads,
    timeout: () => timeout?.(), update: () => notices[0].children[1].emit("click") };
}

test("waiting updates reload only after explicit action and activation", async () => {
  const p = await page();
  assert.equal(p.notices.length, 1);
  assert.equal(p.reloads(), 0);
  p.update(); p.update();
  assert.equal(p.messages.length, 1);
  assert.equal(p.messages[0].type, "APPLY_UPDATE");
  assert.equal(p.reloads(), 0);
  p.serviceWorker.emit("controllerchange");
  p.serviceWorker.emit("controllerchange");
  assert.equal(p.reloads(), 1);
});

test("Later and another tab's activation never reload the current page", async () => {
  const p = await page();
  p.notices[0].children[2].emit("click");
  p.serviceWorker.emit("controllerchange");
  assert.equal(p.notices[0].removed, true);
  assert.equal(p.reloads(), 0);
  assert.equal(p.messages.length, 0);
});

test("first installation does not prompt or reload", async () => {
  const p = await page({ waiting: false, controlled: false });
  p.serviceWorker.controller = {};
  p.serviceWorker.emit("controllerchange");
  assert.equal(p.reloads(), 0);
  assert.equal(p.notices.length, 0);
});

test("newly installed updates and external activation offer an action", async () => {
  const p = await page({ waiting: false });
  p.registration.installing = p.worker;
  p.registration.emit("updatefound");
  p.registration.waiting = p.worker;
  p.worker.emit("statechange");
  assert.equal(p.notices.length, 1);
  const other = await page({ waiting: false });
  other.serviceWorker.emit("controllerchange");
  assert.equal(other.reloads(), 0);
  other.update();
  assert.equal(other.reloads(), 1);
});

test("activation timeout permits retry without reloading", async () => {
  const p = await page();
  p.update(); p.timeout();
  assert.equal(p.reloads(), 0);
  assert.equal(p.notices[0].children[1].disabled, false);
  p.update();
  assert.equal(p.messages.length, 2);
});

test("service worker waits for an explicit activation message", async () => {
  let skips = 0;
  const self = events({ skipWaiting() { skips++; return Promise.resolve(); } });
  const context = { self, caches: { open: async () => ({ addAll: async () => {} }) } };
  vm.runInNewContext(read("sw.js"), context);
  let task;
  const event = { waitUntil(promise) { task = promise; } };
  self.emit("install", event);
  await task;
  assert.equal(skips, 0);
  self.emit("message", { ...event, data: { type: "UNRELATED" } });
  assert.equal(skips, 0);
  self.emit("message", { ...event, data: { type: "APPLY_UPDATE" } });
  await task;
  assert.equal(skips, 1);
});
