import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const core=fs.readFileSync(new URL('../shared/timer-state.js',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../shared/timer.js',import.meta.url),'utf8');
function setup(data=new Map(), initial=100000){
  let now=initial,resumes=0;
  const elements=new Map(),events={};
  const get=id=>{
    if(!elements.has(id))elements.set(id,{value:'',disabled:false,style:{setProperty(){}},setAttribute(){},addEventListener(n,f){this[n]=f;},replaceChildren(){this.value='';},add(){}});
    return elements.get(id);
  };
  class AudioContext{
    constructor(){this.state='suspended';}
    async resume(){this.state='running';resumes++;}
  }
  const ctx={document:{getElementById:get,querySelector:get,querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},Date:{now:()=>now},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},navigator:{},Option:function(){},crypto:{randomUUID:()=>String(now)},
    AudioContext,addEventListener:(n,f)=>events[n]=f,confirm:()=>true};
  ctx.window=ctx;vm.runInNewContext(core,ctx);vm.runInNewContext(script,ctx);
  return {get,data,ctx,events,setTime:v=>now=v,resumes:()=>resumes};
}
test('running timer survives refresh with a wall-clock deadline; expiry is restored',()=>{
  const s=setup();s.get('startBtn').onclick();s.setTime(110000);
  const restored=setup(s.data,110000);
  assert.equal(restored.get('remainingLabel').textContent,'00:20');
  assert.equal(restored.get('pauseBtn').disabled,false);
  const expired=setup(s.data,140000);
  assert.equal(expired.get('timeLabel').textContent,'Done');
});
test('pause, refresh, resume and reset retain correct remaining duration',()=>{
  const s=setup();s.get('startBtn').onclick();s.setTime(110000);s.get('pauseBtn').onclick();
  const r=setup(s.data,200000);
  assert.equal(r.get('remainingLabel').textContent,'00:20');
  r.get('startBtn').onclick();
  assert.equal(JSON.parse(r.data.get('timer.v1.countdown')).endAt,220000);
  r.get('resetBtn').onclick();assert.equal(r.get('remainingLabel').textContent,'00:30');
});
test('Start initializes audio and keyboard shortcuts ignore form controls',()=>{
  const s=setup();s.get('startBtn').onclick();assert.equal(s.resumes(),1);
  s.events.keydown({repeat:false,key:'r',target:{closest:()=>true}});
  assert.equal(s.get('pauseBtn').disabled,false);
});
test('named presets save, load without starting, confirm overwrite/delete and preserve countdown',()=>{
  const s=setup();s.get('presetName').value='Tea';s.get('savePreset').onclick();
  assert.equal(JSON.parse(s.data.get('timer.v1.presets'))[0].ms,30000);
  s.get('mins').value='2';s.get('secs').value='0';s.get('mins').change();
  s.get('loadPreset').onclick();assert.equal(s.get('remainingLabel').textContent,'00:30');
  assert.equal(s.get('pauseBtn').disabled,true);
  s.ctx.confirm=()=>false;s.get('deletePreset').onclick();assert.equal(JSON.parse(s.data.get('timer.v1.presets')).length,1);
  s.ctx.confirm=()=>true;s.get('deletePreset').onclick();assert.equal(s.data.get('timer.v1.presets'),'[]');
});
test('invalid persisted state and durations are rejected without overwriting stored data',()=>{
  const data=new Map([['timer.v1.countdown','{broken'],['timer.v1.presets','bad']]);
  const s=setup(data);
  assert.equal(data.get('timer.v1.countdown'),'{broken');
  for(const [m,sec] of [['-1','0'],['0','60'],['1.5','0'],['1441','0'],['0','0']])assert.equal(s.ctx.TimerState.duration(m,sec),null);
  assert.equal(s.ctx.TimerState.duration('1440','0'),86400000);
});
