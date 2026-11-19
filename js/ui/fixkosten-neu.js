Kostentracker.module({id:'js/ui/fixkosten-neu.js',dependencies:['escapeHtml','formatText','formatInputBetrag','normalizeFixkostenZuordnungTage','reminderControlHtml','readReminderControl','cancelEditFreshKosten','parseBetrag','formatBetragText','formatDatum','parseISODate','heuteISO','isoAusDate','addDays','datumMitSicheremTag','recurringAmount','recurringChanges','recurringDateValid','speichern','renderLaufendeKosten','renderHomeUebersicht','startEditKosten'],session:['state'],read:['Laufende Kosten'],write:['Laufende Kosten'],replace:false},(context,d)=>{
 'use strict';let id=null,mode='details',overflow='',fallback=[],draftChanges=[];
 const $=id=>document.getElementById(id),dialog=$('freshCostDialog');
 const entry=()=>context.repository.view['Laufende Kosten']?.fix?.find(e=>String(e.id)===String(id));
 function freshCostProposal(e,kind,raw,date){
  if(!d.recurringDateValid(date))return {error:'Bitte ein gültiges Datum wählen.'};
  if(e.datum&&date<e.datum)return {error:'Das Datum liegt vor der ersten Abbuchung.'};
  if(kind==='end'){
   if(d.recurringChanges(e).some(c=>c.ab>date))return {error:'Spätere Betragsänderungen zuerst unter Details entfernen.'};
   const end=d.parseISODate(date),start=d.parseISODate(e.datum);if(!start)return {error:'Bitte zuerst das Startdatum unter Details ergänzen.'};
   let last=d.datumMitSicheremTag(end.getFullYear(),end.getMonth(),start.getDate());if(last>end)last=d.datumMitSicheremTag(end.getFullYear(),end.getMonth()-1,start.getDate());
   const next=d.datumMitSicheremTag(last.getFullYear(),last.getMonth()+1,start.getDate());return {end:date,last:d.isoAusDate(last),next:d.isoAusDate(next)};
  }
  const amount=d.parseBetrag(raw);if(!String(raw).trim()||!Number.isFinite(amount)||amount<=0)return {error:'Bitte einen neuen Betrag größer null eingeben.'};
  if(e.wiederholungEnde&&date>e.wiederholungEnde)return {error:'Das Datum liegt nach dem Enddatum.'};
  const changes=d.recurringChanges(e);if(changes.length>=50&&!changes.some(c=>c.ab===date))return {error:'Höchstens 50 Betragsänderungen möglich.'};
  const before=d.addDays(d.parseISODate(date),-1);return {amount,date,before:d.isoAusDate(before),old:d.recurringAmount(e,before)};
 }
 function hydrateFreshDetails(e){
  $('editFreshName').value=e.text||e.name||'';$('editFreshBase').value=d.formatInputBetrag(e.betrag);$('editFreshStart').value=e.datum||'';
  $('editFreshInfo').value=e.info||'';$('editFreshProvider').value=e.haendler||'';$('editFreshWindow').value=d.normalizeFixkostenZuordnungTage(e.zuordnungTage);
  $('editFreshDetailsEnd').value=e.wiederholungEnde||'';draftChanges=d.recurringChanges(e);$('editFreshScheduleMark').value='';renderFreshChanges();
  $('freshReminderHost').innerHTML=d.reminderControlHtml('edit:fixkosten:'+id,e);
  const days=$('freshReminderHost').querySelector('.reminder-days input');if(days)days.id='editFreshReminderDays';
  $('freshReminderHost').querySelector('.reminder-control')?.addEventListener('click',event=>{if(event.target.closest('.reminder-toggle')){$('editFreshScheduleMark').value=String(Number($('editFreshScheduleMark').value||0)+1);$('editFreshScheduleMark').dispatchEvent(new Event('input',{bubbles:true}));}});
  $('freshContractDetails').open=false;$('freshScheduleDetails').open=false;
 }
 function renderFreshChanges(){
  $('freshScheduleDetails').classList.toggle('hidden',!draftChanges.length);
  $('freshScheduleList').innerHTML=draftChanges.map((c,i)=>`<div class="fc-schedule-row"><span>Ab ${d.escapeHtml(d.formatDatum(c.ab))}</span><strong>${d.escapeHtml(d.formatBetragText(c.betrag))}</strong><button type="button" aria-label="Betragsänderung entfernen" onclick="removeFreshCostChange(${i})">Entfernen</button></div>`).join('');
 }
 function removeFreshCostChange(index){if(!Number.isInteger(index)||index<0||index>=draftChanges.length)return;draftChanges.splice(index,1);renderFreshChanges();$('editFreshScheduleMark').value=String(Number($('editFreshScheduleMark').value||0)+1);$('editFreshScheduleMark').dispatchEvent(new Event('input',{bubbles:true}));}
 function freshCostDetailsProposal(e,fields,changes){
  const amount=d.parseBetrag(fields.amount);if(!fields.name.trim()||!Number.isFinite(amount)||amount<=0)return {error:'Beschreibung und gültigen Grundbetrag eingeben.'};
  if(!d.recurringDateValid(fields.start))return {error:'Bitte ein gültiges Startdatum eingeben.'};
  if(fields.end&&(!d.recurringDateValid(fields.end)||fields.end<fields.start))return {error:'Das Enddatum liegt vor dem Startdatum oder ist ungültig.'};
  if(changes.some(c=>c.ab<fields.start||fields.end&&c.ab>fields.end))return {error:'Start- und Enddatum müssen zu den vorgemerkten Änderungen passen.'};
  return {patch:{text:d.formatText(fields.name),betrag:amount,datum:fields.start,tag:Number(fields.start.slice(-2)),info:fields.info.trim(),haendler:fields.provider.trim(),zuordnungTage:d.normalizeFixkostenZuordnungTage(fields.window),wiederholungEnde:fields.end,betragsAenderungen:changes.map(c=>({...c}))}};
 }
 function detailsProposal(){return freshCostDetailsProposal(entry(),{name:$('editFreshName').value,amount:$('editFreshBase').value,start:$('editFreshStart').value,info:$('editFreshInfo').value,provider:$('editFreshProvider').value,window:$('editFreshWindow').value,end:$('editFreshDetailsEnd').value},draftChanges);}
 function refreshFreshCost(){
  const e=entry();if(!e)return;
  if(mode==='details'){$('freshCostSave').disabled=!!detailsProposal().error;return;}
  const date=$(mode==='end'?'editFreshEnd':'editFreshDate').value,p=freshCostProposal(e,mode,$('editFreshAmount').value,date);
  $('freshCostSave').disabled=!!p.error;
  if(mode==='price'){
   const before=d.recurringDateValid(date)?d.isoAusDate(d.addDays(d.parseISODate(date),-1)):'';
   $('freshBeforeLabel').textContent=before?'Bis '+d.formatDatum(before):'Bisher';$('freshBeforeValue').textContent=d.formatBetragText(before?d.recurringAmount(e,before):d.recurringAmount(e,d.heuteISO()));
   $('freshAfterLabel').textContent=d.recurringDateValid(date)?'Ab '+d.formatDatum(date):'Danach';$('freshAfterValue').textContent=p.error?'—':d.formatBetragText(p.amount);
  }else{
   $('freshBeforeLabel').textContent='Letzte Abbuchung';$('freshBeforeValue').textContent=p.error?'—':d.formatDatum(p.last);
   $('freshAfterLabel').textContent=p.error?'Danach':'Ab '+d.parseISODate(p.next).toLocaleDateString('de-DE',{month:'long',year:'numeric'});$('freshAfterValue').textContent='Keine Abbuchung';
  }
 }
 function setFreshCostMode(next){
  const e=entry();if(!e)return;
  mode=['details','price','end'].includes(next)?next:'details';hydrateFreshDetails(e);
  $('editFreshAmount').value='';$('editFreshDate').value=e.datum>d.heuteISO()?e.datum:d.heuteISO();$('editFreshEnd').value=e.wiederholungEnde||'';
  $('freshDetailsFields').classList.toggle('hidden',mode!=='details');$('freshPriceFields').classList.toggle('hidden',mode!=='price');$('freshEndFields').classList.toggle('hidden',mode!=='end');$('freshCostPreview').classList.toggle('hidden',mode==='details');
  $('freshCostHeading').textContent=mode==='details'?'Details bearbeiten':mode==='end'?'Abo beenden':'Betrag ändern';$('freshCostSave').textContent=mode==='details'?'Details speichern':mode==='end'?'Enddatum speichern':'Änderung vormerken';$('freshCostError').textContent='';for(const tabMode of ['details','price','end']){$('freshTab'+tabMode[0].toUpperCase()+tabMode.slice(1)).setAttribute('aria-pressed',String(mode===tabMode));}refreshFreshCost();
 }
 function dismissFreshCost(){if(id===null)return;id=null;if(dialog.open&&dialog.close)dialog.close();else dialog.removeAttribute('open');document.body.style.overflow=overflow;$('freshCostCurtain').classList.add('hidden');for(const [n,was]of fallback)n.inert=was;fallback=[];}
 function cancelEditFreshKosten(){dismissFreshCost();}
 function startEditFreshDetails(){setFreshCostMode('details');}
 function saveEditFreshKosten(){
  const e=entry();if(!e)return;const p=mode==='details'?detailsProposal():freshCostProposal(e,mode,$('editFreshAmount').value,$(mode==='end'?'editFreshEnd':'editFreshDate').value);
  if(p.error){$('freshCostError').textContent=p.error;return;}
  if(mode==='details')Object.assign(e,p.patch,d.readReminderControl('edit:fixkosten:'+id));else if(mode==='end')e.wiederholungEnde=p.end;else e.betragsAenderungen=[...d.recurringChanges(e).filter(c=>c.ab!==p.date),{ab:p.date,betrag:p.amount}].sort((a,b)=>a.ab.localeCompare(b.ab));
  if(d.speichern()===false){$('freshCostError').textContent='Nicht gespeichert. Bitte erneut versuchen.';return;}
  dismissFreshCost();d.renderLaufendeKosten();d.renderHomeUebersicht();
 }
 function openFreshCost(current){
  id=current;const e=entry();if(!e){id=null;return false;}overflow=document.body.style.overflow;
  $('freshCostName').textContent=e.text||e.name||'Fixkosten';$('freshCostCurrent').textContent=d.formatBetragText(d.recurringAmount(e,d.heuteISO()));
  $('editFreshAmount').value='';$('editFreshDate').value=e.datum>d.heuteISO()?e.datum:d.heuteISO();$('editFreshEnd').value=e.wiederholungEnde||'';setFreshCostMode('details');
  context.session.state.editKostenId=null;d.renderLaufendeKosten();document.body.style.overflow='hidden';
  if(dialog.showModal)dialog.showModal();else{dialog.setAttribute('open','');$('freshCostCurtain').classList.remove('hidden');for(const n of document.body.children)if(n!==dialog&&n.id!=='freshCostCurtain'&&n.tagName!=='SCRIPT'){fallback.push([n,!!n.inert]);n.inert=true;}}
  $('freshCostName').focus({preventScroll:true});return true;
 }
 for(const name of ['editFreshAmount','editFreshDate','editFreshEnd','editFreshName','editFreshBase','editFreshStart','editFreshInfo','editFreshProvider','editFreshWindow','editFreshDetailsEnd','editFreshScheduleMark']){ $(name)?.addEventListener('input',refreshFreshCost);$(name)?.addEventListener('change',refreshFreshCost); }
 dialog?.addEventListener('cancel',event=>{event.preventDefault();d.cancelEditFreshKosten();});
 return {openFreshCost,setFreshCostMode,refreshFreshCost,dismissFreshCost,cancelEditFreshKosten,startEditFreshDetails,saveEditFreshKosten,freshCostProposal,freshCostDetailsProposal,removeFreshCostChange};
});
