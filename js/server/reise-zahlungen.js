Kostentracker.module({
 id:'js/server/reise-zahlungen.js',
 dependencies:['merchantDestination','getReiseCurrency','parseBetrag','formatBetragText','formatDatum','importTestServerPayments','renderServerPaymentReview','renderHomeUebersicht','refreshReiseImportedViews','speichern'],
 session:[],read:['Reisen','ReisenMeta','Einstellungen','Haushalt','Freizeit'],write:['Reisen','Einstellungen','Haushalt','Freizeit'],replace:false
},(context,dependencies)=>{
 'use strict';
 function validateImportedPayment(payment) {
  if(!payment||typeof payment.id!=='string'||!/^[-A-Za-z0-9_:]{1,128}$/.test(payment.id))throw new Error('Ungültige Zahlungs-ID.');
  const foreign=payment.foreign;
  if(foreign&&(typeof foreign.amount!=='number'||!Number.isFinite(foreign.amount)||foreign.amount<=0||foreign.amount>1e12||typeof foreign.currency!=='string'||! /^[A-Z]{3}$/.test(foreign.currency)||['EUR','XXX','XTS'].includes(foreign.currency)))throw new Error('Ungültiger Fremdwährungsbetrag.');
  if(!(Number.isInteger(payment.amountCents)&&payment.amountCents>0&&payment.amountCents<=100000000)&&!(payment.amountCents===null&&foreign))throw new Error('Ungültiger Eurobetrag.');
  if(typeof payment.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)||!Number.isFinite(Date.parse(payment.date+'T12:00:00Z'))||new Date(payment.date+'T12:00:00Z').toISOString().slice(0,10)!==payment.date)throw new Error('Ungültiges Zahlungsdatum.');
 }
 function travelPaymentCategory(payment,land) {
  const trip=context.repository.view.Reisen?.[land]||{},options=Object.keys(trip).filter(k=>Array.isArray(trip[k]));
  const known=dependencies.merchantDestination(payment.merchant);
  const preferred=known?.category==='Tanken'?'Transport':known?.category||payment.category||'Sonstiges';
  return options.includes(preferred)?preferred:options.includes('Sonstiges')?'Sonstiges':options[0]||'';
 }
 function routeTravelPayment(payment) {
  const trips=Object.keys(context.repository.view.Reisen||{}).filter(land=>{
   const meta=context.repository.view.ReisenMeta?.[land];
   const valid=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
   return valid(meta?.von)&&valid(meta?.bis)&&meta.von<=meta.bis&&payment.date>=meta.von&&payment.date<=meta.bis;
  });
  if(payment.amountCents===null)return {review:'Eurobetrag fehlt. Abgerechneten Eurobetrag ergänzen und Ziel auswählen.',travelCandidates:trips};
  if(trips.some(land=>{const m=context.repository.view.ReisenMeta[land];return payment.date===m.von||payment.date===m.bis;}))return {review:'An- oder Abreisetag: Reise oder Alltag auswählen.',travelCandidates:trips};
  let eligible=trips;
  if(payment.foreign){const matching=trips.filter(land=>dependencies.getReiseCurrency(land)===payment.foreign.currency);if(matching.length)eligible=matching;else return {review:'Fremdwährung passt zu keiner Reise an diesem Tag. Ziel prüfen.',travelCandidates:trips};}
  if(eligible.length>1)return {review:'Mehrere Reisen an diesem Tag. Ziel auswählen.',travelCandidates:eligible};
  if(eligible.length===1){const land=eligible[0],category=travelPaymentCategory(payment,land);return category?{normal:true,destination:{area:'Reisen',land,category}}:{review:'Die Reise hat keine Ausgabenkategorie. Kategorie ergänzen.',travelCandidates:eligible};}
  return {normal:true};
 }
 function importedForeignFx(payment,land) {
  if(payment.foreign&&payment.amountCents>0)return {amount:payment.foreign.amount,currency:payment.foreign.currency,rate:payment.foreign.amount/(payment.amountCents/100),date:payment.date,rateSource:'bank'};
  if(!land||!payment.amountCents)return null;
  const quote=dependencies.getReiseCurrency(land),record=context.repository.view.ReisenMeta?.[land]?.budgetFxRates?.[quote];
  if(quote&&quote!=='EUR'&&record?.base==='EUR'&&record.quote===quote&&Number.isFinite(record.rate)&&record.rate>0&&/^\d{4}-\d{2}-\d{2}$/.test(record.date))return {amount:payment.amountCents/100,currency:'EUR',rate:1,date:record.date,counterCurrency:quote,counterRate:record.rate,rateSource:'reference'};
  return null;
 }
 function setupTravelPaymentTests() {
  const select=document.getElementById('travelPaymentTestLand');if(!select)return;
  const previous=select.value;select.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='Reise für den Test auswählen';select.appendChild(empty);
  for(const land of Object.keys(context.repository.view.Reisen||{})){const option=document.createElement('option');option.value=land;option.textContent=land;select.appendChild(option);}
  if(Object.hasOwn(context.repository.view.Reisen||{},previous))select.value=previous;
 }
 function updateTravelPaymentTestDate() {
  const land=document.getElementById('travelPaymentTestLand')?.value,meta=context.repository.view.ReisenMeta?.[land];
  const input=document.getElementById('travelPaymentTestDate');if(!input||!meta?.von)return;
  const next=new Date(meta.von+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const date=next.toISOString().slice(0,10);
  input.value=meta.bis&&date<meta.bis?date:meta.von;
 }
 function simulateTravelPayment(kind) {
  const land=document.getElementById('travelPaymentTestLand')?.value,date=document.getElementById('travelPaymentTestDate')?.value;
  if(!land||!date){alert('Eine Reise und ein Datum für den Test auswählen.');return;}
  const currency=dependencies.getReiseCurrency(land);if(!currency||currency==='EUR'){alert('Für die Fremdwährungstests eine Reise mit Landeswährung auswählen.');return;}
  // A synthetic fixture, not an observed notification format.
  const payment={id:'travel-demo-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),date,merchant:'CU (Test)',source:'bank-push',bank:'trade_republic',category:'Einkauf',testOnly:true,amountCents:kind==='foreign'?null:161};
  if(kind!=='eur')payment.foreign={amount:currency==='KRW'?2800:100,currency};
  if(kind==='foreign')payment.reviewReason='Test: nur Fremdwährungsbetrag; Eurobetrag und Ziel prüfen.';
  try{const count=dependencies.importTestServerPayments([payment]);dependencies.renderHomeUebersicht();const status=document.getElementById('travelPaymentTestStatus');if(status)status.textContent=count?'Testausgabe übernommen. Reise oder Alltag prüfen.':'Testzahlung liegt zur Prüfung oben bereit.';}
  catch(error){alert(error.message);}
 }
 function removeTravelPaymentTests() {
  if(!confirm('Nur die mit diesen Testbuttons erzeugten Zahlungen und Prüfungen entfernen?'))return;
  const d=context.repository.view,ids=new Set(d.Einstellungen.serverTravelDemoIds||[]);
  for(const group of [d.Haushalt,d.Freizeit,...Object.values(d.Reisen||{})])for(const [category,list]of Object.entries(group||{}))if(Array.isArray(list))group[category]=list.filter(e=>{if(!e._testPayment)return true;ids.add(e._serverPaymentId);return false;});
  d.Einstellungen.serverPendingReview=(d.Einstellungen.serverPendingReview||[]).filter(p=>{if(!p.testOnly)return true;ids.add(p.id);return false;});
  for(const [key,match]of Object.entries(d.Einstellungen.serverRecurringMatches||{}))if(ids.has(match.paymentId))delete d.Einstellungen.serverRecurringMatches[key];
  d.Einstellungen.serverTravelDemoIds=[];
  d.Einstellungen.serverImportIds=(d.Einstellungen.serverImportIds||[]).filter(id=>!ids.has(id));
  if(dependencies.speichern()===false)return;
  dependencies.renderServerPaymentReview();dependencies.refreshReiseImportedViews();const status=document.getElementById('travelPaymentTestStatus');if(status)status.textContent='Lokale Testzahlungen entfernt.';
 }
 return {validateImportedPayment,travelPaymentCategory,routeTravelPayment,importedForeignFx,setupTravelPaymentTests,updateTravelPaymentTestDate,simulateTravelPayment,removeTravelPaymentTests};
});
