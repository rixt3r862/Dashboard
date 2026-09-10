import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryController } from '../js/history.js';
import { totalsByPlayerId, determineWinnerFromTotals } from '../js/rules.mjs';
import { ROSTER_KEY, readRoster, saveRosterNames } from '../js/roster.mjs';

function harness(presetKey = 'custom', warning = '') {
  globalThis.window = { addEventListener() {}, GameDialog: { confirm: async () => true } };
  globalThis.HTMLInputElement = class {};
  const state = { presetKey, players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    rounds: [{ n: 1, scores: { a: 60, b: 10 } }, { n: 2, scores: { a: 50, b: 20 } }],
    target: 100, winMode: 'high', mode: 'finished', winnerId: 'a', gameState: 'completed',
    winnerMilestones: [], currentRoundScores: { a: 17, b: 3 }, historyEditingRoundN: 1 };
  const inputs = { a: '60', b: '10' };
  let click, message, saved = 0;
  const table = {
    addEventListener(type, callback) { if (type === 'click' && !click) click = callback; },
    querySelector(selector) {
      const match = selector.match(/data-history-edit-score="([^"]+)"/);
      return match ? { value: inputs[match[1]] } : null;
    }
  };
  const controller = createHistoryController({ state, els: { historyTable: table, roundMsg: {} },
    isPhase10: () => presetKey === 'phase10', showMsg: (_, text) => { message = text; },
    setLive() {}, applyPhase10UiText() {}, save: () => saved++, renderAll() {},
    validateRoundScores: () => ({ ok: true, warning }),
    totalsByPlayerId: () => totalsByPlayerId(state.players, state.rounds),
    determineWinnerFromTotals: entries => determineWinnerFromTotals(entries, state.winMode, state.target)
  });
  controller.bindEvents();
  return { state, inputs, save() {
    return click({ target: { closest: () => ({ getAttribute: key => key === 'data-history-action' ? 'save' : '1' }) } });
  }, get message() { return message; }, get saved() { return saved; } };
}

test('earlier-round correction recalculates totals and reopens a finished game without losing draft', () => {
  const h = harness(); h.inputs.a = '5'; h.save();
  assert.equal(totalsByPlayerId(h.state.players, h.state.rounds).a, 55);
  assert.equal(h.state.winnerId, null);
  assert.equal(h.state.mode, 'playing');
  assert.deepEqual(h.state.currentRoundScores, { a: 17, b: 3 });
  assert.equal(h.state.rounds[1].scores.a, 50);
  assert.equal(h.saved, 1);
});
test('malformed scores and incomplete SkyJo or Phase 10 edits never mutate history', () => {
  for (const invalid of ['3.5', '12oops', '1e2', '9007199254740992']) {
    const h = harness(); const before = JSON.stringify(h.state.rounds);
    h.inputs.a = invalid; h.save();
    assert.equal(JSON.stringify(h.state.rounds), before); assert.equal(h.saved, 0);
  }
  for (const preset of ['skyjo', 'phase10']) {
    const h = harness(preset); const before = JSON.stringify(h.state.rounds);
    h.inputs.a = '4'; h.save();
    assert.equal(JSON.stringify(h.state.rounds), before); assert.equal(h.saved, 0);
  }
});
test('history correction updates the winner and free play remains active', () => {
  const h = harness(); h.inputs.a = '0'; h.inputs.b = '110'; h.save();
  assert.equal(h.state.winnerId, 'b');
  assert.equal(h.state.firstWinnerAt.winnerId, 'b');
  const free = harness(); free.state.gameState = 'free_play'; free.save();
  assert.equal(free.state.mode, 'playing'); assert.equal(free.state.winnerId, null);
});
test('history warning waits for the custom confirmation and cancel preserves scores', async () => {
  const h = harness('custom', 'Check the total.');
  const before = JSON.stringify(h.state.rounds);
  let decide;
  window.GameDialog.confirm = () => new Promise(resolve => { decide = resolve; });
  h.inputs.a = '5';
  const pending = h.save();
  assert.equal(JSON.stringify(h.state.rounds), before);
  decide(false); await pending;
  assert.equal(JSON.stringify(h.state.rounds), before);
  assert.equal(h.saved, 0);
});
test('roster persists trimmed unique names and preserves corrupt or blocked storage', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(saveRosterNames(storage, [' Rick ', 'rick', 'Jane', '']), ['Rick', 'Jane']);
  assert.deepEqual(readRoster(storage), ['Rick', 'Jane']);
  assert.throws(() => saveRosterNames(storage, ['x'.repeat(41)]));
  assert.deepEqual(readRoster(storage), ['Rick', 'Jane']);
  data.set(ROSTER_KEY, '{broken');
  assert.throws(() => saveRosterNames(storage, ['Alex']));
  assert.equal(data.get(ROSTER_KEY), '{broken');
  assert.throws(() => saveRosterNames({ getItem: () => null, setItem() { throw Error('blocked'); } }, ['Alex']));
});
