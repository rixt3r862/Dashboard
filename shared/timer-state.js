(function () {
  const MAX = 86400000;
  function duration(minutes, seconds) {
    if (!/^\d+$/.test(String(minutes)) || !/^\d+$/.test(String(seconds))) return null;
    const m=Number(minutes), s=Number(seconds), ms=(m*60+s)*1000;
    return s<60 && ms>0 && ms<=MAX ? ms : null;
  }
  function remaining(state, now) {
    return state.status === "running" ? Math.max(0, Math.min(state.duration, state.endAt-now)) : state.remaining;
  }
  function restore(value, now) {
    if (!value || !Number.isInteger(value.duration) || value.duration<=0 || value.duration>MAX ||
        !["idle","running","paused","done"].includes(value.status) ||
        !Number.isFinite(value.remaining) || value.remaining<0 || value.remaining>value.duration ||
        (value.status==="running" && !Number.isFinite(value.endAt))) throw Error("Invalid timer.");
    const state={...value};
    state.remaining=remaining(state,now);
    if(state.remaining===0) { state.status="done"; state.endAt=null; }
    return state;
  }
  window.TimerState={duration,remaining,restore};
})();
