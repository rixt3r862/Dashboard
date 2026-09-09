import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(raw='[]', blocked=false) {
  const data=new Map([['notepad.v1.notes',raw]]), elements=new Map();
  const get=id=>{
    if(!elements.has(id)) elements.set(id,{value:'',children:[],addEventListener(){},focus(){},replaceChildren(...v){this.children=v;},add(v){this.children.push(v);}});
    return elements.get(id);
  };
  const context={document:{getElementById:get},window:{confirm:()=>true,addEventListener(){}},
    localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(blocked)throw Error();data.set(k,v);}},
    Option:function(text,value){this.text=text;this.value=value;},crypto:{randomUUID:()=>String(Math.random())},
    pad:{value:'First draft'},replaceNote(text){context.pad.value=text;return true;}};
  vm.runInNewContext(fs.readFileSync(new URL('../shared/notepad-notes.js',import.meta.url),'utf8'),context);
  return {context,data,get};
}
test('named note snapshots survive editing and support explicit overwrite/load/delete',()=>{
  const s=setup();s.get('noteName').value='Shopping';
  s.get('saveNamedNote').onclick();
  const first=JSON.parse(s.data.get('notepad.v1.notes'))[0];
  s.context.pad.value='Changed';
  assert.equal(JSON.parse(s.data.get('notepad.v1.notes'))[0].text,'First draft');
  s.get('loadNamedNote').onclick();assert.equal(s.context.pad.value,'First draft');
  s.context.pad.value='Updated';s.get('saveNamedNote').onclick();
  const notes=JSON.parse(s.data.get('notepad.v1.notes'));
  assert.equal(notes.length,1);assert.equal(notes[0].id,first.id);assert.equal(notes[0].text,'Updated');
  s.get('deleteNamedNote').onclick();
  assert.equal(s.data.get('notepad.v1.notes'),'[]');assert.equal(s.context.pad.value,'Updated');
});
test('cancellation and failed recovery preserve the current text',()=>{
  const s=setup();s.get('noteName').value='Note';s.get('saveNamedNote').onclick();
  s.context.pad.value='Unsaved';s.context.window.confirm=()=>false;
  const before=s.data.get('notepad.v1.notes');
  for(const id of ['loadNamedNote','deleteNamedNote','newNamedNote','saveNamedNote'])s.get(id).onclick();
  assert.equal(s.data.get('notepad.v1.notes'),before);assert.equal(s.context.pad.value,'Unsaved');
  s.context.window.confirm=()=>true;s.context.replaceNote=()=>false;s.get('loadNamedNote').onclick();
  assert.equal(s.context.pad.value,'Unsaved');
});
test('corrupt and unwritable storage is preserved',()=>{
  for(const [raw,blocked] of [['broken',false],['[]',true]]){
    const s=setup(raw,blocked);s.get('noteName').value='Note';s.get('saveNamedNote').onclick();
    assert.equal(s.data.get('notepad.v1.notes'),raw);assert.match(s.get('namedNoteStatus').textContent,/Unable/);
  }
});
