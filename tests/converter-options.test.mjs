import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
  const els=new Map(),data=new Map();
  const get=id=>{
    if(!els.has(id))els.set(id,{value:'',style:{removeProperty(){}},classList:{add(){},remove(){}},clientWidth:500,scrollWidth:500,
      addEventListener(n,f){(this.events??={})[n]=f;},removeAttribute(){},setAttribute(){},appendChild(){},setSelectionRange(){},select(){},focus(){},
      replaceChildren(){this.value='';},add(){}});
    return els.get(id);
  };
  const ctx={document:{getElementById:get,createElement:()=>get('option')},window:{addEventListener(){}},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},
    UtilityShell:{save:(k,v)=>data.set(k,v)},getComputedStyle:()=>({fontSize:'40',paddingLeft:'0',paddingRight:'0'}),
    Option:function(text,value){this.text=text;this.value=value;}};
  vm.runInNewContext(read('shared/converter-format.js'),ctx);ctx.ConverterFormat=ctx.window.ConverterFormat;
  return {ctx,get,data};
}
test('precision formatting validates digit counts and handles small/large values',()=>{
  const {ctx}=setup(),f=ctx.ConverterFormat;
  assert.equal(f.format(1/3,'decimal',4),'0.3333');
  assert.equal(f.format(12345,'significant',3),'12,300');
  assert.equal(f.format(-0,'decimal',2),'0.00');
  assert.equal(f.format(Infinity,'decimal',2),'');
  assert.equal(f.valid('significant',0),false);
  assert.equal(f.valid('decimal',13),false);
});
test('Time Converter restores pairs and precision, rejects stale results and preserves source input',()=>{
  const s=setup();
  for(const [id,v] of [['leftValue','60'],['rightValue','1'],['precisionMode','auto'],['precisionDigits','2']])s.get(id).value=v;
  s.data.set('timeConverter.v1.preferences',JSON.stringify({left:'3600',right:'60',mode:'decimal',digits:3}));
  const html=read('Time Unit Converter.html');
  const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('const UNITS'))[1];
  vm.runInNewContext(script,s.ctx);
  assert.equal(s.get('rightValue').value,'3,600.000');
  s.get('precisionDigits').value='1';s.get('precisionDigits').events.change();
  assert.equal(s.get('leftValue').value,'60');
  assert.equal(s.get('rightValue').value,'3,600.0');
  s.get('leftValue').value='bad';s.get('leftValue').events.input();
  assert.equal(s.get('rightValue').value,'');assert.equal(s.get('copyRight').disabled,true);
});
test('unit favorites persist, load the pair, and remove without changing the input value',()=>{
  const s=setup(),c=s.ctx;
  Object.assign(c,{CATEGORIES:{length:{label:'Length',units:{inch:{label:'Inch'},cm:{label:'cm'}}}},
    categoryEl:s.get('category'),fromEl:s.get('from'),toEl:s.get('to'),swapBtn:s.get('swap'),
    refillUnits(){},updateInputUi(){},updateResult(){}});
  c.categoryEl.value='length';c.fromEl.value='inch';c.toEl.value='cm';
  s.get('precisionMode').value='auto';s.get('precisionDigits').value='2';
  vm.runInNewContext(read('shared/unit-favorites.js'),c);
  s.get('favoritePair').onclick();
  const pairs=JSON.parse(s.data.get('unitConverter.v1.favorites'));
  assert.equal(pairs.length,1);
  c.fromEl.value='cm';c.toEl.value='inch';
  s.get('favoritePairs').value=JSON.stringify(pairs[0]);s.get('favoritePairs').onchange();
  assert.equal(c.fromEl.value,'inch');assert.equal(c.toEl.value,'cm');
  s.get('favoritePair').onclick();assert.equal(s.data.get('unitConverter.v1.favorites'),'[]');
});
