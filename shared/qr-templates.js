(function(){
  // Payload conventions: https://github.com/zxing/zxing/wiki/Barcode-Contents
  const wifiEscape=value=>String(value).replace(/[\\;,:"]/g, "\\$&");
  const cardEscape=value=>String(value).replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/[;,]/g,"\\$&");
  function payload(type,data){
    if(type==="wifi"){
      if(!data.ssid)throw Error("Enter a network name.");
      if(!["WPA","WEP","nopass"].includes(data.security))throw Error("Choose a security type.");
      if(data.security!=="nopass"&&!data.password)throw Error("Enter a network password.");
      return "WIFI:T:"+data.security+";S:"+wifiEscape(data.ssid)+";"+
        (data.security==="nopass"?"":"P:"+wifiEscape(data.password)+";")+"H:"+(data.hidden?"true":"false")+";;";
    }
    if(type==="contact"){
      if(!data.name.trim())throw Error("Enter a contact name.");
      const name=cardEscape(data.name.trim());
      const lines=["BEGIN:VCARD","VERSION:3.0","N:"+name+";;;;","FN:"+name];
      for(const [field,key] of [["ORG","organization"],["TEL","phone"],["EMAIL","email"]]){
        if(data[key]?.trim())lines.push(field+":"+cardEscape(data[key].trim()));
      }
      return [...lines,"END:VCARD"].join("\r\n");
    }
    const text=String(data.text||"").trim();
    if(!text)throw Error("Enter text or a URL.");
    return text;
  }
  function encode(QRCode,element,text){
    const bytes=Array.from(new TextEncoder().encode(text));
    // Size with ASCII bytes, then bypass qrcodejs's legacy UTF-8/BOM conversion.
    const code=new QRCode(element,{text:"x".repeat(bytes.length),width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
    code._oQRCode.dataList[0].parsedData=bytes;
    code._oQRCode.dataCache=null;
    code._oQRCode.make();
    return code;
  }
  function paint(model,size,canvas){
    const count=model.getModuleCount(),scale=Math.floor(size/(count+8));
    if(scale<2)throw Error("Too much data for this size. Choose a larger output or shorten the content.");
    canvas.width=canvas.height=size;
    const context=canvas.getContext("2d");
    context.fillStyle="#ffffff";context.fillRect(0,0,size,size);
    const offset=Math.floor((size-count*scale)/2);
    context.fillStyle="#000000";
    for(let row=0;row<count;row++)for(let col=0;col<count;col++){
      if(model.isDark(row,col))context.fillRect(offset+col*scale,offset+row*scale,scale,scale);
    }
    return canvas;
  }
  window.QrTemplates={payload,encode,paint};
})();
