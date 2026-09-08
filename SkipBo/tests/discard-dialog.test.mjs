import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmDiscard } from '../discard-dialog.mjs';

function setup() {
  class Element extends EventTarget {
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
  }
  const elements = Object.fromEntries(['discardDialog', 'discardMessage', 'cancelDiscard', 'confirmDiscard'].map(id => [id, new Element()]));
  const previous = new Element();
  return { elements, previous, document: { getElementById: id => elements[id], activeElement: previous } };
}
test('dialog names card and pile, focuses Cancel, and restores focus on dismissal', async () => {
  const s = setup();
  const result = confirmDiscard(s.document, 0, 2);
  assert.match(s.elements.discardMessage.textContent, /Skip-Bo wild.*pile 3/);
  assert.equal(s.elements.cancelDiscard.focused, true);
  s.elements.cancelDiscard.dispatchEvent(new Event('click'));
  assert.equal(await result, false);
  assert.equal(s.previous.focused, true);
});
test('accept succeeds once; repeated open is ignored and later dismissal cancels', async () => {
  const s = setup();
  const result = confirmDiscard(s.document, 7, 0);
  assert.equal(await confirmDiscard(s.document, 8, 1), false);
  s.elements.confirmDiscard.dispatchEvent(new Event('click'));
  assert.equal(await result, true);
  const next = confirmDiscard(s.document, 5, 1);
  s.elements.discardDialog.close();
  assert.equal(await next, false);
});
