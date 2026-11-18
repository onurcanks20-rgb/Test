Kostentracker.module({id:'js/ui/fixkosten-preis.js',dependencies:['cancelEditFixPrice','parseBetrag','formatBetragText','formatDatum','heuteISO','parseISODate','isoAusDate','addDays','recurringAmount','recurringChanges','recurringDateValid','escapeHtml','speichern','renderLaufendeKosten','renderHomeUebersicht','startEditKosten'],session:['state'],read:['Laufende Kosten'],write:['Laufende Kosten'],replace:false},(context,d)=>{
 'use strict';
 let id=null,overflow='',fallback=[];
 const dialog=document.getElementById('fixPriceDialog'),body=document.getElementById('fixPriceBody');
 const entry=()=>context.repository.view['Laufende Kosten']?.fix?.find(e=>String(e.id)===String(id));
 function fixPriceProposal(e,amount,date){
  const price=d.parseBetrag(amount);
  if(!d.recurringDateValid(date)||!Number.isFinite(price)||price<=0)return {error:'Neuen Betrag und gültiges Datum eingeben.'};
  if(e.datum&&date<e.datum)return {error:'Das Datum liegt vor der ersten Abbuchung.'};
  if(e.wiederholungEnde&&date>e.wiederholungEnde)return {error:'Das Datum liegt nach dem Enddatum.'};
  if(d.recurringChanges(e).length>=50&&!d.recurringChanges(e).some(c=>c.ab===date))return {error:'Höchstens 50 Betragsänderungen möglich.'};
  const before=d.addDays(d.parseISODate(date),-1);
  return {price,date,before:d.isoAusDate(before),oldPrice:d.recurringAmount(e,before)};
 }
 function refreshFixPricePreview(){
  const e=entry();if(!e)return;
  const p=fixPriceProposal(e,document.getElementById('editFixPriceAmount').value,document.getElementById('editFixPriceDate').value);
  document.getElementById('fixPricePreview').classList.toggle('hidden',!!p.error);
  if(p.error)return;
  document.getElementById('fixPriceBeforeLabel').textContent='Bis '+d.formatDatum(p.before);
  document.getElementById('fixPriceBeforeAmount').textContent=d.formatBetragText(p.oldPrice);
  document.getElementById('fixPriceAfterLabel').textContent='Ab '+d.formatDatum(p.date);
  document.getElementById('fixPriceAfterAmount').textContent=d.formatBetragText(p.price);
 }
 function dismissFixPriceEditor(){
  if(id===null)return;id=null;
  if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');
  document.getElementById('fixPriceCurtain').classList.add('hidden');body.replaceChildren();document.body.style.overflow=overflow;
  for(const [node,inert]of fallback)node.inert=inert;fallback=[];
 }
 function cancelEditFixPrice(){dismissFixPriceEditor();}
 function startEditFixPriceDetails(){const current=id;if(current===null)return;dismissFixPriceEditor();context.session.state.fixPriceDetailsOnce=true;d.startEditKosten(current);}
 function saveEditFixPrice(){
  const e=entry();if(!e)return;
  const p=fixPriceProposal(e,document.getElementById('editFixPriceAmount').value,document.getElementById('editFixPriceDate').value),error=document.getElementById('fixPriceError');
  if(p.error){error.textContent=p.error;return;}
  e.betragsAenderungen=[...d.recurringChanges(e).filter(c=>c.ab!==p.date),{ab:p.date,betrag:p.price}].sort((a,b)=>a.ab.localeCompare(b.ab));
  if(d.speichern()===false){error.textContent='Nicht gespeichert. Bitte erneut versuchen.';return;}
  dismissFixPriceEditor();d.renderLaufendeKosten();d.renderHomeUebersicht();
 }
 function openFixPriceEditor(current){
  if(!dialog||!body)return false;
  id=current;const e=entry();if(!e){id=null;return false;}
  overflow=document.body.style.overflow;
  document.getElementById('fixPriceName').textContent=e.text||e.name||'Fixkosten';
  document.getElementById('fixPriceCurrent').textContent=d.formatBetragText(d.recurringAmount(e,d.heuteISO()));
  const initial=e.datum>d.heuteISO()?e.datum:d.heuteISO();
  body.innerHTML=`<div class="item fix-price-form"><label for="editFixPriceAmount">Neuer Betrag (€)</label><input id="editFixPriceAmount" inputmode="decimal" type="text" autocomplete="off" enterkeyhint="next"><label for="editFixPriceDate">Gültig ab</label><input id="editFixPriceDate" type="date" value="${d.escapeHtml(initial)}"><section id="fixPricePreview" class="hidden"><h3>Vorschau</h3><div class="fix-price-table"><div><span id="fixPriceBeforeLabel"></span><strong id="fixPriceBeforeAmount"></strong></div><div><span id="fixPriceAfterLabel"></span><strong id="fixPriceAfterAmount"></strong></div></div></section><p id="fixPriceError" role="alert"></p><div class="fix-price-actions"><button type="button" class="fix-price-save" onclick="saveEditFixPrice()">Änderung vormerken</button><button type="button" class="fix-price-text" onclick="cancelEditFixPrice()">Abbrechen</button><button type="button" class="fix-price-details" onclick="startEditFixPriceDetails()">Details bearbeiten</button></div></div>`;
  body.addEventListener('input',refreshFixPricePreview);body.addEventListener('change',refreshFixPricePreview);
  context.session.state.editKostenId=null;d.renderLaufendeKosten();
  document.body.style.overflow='hidden';
  if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');document.getElementById('fixPriceCurtain').classList.remove('hidden');for(const node of document.body.children)if(node!==dialog&&node.id!=='fixPriceCurtain'&&node.tagName!=='SCRIPT'){fallback.push([node,!!node.inert]);node.inert=true;}}
  document.getElementById('fixPriceName').focus({preventScroll:true});return true;
 }
 dialog?.addEventListener('cancel',event=>{event.preventDefault();d.cancelEditFixPrice();});
 return {openFixPriceEditor,dismissFixPriceEditor,cancelEditFixPrice,saveEditFixPrice,startEditFixPriceDetails,refreshFixPricePreview,fixPriceProposal};
});
