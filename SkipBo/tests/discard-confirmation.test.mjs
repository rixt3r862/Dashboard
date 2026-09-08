import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../engine.mjs';

const source = fs.readFileSync(new URL('../skipbo.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf("document.addEventListener('click'"), source.indexOf("$('hint').onclick"));
function setup(accept, value = 7) {
  const state = E.createGame(['You', 'Bot'], { short: true, target: 1 });
  state.current = 0;
  state.players[0].hand[0] = value;
  let click;
  const prompts = [], moves = [];
  const context = {
    state, selected: { kind: 'hand', index: 0 }, moving: false,
    humanTurn: () => state.current === 0 && state.phase === 'playing',
    confirm: message => { prompts.push(message); return accept; },
    moveWithAnimation: (move, mutate) => { moves.push(move); mutate(); },
    E, document: { addEventListener: (_, fn) => click = fn, querySelector: () => null },
    same: (a, b) => a?.kind === b.kind && a?.index === b.index,
    render() {}, message: '',
  };
  vm.runInNewContext(handler, context);
  return { state, context, prompts, moves, click: dataset => click({ target: { closest: () => ({ dataset }) } }) };
}
test('cancel preserves the entire table and selected hand card', () => {
  const s = setup(false);
  const before = JSON.stringify(s.state);
  s.click({ discard: '2' });
  assert.equal(JSON.stringify(s.state), before);
  assert.equal(s.context.selected.index, 0);
  assert.equal(s.moves.length, 0);
  assert.deepEqual(s.prompts, ['Discard 7 onto discard pile 3? This will end your turn.']);
});
test('confirmation discards exactly once and advances the turn', () => {
  const s = setup(true, 0);
  s.click({ discard: '1' });
  assert.match(s.prompts[0], /Skip-Bo wild.*pile 2/);
  assert.equal(s.state.players[0].discards[1].at(-1), 0);
  assert.equal(s.state.current, 1);
  assert.equal(s.moves.length, 1);
  s.click({ discard: '1' });
  assert.equal(s.moves.length, 1);
});
test('selecting a discard top does not ask to discard', () => {
  const s = setup(false);
  s.context.selected = null;
  s.click({ discard: '0' });
  assert.equal(s.context.selected.kind, 'discard');
  assert.equal(s.prompts.length, 0);
  assert.equal(s.moves.length, 0);
});
