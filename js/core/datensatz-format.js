/* Shared, lossless record format. A booking with an ID is one independent record. */
(() => {
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const own=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true});
 function encode(data,previous=new Map()){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültige App-Daten.');
  const rows=new Map();
  const put=(path,value)=>{const key=JSON.stringify(path),payload=JSON.stringify(value);if(path.length>40||key.length>2048||new TextEncoder().encode(payload).length>240000)throw Error('Ein einzelner Datensatz ist zu groß. Bitte Inhalt prüfen.');rows.set(key,payload);};
  function walk(value,path,order){
   const extra=order===undefined?{}:{order};
   if(Array.isArray(value)){
    put(path,{type:'array',...extra});const used=new Set();
    const children=value.map((entry,index)=>{
     const hasId=entry&&typeof entry==='object'&&!Array.isArray(entry)&&entry.id!=null;
     let token=hasId?'id:'+String(entry.id):entry===null||typeof entry!=='object'?'v:'+JSON.stringify(entry):'index:'+index;
     if(used.has(token))token+=':duplicate:'+index;used.add(token);
     const next=[...path,'i:'+token],old=previous.get(JSON.stringify(next));
     return {entry,hasId,next,old:old?JSON.parse(old).order:undefined};
    });
    const hasKnownOrder=children.some(child=>Number.isFinite(child.old));
    let last=null;
    children.forEach((child,index)=>{
     let position=hasKnownOrder?child.old:index;
     if(!Number.isFinite(position)||last!==null&&position<=last){
      const following=children.slice(index+1).map(item=>item.old).find(value=>Number.isFinite(value)&&(last===null||value>last));
      position=following===undefined?(last===null?0:last+1):last===null?following-1:(last+following)/2;
     }
     last=position;
     if(child.hasId)put(child.next,{type:'value',value:child.entry,order:position});else walk(child.entry,child.next,position);
    });
   }else if(value!==null&&typeof value==='object'){
    put(path,{type:'object',...extra});for(const key of Object.keys(value))walk(value[key],[...path,'p:'+key]);
   }else put(path,{type:'value',value,...extra});
  }
  walk(data,[]);return rows;
 }
 function decode(rows){
  const root={children:new Map()};
  for(const [key,payload]of rows){
   const path=JSON.parse(key),record=JSON.parse(payload);if(!Array.isArray(path)||path.some(p=>typeof p!=='string'||!/^([pi]):/.test(p))||!['object','array','value'].includes(record.type))throw Error('Ungültiger Datenbankeintrag.');
   let node=root;for(const segment of path){if(!node.children.has(segment))node.children.set(segment,{children:new Map()});node=node.children.get(segment);}node.record=record;
  }
  function build(node){
   if(node.record?.type==='value'){if(node.children.size)throw Error('Widersprüchliche Datenstruktur. Synchronisierung prüfen.');return copy(node.record.value);}
   const children=[...node.children],array=node.record?.type==='array'||(!node.record&&children.length&&children.every(([key])=>key.startsWith('i:')));
   if(array){if(children.some(([key])=>!key.startsWith('i:')))throw Error('Ungültige Liste.');return children.sort((a,b)=>(a[1].record?.order??0)-(b[1].record?.order??0)||a[0].localeCompare(b[0])).map(([,child])=>build(child));}
   const result={};for(const [key,child]of children){if(!key.startsWith('p:'))throw Error('Ungültiger Bereich.');own(result,key.slice(2),build(child));}return result;
  }
  return build(root);
 }
 function label(key,payload){
  try{const path=JSON.parse(key).filter(p=>p.startsWith('p:')).map(p=>p.slice(2));const value=payload&&JSON.parse(payload)?.value;return value?.text||value?.name||path.slice(-2).join(' · ')||'App-Daten';}catch{return 'App-Daten';}
 }
 globalThis.KostentrackerRecords=Object.freeze({encode,decode,label});
})();
