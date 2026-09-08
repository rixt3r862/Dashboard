import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../shared/cashbox.js', import.meta.url), 'utf8'), { window });
const C = window.CashBox;
const denoms = [{key:'one',cents:100,label:'$1'}, {key:'pny',cents:1,label:'Penny'}];
const draft = () => ({depositName:'Weekend',depositDate:'2026-09-08',depositAccount:'00123',depositNotes:'',cash:{one:'3',pny:'2'},checks:['1.23',''],expectedTotal:'5'});
test('amounts reject negative, malformed, exponent, excessive precision and huge values', () => {
  for (const v of ['-1','1.234','1.2.3','1e3','$2','1,000','Infinity','1000000001']) assert.equal(C.money(v),null,v);
  for (const [v,n] of [['',0],['.05',5],['12.30',1230],['0',0],['1.2',120]]) assert.equal(C.money(v),n);
  for (const v of ['-1','2.5','1e3','1000001']) assert.equal(C.count(v),null);
});
test('totals use cents and refuse invalid deposits', () => {
  assert.equal(C.totals(draft(),denoms).total,425);
  assert.equal(C.totals(draft(),denoms).difference,-75);
  const d=draft(); d.cash.one='1.5';
  assert.throws(()=>C.totals(d,denoms));
  d.cash.one='3';d.checks=['-10'];assert.throws(()=>C.totals(d,denoms));
});
test('CSV includes detail, quotes fields, and neutralizes formula-like text', () => {
  const d=draft();d.depositName='=SUM(1,2)';d.depositNotes='He said "yes"\nNext line';
  const csv=C.csv([{draft:d,savedAt:'2026-09-08T12:00:00Z'}],denoms);
  assert.ok(csv.includes("\"'=SUM(1,2)\""));
  assert.ok(csv.includes('He said ""yes""\nNext line'));
  assert.ok(csv.includes('"00123"'));
  assert.ok(csv.includes('"4.25"'));
  assert.ok(csv.includes('Check Amounts'));
});

function historySetup(raw='[]', blocked=false) {
  const elements=new Map(), storage=new Map([['cashbox.deposits.v1',raw]]);
  function element() {return {children:[],value:'Weekend',disabled:false,textContent:'',append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},focus(){},click(){}};}
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  let loaded=null;
  const ctx={document,window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error();storage.set(k,v);}},
    CashBox:C,DENOMS:denoms,toUsd:n=>String(n),calcAll(){},moneyForm:{reportValidity(){}},
    depositNameEl:document.getElementById('name'),readDraft:draft,crypto:{randomUUID:()=>String(storage.size)+Math.random()},
    confirm:()=>true,STORAGE_KEY:'cashbox.form.v1',applyDraft:d=>loaded=d,updateSaveStatus(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../shared/cashbox-history.js',import.meta.url),'utf8'),ctx);
  return {elements,storage,ctx,loaded:()=>loaded};
}
test('history saves snapshots, loads them, and deletes without deleting the draft', () => {
  const s=historySetup();
  s.elements.get('saveDeposit').onclick();
  assert.equal(JSON.parse(s.storage.get('cashbox.deposits.v1')).length,1);
  const row=s.elements.get('depositHistory').children[0];
  row.children[1].onclick();
  assert.equal(s.loaded().depositName,'Weekend');
  row.children[2].onclick();
  assert.equal(s.storage.get('cashbox.deposits.v1'),'[]');
  assert.ok(s.storage.has('cashbox.form.v1'));
});
test('blocked writes and corrupt history retain original data', () => {
  for (const [raw,blocked] of [['{broken',false],['[]',true]]) {
    const s=historySetup(raw,blocked);s.elements.get('saveDeposit').onclick();
    assert.equal(s.storage.get('cashbox.deposits.v1'),raw);
    assert.match(s.elements.get('historyStatus').textContent,/Unable to save/);
  }
});
test('cancelled history actions do not change draft or records', () => {
  const s=historySetup();s.elements.get('saveDeposit').onclick();
  s.ctx.confirm=()=>false;
  const before=s.storage.get('cashbox.deposits.v1'), row=s.elements.get('depositHistory').children[0];
  row.children[1].onclick();row.children[2].onclick();
  assert.equal(s.loaded(),null);assert.equal(s.storage.get('cashbox.deposits.v1'),before);
});
