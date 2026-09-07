import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotion } from '../motion.mjs';
function fixture(reduced = false, reject = false) {
  const calls = []; let removed = 0;
  const document = {
    createElement: () => ({ style: {}, setAttribute() {}, remove() { removed++; }, animate(frames, options) { calls.push({frames, options}); return { finished: reject ? Promise.reject(new Error('cancelled')) : Promise.resolve() }; } }),
    body: { appendChild() {} },
  };
  return { motion: createMotion(document, { matchMedia: () => ({ matches: reduced }) }), calls, removed: () => removed };
}
const from = {left:10,top:20,width:70,height:98}, to = {left:200,top:100,width:35,height:49};
test('card flights use Hearts timing, deal stagger, and clean up', async () => {
  const f=fixture(); await f.motion.fly(from,to,7,84);
  assert.equal(f.calls[0].options.duration,620);assert.equal(f.calls[0].options.delay,84);
  assert.match(f.calls[0].frames[1].transform,/translate\(190px,80px\) scale\(0.5,0.5\)/);
  assert.equal(f.removed(),1);
});
test('reduced motion and missing positions skip flights',async()=>{
  const f=fixture(true);await f.motion.fly(from,to);assert.equal(f.calls.length,0);
  const g=fixture();await g.motion.fly(undefined,to);assert.equal(g.calls.length,0);
});
test('cancelled animations remove their floating cards',async()=>{
  const f=fixture(false,true);await assert.rejects(f.motion.fly(from,to));assert.equal(f.removed(),1);
});
