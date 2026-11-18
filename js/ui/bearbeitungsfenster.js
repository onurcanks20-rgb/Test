Kostentracker.module({
 id:'js/ui/bearbeitungsfenster.js',
 dependencies:['openFixPriceEditor','formatDatum','recurringDateValid','formatBetragText','parseBetrag','decorateReminderControls','cancelEditHaushalt','cancelEditFreizeit','cancelEditKosten','cancelEditVersicherung','cancelEditEinnahme','cancelEditSparenInvestieren','cancelEditGeplanteAusgabe','cancelEditReise','cancelEditAusgabenArchiv','renderHaushalt','renderFreizeit','renderLaufendeKosten','renderVersicherungen','renderEinnahmen','renderSparenInvestieren','renderGeplanteAusgaben','renderListe','renderAusgabenArchiv'],
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
 function bookingEditorPreviewRows(base,changes=[],end='',draft=base,currency='EUR'){
  const money=value=>currency==='EUR'?d.formatBetragText(value):value.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+currency;
  const rows=[];
  if(Number.isFinite(base)&&Number.isFinite(draft)&&base!==draft)rows.push(['Bisher',money(base)],['Neu',money(draft)]);
  for(const change of [...changes].sort((a,b)=>a.ab.localeCompare(b.ab)))if(d.recurringDateValid(change.ab)&&Number.isFinite(change.betrag)&&change.betrag>0)rows.push(['Ab '+d.formatDatum(change.ab),money(change.betrag)]);
  if(d.recurringDateValid(end))rows.push(['Bis einschließlich',d.formatDatum(end)],['Danach','Keine weiteren Fälligkeiten']);
  return rows;
 }
 function organizeEditor(card,type,id,input,nameId,save){
  const form=card.querySelector('.booking-edit-form,.reise-edit-form')||card.firstElementChild;
  if(!form)return;
  const extra=document.createElement('details');extra.className='booking-editor-extra';
  const summary=document.createElement('summary');summary.textContent='Weitere Einstellungen';extra.appendChild(summary);
  const extraBody=document.createElement('div');extraBody.className='booking-editor-extra-body';extra.appendChild(extraBody);
  const prefix={fixkosten:'editRecCost-',versicherungen:'editRecVers-',einnahmen:'editRecIncome-',sparen:'editRecSavings-',geplant:'editRecPlanned-'}[type];
  const options=prefix?document.getElementById(prefix+id+'Options'):null;
  // Move original nodes in their existing order; all field IDs and listeners survive.
  for(const node of [...form.children]){
   if(node===options)continue;
   if(node.id===input.id||node.id===nameId||node.tagName==='LABEL'&&[input.id,nameId].includes(node.htmlFor))continue;
   extraBody.appendChild(node);
  }
  if(extraBody.children.length)form.appendChild(extra);
  const preview=document.createElement('section');preview.className='booking-editor-preview';
  const heading=document.createElement('h3');heading.textContent='Vorschau';preview.appendChild(heading);
  const list=document.createElement('div');list.className='booking-editor-preview-list';preview.appendChild(list);
  const actions=card.querySelector('.booking-editor-actions');card.insertBefore(preview,actions);
  for(const label of card.querySelectorAll('label')){
   if(label.children.length)continue;
   label.textContent=label.textContent.replace(/\s*\(optional\)/g,'').replace('Vertragsinfo','Vertragsdaten').replace('Zeitfenster zur Fälligkeit','Zuordnung').replace(' · danach monatlich','');
  }
  for(const label of card.querySelectorAll('.entry-date-time label > span'))label.textContent=label.textContent.replace(/\s*\(optional\)/g,'');
  const reminder=card.querySelector('.reminder-toggle > span:first-child');if(reminder)reminder.textContent=reminder.textContent.replace(/^🔔\s*/u,'');

  let mode='general',bar=null,price=null,ending=null;
  const original=d.parseBetrag(input.value),previewCurrency=(input.labels?.[0]?.textContent||'').match(/\(([A-Z]{3})\)/)?.[1]||'EUR';
  const isRecurring=()=>!!options&&!options.classList.contains('hidden');
  const update=()=>{
   const recurring=isRecurring();bar?.classList.toggle('hidden',!recurring);
   if(!recurring&&mode!=='general')setMode('general');
   const changes=options?[...options.querySelectorAll('[data-recurring-row]')].map(row=>({ab:document.getElementById(prefix+id+'ChangeDate-'+row.dataset.recurringRow)?.value||'',betrag:d.parseBetrag(document.getElementById(prefix+id+'ChangeAmount-'+row.dataset.recurringRow)?.value)})):[];
   const end=options?document.getElementById(prefix+id+'End')?.value||'':'';
   const rows=bookingEditorPreviewRows(original,recurring&&mode==='price'?changes:[],recurring&&mode==='end'?end:'',mode==='general'?d.parseBetrag(input.value):original,previewCurrency);
   if(mode==='price'&&rows.length)rows.unshift(['Bisher',d.formatBetragText(original)]);
   list.replaceChildren();for(const [label,value]of rows){const row=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');left.textContent=label;right.textContent=value;row.append(left,right);list.appendChild(row);}
   preview.classList.toggle('hidden',!rows.length);
  };
  function setMode(next){
   mode=next;form.classList.toggle('hidden',mode!=='general');
   if(options){options.classList.toggle('editor-lifecycle-hidden',mode==='general');options.open=true;}
   price?.classList.toggle('hidden',mode!=='price');ending?.classList.toggle('hidden',mode!=='end');
   for(const button of bar?.children||[]){button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));}
   const title=dialog.querySelector('.booking-editor-section');if(title){title.hidden=mode==='general';title.textContent=mode==='price'?'Betrag ändern':mode==='end'?(type==='fixkosten'?'Abo beenden':'Wiederholung beenden'):'Buchung bearbeiten';}
   save.textContent=mode==='price'?'Änderung speichern':mode==='end'?'Enddatum speichern':'Speichern';
   update();
  }
  if(options){
   const endInput=document.getElementById(prefix+id+'End');
   ending=document.createElement('div');ending.className='editor-end-panel';
   const endLabel=options.querySelector('label[for="'+CSS.escape(endInput.id)+'"]');
   if(endLabel)ending.appendChild(endLabel);ending.appendChild(endInput);
   price=document.createElement('div');price.className='editor-price-panel';
   for(const node of [...options.children])if(node.tagName!=='SUMMARY'&&node.tagName!=='H4'&&node.id!==prefix+id+'Error'&&node!==ending)price.appendChild(node);
   options.querySelector('h4')?.remove();options.append(ending,price);card.insertBefore(options,preview);
   bar=document.createElement('div');bar.className='booking-editor-modes';bar.setAttribute('role','group');bar.setAttribute('aria-label','Bearbeitungsart');
   for(const [value,label]of [['general','Details'],['price','Betrag ändern'],['end','Beenden']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.mode=value;button.addEventListener('click',()=>setMode(value));bar.appendChild(button);}
   card.insertBefore(bar,form);
   // Structural additions/removals dispatch an input through their existing marker.
  }
  card.addEventListener('input',update);card.addEventListener('change',update);setMode('general');
 }

 function presentBookingEditor(type,id){
  if(type==='fixkosten'&&!context.session.state.fixPriceDetailsOnce)return d.openFixPriceEditor(id);
  context.session.state.fixPriceDetailsOnce=false;
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
  organizeEditor(card,type,id,input,nameIds[type]+id,save);
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
 return {presentBookingEditor,closeBookingEditor,dismissBookingEditor,bookingEditorPreviewRows};
});
