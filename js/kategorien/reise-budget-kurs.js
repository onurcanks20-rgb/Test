Kostentracker.module({
 id:'js/kategorien/reise-budget-kurs.js',
 dependencies:['isTravelMode','renderTravelHome','getReiseCurrency','updateReiseAmountPreview','renderReiseBudget','formatBetrag','formatDatum','speichern'],
 session:['aktuellesLand','state'],read:['ReisenMeta'],write:['ReisenMeta'],replace:false
}, (context,dependencies)=>{
 'use strict';
 const pending=new Map(), states=new Map(), successful=new Map(), formats=new Map();
 const MAX_AGE=60*60*1000;
 function validRate(record,quote) {
   if(!record||record.base!=='EUR'||record.quote!==quote||typeof record.rate!=='number'||!Number.isFinite(record.rate)||record.rate<=0||record.rate>1e9)return false;
   if(typeof record.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.date))return false;
   const date=Date.parse(record.date+'T12:00:00Z');
   return Number.isFinite(date)&&new Date(date).toISOString().slice(0,10)===record.date&&date<=Date.now()+86400000;
 }
 function cachedRate(land,quote) {
   const record=context.repository.view.ReisenMeta?.[land]?.budgetFxRates?.[quote];
   return validRate(record,quote)?record:null;
 }
 function fresh(record) {
   const checked=Date.parse(record?.checkedAt||'');
   return Number.isFinite(checked)&&checked<=Date.now()+300000&&Date.now()-checked<MAX_AGE;
 }
 function isLocal(land) {return context.repository.view.ReisenMeta?.[land]?.budgetCurrencyDisplay==='local';}
 function reiseBudgetPresentation(land=context.session.aktuellesLand) {
   const quote=dependencies.getReiseCurrency(land)||'EUR',record=cachedRate(land,quote);
   const converted=isLocal(land)&&quote!=='EUR'&&!!record;
   return {currency:converted?quote:'EUR',rate:converted?record.rate:1,local:converted,quote,record};
 }
 function formatReiseBudgetAmount(eur,land=context.session.aktuellesLand) {
   const display=reiseBudgetPresentation(land);
   if(display.currency==='EUR')return dependencies.formatBetrag(eur);
   if(!formats.has(display.currency))formats.set(display.currency,new Intl.NumberFormat('de-DE',{style:'currency',currency:display.currency,currencyDisplay:'code'}));
   return formats.get(display.currency).format(eur*display.rate);
 }
 function repaint(land) {if(context.session.aktuellesLand===land){if(!context.session.state.reiseBudgetEdit)dependencies.renderReiseBudget();dependencies.updateReiseAmountPreview();}if(dependencies.isTravelMode?.())dependencies.renderTravelHome?.();}
 async function fetchRate(quote) {
   if(pending.has(quote))return pending.get(quote);
   const task=(async()=>{
     const controller=new AbortController();let timer;
     try {
       const result=await Promise.race([
         (async()=>{
           const response=await fetch('https://api.frankfurter.dev/v2/rate/eur/'+quote.toLowerCase(),{signal:controller.signal,mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});
           if(!response.ok)throw new Error('rate-http');
           const json=await response.json();
           if(!validRate(json,quote))throw new Error('rate-invalid');
           return {base:'EUR',quote,rate:json.rate,date:json.date,checkedAt:new Date().toISOString()};
         })(),
         new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('rate-timeout'));},8000);})
       ]);
       return result;
     }finally{clearTimeout(timer);}
   })();
   pending.set(quote,task);
   try{return await task;}finally{if(pending.get(quote)===task)pending.delete(quote);}
 }
 async function requestReiseBudgetRate(land=context.session.aktuellesLand,force=false) {
   if(!land||!context.repository.view.ReisenMeta?.[land])return false;
   const quote=dependencies.getReiseCurrency(land);if(!quote||quote==='EUR')return true;
   const cached=cachedRate(land,quote),stateKey=land+':'+quote,previous=states.get(stateKey);
   if(!force&&fresh(cached))return true;
   if(navigator.onLine===false){states.set(stateKey,{status:'offline'});repaint(land);return !!cached;}
   if(previous?.status==='loading')return !!cached;
   if(!force&&previous?.attempt&&Date.now()-previous.attempt<60000)return !!cached;
   states.set(stateKey,{status:'loading',attempt:Date.now()});repaint(land);
   try {
     const pooled=successful.get(quote);
     const record=!force&&fresh(pooled)?pooled:await fetchRate(quote);
     // A late reply must not recreate a deleted trip or overwrite a new currency.
     const meta=context.repository.view.ReisenMeta?.[land];
     if(!meta||dependencies.getReiseCurrency(land)!==quote)return false;
     meta.budgetFxRates ||= {};meta.budgetFxRates[quote]=record;
     if(dependencies.speichern()===false){states.set(stateKey,{status:'storage',attempt:Date.now()});return false;}
     successful.set(quote,record);states.set(stateKey,{status:'ready',attempt:Date.now()});return true;
   }catch(_){states.set(stateKey,{status:'error',attempt:Date.now()});return !!cached;}
   finally{if(states.get(stateKey)?.status==='loading')states.delete(stateKey);repaint(land);}
 }
 function prepareReiseBudgetRate() {
   const land=context.session.aktuellesLand;
   if(land&&isLocal(land))return requestReiseBudgetRate(land);
   return Promise.resolve(false);
 }
 async function toggleReiseBudgetCurrency(land=context.session.aktuellesLand) {
   const quote=dependencies.getReiseCurrency(land);
   if(!land||!quote||quote==='EUR')return;
   const meta=context.repository.view.ReisenMeta[land];if(!meta)return;
   meta.budgetCurrencyDisplay=isLocal(land)?'eur':'local';
   if(dependencies.speichern()===false){repaint(land);return;}
   repaint(land);
   if(isLocal(land))await requestReiseBudgetRate(land);
 }
 function reiseBudgetRateState(land=context.session.aktuellesLand) {return states.get(land+':'+dependencies.getReiseCurrency(land))?.status||'';}
 function refreshReiseBudgetRate(){return requestReiseBudgetRate(context.session.aktuellesLand,true);}
 function renderReiseBudgetToggle() {
   const land=context.session.aktuellesLand,display=reiseBudgetPresentation(land);
   const disabled=!dependencies.getReiseCurrency(land)||display.quote==='EUR';
   const label=isLocal(land)?'Budgetanzeige auf Euro umstellen':'Budgetanzeige auf '+display.quote+' umstellen';
   return `<button type="button" class="reise-budget-switch" onclick="toggleReiseBudgetCurrency()" aria-label="${label}" aria-pressed="${isLocal(land)}"${disabled?' disabled':''}>${display.currency} <span aria-hidden="true">⇄</span></button>`;
 }
 function renderReiseBudgetRateNote() {
   const land=context.session.aktuellesLand,{quote,record}=reiseBudgetPresentation(land),state=states.get(land+':'+quote);
   if(!dependencies.getReiseCurrency(land))return 'Bitte eine Reisewährung auswählen.';
   if(quote==='EUR')return 'Budgetanzeige in Euro.';
   let text;
   if(record){
     const number=new Intl.NumberFormat('de-DE',{maximumFractionDigits:6}).format(record.rate);
     text=`1 € = ${number} ${quote} · Kurs vom ${dependencies.formatDatum(record.date)} · Richtwert`;
     if(navigator.onLine===false||state?.status==='offline')text+=' · Offline';
     else if(state?.status==='loading')text+=' · wird aktualisiert';
     else if(state?.status==='error')text+=' · gespeicherter Kurs';
     else if(state?.status==='storage')text+=' · neuer Kurs nicht gespeichert';
   }else if(state?.status==='loading')text='Kurs wird geladen · Anzeige vorerst in Euro.';
   else if(navigator.onLine===false||state?.status==='offline')text='Offline: noch kein Kurs gespeichert · Anzeige in Euro.';
   else if(state?.status==='error')text='Kein Kurs verfügbar · Anzeige bleibt in Euro.';
   else if(state?.status==='storage')text='Kurs konnte nicht gespeichert werden · Anzeige in Euro.';
   else text='Euro ⇄ '+quote+' · Umrechnung nur für diese Budgetanzeige.';
   const refresh=record||state?.status==='error'||state?.status==='offline'||state?.status==='storage';
   return text+(refresh?` <button type="button" class="reise-rate-refresh" onclick="refreshReiseBudgetRate()" aria-label="Wechselkurs aktualisieren"${state?.status==='loading'?' disabled':''}>↻</button>`:'');
 }
 window.addEventListener('online',()=>{prepareReiseBudgetRate();});
 window.addEventListener('offline',()=>{const land=context.session.aktuellesLand;if(land)repaint(land);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')prepareReiseBudgetRate();});
 return {reiseBudgetRateState,reiseBudgetPresentation,formatReiseBudgetAmount,requestReiseBudgetRate,prepareReiseBudgetRate,toggleReiseBudgetCurrency,refreshReiseBudgetRate,renderReiseBudgetToggle,renderReiseBudgetRateNote};
});
