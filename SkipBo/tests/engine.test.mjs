import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.mjs';
const fixture = () => ({phase:'playing',current:0,players:[{id:'a',score:0,stock:[9,1],hand:[2,3,4,5,6],discards:[[],[],[],[]]},{id:'b',score:0,stock:[7,8],hand:[],discards:[[],[],[],[]]}],draw:[1,2,3,4,5,6],completed:[],builds:[[],[],[],[]],history:[],target:500,passes:0});
test('deck composition and stock sizes conserve every card',()=>{
  for(let n=2;n<=6;n++) for(const short of [true,false]) {
    const s=E.createGame(Array.from({length:n},(_,i)=>`Player ${i}`),{short});
    assert.equal(s.players[0].stock.length,short?10:n>4?20:30);
    assert.equal(s.players[s.current].hand.length,5);
    assert.deepEqual(E.validateState(s),s);
  }
});
test('stock priority, legal sequence, wild values, and immediate win',()=>{
  const s=fixture();
  assert.equal(E.play(s,{kind:'hand',index:0},0),false);
  assert.equal(E.play(s,{kind:'stock'},0),true);
  assert.equal(s.builds[0].length,1);
  s.players[0].stock=[0];
  assert.equal(E.play(s,{kind:'stock'},0),true);
  assert.equal(s.phase,'roundOver'); assert.equal(s.players[0].score,35);
  assert.equal(E.play(s,{kind:'hand',index:0},0),false);
});
test('completed piles recycle actual wild cards and refill an emptied hand',()=>{
  const s=fixture(); s.builds[0]=[1,2,0,4,5,6,7,8,9,10,11]; s.players[0].hand=[12]; s.draw=[];
  E.play(s,{kind:'hand',index:0},0);
  assert.equal(s.builds[0].length,0);assert.equal(s.players[0].hand.length,5);
  assert.equal(s.draw.length,7);assert.equal(s.completed.length,0);
  assert.equal([...s.draw,...s.players[0].hand].filter(v=>v===0).length,1);
});
test('only discard tops play; discarding ends turn and refills next player',()=>{
  const s=fixture();s.players[0].discards[0]=[1,9];
  assert.equal(E.canPlay(s,{kind:'discard',index:0},0),false);
  assert.equal(E.discard(s,99,0),false);assert.equal(E.discard(s,0,0),true);
  assert.deepEqual(s.players[0].discards[0],[1,9,2]);assert.equal(s.current,1);assert.equal(s.players[1].hand.length,5);
});
test('single round ends match and next round cannot overwrite it',()=>{
 const s=fixture();s.target=1;s.players[0].stock=[1];E.play(s,{kind:'stock'},0);
 assert.equal(s.phase,'finished');assert.equal(s.winnerId,'a');assert.equal(E.nextRound(s),false);
});
test('invalid sessions fail before replacing live state',()=>{
 const s=E.createGame(['A','B']);const copy=structuredClone(s);copy.draw[0]=99;assert.throws(()=>E.validateState(copy));
 copy.draw=s.draw;copy.players[0].hand.push(1);assert.throws(()=>E.validateState(copy));
 assert.throws(()=>E.validateState({}));
});
test('bots do not inspect hidden stocks or opposing hands',()=>{
 const s=fixture(), copy=structuredClone(s);copy.players[0].stock[0]=3;copy.players[1].hand=[0,0,0,0,0];
 assert.deepEqual(E.botMove(s,'hard'),E.botMove(copy,'hard'));
});
test('complete bot simulations preserve cards, score correctly, and restore',()=>{
 for(let n=2;n<=6;n++) {
  const s=E.createGame(Array.from({length:n},(_,i)=>`P${i}`),{short:true,target:1});
  let steps=0;
  while(s.phase==='playing'&&steps++<20000){const m=E.botMove(s,'hard');assert.ok(m.type==='play'?E.play(s,m.source,m.pile):m.type==='discard'?E.discard(s,m.index,m.pile):E.pass(s));if(steps%50===0)E.validateState(s);}
  assert.equal(s.phase,'finished');E.validateState(s);
  const winner=s.players.find(p=>p.id===s.winnerId);assert.equal(winner.score,25+5*s.players.reduce((v,p)=>v+p.stock.length,0));
 }
});
test('blocked empty-handed tables redeal without awarding points',()=>{
 const s=E.createGame(['A','B'],{short:true});
 // Deliberately constructed exhaustion fixture isolates the house-rule transition.
 s.draw=[];s.completed=[];s.builds=[[],[],[],[]];s.players.forEach(p=>{p.hand=[];p.stock=[12];p.discards=[[],[],[],[]];});
 assert.equal(E.pass(s),true);assert.equal(s.phase,'playing');assert.equal(E.pass(s),true);assert.equal(s.phase,'roundOver');
 assert.equal(s.history.length,0);assert.equal(E.nextRound(s),true);assert.equal(s.roundNumber,2);E.validateState(s);
});
test('next rounds rotate the starter and retain scores and history',()=>{
 const s=E.createGame(['A','B','C'],{short:true});let steps=0;const starter=s.current;
 while(s.phase==='playing'&&steps++<20000){const m=E.botMove(s,'hard');if(m.type==='play')E.play(s,m.source,m.pile);else if(m.type==='discard')E.discard(s,m.index,m.pile);else E.pass(s);}
 assert.equal(s.phase,'roundOver');const scores=s.players.map(p=>p.score);assert.equal(E.nextRound(s),true);
 assert.equal(s.current,(starter+1)%3);assert.deepEqual(s.players.map(p=>p.score),scores);assert.equal(s.history.length,1);E.validateState(s);
});
