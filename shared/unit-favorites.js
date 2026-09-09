(function(){
  const key="unitConverter.v1.favorites", precisionKey="unitConverter.v1.precision";
  const $=id=>document.getElementById(id), mode=$("precisionMode"),digits=$("precisionDigits"),list=$("favoritePairs"),button=$("favoritePair");
  function pair(){return {category:categoryEl.value,from:fromEl.value,to:toEl.value};}
  function same(a,b){return a.category===b.category&&a.from===b.from&&a.to===b.to;}
  function read(){
    const all=JSON.parse(localStorage.getItem(key)||"[]");
    if(!Array.isArray(all)||all.some(p=>!p||!CATEGORIES[p.category]?.units[p.from]||!CATEGORIES[p.category]?.units[p.to]))throw Error();
    return all;
  }
  function render(){
    list.replaceChildren(new Option("Choose a pair",""));
    try{
      const all=read(),current=pair(),saved=all.some(p=>same(p,current));
      button.textContent=saved?"★":"☆";button.setAttribute("aria-pressed",String(saved));
      button.title=button.ariaLabel=saved?"Remove favorite pair":"Favorite this unit pair";
      all.forEach(p=>{const c=CATEGORIES[p.category];list.add(new Option(c.label+": "+c.units[p.from].label+" to "+c.units[p.to].label,JSON.stringify(p)));});
    }catch{$("favoriteStatus").textContent="Favorites unavailable. Stored data has been kept.";}
  }
  button.onclick=()=>{
    try{
      const all=read(),current=pair(),saved=all.some(p=>same(p,current));
      localStorage.setItem(key,JSON.stringify(saved?all.filter(p=>!same(p,current)):[...all,current]));
      render();$("favoriteStatus").textContent=saved?"Favorite removed.":"Favorite saved on this device.";
    }catch{$("favoriteStatus").textContent="Unable to save favorites.";}
  };
  list.onchange=()=>{
    if(list.value==="")return;
    try{
      const chosen=JSON.parse(list.value),p=read().find(item=>same(item,chosen));if(!p)return;
      categoryEl.value=p.category;refillUnits();fromEl.value=p.from;toEl.value=p.to;
      updateInputUi();updateResult();render();
    }catch{$("favoriteStatus").textContent="Unable to load favorite.";}
  };
  function precision(){
    digits.disabled=mode.value==="auto";digits.min=mode.value==="significant"?"1":"0";
  }
  try{
    const p=JSON.parse(localStorage.getItem(precisionKey)||"{}");
    if(ConverterFormat.valid(p.mode,p.digits)){mode.value=p.mode;digits.value=p.digits;}
  }catch{$("favoriteStatus").textContent="Saved precision unavailable.";}
  for(const control of [mode,digits])control.addEventListener("change",()=>{
    precision();
    if(!ConverterFormat.valid(mode.value,Number(digits.value))){$("favoriteStatus").textContent="Choose whole digits from "+digits.min+" to 12.";return;}
    UtilityShell.save(precisionKey,JSON.stringify({mode:mode.value,digits:Number(digits.value)}));
    updateResult();
  });
  for(const control of [categoryEl,fromEl,toEl,swapBtn])control.addEventListener(control===swapBtn?"click":"change",render);
  window.addEventListener("storage",e=>{if(e.key===key||e.key===null)render();});
  precision();render();updateResult();
})();
