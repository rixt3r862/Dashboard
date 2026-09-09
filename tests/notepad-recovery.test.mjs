import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../shared/notepad-storage.js', import.meta.url), 'utf8'), {window});
const N = window.NotepadStorage;
function storage(failKey) {
  const data = new Map([['notepad.v1.draft','Original note']]);
  return {data,getItem:k=>data.get(k)??null,setItem(k,v){if(k===failKey)throw Error('Quota');data.set(k,v);}};
}
test('replacement preserves exact previous text, including unsaved edits and blank notes', () => {
  const s=storage();
  N.save(s,'Imported','Original plus unsaved edits');
  assert.equal(N.previous(s).text,'Original plus unsaved edits');
  N.save(s,'','Imported');
  assert.equal(N.previous(s).text,'Imported');
  N.save(s,'Recovered','');
  assert.equal(N.previous(s).text,'');
});
test('ordinary saves preserve the existing recovery checkpoint', () => {
  const s=storage();
  N.save(s,'First edit','Original note');
  N.save(s,'More typing');
  assert.equal(N.previous(s).text,'Original note');
});
test('failed backup never overwrites the stored draft; metadata failure still saves', () => {
  const blocked=storage('notepad.v1.previous');
  assert.throws(()=>N.save(blocked,'New','Original note'));
  assert.equal(blocked.getItem('notepad.v1.draft'),'Original note');
  const meta=storage('notepad.v1.meta');
  N.save(meta,'New','Original note');
  assert.equal(meta.getItem('notepad.v1.draft'),'New');
});
test('corrupt recovery data is rejected without deleting it', () => {
  const s=storage();s.data.set('notepad.v1.previous','{broken');
  assert.throws(()=>N.previous(s));
  assert.equal(s.getItem('notepad.v1.previous'),'{broken');
});
test('append preserves content with a single boundary newline when needed', () => {
  assert.equal(N.append('One','Two'),'One\nTwo');
  assert.equal(N.append('One\n','Two'),'One\nTwo');
  assert.equal(N.append('One','\nTwo'),'One\nTwo');
  assert.equal(N.append('','Two'),'Two');
  assert.equal(N.append('One',''),'One');
});
test('failed destructive change keeps the editor text and reports failure', () => {
  const html=fs.readFileSync(new URL('../Notepad.html',import.meta.url),'utf8');
  const code=html.slice(html.indexOf('function replaceNote('),html.indexOf('recoverBtn.addEventListener'));
  const s=storage('notepad.v1.previous');
  let message='';
  const ctx={window:{clearTimeout(){}},saveTimer:1,localStorage:s,NotepadStorage:N,pad:{value:'Unsaved work'},setDraftStatus:m=>message=m};
  vm.runInNewContext(code,ctx);
  assert.equal(ctx.replaceNote('','Cleared'),false);
  assert.equal(ctx.pad.value,'Unsaved work');
  assert.match(message,/Current note was kept/);
});
