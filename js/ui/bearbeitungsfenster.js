Kostentracker.module({
 id:'js/ui/bearbeitungsfenster.js',
 dependencies:['formatBetragText','parseBetrag','decorateReminderControls','cancelEditHaushalt','cancelEditFreizeit','cancelEditKosten','cancelEditVersicherung','cancelEditEinnahme','cancelEditSparenInvestieren','cancelEditGeplanteAusgabe','cancelEditReise','cancelEditAusgabenArchiv','renderHaushalt','renderFreizeit','renderLaufendeKosten','renderVersicherungen','renderEinnahmen','renderSparenInvestieren','renderGeplanteAusgaben','renderListe','renderAusgabenArchiv'],
 session:['state'],read:[],write:[],replace:false
},(context,d)=>{
 'use strict';
 const configs={
  haushalt:['Haushalt','editHaushaltId','editBetrag-','renderHaushalt','cancelEditHaushalt','saveEditHaushalt'],
  freizeit:['Freizeit','editFreizeitId','editFreizeitBetrag-','renderFreizeit','cancelEditFreizeit','saveEditFreizeit'],
  fixkosten:['Fixkosten','editKostenId','editKostenBetrag-','renderLaufendeKosten','cancelEditKosten','saveEditKosten'],
  versicherungen:['Versicherungen','editVersicherungId','editBetrag-','renderVersicherungen','cancelEditVersicherung','saveEditVersicherung'],
  einnahmen:['Einnahmen','editEinnahmeId','editEinnahmenBetrag-','renderEinnahmen','cancelEditEinnahme','saveEditEinnahme'],
  sparen:['Sparen & Investieren','editSparenInvestierenId','editSparenBetrag-','renderSparenInvestieren','cancelEditSparenInvestieren','saveEditSparenInvestieren'],
  geplant:['Geplante Ausgaben','editGeplanteAusgabeId','editGeplantBetrag-','renderGeplanteAusgaben','cancelEditGeplanteAusgabe','saveEditGeplanteAusgabe'],
  reisen:['Reisen','editReiseId','editBetrag-','renderListe','cancelEditReise','saveEditReise'],
  archiv:['Alle Einträge','editAusgabenArchivId','editArchivBetrag-','renderAusgabenArchiv','cancelEditAusgabenArchiv','saveEditAusgabenArchiv']
 };
 let active=null,previousOverflow='',opener=null,fallbackNodes=[];
 const dialog=document.getElementById('bookingEditDialog'),host=document.getElementById('bookingEditHost');
 function requestClose(){if(active)d[active.config[4]]();}
 document.getElementById('bookingEditClose')?.addEventListener('click',requestClose);
 dialog?.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
 dialog?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();requestClose();return;}
  if(event.key!=='Tab'||!active)return;
  const nodes=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(n=>!n.disabled&&n.type!=='hidden'&&n.tabIndex!==-1&&n.getClientRects().length);
  if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 function dismissBookingEditor(){
  if(!active)return;
  active=null;
  if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
  host.replaceChildren();document.getElementById('bookingEditFallback')?.classList.add('hidden');document.body.style.overflow=previousOverflow;
  for(const [node,inert,hidden]of fallbackNodes){node.inert=inert;if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden);}fallbackNodes=[];
  const restore=opener;opener=null;if(restore?.isConnected)restore.focus({preventScroll:true});
 }
 function closeBookingEditor(type,id){if(active&&active.type===type&&(id===undefined||String(active.id)===String(id)))dismissBookingEditor();}
 function presentBookingEditor(type,id){
  const config=configs[type];if(!config||!dialog||!host)return false;
  const input=document.getElementById(config[2]+id),card=input?.closest('.item');
  if(!card)return false;
  if(active)dismissBookingEditor();
  opener=document.activeElement;previousOverflow=document.body.style.overflow;
  card.dataset.bookingType=type;card.classList.add('booking-editor-card');
  // Decorate before moving so existing reminder/currency context is retained.
  d.decorateReminderControls(card);
  const buttons=[...card.querySelectorAll('button[onclick]')];
  const save=buttons.find(b=>(b.getAttribute('onclick')||'').includes(config[5]+'('));
  const cancel=buttons.find(b=>(b.getAttribute('onclick')||'').includes(config[4]+'('));
  if(!save||!cancel)return false;
  const oldParents=new Set([save.parentElement,cancel.parentElement]);
  const actions=document.createElement('div');actions.className='booking-editor-actions';
  for(const [button,label,kind]of [[save,'Speichern','primary'],[cancel,'Abbrechen','secondary']]){
   button.textContent=label;button.className='booking-editor-'+kind;button.removeAttribute('style');button.type='button';actions.appendChild(button);
  }
  // The original nodes keep values and listeners; controls are never cloned.
  for(const parent of oldParents)if(parent&&!parent.children.length)parent.remove();
  card.appendChild(actions);host.replaceChildren(card);
  active={type,id,config};
  const nameIds={haushalt:'editText-',freizeit:'editFreizeitText-',fixkosten:'editKostenText-',versicherungen:'editName-',einnahmen:'editEinnahmenText-',sparen:'editSparenText-',geplant:'editGeplantText-',reisen:'editText-',archiv:'editArchivText-'};
  const name=(document.getElementById(nameIds[type]+id)?.value||'').trim();
  document.getElementById('bookingEditTitle').textContent=name||config[0];
  const recurringLabels={fixkosten:'Monatliche Fixkosten',sparen:'Sparen & Investieren · pro Gehaltsperiode'};
  document.getElementById('bookingEditArea').textContent=recurringLabels[type]||config[0];
  const value=d.parseBetrag(input.value),label=input.labels?.[0]?.textContent||'',currency=label.match(/\(([A-Z]{3})\)/)?.[1];
  document.getElementById('bookingEditAmount').textContent=currency&&currency!=='EUR'?value.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+currency:d.formatBetragText(value);
  dialog.querySelector('.booking-editor-scroll')?.scrollTo?.(0,0);
  // Lists continue rendering ordinary cards while the independent form stays open.
  context.session.state[config[1]]=null;d[config[3]]();
  document.body.style.overflow='hidden';
  if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}
  else {
   dialog.setAttribute('open','');document.getElementById('bookingEditFallback')?.classList.remove('hidden');for(const node of document.body.children){if(node===dialog||node.id==='bookingEditFallback'||node.tagName==='SCRIPT')continue;fallbackNodes.push([node,!!node.inert,node.getAttribute('aria-hidden')]);node.inert=true;node.setAttribute('aria-hidden','true');}
  }
  document.getElementById('bookingEditTitle').focus({preventScroll:true});
  return true;
 }
 return {presentBookingEditor,closeBookingEditor,dismissBookingEditor};
});
