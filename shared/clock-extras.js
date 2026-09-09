(function () {
  const $=id=>document.getElementById(id), key="clock.display.v1";
  const zone=$("secondZone"), date=$("showDate"), awake=$("keepAwake"), fullscreen=$("clockFullscreen");
  const message=text=>$("clockStatus").textContent=text;
  let lock=null, pending=false, wantAwake=false;
  let zones=["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo","Australia/Sydney"];
  try{ if(Intl.supportedValuesOf) zones=[...new Set(["UTC",...Intl.supportedValuesOf("timeZone")])]; }catch{}
  zones.forEach(value=>zone.add(new Option(value.replaceAll("_"," "),value)));
  try{
    const prefs=JSON.parse(localStorage.getItem(key)||"{}");
    date.checked=prefs?.showDate===true;
    if(zones.includes(prefs?.zone))zone.value=prefs.zone;
  }catch{message("Clock display preferences could not be restored.");}
  function save(){
    UtilityShell.save(key,JSON.stringify({showDate:date.checked,zone:zone.value}),"clockStatus");
    update();
  }
  function update(){
    const now=new Date();
    $("clockDate").hidden=!date.checked;
    $("clockDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    $("secondClock").hidden=!zone.value;
    if(zone.value){
      $("secondClock").textContent=zone.options[zone.selectedIndex].text+" · "+
        new Intl.DateTimeFormat(undefined,{timeZone:zone.value,weekday:"short",month:"short",day:"numeric",
          hour:"numeric",minute:"2-digit",second:$("toggle-seconds").checked?"2-digit":undefined,
          hour12:!$("toggle-24h").checked}).format(now);
    }
    const time=$("time");
    time.style.fontSize="180px";
    const available=time.clientWidth;
    if(available && time.scrollWidth>available)time.style.fontSize=Math.floor(180*available/time.scrollWidth)+"px";
  }
  date.addEventListener("change",save);zone.addEventListener("change",save);
  fullscreen.disabled=!document.documentElement.requestFullscreen;
  fullscreen.addEventListener("click",async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{message("Fullscreen is unavailable in this browser.");}
  });
  document.addEventListener("fullscreenchange",()=>{
    fullscreen.textContent=document.fullscreenElement?"Exit Fullscreen":"Fullscreen";
    update();
  });
  async function acquire(){
    if(pending || lock || !wantAwake || document.hidden)return;
    pending=true;
    try{
      const next=await navigator.wakeLock.request("screen");
      if(!wantAwake || document.hidden){await next.release();return;}
      lock=next;
      next.addEventListener("release",()=>{
        if(lock===next)lock=null;
        if(wantAwake)message("Screen-awake request released by the browser.");
      });
      message("Screen will stay awake while this page is visible.");
    }catch{
      wantAwake=false;awake.checked=false;message("Unable to keep the screen awake.");
    }finally{pending=false;}
  }
  awake.disabled=!navigator.wakeLock;
  if(awake.disabled)awake.title="Screen wake lock is unavailable in this browser.";
  awake.addEventListener("change",()=>{
    wantAwake=awake.checked;
    if(wantAwake)acquire();
    else {
      const current=lock;lock=null;
      if(current)current.release().catch(()=>message("Unable to release the screen-awake request."));
      message("Screen-awake request off.");
    }
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){acquire();update();}});
  window.addEventListener("resize",update);
  window.addEventListener("pagehide",()=>{wantAwake=false;awake.checked=false;if(lock)lock.release().catch(()=>{});lock=null;});
  for(const id of ["toggle-24h","toggle-seconds"])$(id).addEventListener("change",update);
  update();setInterval(update,1000);
})();
