/* Read-only, semantic comparison of the current app data with a saved snapshot. */
(() => {
 'use strict';
 const areas=new Set(['Haushalt','Freizeit','Einnahmen','Versicherungen','Laufende Kosten','Geplante Ausgaben','Sparen & Investieren','Reisen']);
 const names={Einstellungen:'Einstellungen',ReisenMeta:'Reiseplanung',budget:'Budget',von:'Von',bis:'Bis',waehrung:'Währung',gehaltstag:'Gehaltstag',startgehaelter:'Gehälter',geloeschteKategorien:'Kategorien',fix:'Fixkosten'};
 const stable=value=>value===undefined?'[missing]':JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const same=(a,b)=>stable(a)===stable(b);
 const currency=value=>Number(value).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
 const display=value=>Array.isArray(value)?(value.map(item=>typeof item==='object'?'Auswahl':String(item)).join(', ')||'Leer'):value===undefined?'Nicht vorhanden':value===null?'Leer':typeof value==='boolean'?(value?'Ja':'Nein'):typeof value==='object'?'Gespeicherte Auswahl':String(value);
 const pathLabel=path=>path.map(p=>names[p]||(/^\d{1,2}$/.test(p)?'Monat '+p:p)).join(' · ');
 function collect(data){
  const entries=new Map(),other=new Map(),duplicates=new Map();
  function visit(value,path){
   if(Array.isArray(value)){
    if(areas.has(path[0])&&path[0]!=='ReisenMeta'){
     for(const entry of value){
      if(!entry||typeof entry!=='object'||Array.isArray(entry)){other.set(JSON.stringify(path),{path,value});return;}
      const identity=entry.id!=null?'id:'+typeof entry.id+':'+entry.id:'legacy:'+stable([entry.text||entry.name||'',entry.datum||'',entry.kategorie||'']);
      const key=path[0]+':'+identity,index=duplicates.get(key)||0;duplicates.set(key,index+1);entries.set(key+':'+index,{value:entry,path});
     }
     // Empty category/country structures are meaningful even without bookings.
     other.set(JSON.stringify(path),{path,value:{$category:true}});return;
    }
    other.set(JSON.stringify(path),{path,value});return;
   }
   if(value&&typeof value==='object'){
    if(!Object.keys(value).length)other.set(JSON.stringify(path),{path,value:{}});
    for(const [key,item]of Object.entries(value))visit(item,[...path,key]);
   }else other.set(JSON.stringify(path),{path,value});
  }
  visit(data,[]);return {entries,other};
 }
 function entryDescription(record){const e=record.value;return [e.text||e.name||e.kategorie||'Buchung',e.betrag!=null?currency(e.betrag):'',e.datum||'',pathLabel(record.path)].filter(Boolean).join(' · ');}
 function entryChanges(before,after){
  const a=before.value,b=after.value,parts=[];
  const fieldNames={text:'Beschreibung',name:'Name',datum:'Datum',uhrzeit:'Uhrzeit',kategorie:'Kategorie',wiederholung:'Wiederholung',intervall:'Intervall',haendler:'Händler',bereich:'Bereich',originalAmount:'Originalbetrag',originalCurrency:'Währung',betragEuro:'Eurobetrag',betrag:'Betrag'};
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
   if(key==='id'||same(a[key],b[key]))continue;
   const show=v=>key==='betrag'||key==='betragEuro'?v===undefined?'Nicht vorhanden':currency(v):display(v);
   parts.push((fieldNames[key]||'Weitere Angabe')+': '+show(a[key])+' → '+show(b[key]));
  }
  if(!same(before.path,after.path))parts.push('Zuordnung: '+pathLabel(before.path)+' → '+pathLabel(after.path));
  return parts.join(' · ');
 }
 function compare(current,target){
  const before=collect(current),after=collect(target),result={added:[],removed:[],changed:[],other:[]};
  for(const [key,entry]of before.entries){const next=after.entries.get(key);if(!next)result.removed.push({title:entryDescription(entry),detail:''});else if(!same(entry.value,next.value)||!same(entry.path,next.path))result.changed.push({title:entryDescription(next),detail:entryChanges(entry,next)});}
  for(const [key,entry]of after.entries)if(!before.entries.has(key))result.added.push({title:entryDescription(entry),detail:''});
  for(const key of new Set([...before.other.keys(),...after.other.keys()])){
   const a=before.other.get(key),b=after.other.get(key);if(a&&b&&same(a.value,b.value))continue;const record=b||a,path=record.path;
   const category=record.value?.$category;
   const show=value=>path.at(-1)==='budget'&&typeof value==='number'?currency(value):display(value);
   result.other.push({title:pathLabel(path)||'App-Daten',detail:category?(b?'Kategorie wieder hinzufügen':'Kategorie entfernen'):show(a?.value)+' → '+show(b?.value)});
  }
  result.total=result.added.length+result.removed.length+result.changed.length+result.other.length;return result;
 }
 globalThis.KostentrackerBackupDiff=Object.freeze({compare,stable});
})();
