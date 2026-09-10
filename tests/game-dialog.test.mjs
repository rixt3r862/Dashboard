import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';

const source = readFileSync(new URL('../shared/game-dialog.js', import.meta.url), 'utf8');
function fixture() {
  let now = 0, next = 0, dialog;
  const timers = new Map(), fields = new Map();
  const document = { body: { dataset: {dialogGame:'Hearts'}, appendChild() {} } };
  function node() {
    const handlers = new Map();
    return { hidden:false, disabled:false, isConnected:true, textContent:'', value:'',
      setAttribute() {}, focus() {document.activeElement=this;}, select() {this.selected=true;},
      addEventListener(type, fn) {if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
      removeEventListener(type,fn) {handlers.get(type)?.delete(fn);},
      emit(type,event={}) {for(const fn of [...handlers.get(type)||[]])fn({preventDefault(){},stopPropagation(){},...event});},
      querySelector(selector) {if(!fields.has(selector))fields.set(selector,node());return fields.get(selector);},
      showModal() {this.open=true;}, close() {this.open=false;queueMicrotask(()=>this.emit('close'));},
    };
  }
  document.activeElement = node();
  const previous = document.activeElement;
  document.createElement = () => (dialog = node());
  const window = {
    setTimeout(callback,delay) {const id=++next;timers.set(id,{callback,due:now+delay});return id;},
    clearTimeout(id) {timers.delete(id);}
  };
  vm.runInNewContext(source,{window,document,Date:{now:()=>now},queueMicrotask});
  return {api:window.GameDialog,fields,previous,document,get dialog(){return dialog;},
    tick(ms) {now+=ms;for(const [id,timer]of [...timers])if(timer.due<=now){timers.delete(id);timer.callback();}},
    async cancel() {dialog.emit('cancel');await Promise.resolve();await Promise.resolve();},
    async accept() {dialog.emit('submit');await Promise.resolve();await Promise.resolve();}
  };
}
test('confirmation defaults to Cancel and restores focus on Escape', async () => {
  const f=fixture(), answer=f.api.confirm('Delete saved session "<script>"?');
  assert.equal(f.document.activeElement,f.fields.get('[data-cancel]'));
  assert.equal(f.fields.get('#gameDialogMessage').textContent,'Delete saved session "<script>"?');
  assert.equal(f.api.isOpen,true);
  await f.cancel();
  assert.equal(await answer,false);
  assert.equal(f.document.activeElement,f.previous);
  assert.equal(f.api.isOpen,false);
});
test('prompt validates blank names, supports Enter submit, and cancels to null', async () => {
  const f=fixture(), answer=f.api.prompt('Save session','Existing');
  assert.equal(f.fields.get('input').selected,true);
  f.fields.get('input').value='   ';await f.accept();
  assert.equal(f.api.isOpen,true);
  assert.match(f.fields.get('.game-dialog-error').textContent,/Enter/);
  f.fields.get('input').value='  Friday  ';await f.accept();
  assert.equal(await answer,'Friday');
  const canceled=f.api.prompt('Rename session','Friday');await f.cancel();
  assert.equal(await canceled,null);
});
test('gameplay timers pause with their remaining delay and can be canceled while paused', async () => {
  const f=fixture();let calls=0;
  f.api.setTimeout(()=>calls++,100);f.tick(40);
  const answer=f.api.confirm('Reset table?');f.tick(1000);
  assert.equal(calls,0);
  const canceled=f.api.setTimeout(()=>calls+=100,10);f.api.clearTimeout(canceled);
  await f.cancel();await answer;f.tick(59);assert.equal(calls,0);
  f.tick(1);assert.equal(calls,1);
});
test('duplicate requests are rejected and keyboard focus stays within the dialog', async () => {
  const f=fixture(), first=f.api.confirm('Reset table?');
  assert.equal(await f.api.confirm('Delete session?'),false);
  const cancel=f.fields.get('[data-cancel]'), accept=f.fields.get('[data-accept]');
  accept.focus();f.dialog.emit('keydown',{key:'Tab',shiftKey:false});
  assert.equal(f.document.activeElement,cancel);
  cancel.focus();f.dialog.emit('keydown',{key:'Tab',shiftKey:true});
  assert.equal(f.document.activeElement,accept);
  await f.accept();assert.equal(await first,true);
});
test('confirmed reset can cancel old timers before gameplay resumes', async () => {
  const f=fixture();let calls=0;
  const id=f.api.setTimeout(()=>calls++,0);
  const reset=(async()=>{await f.api.confirm('Reset?');f.api.clearTimeout(id);})();
  await f.accept();await reset;f.tick(100);
  assert.equal(calls,0);
});
test('all games load themed dialogs and no native alert/confirm/prompt calls remain', () => {
  function inspect(dir) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      if(entry.name==='tests')continue;
      const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
      if(entry.isDirectory())inspect(path);
      else if(/\.(?:m?js|html)$/.test(entry.name)) {
        assert.doesNotMatch(readFileSync(path,'utf8'),/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/,path.pathname);
      }
    }
  }
  for(const game of ['Hearts','Spades','Crazy8s','FiveCrowns','Phase10','SkyJo','SkipBo','ScoreKeeper']) {
    const root=new URL('../'+game+'/',import.meta.url);inspect(root);
    const html=readFileSync(new URL('index.html',root),'utf8');
    assert.match(html,/shared\/game-dialog\.js/);assert.match(html,/shared\/game-dialog\.css/);
    assert.match(html,/data-dialog-game=/);
  }
});
