(function(){
  function fields(raw){
    const url=new URL(raw.trim());
    const rows=[["Protocol",url.protocol],["Host",url.hostname],["Port",url.port],
      ["Path",url.pathname],["Query",url.search],["Fragment",url.hash]];
    if(url.username)rows.push(["Username",url.username]);
    if(url.password)rows.push(["Password",url.password,true]);
    for(const [key,value] of url.searchParams)rows.push(["Parameter: "+key,value]);
    return rows;
  }
  function render(raw){
    const container=document.getElementById("urlParts"),status=document.getElementById("urlPartsStatus");
    container.replaceChildren();status.textContent="";
    if(!raw.trim())return;
    let rows;
    try{rows=fields(raw);}catch{status.textContent="Enter an absolute URL, including its scheme (for example https://).";return;}
    for(const [label,value,secret] of rows){
      const row=document.createElement("div");row.className="url-part";
      const title=document.createElement("strong");title.textContent=label;
      const text=document.createElement("input");text.type=secret?"password":"text";text.readOnly=true;
      text.value=value;text.setAttribute("aria-label",label);
      const button=document.createElement("button");button.type="button";button.className="mini-button";
      button.textContent="Copy";button.disabled=!value;button.setAttribute("aria-label","Copy "+label);
      button.onclick=async()=>{
        try{await navigator.clipboard.writeText(value);status.textContent=label+" copied.";}
        catch{text.focus();text.select();status.textContent="Copy unavailable. Field selected.";}
      };
      row.append(title,text,button);container.append(row);
    }
  }
  window.UrlFields={fields,render};
  render(document.getElementById("source").value);
})();
