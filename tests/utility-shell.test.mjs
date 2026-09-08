import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../shared/utility-shell.js', import.meta.url), 'utf8');
function setup(initial = null, blocked = false) {
  const data = new Map(initial ? [['dash.theme', initial]] : []);
  const attrs = {};
  const events = {};
  const select = { value: '', addEventListener: (name, fn) => events[name] = fn };
  const status = { textContent: '', setAttribute() {} };
  const context = {
    document: {
      documentElement: { setAttribute: (k, v) => attrs[k] = v, removeAttribute: k => delete attrs[k] },
      getElementById: id => id === 'utilityTheme' ? select : status,
      addEventListener: (name, fn) => events[name] = fn,
    },
    localStorage: {
      getItem: k => { if (blocked) throw Error(); return data.get(k) ?? null; },
      setItem: (k, v) => { if (blocked) throw Error(); data.set(k, v); },
      removeItem: k => { if (blocked) throw Error(); data.delete(k); },
    },
    addEventListener: (name, fn) => events[name] = fn,
  };
  context.window = context;
  vm.runInNewContext(source, context);
  events.DOMContentLoaded();
  return { context, data, attrs, events, select, status };
}
test('theme honors saved choice, explicit changes, and system mode', () => {
  const s = setup('dark');
  assert.equal(s.attrs['data-theme'], 'dark');
  s.select.value = 'light'; s.events.change();
  assert.equal(s.data.get('dash.theme'), 'light');
  s.select.value = 'system'; s.events.change();
  assert.equal(s.attrs['data-theme'], undefined);
  assert.equal(s.data.has('dash.theme'), false);
});
test('theme follows cross-tab changes and return navigation', () => {
  const s = setup();
  s.data.set('dash.theme', 'dark'); s.events.storage({ key: 'dash.theme' });
  assert.equal(s.select.value, 'dark');
  s.data.clear(); s.events.pageshow();
  assert.equal(s.select.value, 'system');
});
test('blocked storage keeps page theme usable and reports save failure', () => {
  const s = setup(null, true);
  s.select.value = 'dark'; s.events.change();
  assert.equal(s.attrs['data-theme'], 'dark');
  assert.match(s.status.textContent, /Unable to save/);
  assert.equal(s.context.UtilityShell.save('example', 'value'), false);
  assert.equal(s.status.textContent, 'Unable to save on this device.');
});
test('successful save reports device-local persistence', () => {
  const s = setup();
  assert.equal(s.context.UtilityShell.save('example', 'value'), true);
  assert.equal(s.data.get('example'), 'value');
  assert.equal(s.status.textContent, 'Saved on this device.');
});
test('Clock keeps default controls usable with malformed or inaccessible preferences', () => {
  const html = fs.readFileSync(new URL('../clock.html', import.meta.url), 'utf8');
  const code = html.slice(html.indexOf('let prefs = {};'), html.indexOf("chk24.addEventListener('change'"));
  for (const value of ['{broken', 'null', '[]', 'blocked']) {
    const s = setup();
    const controls = {
      chk24: {}, chkSec: {}, fontSelect: {}, FONT_MAP: { system: {} },
      localStorage: { getItem() { if (value === 'blocked') throw Error(); return value; } },
      UtilityShell: s.context.UtilityShell,
    };
    vm.runInNewContext(code, controls);
    assert.equal(controls.chk24.checked, false);
    assert.equal(controls.fontSelect.value, 'system');
    assert.match(s.status.textContent, /could not be restored/);
  }
});
test('all utilities include shared navigation once and parse their inline scripts', () => {
  const files = ['MoneyCounter.html', 'Notepad.html', 'Timer.html', 'clock.html', 'Time Converter.html', 'Time Unit Converter.html', 'Unit Converter.html', 'Date Math Tool.html', 'URL Tool.html', 'QR Tool.html'];
  for (const file of files) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.equal((html.match(/id="utilityTheme"/g) || []).length, 1, file);
    assert.ok(html.includes('src="./shared/utility-shell.js"'), file);
    assert.ok(html.includes('href="./shared/utility-shell.css"'), file);
    assert.ok(!html.includes('Back to Dashboard'), file);
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], { filename: file });
  }
});
