Kostentracker.module({
 id:'js/ui/kategorien-editor.js',
 dependencies:['renderVersicherungen','saveEditVersicherung','renderSparenInvestieren','saveEditSparenInvestieren','renderEinnahmen','saveEditEinnahme','renderGeplanteAusgaben','saveEditGeplanteAusgabe','renderHaushalt','saveEditHaushalt','renderFreizeit','saveEditFreizeit','renderListe','saveEditReise','renderReiseBudget','renderLaender','renderHomeUebersicht','renderUebersicht','decorateReminderControls','reminderControlHtml','recurringChanges','recurringAmount','recurringDateValid','freshCostProposal','formatBetragText','formatDatum','parseISODate','isoAusDate','datumMitSicheremTag','heuteISO','getGehaltszeitraum','speichern','cancelEditCategoryEditor'],
 session:['state','aktuellesLand'],read:['Versicherungen','Sparen & Investieren','Einnahmen','Geplante Ausgaben','Haushalt','Freizeit','Reisen'],write:['Versicherungen','Sparen & Investieren','Einnahmen','Geplante Ausgaben','Haushalt','Freizeit','Reisen'],replace:false
},(context,d)=>{
 'use strict';
 const $=id=>document.getElementById(id),dialog=$('categoryEditDialog');
 // Reuse the category's existing detail form and save routine, including its
 // time, currency, planned-budget and recurrence validation. Move the live form
 // rather than copying HTML or introducing a second set of field IDs.
 const configs={
  versicherungen:{key:'Versicherungen',label:'Versicherungen',state:'editVersicherungId',render:'renderVersicherungen',save:'saveEditVersicherung',field:'editName-',reminder:'versicherungen'},
  'sparen-investieren':{key:'Sparen & Investieren',label:'Sparen & Investieren',state:'editSparenInvestierenId',render:'renderSparenInvestieren',save:'saveEditSparenInvestieren',field:'editSparenBetrag-',reminder:'sparen'},
  einnahmen:{key:'Einnahmen',label:'Einnahmen',state:'editEinnahmeId',render:'renderEinnahmen',save:'saveEditEinnahme',field:'editEinnahmenText-',reminder:'einnahmen'},
  'geplante-ausgaben':{key:'Geplante Ausgaben',label:'Geplante Ausgaben',state:'editGeplanteAusgabeId',render:'renderGeplanteAusgaben',save:'saveEditGeplanteAusgabe',field:'editGeplantText-',reminder:'geplant'},
  haushalt:{key:'Haushalt',label:'Haushalt',state:'editHaushaltId',render:'renderHaushalt',save:'saveEditHaushalt',field:'editBetrag-',reminder:'haushalt'},
  freizeit:{key:'Freizeit',label:'Freizeit',state:'editFreizeitId',render:'renderFreizeit',save:'saveEditFreizeit',field:'editFreizeitBetrag-',reminder:'freizeit'},
  reisen:{key:'Reisen',label:'Reisen',state:'editReiseId',render:'renderListe',save:'saveEditReise',field:'editBetrag-',reminder:'reisen'}
 };
 let active=null,mode='details',overflow='',fallback=[];
 function findEntry(kind,id){
  const cfg=configs[kind];if(!cfg)return null;const data=context.repository.view[cfg.key];
  const lists=Array.isArray(data)?[data]:Object.values(kind==='reisen'?data?.[context.session.aktuellesLand]||{}:data||{});
  for(const list of lists)if(Array.isArray(list)){const e=list.find(x=>String(x.id)===String(id));if(e)return e;}return null;
 }
 function recurring(kind,e){return kind==='versicherungen'||kind==='sparen-investieren'||['einnahmen','geplante-ausgaben'].includes(kind)&&['monatlich','jaehrlich'].includes(e.wiederholung);}
 function mountDetails(){
  const {kind,id,cfg}=active;$('categoryEditDetails').replaceChildren();
  context.session.state[cfg.state]=id;d[cfg.render]();
  const form=$(cfg.field+id)?.closest('.booking-edit-form');
  if(!form){context.session.state[cfg.state]=null;d[cfg.render]();return false;}
  d.decorateReminderControls(form);
  if(!form.querySelector('[data-reminder-key]')){const host=document.createElement('div');host.innerHTML=d.reminderControlHtml('edit:'+cfg.reminder+':'+id,findEntry(kind,id));form.appendChild(host);}
  for(const button of form.querySelectorAll('button[onclick]')){
   const code=button.getAttribute('onclick')||'';
   if(/(?:saveEdit|cancelEdit)\w*\(/.test(code))button.parentElement.classList.add('hidden');
  }
  for(const group of form.querySelectorAll('.recurring-options')){
   group.open=false;const title=group.querySelector('summary');if(title)title.textContent='Laufzeit & vorgemerkte Änderungen';
  }
  $('editCategoryReminderMark').value='';
  const days=form.querySelector('.reminder-days input');if(days)days.id='editCategoryReminderDays';
  form.querySelector('.reminder-control')?.addEventListener('click',event=>{if(event.target.closest('.reminder-toggle')){$('editCategoryReminderMark').value=String(Number($('editCategoryReminderMark').value||0)+1);$('editCategoryReminderMark').dispatchEvent(new Event('input',{bubbles:true}));}});
  $('categoryEditDetails').appendChild(form);
  // Remove the empty editing card from the underlying category page.
  context.session.state[cfg.state]=null;d[cfg.render]();
  return true;
 }
 function openCategoryEditor(kind,id){
  const cfg=configs[kind],e=findEntry(kind,id);if(!cfg||!e)return false;
  if(active)dismissCategoryEditor();active={kind,id:e.id,cfg};overflow=document.body.style.overflow;mode='details';
  $('categoryEditName').textContent=e.text||e.name||cfg.label;
  $('categoryEditSubtitle').textContent=kind==='sparen-investieren'?(e.typ==='sparen'?'Sparen · pro Gehaltsperiode':'Investieren · pro Gehaltsperiode'):cfg.label;
  $('categoryEditCurrent').textContent=d.formatBetragText(recurring(kind,e)?d.recurringAmount(e,kind==='sparen-investieren'?d.getGehaltszeitraum().start:d.heuteISO()):e.betrag);
  if(!mountDetails()){active=null;return false;}
  setCategoryEditMode('details',false);document.body.style.overflow='hidden';
  if(dialog.showModal)dialog.showModal();else{dialog.setAttribute('open','');$('categoryEditorCurtain').classList.remove('hidden');for(const node of document.body.children)if(node!==dialog&&node.id!=='categoryEditorCurtain'&&node.tagName!=='SCRIPT'){fallback.push([node,!!node.inert]);node.inert=true;}}
  $('categoryEditName').focus({preventScroll:true});return true;
 }
 function dismissCategoryEditor(){
  if(!active)return;const cfg=active.cfg;active=null;context.session.state[cfg.state]=null;
  if(dialog.open&&dialog.close)dialog.close();else dialog.removeAttribute('open');
  document.body.style.overflow=overflow;$('categoryEditorCurtain').classList.add('hidden');for(const [node,was]of fallback)node.inert=was;fallback=[];$('categoryEditDetails').replaceChildren();
 }
 function cancelEditCategoryEditor(){dismissCategoryEditor();}
 function finishCategoryEditor(kind,id){if(active&&active.kind===kind&&String(active.id)===String(id))dismissCategoryEditor();}
 function setCategoryEditMode(next,remount=true){
  if(!active)return;const e=findEntry(active.kind,active.id),repeat=recurring(active.kind,e);
  mode=repeat&&['price','end'].includes(next)?next:'details';
  if(remount&&!mountDetails())return dismissCategoryEditor();
  $('categoryEditTabs').classList.toggle('hidden',!repeat);
  for(const [value,name]of [['details','Details'],['price','Price'],['end','End']]){$('categoryEdit'+name+'Tab').setAttribute('aria-pressed',String(mode===value));$('categoryEdit'+name).classList.toggle('hidden',mode!==value);}
  $('categoryEditPreview').classList.toggle('hidden',mode==='details');
  $('editCategoryAmount').value='';$('editCategoryDate').value=e.datum>d.heuteISO()?e.datum:d.heuteISO();$('editCategoryEndDate').value=e.wiederholungEnde||'';
  $('categoryEditError').textContent='';$('categoryEditSave').textContent=mode==='price'?'Änderung vormerken':mode==='end'?'Enddatum speichern':'Speichern';refreshCategoryEditor();
 }
 // Dates use the entry's actual cadence. Savings are allocated per salary
 // period, so their end preview reports the period boundary, not a bank debit.
 function categoryEditorProposal(kind,e,which,raw,date){
  const anchor=kind==='geplante-ausgaben'?e.wiederholungStart||e.datum:e.datum;
  const p=d.freshCostProposal({...e,datum:anchor},which,raw,date);if(p.error||which!=='end')return p;
  if(kind==='sparen-investieren')return {...p,period:true};
  const step=kind==='versicherungen'?({'vierteljährlich':3,'halbjährlich':6,'jährlich':12}[e.intervall]||1):e.wiederholung==='jaehrlich'?12:1;
  const start=d.parseISODate(anchor),end=d.parseISODate(date);if(!start)return {error:'Bitte zuerst ein Startdatum eingeben.'};
  const months=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth();let count=Math.floor(months/step);
  let last=d.datumMitSicheremTag(start.getFullYear(),start.getMonth()+count*step,start.getDate());
  if(last>end){count--;last=d.datumMitSicheremTag(start.getFullYear(),start.getMonth()+count*step,start.getDate());}
  const next=d.datumMitSicheremTag(start.getFullYear(),start.getMonth()+(count+1)*step,start.getDate());
  return {...p,last:count>=0?d.isoAusDate(last):'',next:d.isoAusDate(next)};
 }
 function refreshCategoryEditor(){
  if(!active)return;$('categoryEditSave').disabled=false;if(mode==='details')return;
  const e=findEntry(active.kind,active.id),date=$(mode==='price'?'editCategoryDate':'editCategoryEndDate').value;
  const p=categoryEditorProposal(active.kind,e,mode,$('editCategoryAmount').value,date);$('categoryEditSave').disabled=!!p.error;
  if(mode==='price'){
   const valid=d.recurringDateValid(date),before=valid?d.isoAusDate(new Date(d.parseISODate(date).getTime()-86400000)):'';
   $('categoryBeforeLabel').textContent=valid?'Bis '+d.formatDatum(before):'Bisher';$('categoryBeforeValue').textContent=d.formatBetragText(d.recurringAmount(e,before||d.heuteISO()));
   $('categoryAfterLabel').textContent=valid?'Ab '+d.formatDatum(date):'Danach';$('categoryAfterValue').textContent=p.error?'—':d.formatBetragText(p.amount);
  }else{
   $('categoryBeforeLabel').textContent=p.period?'Berücksichtigt bis':active.kind==='einnahmen'?'Letzte Einnahme':active.kind==='geplante-ausgaben'?'Letzter Termin':'Letzte Zahlung';
   $('categoryBeforeValue').textContent=p.error?'—':d.formatDatum(p.period?date:p.last);
   $('categoryAfterLabel').textContent=p.error?'Danach':p.period?'Danach':'Ab '+d.formatDatum(p.next);
   $('categoryAfterValue').textContent=p.period?'Keine weitere Berücksichtigung':active.kind==='einnahmen'?'Keine Einnahme':active.kind==='geplante-ausgaben'?'Kein weiterer Termin':'Keine Zahlung';
  }
 }
 function saveEditCategoryEditor(){
  if(!active)return;const {kind,id,cfg}=active;
  if(mode==='details'){
   context.session.state[cfg.state]=id;d[cfg.save](id);
   // A successful category save closes through finishCategoryEditor. Failed
   // validation/storage leaves the live form in place for correction/retry.
   if(active){context.session.state[cfg.state]=null;$('categoryEditError').textContent='Nicht gespeichert. Bitte die Angaben prüfen.';}
   return;
  }
  const e=findEntry(kind,id),p=categoryEditorProposal(kind,e,mode,$('editCategoryAmount').value,$(mode==='price'?'editCategoryDate':'editCategoryEndDate').value);
  if(p.error){$('categoryEditError').textContent=p.error;return;}
  if(mode==='end')e.wiederholungEnde=p.end;else e.betragsAenderungen=[...d.recurringChanges(e).filter(c=>c.ab!==p.date),{ab:p.date,betrag:p.amount}].sort((a,b)=>a.ab.localeCompare(b.ab));
  if(d.speichern()===false){$('categoryEditError').textContent='Nicht gespeichert. Bitte erneut versuchen.';return;}
  dismissCategoryEditor();d[cfg.render]();d.renderHomeUebersicht();d.renderUebersicht();
 }
 for(const name of ['editCategoryAmount','editCategoryDate','editCategoryEndDate'])for(const event of ['input','change'])$(name)?.addEventListener(event,refreshCategoryEditor);
 dialog?.addEventListener('cancel',event=>{event.preventDefault();d.cancelEditCategoryEditor();});
 return {openCategoryEditor,dismissCategoryEditor,cancelEditCategoryEditor,finishCategoryEditor,setCategoryEditMode,refreshCategoryEditor,saveEditCategoryEditor,categoryEditorProposal};
});
