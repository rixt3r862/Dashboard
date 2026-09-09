import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('12-hour conversion distinguishes midnight/noon and preserves seconds',()=>{
  const html=fs.readFileSync(new URL('../Time Converter.html',import.meta.url),'utf8');
  const code=html.slice(html.indexOf('function normalizeTwoDigits('),html.indexOf('function setStatus('));
  const ctx={periodSelect:{value:'AM'}};
  vm.runInNewContext(code,ctx);
  assert.equal(ctx.toPm24HourDisplay(ctx.parsePmInput('12')),'00:00');
  assert.equal(ctx.toPm24HourDisplay(ctx.parsePmInput('9:05:30')),'09:05:30');
  ctx.periodSelect.value='PM';
  assert.equal(ctx.toPm24HourDisplay(ctx.parsePmInput('12')),'12:00');
  assert.equal(ctx.toPm24HourDisplay(ctx.parsePmInput('9:05:30')),'21:05:30');
  assert.equal(ctx.toPmDisplay(ctx.parsePmInput('5')),'5:00 PM');
  for(const v of ['0','13','12:60','9:05:60'])assert.ok(ctx.parsePmInput(v).error);
  assert.equal(ctx.to12HourDisplay(ctx.parseInput('00:00')),'12:00 AM');
});
function clockSetup(){
  const elements=new Map(), events={}, data=new Map();
  const get=id=>{
    if(!elements.has(id))elements.set(id,{value:'',checked:false,options:[{text:'Off'}],selectedIndex:0,clientWidth:300,scrollWidth:600,
      style:{},add(o){this.options.push(o);},addEventListener(n,f){this[n]=f;}});
    return elements.get(id);
  };
  let releases=0,requests=0;
  const sentinel={addEventListener(){},release:async()=>{releases++;}};
  const document={getElementById:get,documentElement:{requestFullscreen:async()=>{document.fullscreenElement=true;}},
    exitFullscreen:async()=>{document.fullscreenElement=null;},addEventListener:(n,f)=>events[n]=f,hidden:false};
  const ctx={document,window:{addEventListener(){}},navigator:{wakeLock:{request:async()=>{requests++;return sentinel;}}},
    localStorage:{getItem:k=>data.get(k)??null},UtilityShell:{save:(k,v)=>data.set(k,v)},
    Option:function(text,value){this.text=text;this.value=value;},Intl,Date,setInterval(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../shared/clock-extras.js',import.meta.url),'utf8'),ctx);
  return {get,events,data,document,requests:()=>requests,releases:()=>releases};
}
test('clock saves date/timezone choices and fits the primary time display',()=>{
  const s=clockSetup();s.get('showDate').checked=true;s.get('showDate').change();
  assert.equal(s.get('clockDate').hidden,false);
  s.get('secondZone').value='UTC';s.get('secondZone').selectedIndex=1;s.get('secondZone').change();
  assert.equal(s.get('secondClock').hidden,false);
  assert.equal(JSON.parse(s.data.get('clock.display.v1')).zone,'UTC');
  assert.equal(s.get('time').style.fontSize,'90px');
});
test('fullscreen reflects browser state; wake lock acquires and releases explicitly',async()=>{
  const s=clockSetup();
  await s.get('clockFullscreen').click();s.events.fullscreenchange();
  assert.equal(s.get('clockFullscreen').textContent,'Exit Fullscreen');
  s.get('keepAwake').checked=true;s.get('keepAwake').change();await Promise.resolve();await Promise.resolve();
  assert.equal(s.requests(),1);
  s.get('keepAwake').checked=false;s.get('keepAwake').change();await Promise.resolve();
  assert.equal(s.releases(),1);
});
