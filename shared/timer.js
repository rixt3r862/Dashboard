(function () {
  const $=id=>document.getElementById(id), KEY="timer.v1.countdown", PRESETS="timer.v1.presets";
  let state={duration:30000,remaining:30000,endAt:null,status:"idle"}, frame=null, audio=null;
  const status=message=>$("timerStatus").textContent=message;
  const active=()=>["running","paused"].includes(state.status);
  function persist(){
    try { localStorage.setItem(KEY,JSON.stringify(state)); }
    catch { status("Unable to save this timer on this device."); }
  }
  function format(ms){
    const seconds=Math.ceil(ms/1000);
    return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
  }
  function fields(){
    $("mins").value=Math.floor(state.duration/60000);
    $("secs").value=(state.duration/1000)%60;
  }
  function render(){
    const left=TimerState.remaining(state,Date.now()), percent=Math.min(100,100*(1-left/state.duration));
    $("timeLabel").textContent=state.status==="done"?"Done":format(left);
    $("remainingLabel").textContent=format(left);
    $("percentLabel").textContent=percent.toFixed(0)+"%";
    $("bar").style.width=percent+"%";
    document.querySelector(".ring").style.setProperty("--angle",percent*3.6+"deg");
    document.querySelector(".progress").setAttribute("aria-valuenow",percent.toFixed(0));
    $("startBtn").disabled=state.status==="running";
    $("startBtn").textContent=state.status==="paused"?"Resume":"Start";
    $("pauseBtn").disabled=state.status!=="running";
    $("resetBtn").disabled=state.status==="idle";
    $("mins").disabled=$("secs").disabled=active();
    document.title=state.status==="done"?"Timer complete":format(left)+" - Timer";
  }
  async function prepareAudio(){
    try{
      if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==="suspended") await audio.resume();
      if(audio.state!=="running") throw Error();
      return true;
    }catch{ status("Sound unavailable. The timer will still finish on screen."); return false; }
  }
  function beep(){
    if(!audio || audio.state!=="running") { status("Timer complete. Sound requires Start or Test Alarm in this tab."); return; }
    try{
      const oscillator=audio.createOscillator(), gain=audio.createGain();
      oscillator.frequency.value=880; oscillator.connect(gain); gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.0001,audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2,audio.currentTime+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001,audio.currentTime+0.5);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start();oscillator.stop(audio.currentTime+0.51);
    }catch{status("Timer complete. Sound unavailable.");}
  }
  function tick(){
    cancelAnimationFrame(frame);frame=null;
    if(state.status==="running" && TimerState.remaining(state,Date.now())===0){
      state.status="done";state.remaining=0;state.endAt=null;
      status("Timer complete.");persist();beep();
      try{navigator.vibrate?.([120,80,120]);}catch{}
    }
    render();
    if(state.status==="running") frame=requestAnimationFrame(tick);
  }
  function start(){
    if(state.status==="running") return;
    if(state.status!=="paused"){
      const ms=TimerState.duration($("mins").value||"0",$("secs").value||"0");
      if(ms===null){status("Enter a duration from 1 second to 24 hours, using whole minutes and seconds (0–59).");return;}
      state.duration=state.remaining=ms;
    }
    state.status="running";state.endAt=Date.now()+state.remaining;
    status("Timer running.");prepareAudio();persist();tick();
  }
  function pause(){
    if(state.status!=="running") return;
    const left=TimerState.remaining(state,Date.now());
    if(!left){tick();return;}
    state.remaining=left;state.status="paused";state.endAt=null;
    status("Timer paused.");persist();tick();
  }
  function reset(){
    state.status="idle";state.remaining=state.duration;state.endAt=null;
    status("Timer reset.");persist();tick();
  }
  function setDuration(ms){
    if(active()&&!window.confirm("Replace the current countdown with this duration?"))return;
    state={duration:ms,remaining:ms,endAt:null,status:"idle"};
    fields();status("Duration loaded.");persist();tick();
  }
  $("startBtn").onclick=start;$("pauseBtn").onclick=pause;$("resetBtn").onclick=reset;
  $("testAlarm").onclick=async()=>{if(await prepareAudio()){status("Test alarm.");beep();}};
  for(const id of ["mins","secs"]) $(id).addEventListener("change",()=>{
    if(active())return;
    const ms=TimerState.duration($("mins").value||"0",$("secs").value||"0");
    if(ms===null){status("Enter a duration from 1 second to 24 hours, with seconds from 0 to 59.");return;}
    setDuration(ms);
  });
  document.querySelectorAll(".preset").forEach(button=>button.onclick=()=>setDuration(Number(button.dataset.sec)*1000));
  document.addEventListener("keydown",e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest("input,textarea,select,button,a,[contenteditable]"))return;
    if(e.code==="Space"){e.preventDefault();state.status==="running"?pause():start();}
    if(e.key.toLowerCase()==="r")reset();
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
  window.addEventListener("pageshow",()=>tick());
  const list=$("savedPresets");
  function readPresets(){
    const presets=JSON.parse(localStorage.getItem(PRESETS)||"[]");
    if(!Array.isArray(presets)||presets.some(p=>!p||typeof p.id!=="string"||typeof p.name!=="string"||
      !Number.isInteger(p.ms)||p.ms<=0||p.ms>86400000||p.ms%1000!==0))throw Error();
    return presets;
  }
  function presetMessage(text){$("presetStatus").textContent=text;}
  function presetList(){
    const selected=list.value;
    list.replaceChildren(new Option("Choose a preset",""));
    try{for(const p of readPresets())list.add(new Option(p.name+" ("+format(p.ms)+")",p.id));list.value=selected;}
    catch{presetMessage("Saved presets unavailable. Stored data has been kept.");}
    $("loadPreset").disabled=$("deletePreset").disabled=!list.value;
  }
  list.onchange=()=>{$("loadPreset").disabled=$("deletePreset").disabled=!list.value;};
  $("savePreset").onclick=()=>{
    const name=$("presetName").value.trim(), ms=TimerState.duration($("mins").value||"0",$("secs").value||"0");
    if(!name||ms===null){presetMessage("Enter a name and a valid duration.");return;}
    try{
      const all=readPresets(), existing=all.find(p=>p.name.toLowerCase()===name.toLowerCase());
      if(existing&&!window.confirm('Replace preset "'+existing.name+'"?'))return;
      const p={id:existing?.id||crypto.randomUUID(),name,ms};
      localStorage.setItem(PRESETS,JSON.stringify([p,...all.filter(item=>item.id!==p.id)]));
      presetList();list.value=p.id;list.onchange();presetMessage("Preset saved on this device.");
    }catch{presetMessage("Unable to save preset. Stored data has been kept.");}
  };
  $("loadPreset").onclick=()=>{
    try{const p=readPresets().find(p=>p.id===list.value);if(p)setDuration(p.ms);}
    catch{presetMessage("Unable to load preset.");}
  };
  $("deletePreset").onclick=()=>{
    try{
      const all=readPresets(),p=all.find(p=>p.id===list.value);
      if(!p||!window.confirm('Delete preset "'+p.name+'"?'))return;
      localStorage.setItem(PRESETS,JSON.stringify(all.filter(item=>item.id!==p.id)));
      presetList();presetMessage("Preset deleted.");
    }catch{presetMessage("Unable to delete preset.");}
  };
  window.addEventListener("storage",e=>{
    if(e.key===PRESETS||e.key===null)presetList();
    if(e.key===KEY||e.key===null)restore();
  });
  function restore(){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw){
        state=TimerState.restore(JSON.parse(raw),Date.now());
        status(state.status==="done"?"Timer completed while away.":state.status==="running"?"Timer restored. Use Test Alarm to enable sound in this tab.":"Timer restored.");
      } else state={duration:30000,remaining:30000,endAt:null,status:"idle"};
    }catch{status("Saved timer unavailable. Stored data has been kept.");}
    fields();tick();
  }
  restore();presetList();
})();
