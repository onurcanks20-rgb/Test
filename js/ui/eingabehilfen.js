Kostentracker.module({
  "id":"js/ui/eingabehilfen.js",
  "dependencies":["compareEntriesNewest","merchantDestination","validMerchantDestination","setQuickCategory","setReiseKategorie","toggleCategoryAdd"],
  "session":["aktuellesLand"],"read":["Haushalt","Freizeit","Reisen","Einstellungen"],"write":[],"replace":false
},(context,dependencies)=>{
"use strict";
const fields={hausText:{area:'Haushalt',input:'hausKategorie',grid:'hausKategorieGrid',quick:'haus'},freizeitText:{area:'Freizeit',input:'freizeitKategorie',grid:'freizeitKategorieGrid',quick:'freizeit'},text:{area:'Reisen',input:'kategorieSelect',grid:'reiseKategorieGrid'}};
const emptyActions={
 haushalt:['hausAddPanel','hausBetrag','＋ Ausgabe hinzufügen'],freizeit:['freizeitAddPanel','freizeitBetrag','＋ Ausgabe hinzufügen'],
 einnahmen:['einnahmenAddPanel','einnahmenText','＋ Einnahme hinzufügen'],fixkosten:['kostenAddPanel','costText','＋ Fixkosten hinzufügen'],
 versicherungen:['versAddPanel','versName','＋ Versicherung hinzufügen'],geplant:['geplantAddPanel','geplantText','＋ Ausgabe planen'],
 sparen:['sparenInvestierenAddPanel','sparenInvestierenBetrag','＋ Sparbetrag hinzufügen'],reisen:['reisenAddPanel','landInput','＋ Reise hinzufügen']
};
const boxes=new Map();
function merchantSuggestionKey(value){return String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');}
function merchantSuggestions(fieldId,query=''){
 const config=fields[fieldId];if(!config)return [];
 const area=config.area;
 const source=area==='Reisen'?context.repository.view.Reisen?.[context.session.aktuellesLand]:context.repository.view[area];
 const rows=Object.entries(source||{}).filter(([,list])=>Array.isArray(list)).flatMap(([category,list])=>list.filter(row=>row&&typeof row==='object').map(row=>area==='Reisen'?{...row,kategorie:category}:row)).sort(dependencies.compareEntriesNewest);
 const found=new Map(),term=merchantSuggestionKey(query);
 const categories=area==='Reisen'?Object.keys(source||{}).filter(key=>Array.isArray(source[key])):null;
 function add(name,category){
   name=String(name||'').trim().replace(/\s+/g,' ');const key=merchantSuggestionKey(name);
   if(name.length<2||name.length>200||!key||found.has(key)||key===merchantSuggestionKey(category))return;
   if(area==='Reisen'){if(!categories.includes(category))return;}
   else {
     const assigned=dependencies.merchantDestination(name);
     if(assigned&&assigned.area!==area)return;
     if(assigned)category=assigned.category;
     if(!dependencies.validMerchantDestination(area,category))return;
   }
   found.set(key,{name,category,key});
 }
 for(const row of rows)add(row._serverMerchant||row.text,row.kategorie);
 if(area!=='Reisen')for(const rule of context.repository.view.Einstellungen?.haendlerRegeln||[])if(rule.area===area)add(rule.merchant,rule.category);
 return [...found.values()].filter(row=>!term||row.key.includes(term)).sort((a,b)=>Number(b.key.startsWith(term))-Number(a.key.startsWith(term))).slice(0,4);
}
function hideMerchantSuggestions(fieldId){const box=boxes.get(fieldId);box?.classList.add('hidden');}
function chooseMerchantSuggestion(fieldId,key){
 const input=document.getElementById(fieldId),config=fields[fieldId];if(!input||!config)return;
 const found=merchantSuggestions(fieldId,input.value).find(row=>row.key===key);if(!found)return;
 input.value=found.name;
 if(config.area==='Reisen')dependencies.setReiseKategorie(found.category,null,false);
 else dependencies.setQuickCategory(config.quick,found.category,null);
 for(const b of document.querySelectorAll('#'+config.grid+' .quick-category-btn'))b.classList.toggle('selected',b.dataset.category===found.category);
 hideMerchantSuggestions(fieldId);
}
function renderMerchantSuggestions(fieldId){
 const input=document.getElementById(fieldId);if(!input||!fields[fieldId])return;
 let box=boxes.get(fieldId);
 if(!box){
   box=document.createElement('div');box.id=fieldId+'Suggestions';box.className='merchant-suggestions hidden';box.setAttribute('role','group');box.setAttribute('aria-label','Händler vorschlagen');
   input.insertAdjacentElement('afterend',box);input.setAttribute('aria-controls',box.id);boxes.set(fieldId,box);
 }
 box.replaceChildren();const options=merchantSuggestions(fieldId,input.value);
 for(const option of options){
   const b=document.createElement('button');b.type='button';b.className='merchant-suggestion';
   const name=document.createElement('span');name.textContent=option.name;
   const category=document.createElement('small');category.textContent=option.category;
   b.append(name,category);b.addEventListener('click',()=>chooseMerchantSuggestion(fieldId,option.key));box.appendChild(b);
 }
 box.classList.toggle('hidden',options.length===0);
}
function openEmptyAdd(area){
 const action=emptyActions[area];if(!action)return;
 const [panelId,focusId]=action,panel=document.getElementById(panelId);
 if(!panel)return;
 if(panel.classList.contains('hidden'))dependencies.toggleCategoryAdd(panelId,focusId);
 else document.getElementById(focusId)?.focus();
 panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function appendEmptyAction(host,area){
 const action=emptyActions[area];if(!host||!action)return;
 const target=host.querySelector('.empty-state')||host;
 const b=document.createElement('button');b.type='button';b.className='empty-state-add';b.textContent=action[2];b.addEventListener('click',()=>openEmptyAdd(area));target.appendChild(b);
}
document.addEventListener('input',event=>{if(fields[event.target?.id])renderMerchantSuggestions(event.target.id);});
document.addEventListener('focusin',event=>{if(fields[event.target?.id])renderMerchantSuggestions(event.target.id);});
document.addEventListener('focusout',event=>{
 const id=event.target?.id;if(!fields[id])return;
 const box=boxes.get(id);if(box?.contains(event.relatedTarget))return;
 setTimeout(()=>{if(document.activeElement!==document.getElementById(id)&&!box?.contains(document.activeElement))hideMerchantSuggestions(id);},150);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const id of boxes.keys())hideMerchantSuggestions(id);});
document.addEventListener('pointerdown',event=>{for(const [id,box]of boxes)if(event.target!==document.getElementById(id)&&!box.contains(event.target))hideMerchantSuggestions(id);},{passive:true});
return {merchantSuggestionKey,merchantSuggestions,chooseMerchantSuggestion,renderMerchantSuggestions,hideMerchantSuggestions,openEmptyAdd,appendEmptyAction};
});
