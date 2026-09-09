import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { explainHint } from '../SkipBo/hints.mjs';
import { botMove } from '../SkipBo/engine.mjs';

function functions(path, names, globals = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf('function ' + name + '(');
    const firstLineEnd = source.indexOf('\n', start);
    const end = source.slice(start, firstLineEnd).endsWith('}')
      ? firstLineEnd : source.indexOf('\n}', start) + 2;
    vm.runInContext(source.slice(start, end), context);
  }
  return context;
}
test('5 Crowns meld feedback explains books, wild runs and invalid groups', () => {
  const c = functions('FiveCrowns/fivecrowns.js', ['isBook', 'isRun', 'meldCheckMessage'], {
    isWild: card => card.rank === 'Joker' || card.rank === '5',
    rankSortValue: card => Number(card.rank)
  });
  const cards = (...ranks) => ranks.map(rank => ({ rank, suit: 'clubs' }));
  assert.match(c.meldCheckMessage(cards('3', '3')), /at least 3/);
  assert.match(c.meldCheckMessage(cards('3', '3', '5')), /Valid book/);
  assert.match(c.meldCheckMessage(cards('6', '8', 'Joker')), /Valid run/);
  assert.match(c.meldCheckMessage(cards('6', '6', '8')), /repeat/);
  assert.match(c.meldCheckMessage(cards('6', '9', '10')), /not enough wild/);
  assert.match(c.meldCheckMessage([{rank:'6',suit:'clubs'}, {rank:'7',suit:'hearts'}, {rank:'8',suit:'clubs'}]), /one suit/);
});
test('Phase 10 path feedback distinguishes readiness and missing group requirements', () => {
  const c = functions('Phase10/phase10.js', ['phasePreviewGroupLabel', 'phasePathFeedback', 'phaseHandKey']);
  assert.equal(c.phasePathFeedback({missingCount:0}), 'All required groups are complete.');
  assert.match(c.phasePathFeedback({missingCount:1,groups:[{meta:{kind:'set',size:3},missingLabel:'one 7'}]}), /Set of 3: needs one 7/);
  assert.equal(c.phaseHandKey([{id:'b'},{id:'a'}]), c.phaseHandKey([{id:'a'},{id:'b'}]));
});
test('Skip-Bo hints explain exposed-card strategy without modifying the game', () => {
  const state = {phase:'playing',current:0,builds:[[],[],[],[]],players:[{stock:[9,1],hand:[4],discards:[[],[],[],[]]}]};
  const before = JSON.stringify(state);
  assert.match(explainHint(state, botMove(state,'hard')), /Reducing your stock/);
  assert.equal(JSON.stringify(state), before);
  state.players[0].stock = [2]; state.players[0].hand = [1];
  assert.match(explainHint(state, botMove(state,'hard')), /ready for your exposed stock/);
  state.players[0].stock = [9]; state.players[0].hand = [4];
  assert.match(explainHint(state, botMove(state,'hard')), /Discarding ends your turn/);
});
test('all local service-worker core assets exist', () => {
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const paths = source.match(/"\.\/[^"]+"/g) || [];
  for (const literal of paths) {
    const path = JSON.parse(literal).split('?')[0];
    assert.ok(existsSync(new URL('../' + path, import.meta.url)), path);
  }
});
