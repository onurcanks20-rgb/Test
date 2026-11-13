Kostentracker.module({
 id:'js/ui/eingabeschutz.js', dependencies:[], session:[], read:[], write:[], replace:false
}, () => {
 'use strict';
 const panelIds=new Set(['reisenAddPanel','reiseAddPanel','versAddPanel','hausAddPanel','freizeitAddPanel','einnahmenAddPanel','kostenAddPanel','geplantAddPanel','sparenInvestierenAddPanel']);
 const drafts=new Map();
 let depth=0,submission=null;
 const navigation=/^(?:goHome|show|backToReisen|closeAusgabenArchiv|open(?:Uebersicht|Haushalt|Freizeit|Einnahmen|Kosten|Versicherungen|GeplanteAusgaben|SparenInvestieren|Reisen|Land|AusgabenArchiv|GlobalArchiv|Grafik|HiddenArchive|ServerSettings|Settings\w*)|setTravelMode)$/;
 const editStart=/^(?:startEdit\w+|editKategorie|editLand|editEintrag|editHaushalt|editGeplanteAusgabe|erneutBuchenEintrag)$/;
 const submissions=/^(?:add(?:Haushalt|Freizeit|Eintrag|Land|Versicherung|Kosten|Einnahme|GeplanteAusgabe|SparenInvestieren)|saveEdit\w+|saveReiseBudget|saveQuickAdd)$/;
 const controls=root=>Array.from(root?.querySelectorAll?.('input,textarea,select')||[]).filter(field=>!field.disabled&&!field.readOnly&&!['button','submit','reset','file'].includes(field.type));
 function visible(root) {
  if(!root||root.isConnected===false)return false;
  for(let node=root;node&&node!==document;node=node.parentElement){if(node.hidden||node.classList?.contains('hidden'))return false;}
  return !root.getClientRects||root.getClientRects().length>0;
 }
 function owner(field) {
  for(let node=field;node&&node!==document;node=node.parentElement)if(panelIds.has(node.id))return node;
  if(!/^(?:edit|reiseBudgetEdit$|reiseVonEdit$|reiseBisEdit$|reiseCurrencyEdit$)/i.test(field?.id||''))return null;
  return field.closest?.('.reise-category-card,.item')||null;
 }
 function values(root) {
  return controls(root).map((field,index)=>({field,key:field.id||String(index),value:String(field.value??''),checked:!!field.checked,type:field.type}));
 }
 function capture(root) {return new Map(values(root).map(value=>[value.key,value]));}
 function scan() {
  const active=new Set();
  for(const field of document.querySelectorAll?.('input,textarea,select')||[]){const root=owner(field);if(root&&visible(root))active.add(root);}
  for(const [root]of drafts)if(!active.has(root))drafts.delete(root);
  for(const root of active){
   if(!drafts.has(root))drafts.set(root,{baseline:capture(root),touched:false,force:false});
   else if(!drafts.get(root).touched)drafts.get(root).baseline=capture(root);
   else {const baseline=drafts.get(root).baseline;for(const value of values(root))if(!baseline.has(value.key))baseline.set(value.key,value);}
  }
 }
 function dirty(root,state) {
  if(!state?.touched||!visible(root))return false;
  return state.force||values(root).some(value=>{
   const previous=state.baseline.get(value.key);
   return previous&&(previous.value!==value.value||(['checkbox','radio'].includes(value.type)&&previous.checked!==value.checked));
  });
 }
 function dirtyRoots(){return [...drafts].filter(([root,state])=>dirty(root,state)).map(([root])=>root);}
 function restore(root) {
  const state=drafts.get(root);if(!state)return;
  for(const value of values(root)){
   const original=state.baseline.get(value.key);if(!original)continue;
   value.field.value=original.value;
   if(['checkbox','radio'].includes(value.type))value.field.checked=original.checked;
  }
  drafts.delete(root);
 }
 function affected(name,args) {
  const all=dirtyRoots();
  if(navigation.test(name)){
   if(name==='show'&&document.getElementById(args[0])&&!document.getElementById(args[0]).classList.contains('hidden'))return [];
   return all;
  }
  if(name==='closeStartQuickAdd')return all.filter(root=>document.getElementById('startQuickAddHost')?.contains(root));
  if(name==='closeCategoryAddPanels'||name==='toggleCategoryAdd')return all.filter(root=>panelIds.has(root.id));
  if(name==='openStartQuickAdd'||name==='erneutBuchenEintrag')return all;
  if(/^cancelEdit/.test(name))return all.filter(root=>Array.from(root.querySelectorAll?.('[onclick]')||[]).some(button=>(button.getAttribute('onclick')||'').includes(name+'(')));
  if(name==='setReiseBudgetEditing')return all.filter(root=>root.classList.contains('reise-budget-editor'));
  if(editStart.test(name)||/^toggle.*(?:Details|Monat|Jahr)$/.test(name)||name==='toggleKategorie')return all.filter(root=>!panelIds.has(root.id));
  return [];
 }
 function hasUnsavedInputs(){scan();return dirtyRoots().length>0;}
 function runWithUnsavedGuard(name,fn,args) {
  if(depth){
   const result=fn(...args);
   if(submission&&['speichern','speichernOhneHomeRender','addItem'].includes(name))submission.saved=result===true;
   return result;
  }
  scan();
  const leaving=affected(name,args);
  if(leaving.length){
   if(!confirm('Ungespeicherte Eingaben verwerfen?\n\nDeine Änderungen wurden noch nicht gespeichert. Mit „Abbrechen“ bleibst du bei deiner Eingabe.'))return false;
   leaving.forEach(restore);
  }
  const previous=new Map([...drafts].map(([root])=>[root,capture(root)]));
  const beforeCopy=name==='erneutBuchenEintrag'?new Map([...panelIds].map(id=>{const root=document.getElementById(id);return [root,capture(root)];})):null;
  const submitting=submissions.test(name);
  if(submitting)submission={saved:false,roots:[...drafts.keys()].filter(root=>root.contains(document.activeElement)||Array.from(root.querySelectorAll?.('[onclick]')||[]).some(button=>(button.getAttribute('onclick')||'').includes(name+'(')))};
  depth++;
  try{return fn(...args);}
  finally{
   depth--;
   // A successful save closes or replaces its form; a validation/storage failure leaves it dirty.
   if(submitting){
    for(const [root,state]of drafts){
     if(!visible(root)||(submission.saved&&submission.roots.includes(root)))drafts.delete(root);
    }
    submission=null;
   }
   // The amount/category/currency buttons update values without native input events.
   if(['setQuickAmount','setQuickCategory','setReiseKategorie','toggleReiseInputCurrency','clearEntryTime'].includes(name)){
    for(const [root,state]of drafts){const before=previous.get(root);if(before&&values(root).some(value=>{const old=before.get(value.key);return old&&(old.value!==value.value||old.checked!==value.checked);}))state.touched=true;}
   }
   scan();
   if(beforeCopy)for(const [root,state]of drafts)if(document.getElementById('startQuickAddHost')?.contains(root)){if(beforeCopy.has(root))state.baseline=beforeCopy.get(root);state.touched=true;state.force=true;}
  }
 }
 function prepare(event){
  const root=owner(event.target);if(!root||!visible(root))return;
  scan();const state=drafts.get(root);if(state&&!state.touched)state.baseline=capture(root);
 }
 function changed(event){
  const root=owner(event.target);if(!root||!visible(root))return;
  // Focus/pointer/beforeinput capture the value before the first edit.
  const state=drafts.get(root);if(state)state.touched=true;
 }
 for(const type of ['pointerdown','focusin','beforeinput'])document.addEventListener(type,prepare,true);
 for(const type of ['input','change'])document.addEventListener(type,changed,true);
 // Do not navigate or reset a form on visibilitychange/pageshow/background resume.
 window.addEventListener('beforeunload',event=>{if(hasUnsavedInputs()){event.preventDefault();event.returnValue='';}});
 new MutationObserver(()=>{if(!depth)scan();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
 document.addEventListener('kostentracker:boot-complete',scan);
 scan();
 return {runWithUnsavedGuard,hasUnsavedInputs};
});
