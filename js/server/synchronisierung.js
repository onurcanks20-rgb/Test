Kostentracker.module({
  "id": "js/server/synchronisierung.js",
  "dependencies": [
    "hasUnsavedInputs", "clearUndoDelete",
    "showDetailedPaymentNotice", "resumePaymentImportedNotice",
    "merchantDestination",
    "merchantCategories",
    "validMerchantDestination",
    "rememberMerchantRule",
    "addDays",
    "openAccessibleDialog",
    "closeAccessibleDialog",
    "appendReiseExternalExpense",
    "refreshReiseImportedViews",
    "validateImportedPayment",
    "routeTravelPayment",
    "travelPaymentCategory",
    "importedForeignFx",
    "setupTravelPaymentTests",
    "appendFreizeitExternalExpense",
    "appendHaushaltExternalExpense",
    "formatBetragText",
    "formatDatum",
    "generateId",
    "isoAusDate",
    "istEintragAusgeblendet",
    "laufendeKostenImZeitraum",
    "normalizeFixkostenZuordnungTage",
    "parseBetrag",
    "parseISODate",
    "renderHomeUebersicht",
    "renderRecentAusgaben",
    "show",
    "versicherungsZahlungenImZeitraum",
    "importedEntryTime"
  ],
  "session": [],
  "read": [
    "*"
  ],
  "write": [
    "Einstellungen"
  ],
  "replace": true
}, (context, dependencies) => {
"use strict";

        let testServiceWorkerPromise = null;

        function withPushTimeout(promise, ms, message) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(message)), ms);
                Promise.resolve(promise).then(value => {
                    clearTimeout(timer);
                    resolve(value);
                }, error => {
                    clearTimeout(timer);
                    reject(error);
                });
            });
        }

        async function ensureTestServiceWorker() {
            if (!window.isSecureContext || !/^https?:$/.test(location.protocol)) {
                throw new Error("Bitte die App über ihre HTTPS-Adresse öffnen.");
            }
            if (!("serviceWorker" in navigator)) throw new Error("Service Worker wird von diesem Browser nicht unterstützt.");
            if (!testServiceWorkerPromise) {
                testServiceWorkerPromise = (async () => {
                    await withPushTimeout(
                        navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }),
                        10000, "Service Worker konnte nicht rechtzeitig geladen werden. Verbindung und service-worker.js prüfen."
                    );
                    const ready = await withPushTimeout(navigator.serviceWorker.ready, 10000,
                        "Service Worker wird nicht aktiv. Bitte die App neu öffnen und die Zusatzdateien prüfen.");
                    const scope = new URL("./", location.href).href;
                    if (ready.scope !== scope || !ready.active) throw new Error("Der erwartete Service Worker ist noch nicht aktiv. Bitte die App neu öffnen.");
                    return ready;
                })().catch(error => {
                    testServiceWorkerPromise = null;
                    throw error;
                });
            }
            return testServiceWorkerPromise;
        }


function openServerSettings() {dependencies.show('serverSettingsView');renderTestServerSettings();renderPushTestStatus();dependencies.setupTravelPaymentTests();}
async function renderPushTestStatus() {
  const node=document.getElementById('serverNotificationStatus');if(!node)return;
  if(!('Notification' in window)){node.textContent='Für Benachrichtigungen die App über ihr Home-Bildschirm-Icon öffnen.';return;}
  node.textContent=Notification.permission==='granted'?'Mitteilungen sind erlaubt.':Notification.permission==='denied'?'Mitteilungen sind blockiert. Bitte in den Geräteeinstellungen erlauben.':'Mitteilungen sind noch nicht aktiviert.';
}

// Main app integration; credentials are never in a data backup.
var testServerConfig = (() => { try {return JSON.parse(localStorage.getItem('kostenApp_test_server'))||{};} catch {return {};} })();
// Legacy saved credentials belong to the existing primary account.
var testServerBoundUser = (() => {try {return localStorage.getItem('kostenApp_test_user')||testServerConfig.userId||(testServerConfig.token?'person1':null);} catch {return testServerConfig.token?'person1':null;}})();
var testServerBusy = false, testServerTimer = null, testServerPending = false;
const TEST_SERVER_URL = 'https://kostentracker-test.onurcanks20.workers.dev';
var serverBackupRequired=false, serverRestorePromptSeen=false, serverLastStatus='';
let serverSyncRevision=0,serverSyncedRevision=-1,serverSyncConfirmed=false,serverSyncError=false;
function updateServerLoginControls() {
  const token=document.getElementById('testServerToken'),button=document.getElementById('serverLoginButton');
  if(button){button.textContent=testServerConfig.token&&token?.value.trim()===testServerConfig.token?'Jetzt synchronisieren':'Anmelden';button.disabled=testServerBusy;}
  if(token)token.disabled=testServerBusy;
  document.getElementById('serverRestoreNotice')?.classList.toggle('hidden',!serverBackupRequired);
  document.getElementById('serverAccountActions')?.classList.toggle('hidden',!testServerConfig.token);
  document.getElementById('storageServerRestoreActions')?.classList.toggle('hidden',!testServerConfig.token);
  const dialog=document.getElementById('serverRestoreDialog');if(dialog)dialog.dataset.busy=testServerBusy?'true':'false';
  for(const id of ['serverRestoreConfirm','serverRestoreLater']){const node=document.getElementById(id);if(node)node.disabled=testServerBusy;}
}
function showServerRestorePrompt(force=false) {
  if(serverRestorePromptSeen&&!force)return;
  const title=document.getElementById('serverRestoreTitle'),description=document.getElementById('serverRestoreDescription');
  if(title)title.textContent=serverBackupRequired?'Deine gespeicherten Daten sind da':'Daten wiederherstellen';
  if(description)description.textContent=serverBackupRequired?'Stelle deine bisherigen Einträge auf diesem Gerät wieder her. Danach werden neue Zahlungen automatisch übernommen.':'Lade deine gespeicherte Sicherung auf dieses Gerät.';
  const error=document.getElementById('serverRestoreError');if(error)error.textContent='';
  updateServerLoginControls();
  if(dependencies.openAccessibleDialog('serverRestoreDialog','serverRestoreTitle'))serverRestorePromptSeen=true;
}
function closeServerRestorePrompt() {
  if(testServerBusy)return;
  dependencies.closeAccessibleDialog('serverRestoreDialog');
}
function renderHomeSyncStatus() {
  renderStorageV2();
  const node=document.getElementById('homeSyncStatus');if(!node)return;
  let state='local',text='Nur auf diesem Gerät';
  if(testServerConfig?.token){
    const reviews=pendingPaymentCount();
    if(serverBackupRequired){state='restore';text='Daten wiederherstellen';}
    else if(navigator.onLine===false){state='offline';text='Offline · Synchronisierung folgt';}
    else if(testServerBusy){state='busy';text='Wird synchronisiert …';}
    else if(storageV2().status().error){state='error';text='Lokales Speichern prüfen';}
    else if(storageV2().status().conflicts.length){state='review';text='Änderungen abgleichen';}
    else if(serverSyncError){state='error';text='Noch nicht synchronisiert';}
    else if(storageV2().status().pending||serverSyncedRevision<serverSyncRevision||!serverSyncConfirmed){state='pending';text=serverSyncConfirmed?'Übertragung ausstehend':'Verbindung wird geprüft';}
    else if(reviews){state='review';text=reviews===1?'Eine Zahlung prüfen':reviews+' Zahlungen prüfen';}
    else{state='synced';text='Alles synchronisiert';}
  }
  node.textContent=text;node.dataset.state=state;node.setAttribute('aria-label',text+' – Anmeldung öffnen');
}
function serverStatus(message) {serverLastStatus=message;const storageNote=document.getElementById('storageV2ActionStatus');if(storageNote)storageNote.textContent=message;const node=document.getElementById('testServerStatus');if(node)node.textContent=message;updateServerLoginControls();renderHomeSyncStatus();}
function renderTestServerSettings() {
  renderServerPaymentReview();
  const node=document.getElementById('testServerToken');if(node)node.value=testServerConfig.token||'';
  serverStatus(serverBackupRequired?'Bitte deine Daten wiederherstellen, um neue Zahlungen zu übernehmen.':serverLastStatus||(testServerConfig.token?'Du bist angemeldet.':'Noch nicht angemeldet.'));
}
function bindTestServerUser(config) {
  if(!config.userId||!/^[-a-zA-Z0-9_]{1,40}$/.test(config.userId)) throw new Error('Bitte zuerst den neuen Worker für getrennte Zugänge deployen.');
  if(testServerBoundUser&&testServerBoundUser!==config.userId) throw new Error('Dieser Code gehört zu einer anderen Person. Dieses App-Profil bleibt bei deinem bisherigen Zugang. Für die zweite Person deren eigenes Handy verwenden.');
  if(!testServerBoundUser) localStorage.setItem('kostenApp_test_backup_check',config.userId);
  localStorage.setItem('kostenApp_test_user',config.userId);testServerBoundUser=config.userId;
}
async function saveTestServerSettings() {
  const token=document.getElementById('testServerToken').value.trim();
  if(token.length<32) throw new Error('Bitte deinen vollständigen persönlichen Zugangscode eingeben.');
  const remote=await testServerRequest('/api/config',undefined,token);
  bindTestServerUser(remote);
  const config={token,userId:remote.userId};localStorage.setItem('kostenApp_test_server',JSON.stringify(config));testServerConfig=config;
  return remote;
}
async function testServerRequest(path,value,token=testServerConfig?.token) {
  if(!token) throw new Error('Persönlicher Code fehlt.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(TEST_SERVER_URL+path,{method:value===undefined?'GET':'POST',cache:'no-store',signal:controller.signal,
      headers:{Authorization:'Bearer '+token,'X-Kostentracker-Storage':'2',...(value===undefined?{}:{'Content-Type':'application/json'})},
      ...(value===undefined?{}:{body:JSON.stringify(value)})});
    const data=await response.json();if(!response.ok) throw new Error(data.error||'Serverfehler '+response.status);return data;
  } finally {clearTimeout(timer);}
}
function scheduleTestServerSync() {
  serverSyncRevision++;renderHomeSyncStatus();
  if(!testServerConfig?.token) return;
  clearTimeout(testServerTimer);testServerTimer=setTimeout(()=>syncTestServer(false),1800);
}
function normalizedProvider(value) {return String(value||'').normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim();}
function showPaymentImportedNotice(success=true,paymentIds=[]) {
  dependencies.showDetailedPaymentNotice(success,paymentIds);
}
function simulatePaymentConfirmation() {
  const payment={id:'payment-demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12),merchant:'Wolt',amountCents:123,date:dependencies.isoAusDate(new Date()),source:'bank-push',category:'Einkauf',testOnly:true};
  const status=document.getElementById('paymentConfirmationTestStatus');
  try {
    const count=importTestServerPayments([payment]);dependencies.renderHomeUebersicht();
    if(status)status.textContent=count?'Lokale Testbuchung über 1,23 € erstellt. Über Ändern die Zuordnung prüfen.':'Die Testzahlung wartet auf deine Zuordnung in der Zahlungsprüfung.';
  } catch(error) {if(status)status.textContent='Testzahlung konnte nicht gespeichert werden. Bitte erneut versuchen.';}

}

function isPaypalEmail(payment) {return payment.source==='paypal-email';}
function rememberPaypalReceipt(payment,status,recurringKey=null) {
  if(!isPaypalEmail(payment))return;
  const settings=context.repository.view.Einstellungen;settings.serverPaypalReceipts??={};
  settings.serverPaypalReceipts[payment.id]={transactionId:payment.paypalTransactionId,date:payment.date,amountCents:payment.amountCents,merchant:payment.merchant,status,...(recurringKey?{recurringKey}:{})};
}
function possiblePaypalDuplicate(payment) {
  const days=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
  if(!isPaypalEmail(payment)){
    if(payment.bank!=='paypal'&&!/paypal/iu.test(payment.merchant||''))return false;
    return Object.values(context.repository.view.Einstellungen?.serverPaypalReceipts||{}).some(p=>p.amountCents===payment.amountCents&&days(payment.date,p.date)>=0&&days(payment.date,p.date)<=14);
  }
  const records=[...(context.repository.view.Einstellungen?.serverPendingReview||[])];
  for(const group of [context.repository.view.Haushalt,context.repository.view.Freizeit,...Object.values(context.repository.view.Reisen||{})])for(const list of Object.values(group||{}))if(Array.isArray(list))for(const e of list)if(e._serverPaymentId)records.push({id:e._serverPaymentId,merchant:e._serverMerchant||e.text,date:e.datum,amountCents:Math.round(e.betrag*100)});
  return records.some(p=>p.id!==payment.id&&p.amountCents===payment.amountCents&&p.date===payment.date&&normalizedProvider(p.merchant)===normalizedProvider(payment.merchant));
}
function recurringPaymentMatches(payment) {
  const paid=dependencies.parseISODate(payment.date), from=dependencies.addDays(paid,-31), to=dependencies.addDays(paid,31);
  const rows=[...dependencies.laufendeKostenImZeitraum(from,to),...dependencies.versicherungsZahlungenImZeitraum(from,to)];
  const matches=[],unknown=[],all=[];
  const calendar=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  for(const due of rows) {
    if(Math.round((dependencies.parseBetrag(due.betrag)||0)*100)!==payment.amountCents) continue;
    const insurance=due.typ==='versicherung';
    const item=(insurance?context.repository.view.Versicherungen:context.repository.view['Laufende Kosten']?.fix)?.find(e=>String(e.id)===String(due.sourceId));
    if(!item||dependencies.istEintragAusgeblendet(insurance?'versicherungen':'fixkosten',item.id)) continue;
    const window=dependencies.normalizeFixkostenZuordnungTage(item.zuordnungTage);
    if(Math.abs(calendar(due.datum)-calendar(paid))/86400000>window) continue;
    const candidate={...due,key:[due.typ,String(item.id),dependencies.isoAusDate(due.datum)].join(':')};all.push(candidate);
    const aliases=String(insurance?item.anbieter||'':item.haendler||'').split(';').map(normalizedProvider).filter(Boolean);
    if(!aliases.length) {unknown.push(candidate);continue;}
    if(aliases.includes(normalizedProvider(payment.merchant))) matches.push(candidate);
  }
  return {matches,unknown,all};
}
function classifyPushPayment(payment) {
  if(payment.reviewReason) return {review:payment.reviewReason};
  if(possiblePaypalDuplicate(payment))return {review:'Mögliche doppelte PayPal-Zahlung oder spätere Bankabbuchung. Bereits erfasste Zahlung bitte prüfen und gegebenenfalls ignorieren.'};
  if(payment.amountCents===null)return dependencies.routeTravelPayment(payment);
  if(payment.source!=='bank-push'&&!isPaypalEmail(payment)) return classifyMerchantPayment(payment);
  const {matches,unknown,all}=recurringPaymentMatches(payment);
  if(matches.length===1&&!unknown.length) {
    if(context.repository.view.Einstellungen?.serverRecurringMatches?.[matches[0].key]) return {review:'Für diese Fälligkeit wurde bereits eine Zahlung zugeordnet.'};
    return {recurring:matches[0]};
  }
  if(matches.length>1||unknown.length||(isPaypalEmail(payment)&&all.length)) return {review:'Mögliche Fixkosten/Versicherung: Anbieter, Betrag und Fälligkeit bitte prüfen.'};
  return classifyMerchantPayment(payment);
}
function classifyMerchantPayment(payment) {
  const route=dependencies.routeTravelPayment(payment);
  if(route.review)return route;
  if(!dependencies.merchantDestination(payment.merchant))return {review:'Unbekannter Händler. Wohin gehört diese Zahlung?',travelCandidates:route.destination?[route.destination.land]:[]};
  return route;
}
function importedPaymentDestination(payment) {
  const travel=dependencies.routeTravelPayment(payment);if(travel.destination)return travel.destination;
  const target=dependencies.merchantDestination(payment.merchant);
  if(!target)throw Error('Unbekannten Händler bitte zuerst zuordnen.');
  return target;
}
function appendImportedPayment(payment,destination=null) {
  const target=destination||importedPaymentDestination(payment),month=Number(payment.date.slice(5,7));
  const entry={id:dependencies.generateId(),text:String(payment.merchant||'Apple Pay').slice(0,200),betrag:payment.amountCents/100,datum:payment.date,kategorie:target.category,_serverPaymentId:payment.id,...(isPaypalEmail(payment)?{_paypalTransactionId:payment.paypalTransactionId,_paymentSource:'paypal-email'}:{}),...(payment.notificationDate?{_notificationDate:payment.notificationDate}:{}),...dependencies.importedEntryTime(payment),...(payment.testOnly?{_testPayment:true}:{})};
  const fx=dependencies.importedForeignFx(payment,target.land);if(fx)entry.fx=fx;
  if(target.area==='Reisen'){dependencies.appendReiseExternalExpense(entry,target.land,target.category);return;}
  if(target.area==='Freizeit') dependencies.appendFreizeitExternalExpense(entry,month);else dependencies.appendHaushaltExternalExpense(entry,month);
}
let reviewGateOverflow=null,reviewGateFallback=false;
const reviewGateInert=new Map();
function pendingPaymentCount() {return (context.repository.view.Einstellungen?.serverPendingReview||[]).length;}
function syncPaymentReviewGate() {
  if(document.documentElement.classList.contains('boot-starting'))return;
  const dialog=document.getElementById('paymentReviewDialog');if(!dialog)return;
  const count=pendingPaymentCount(),remaining=document.getElementById('paymentReviewRemaining');
  if(remaining)remaining.textContent=count===1?'Eine Zahlung ist offen. Bitte entscheiden.':`${count} Zahlungen sind offen. Bitte alle entscheiden.`;
  if(count){
    if(reviewGateOverflow===null){reviewGateOverflow=document.body.style.overflow||'';document.body.style.overflow='hidden';}
    if(!dialog.open){
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{reviewGateFallback=true;dialog.setAttribute('open','');dialog.open=true;document.body.classList.add('payment-review-fallback');for(const node of Array.from(document.body.children)){if(node===dialog)continue;reviewGateInert.set(node,node.inert);node.inert=true;}}
      document.getElementById('paymentReviewHeading')?.focus();
    }
  }else{
    if(dialog.open){if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');dialog.open=false;}}
    if(reviewGateOverflow!==null){document.body.style.overflow=reviewGateOverflow;reviewGateOverflow=null;}
    for(const [node,previous]of reviewGateInert)node.inert=previous;reviewGateInert.clear();reviewGateFallback=false;document.body.classList.remove('payment-review-fallback');
  }
}
function initializePaymentReviewGate() {
  const dialog=document.getElementById('paymentReviewDialog');if(!dialog)return;
  dialog.addEventListener('cancel',event=>{if(pendingPaymentCount())event.preventDefault();});
  dialog.addEventListener('close',()=>{if(pendingPaymentCount())setTimeout(syncPaymentReviewGate,0);});
  document.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}
    if(reviewGateFallback&&event.key==='Tab'){
      const controls=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]'));
      const first=controls[0],last=controls[controls.length-1];
      if(!first){event.preventDefault();document.getElementById('paymentReviewHeading')?.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement))){event.preventDefault();first.focus();}
    }
  });
  document.addEventListener('focusin',event=>{if(reviewGateFallback&&dialog.open&&!dialog.contains(event.target))document.getElementById('paymentReviewHeading')?.focus();});
  renderServerPaymentReview();
}

function reviewCategories(id) {
  const target=document.getElementById('reviewTarget-'+id)?.value||'';
  const select=document.getElementById('reviewCategory-'+id);if(!select)return;
  select.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent='Kategorie auswählen';select.appendChild(first);
  const options=target.startsWith('recurring:')?[]:target.startsWith('reise:')?Object.keys(context.repository.view.Reisen?.[target.slice(6)]||{}):dependencies.merchantCategories(target);
  for(const category of options){const option=document.createElement('option');option.value=category;option.textContent=category;select.appendChild(option);}
  select.value='';select.disabled=!options.length;
  const payment=(context.repository.view.Einstellungen?.serverPendingReview||[]).find(p=>p.id===id),known=dependencies.merchantDestination(payment?.merchant);
  if(known?.area===target&&options.includes(known.category))select.value=known.category;
  const remember=document.getElementById('reviewRemember-'+id);if(remember){remember.disabled=!['Haushalt','Freizeit'].includes(target);if(remember.disabled)remember.checked=false;}
}
function renderServerPaymentReview() {
  const host=document.getElementById('serverPaymentReview');if(!host){syncPaymentReviewGate();return;}host.replaceChildren();const error=document.getElementById('paymentReviewError');if(error)error.textContent='';
  const pending=context.repository.view.Einstellungen?.serverPendingReview||[];
  const title=document.createElement('strong');title.textContent=`Zahlungen zur Prüfung: ${pending.length}`;host.appendChild(title);
  const note=document.createElement('div');note.className='settings-note';note.textContent='Ziel und Betrag prüfen. Eindeutig zugeordnete Fixkosten werden nicht erneut abgezogen.';host.appendChild(note);
  for(const payment of pending) {
    const row=document.createElement('div');row.style.cssText='margin-top:12px;padding:12px;border-radius:12px;background:var(--secondary);';
    const amount=payment.amountCents===null?`${payment.foreign.amount} ${payment.foreign.currency}`:dependencies.formatBetragText(payment.amountCents/100);
    const label=document.createElement('div');label.textContent=`${payment.merchant} · ${amount} · ${dependencies.formatDatum(payment.date)}`;row.appendChild(label);
    if(payment.foreign&&payment.amountCents!==null){const foreign=document.createElement('div');foreign.className='settings-note';foreign.textContent=`Originalbetrag: ${payment.foreign.amount} ${payment.foreign.currency}`;row.appendChild(foreign);}
    if(isPaypalEmail(payment)){const source=document.createElement('div');source.className='settings-note';source.textContent='PayPal-E-Mail · Transaktion '+payment.paypalTransactionId;row.appendChild(source);}
    const reason=document.createElement('div');reason.className='settings-note';reason.textContent=payment.reviewReason;row.appendChild(reason);
    if(payment.notificationText){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Mitteilung anzeigen';details.appendChild(summary);const raw=document.createElement('div');raw.className='settings-note';raw.textContent=[payment.notificationTitle,payment.notificationSubtitle,payment.notificationText].filter(Boolean).join(' · ');details.appendChild(raw);row.appendChild(details);}
    const route=dependencies.routeTravelPayment(payment),target=document.createElement('select');target.id='reviewTarget-'+payment.id;target.setAttribute('aria-label','Zahlung zuordnen');
    const empty=document.createElement('option');empty.value='';empty.textContent='Ziel auswählen';target.appendChild(empty);
    for(const area of ['Haushalt','Freizeit']){const option=document.createElement('option');option.value=area;option.textContent=area;target.appendChild(option);}
    for(const land of Object.keys(context.repository.view.Reisen||{})){const option=document.createElement('option');option.value='reise:'+land;option.textContent='Reise: '+land;target.appendChild(option);}
    if(isPaypalEmail(payment))for(const due of recurringPaymentMatches(payment).all){
      const option=document.createElement('option');option.value='recurring:'+due.key;option.textContent=(due.typ==='versicherung'?'Versicherung: ':'Fixkosten: ')+due.name+' · '+dependencies.formatDatum(dependencies.isoAusDate(due.datum))+' (bereits eingeplant)';target.appendChild(option);
    }
    const known=dependencies.merchantDestination(payment.merchant);target.value=isPaypalEmail(payment)?'':route.destination?'reise:'+route.destination.land:route.review?'':known?.area||'';target.addEventListener('change',()=>reviewCategories(payment.id));row.appendChild(target);
    const category=document.createElement('select');category.id='reviewCategory-'+payment.id;category.setAttribute('aria-label','Kategorie');row.appendChild(category);
    const rememberLabel=document.createElement('label');rememberLabel.className='merchant-remember';const remember=document.createElement('input');remember.type='checkbox';remember.id='reviewRemember-'+payment.id;rememberLabel.appendChild(remember);const rememberText=document.createElement('span');rememberText.textContent='Für diesen Händler merken';rememberLabel.appendChild(rememberText);row.appendChild(rememberLabel);
    if(payment.amountCents===null){const euro=document.createElement('input');euro.id='reviewEuro-'+payment.id;euro.type='text';euro.inputMode='decimal';euro.placeholder='Abgerechneter Betrag in Euro';euro.setAttribute('aria-label','Abgerechneter Betrag in Euro');row.appendChild(euro);}
    const accept=document.createElement('button');accept.type='button';accept.textContent='Zahlung übernehmen';accept.addEventListener('click',()=>resolveServerPaymentReview(payment.id,true,target.value,document.getElementById('reviewEuro-'+payment.id)?.value,category.value,remember.checked));row.appendChild(accept);
    const ignore=document.createElement('button');ignore.type='button';ignore.textContent='Bereits berücksichtigt / ignorieren';ignore.addEventListener('click',()=>resolveServerPaymentReview(payment.id,false));row.appendChild(ignore);
    host.appendChild(row);reviewCategories(payment.id);
    if(route.destination&&known)category.value=route.destination.category;
  }
  syncPaymentReviewGate();dependencies.resumePaymentImportedNotice();
}
function resolveServerPaymentReview(id,book,target=null,euroValue=null,category=null,remember=false) {
  const pending=context.repository.view.Einstellungen?.serverPendingReview||[],payment=pending.find(p=>p.id===id);if(!payment)return;
  let resolved=payment,destination,recurring=null;
  if(book){
    if(payment.amountCents===null){const euro=dependencies.parseBetrag(euroValue);if(!Number.isFinite(euro)||euro<=0||euro>1000000){alert('Bitte den abgerechneten Eurobetrag ergänzen.');return;}resolved={...payment,amountCents:Math.round(euro*100)};if(resolved.amountCents<=0){alert('Eurobetrag ist kleiner als ein Cent.');return;}}
    const route=dependencies.routeTravelPayment(resolved);
    if(target===null&&(route.review||!dependencies.merchantDestination(resolved.merchant))){alert('Bitte Bereich und Kategorie auswählen.');return;}
    if(target===''){alert('Bitte ein Ziel auswählen.');return;}
    if(target?.startsWith('recurring:')){
      if(!isPaypalEmail(resolved)){alert('Ungültiges Ziel.');return;}
      recurring=recurringPaymentMatches(resolved).all.find(due=>due.key===target.slice(10));
      if(!recurring){alert('Diese Fälligkeit passt nicht mehr. Bitte erneut prüfen.');return;}
      if(context.repository.view.Einstellungen.serverRecurringMatches?.[recurring.key]){alert('Für diese Fälligkeit ist bereits eine Zahlung zugeordnet. Bitte bereits berücksichtigt / ignorieren wählen.');return;}
    }else if(target?.startsWith('reise:')){
      const land=target.slice(6),options=Object.keys(context.repository.view.Reisen?.[land]||{});
      const chosen=category||(!remember&&dependencies.merchantDestination(resolved.merchant)?dependencies.travelPaymentCategory(resolved,land):'');
      if(!options.includes(chosen)){alert('Bitte eine Reisekategorie auswählen.');return;}
      destination={area:'Reisen',land,category:chosen};
    }else if(['Haushalt','Freizeit'].includes(target)){
      if(!dependencies.validMerchantDestination(target,category)){alert('Bitte eine Kategorie auswählen.');return;}
      destination={area:target,category};
    }else if(target==='alltag'){
      destination=dependencies.merchantDestination(resolved.merchant);if(!destination){alert('Bitte Haushalt oder Freizeit und eine Kategorie auswählen.');return;}
    }else if(target!==null){alert('Ungültiges Ziel.');return;}

  }
  const before=context.clone(context.repository.view);
  try {
    if(book){dependencies.validateImportedPayment(resolved);if(remember&&!recurring){if(!destination||!['Haushalt','Freizeit'].includes(destination.area))throw Error('Händlerzuordnungen bitte für Haushalt oder Freizeit speichern.');dependencies.rememberMerchantRule(resolved.merchant,destination.area,destination.category);}if(recurring){context.repository.view.Einstellungen.serverRecurringMatches??={};context.repository.view.Einstellungen.serverRecurringMatches[recurring.key]={paymentId:resolved.id,date:resolved.date,merchant:resolved.merchant};}else appendImportedPayment(resolved,destination);}
    rememberPaypalReceipt(resolved,book?(recurring?'recurring':'booked'):'ignored',recurring?.key);
    context.repository.view.Einstellungen.serverPendingReview=pending.filter(p=>p.id!==id);
    context.storage.setItem(context.storage.key,JSON.stringify(context.repository.view));context.storage.lastSaved=JSON.stringify(context.repository.view);
  } catch(error) {context.repository.view=before;showPaymentImportedNotice(false);serverStatus('Entscheidung konnte nicht gespeichert werden. Ziel prüfen und erneut versuchen.');const status=document.getElementById('paymentReviewError');if(status)status.textContent='Entscheidung konnte nicht gespeichert werden. Die Zahlung bleibt offen. Ziel prüfen und erneut versuchen.';syncPaymentReviewGate();return;}
  if(book&&!recurring)showPaymentImportedNotice(true,[resolved.id]);renderServerPaymentReview();dependencies.refreshReiseImportedViews();dependencies.renderHomeUebersicht();dependencies.renderRecentAusgaben('haushalt');dependencies.renderRecentAusgaben('freizeit');scheduleTestServerSync();
}

function importTestServerPayments(payments) {
  if(!Array.isArray(payments)||payments.length>100) throw new Error('Ungültige Zahlungsliste.');
  const ids=new Set(context.repository.view.Einstellungen?.serverImportIds||[]);
  for(const area of ['Haushalt','Freizeit']) Object.values(context.repository.view[area]||{}).forEach(list=>Array.isArray(list)&&list.forEach(e=>{if(e._serverPaymentId)ids.add(e._serverPaymentId);}));
  for(const trip of Object.values(context.repository.view.Reisen||{}))Object.values(trip||{}).forEach(list=>Array.isArray(list)&&list.forEach(e=>{if(e._serverPaymentId)ids.add(e._serverPaymentId);}));
  const before=context.clone(context.repository.view);let count=0;const noticeIds=[];
  try {
    for(const payment of payments) {
      dependencies.validateImportedPayment(payment);
      if(ids.has(payment.id)) continue;
      const classification=classifyPushPayment(payment);
      context.repository.view.Einstellungen??={};
      if(classification.review) {
        context.repository.view.Einstellungen.serverPendingReview??=[];
        if(!context.repository.view.Einstellungen.serverPendingReview.some(p=>p.id===payment.id)) context.repository.view.Einstellungen.serverPendingReview.push({...payment,reviewReason:classification.review});
      } else if(classification.recurring) {
        context.repository.view.Einstellungen.serverRecurringMatches??={};
        context.repository.view.Einstellungen.serverRecurringMatches[classification.recurring.key]={paymentId:payment.id,date:payment.date,merchant:payment.merchant};
      } else {appendImportedPayment(payment);count++;noticeIds.push(payment.id);}
      rememberPaypalReceipt(payment,classification.review?'pending':classification.recurring?'recurring':'booked',classification.recurring?.key);
      if(payment.testOnly){context.repository.view.Einstellungen.serverTravelDemoIds??=[];context.repository.view.Einstellungen.serverTravelDemoIds.push(payment.id);}
      ids.add(payment.id);
    }
    context.repository.view.Einstellungen??={};context.repository.view.Einstellungen.serverImportIds=[...ids];
    // Save before acknowledgment: after a crash/retry the IDs prevent duplication.
    context.storage.setItem(context.storage.key,JSON.stringify(context.repository.view));context.storage.lastSaved=JSON.stringify(context.repository.view);
  } catch(error) {context.repository.view=before;showPaymentImportedNotice(false);throw error;}
  if(count>0) showPaymentImportedNotice(true,noticeIds);
  renderServerPaymentReview();dependencies.refreshReiseImportedViews();
  return count;
}
function prepareStorageSettings(){
 const token=document.getElementById('testServerToken');if(token)token.value=testServerConfig.token||'';
 backupHistoryOpen=false;backupHistoryRequest++;const host=document.getElementById('storageV2Backups');if(host)host.hidden=true;updateBackupHistoryButton();renderStorageV2();updateServerLoginControls();const note=document.getElementById('storageV2ActionStatus');if(note)note.textContent=serverLastStatus;
}
function storageV2(){return context.storage.database;}
function adoptDatabase(){context.repository.view=storageV2().data();context.storage.lastSaved=storageV2().read();}
function renderStorageV2(){
 const state=storageV2().status(),node=document.getElementById('storageV2Status');
 const connected=!!testServerConfig?.token;document.getElementById('storageV2LoginNotice')?.classList.toggle('hidden',connected);const create=document.getElementById('storageV2Create');if(create)create.disabled=!connected||testServerBusy;
 if(node)node.textContent=`Auf diesem Gerät: ${(state.bytes/1024).toLocaleString('de-DE',{maximumFractionDigits:1})} KB · ${state.pending} Änderungen ausstehend`+(state.error?' · Lokales Speichern prüfen':'');
 const host=document.getElementById('storageV2Conflicts');if(!host)return;host.replaceChildren();
 state.conflicts.forEach((item,index)=>{
  const row=document.createElement('div');row.className='settings-page-card';
  const title=document.createElement('strong');title.textContent='Änderung prüfen: '+KostentrackerRecords.label(item.key,storageV2().records().get(item.key)||item.remote.payload);row.appendChild(title);
  const note=document.createElement('p');note.className='settings-note';note.textContent='Dieser Eintrag wurde auch auf dem Server geändert. Beide Fassungen bleiben bis zu deiner Entscheidung erhalten.';row.appendChild(note);
  const describe=payload=>{if(payload===null)return 'Gelöscht';const record=JSON.parse(payload);if(record.type!=='value')return record.type==='array'?'Liste vorhanden':'Bereich vorhanden';const value=record.value;if(!value||typeof value!=='object')return String(value??'Leer');return [value.text||value.name,value.betrag!=null?Number(value.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):'',value.datum||''].filter(Boolean).join(' · ')||'Gespeicherter Eintrag';};
  for(const [label,payload]of [['Auf diesem Gerät',storageV2().records().get(item.key)??null],['Auf dem Server',item.remote.payload]]){const line=document.createElement('p');line.className='settings-note';line.textContent=label+': '+describe(payload);row.appendChild(line);}
  for(const [keep,label]of [[true,'Meine Änderung verwenden'],[false,'Serverstand verwenden']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>resolveStorageConflict(index,keep);row.appendChild(button);}host.appendChild(row);
 });
}
async function resolveStorageConflict(index,keepLocal){
 if(testServerBusy)return;const item=storageV2().status().conflicts[index];if(!item)return;
 if(!confirm(keepLocal?'Deine Änderung für diesen Eintrag verwenden?':'Den Serverstand für diesen Eintrag übernehmen?'))return;
 try{await storageV2().resolve(item.key,keepLocal);adoptDatabase();dependencies.renderHomeUebersicht();dependencies.refreshReiseImportedViews();renderStorageV2();scheduleTestServerSync();}catch(error){serverStatus('Änderung konnte nicht übernommen werden: '+error.message);}
}
async function readV2Snapshot(backupId){
 const records=[];let after='',cursor=null;
 for(let page=0;page<10000;page++){
  const path=backupId?'/api/v2/backup-records?id='+encodeURIComponent(backupId)+'&after='+encodeURIComponent(after):'/api/v2/snapshot?after='+encodeURIComponent(after);
  const result=await testServerRequest(path);if(cursor===null)cursor=result.cursor;records.push(...result.records);if(!result.next)return {records,cursor};after=result.next;
 }
 throw Error('Zu viele Datenseiten. Bitte erneut versuchen.');
}
async function pullV2(){
 for(let page=0;page<10000;page++){const result=await testServerRequest('/api/v2/changes?after='+storageV2().status().cursor);await storageV2().receive(result);if(!result.more){adoptDatabase();return;}}
 throw Error('Weitere Daten sind noch nicht abgeglichen. Bitte erneut synchronisieren.');
}
let backupHistoryOpen=false,backupHistoryAll=false,backupHistoryRequest=0,backupHistoryCache=null;
let backupPreview=null,backupPreviewRequest=0;
function updateBackupHistoryButton(){const button=document.getElementById('storageV2HistoryToggle');if(button){button.textContent=backupHistoryOpen?'Sicherungsstände ausblenden':'Sicherungsstände anzeigen';button.setAttribute('aria-expanded',String(backupHistoryOpen));}}
function drawBackupHistory(){
 const host=document.getElementById('storageV2Backups');if(!host||!backupHistoryCache)return;host.replaceChildren();
 const items=backupHistoryAll?backupHistoryCache.backups:backupHistoryCache.backups.slice(0,3);let day='';
 for(const item of items){
  const date=new Date(item.created),heading=date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  if(heading!==day){day=heading;const title=document.createElement('h4');title.className='backup-day';title.textContent=heading;host.appendChild(title);}
  const button=document.createElement('button');button.type='button';button.className='backup-history-row';
  const title=document.createElement('span');title.textContent=date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+(item.kind==='manuell'?'Manuell':'Automatisch');
  const hint=document.createElement('span');hint.className='backup-row-hint';hint.textContent='Änderungen ansehen ›';button.append(title,hint);
  button.onclick=()=>restoreHistoricalBackup(item.id,heading+' · '+date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));host.appendChild(button);
 }
 if(!items.length){const note=document.createElement('p');note.className='settings-note';note.textContent='Noch keine Sicherungsstände vorhanden.';host.appendChild(note);}
 if(backupHistoryCache.backups.length>3){const button=document.createElement('button');button.type='button';button.className='backup-more';button.textContent=backupHistoryAll?'Weniger anzeigen':'Alle '+backupHistoryCache.backups.length+' Stände anzeigen';button.onclick=()=>{backupHistoryAll=!backupHistoryAll;drawBackupHistory();};host.appendChild(button);}
 const more=document.createElement('details');more.className='backup-older';const summary=document.createElement('summary');summary.textContent='Weitere Sicherungen';more.appendChild(summary);
 if(backupHistoryCache.legacy){const button=document.createElement('button');button.type='button';button.className='backup-history-row';button.textContent='Vor der Speicherumstellung · Änderungen ansehen';button.onclick=()=>restoreHistoricalBackup('legacy','Vor der Speicherumstellung');more.appendChild(button);}
 const original=document.createElement('button');original.type='button';original.className='backup-history-row';original.textContent='Daten vor der Umstellung als Datei exportieren';original.onclick=()=>exportStorageMigrationBackup();more.appendChild(original);host.appendChild(more);
}
async function renderServerBackupHistory(refresh=false){
 const host=document.getElementById('storageV2Backups');if(!host)return;
 if(refresh!==true&&backupHistoryOpen){backupHistoryOpen=false;backupHistoryRequest++;host.hidden=true;updateBackupHistoryButton();return;}
 backupHistoryOpen=true;host.hidden=false;updateBackupHistoryButton();const request=++backupHistoryRequest;
 if(!backupHistoryCache){host.textContent='Sicherungsstände werden geladen …';host.setAttribute('aria-busy','true');}
 if(!testServerConfig?.token){host.textContent='Bitte zuerst anmelden.';return;}
 try{
  const state=await testServerRequest('/api/v2/status');if(request!==backupHistoryRequest)return;
  if(!state.ready){host.textContent='Sicherungsstände erscheinen nach der ersten vollständigen Synchronisierung.';return;}
  const result=await testServerRequest('/api/v2/backups');if(request!==backupHistoryRequest)return;
  backupHistoryCache={backups:result.backups,legacy:state.legacy};drawBackupHistory();
 }catch(error){if(request===backupHistoryRequest)host.textContent='Sicherungsstände derzeit nicht abrufbar: '+error.message;}
 finally{if(request===backupHistoryRequest)host.removeAttribute('aria-busy');}
}
async function exportStorageMigrationBackup(){
 try{const data=await storageV2().migrationSnapshot();if(!data)throw Error('Auf diesem Gerät gibt es keine Sicherung vor der Umstellung.');const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='Kostentracker-vor-Speicherumstellung.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){serverStatus(error.message);}
}
async function createServerBackup(){
 if(testServerBusy)return;
 try{await syncTestServer();if(storageV2().status().pending||storageV2().status().conflicts.length||serverSyncError)throw Error('Bitte zuerst alle Änderungen synchronisieren und Konflikte klären.');await testServerRequest('/api/v2/backup',{manual:true});await renderServerBackupHistory(true);serverStatus('Zusätzlicher Sicherungsstand erstellt.');}catch(error){serverStatus('Sicherung nicht erstellt: '+error.message);}
}
function setBackupPreviewBusy(busy){const dialog=document.getElementById('backupPreviewDialog');if(dialog)dialog.dataset.busy=String(busy);for(const id of ['backupPreviewConfirm','backupPreviewCancel']){const button=document.getElementById(id);if(button)button.disabled=busy;}}
function closeBackupPreview(){if(document.getElementById('backupPreviewDialog')?.dataset.busy==='true')return;backupPreviewRequest++;backupPreview=null;dependencies.closeAccessibleDialog('backupPreviewDialog');}
function drawBackupPreview(data,label,message=''){
 const diff=KostentrackerBackupDiff.compare(storageV2().data(),data),host=document.getElementById('backupPreviewChanges');host.replaceChildren();
 document.getElementById('backupPreviewDate').textContent=label;
 document.getElementById('backupPreviewSummary').textContent=message||(diff.total?'So würde sich dein aktueller Stand ändern:':'Dieser Sicherungsstand entspricht deinen aktuellen Daten.');
 for(const [key,title]of [['removed','Buchungen entfernen'],['added','Buchungen wieder hinzufügen'],['changed','Buchungen ändern'],['other','Budgets, Kategorien & Einstellungen ändern']]){
  const rows=diff[key];if(!rows.length)continue;const section=document.createElement('section');const heading=document.createElement('h3');heading.textContent=rows.length+' · '+title;section.appendChild(heading);
  const add=(parent,row)=>{const line=document.createElement('div');line.className='backup-change';const name=document.createElement('strong');name.textContent=row.title;line.appendChild(name);if(row.detail){const detail=document.createElement('p');detail.textContent=row.detail;line.appendChild(detail);}parent.appendChild(line);};
  rows.slice(0,8).forEach(row=>add(section,row));if(rows.length>8){const more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Weitere '+(rows.length-8)+' Änderungen';more.appendChild(summary);rows.slice(8).forEach(row=>add(more,row));section.appendChild(more);}host.appendChild(section);
 }
 document.getElementById('backupPreviewConfirm').disabled=!diff.total;
 return diff;
}
async function restoreHistoricalBackup(id,label='Ausgewählter Sicherungsstand'){
 if(testServerBusy)return;
 if(!dependencies.openAccessibleDialog('backupPreviewDialog','backupPreviewTitle'))return;
 const request=++backupPreviewRequest;backupPreview=null;document.getElementById('backupPreviewDate').textContent=label;document.getElementById('backupPreviewSummary').textContent='Änderungen werden verglichen …';document.getElementById('backupPreviewChanges').replaceChildren();document.getElementById('backupPreviewError').textContent='';document.getElementById('backupPreviewConfirm').disabled=true;
 try{
  let data;if(id==='legacy'){const saved=await testServerRequest('/api/backup');data=saved.data;}else{const snapshot=await readV2Snapshot(id);if(!snapshot.records.length)throw Error('Dieser Sicherungsstand ist nicht mehr verfügbar.');data=KostentrackerRecords.decode(new Map(snapshot.records.filter(row=>row.payload!==null).map(row=>[row.key,row.payload])));}
  if(request!==backupPreviewRequest||!document.getElementById('backupPreviewDialog').open)return;
  if(!data?.Haushalt||!data?.Einstellungen)throw Error('Sicherungsstand ungültig.');
  backupPreview={id,label,data,baseline:KostentrackerBackupDiff.stable(storageV2().data())};drawBackupPreview(data,label);
 }catch(error){if(request===backupPreviewRequest){document.getElementById('backupPreviewSummary').textContent='Vorschau konnte nicht geladen werden.';document.getElementById('backupPreviewError').textContent=error.message;}}
}
async function confirmBackupPreview(){
 if(testServerBusy||!backupPreview||!document.getElementById('backupPreviewDialog')?.open||document.getElementById('backupPreviewDialog').dataset.busy==='true')return;
 const selected=backupPreview;setBackupPreviewBusy(true);document.getElementById('backupPreviewError').textContent='';
 try{
  await syncTestServer();if(storageV2().status().pending||storageV2().status().conflicts.length||serverSyncError||!serverSyncConfirmed)throw Error('Bitte zuerst vollständig synchronisieren und offene Änderungen klären.');
  if(selected!==backupPreview)return;
  if(selected.baseline!==KostentrackerBackupDiff.stable(storageV2().data())){selected.baseline=KostentrackerBackupDiff.stable(storageV2().data());drawBackupPreview(selected.data,selected.label,'Dein aktueller Stand hat sich inzwischen geändert. Bitte die aktualisierte Vorschau erneut prüfen.');return;}
  if(!KostentrackerBackupDiff.compare(storageV2().data(),selected.data).total)return;
  testServerBusy=true;await testServerRequest('/api/v2/backup',{manual:true});
  // Recheck after the network request: never apply a preview over newer local changes.
  if(selected.baseline!==KostentrackerBackupDiff.stable(storageV2().data())){selected.baseline=KostentrackerBackupDiff.stable(storageV2().data());drawBackupPreview(selected.data,selected.label,'Deine Daten haben sich geändert. Bitte die Vorschau erneut prüfen.');return;}
  await storageV2().replace(selected.data);adoptDatabase();dependencies.clearUndoDelete();await storageV2().flush();location.reload();
 }catch(error){document.getElementById('backupPreviewError').textContent='Wiederherstellung nicht durchgeführt: '+error.message;}
 finally{testServerBusy=false;setBackupPreviewBusy(false);if(backupPreview)document.getElementById('backupPreviewConfirm').disabled=!KostentrackerBackupDiff.compare(storageV2().data(),backupPreview.data).total;renderHomeSyncStatus();}
}

async function syncTestServer(saveSettings=false) {
  if(testServerBusy){testServerPending=true;return;}
  if(dependencies.hasUnsavedInputs?.()){serverStatus('Deine Eingabe bleibt offen. Synchronisierung folgt nach dem Abschließen.');clearTimeout(testServerTimer);testServerTimer=setTimeout(()=>syncTestServer(false),5000);return;}
  try {
    testServerBusy=true;serverStatus('Daten werden synchronisiert …');
    if(saveSettings)await saveTestServerSettings();else{if(!testServerConfig?.token){serverStatus('Noch nicht angemeldet.');return;}bindTestServerUser(await testServerRequest('/api/config'));}
    const db=storageV2();context.storage.setItem(context.storage.key,JSON.stringify(context.repository.view));await db.flush();
    const state=await testServerRequest('/api/v2/status');
    if((localStorage.getItem('kostenApp_test_backup_check')===testServerBoundUser||!db.status().hadLegacy&&!db.status().confirmedServer)&&(state.ready||state.legacy)){
      serverBackupRequired=true;serverStatus('Bitte vorhandene Daten wiederherstellen. Lokale Daten werden nicht automatisch darübergeschrieben.');showServerRestorePrompt(saveSettings);return;
    }
    await testServerRequest('/api/v2/begin',{deviceId:db.status().deviceId});
    localStorage.removeItem('kostenApp_test_backup_check');serverBackupRequired=false;serverRestorePromptSeen=false;
    if(state.ready)await pullV2();
    let count=0;
    // Confirm imports only after their data and retry operations reached IndexedDB.
    for(let page=0;page<10;page++){
      const result=await testServerRequest('/api/payments');count+=importTestServerPayments(result.payments);await db.flush();
      if(result.payments.length)await testServerRequest('/api/payments/ack',{ids:result.payments.map(p=>p.id)});
      if(result.payments.length<100)break;
    }
    for(let round=0;round<150;round++){
      await db.flush();let size=0;const operations=[];
      for(const op of db.batch(4)){const bytes=new TextEncoder().encode(JSON.stringify(op)).length;if(operations.length&&size+bytes>500000)break;operations.push(op);size+=bytes;}
      if(!operations.length)break;
      const result=await testServerRequest('/api/v2/push',{deviceId:db.status().deviceId,operations});
      await db.accept(result.accepted);if(result.conflicts.length)await db.rememberConflicts(result.conflicts);
    }
    if(!state.ready){
      if(db.status().pending){testServerPending=true;serverStatus('Erste Datenübernahme läuft weiter. Die Daten bleiben lokal gespeichert.');return;}
      await testServerRequest('/api/v2/finish',{deviceId:db.status().deviceId});
    }
    await pullV2();await db.markServerReady();if(!dependencies.hasUnsavedInputs?.()){dependencies.renderHomeUebersicht();dependencies.refreshReiseImportedViews();}
    if(!db.status().pending&&!db.status().conflicts.length){await testServerRequest('/api/v2/backup',{manual:false});await db.archiveLegacy();serverSyncedRevision=serverSyncRevision;serverSyncConfirmed=true;serverSyncError=false;serverStatus('Du bist angemeldet. Deine Daten sind aktuell.'+(count?' '+count+' neue Zahlungen übernommen.':''));}
    else{serverSyncConfirmed=false;serverStatus(db.status().conflicts.length?'Bitte die Änderungen unter Datenspeicher abgleichen.':'Weitere Änderungen werden übertragen.');if(!db.status().conflicts.length)testServerPending=true;}
  }catch(error){serverSyncError=true;serverStatus('Noch nicht synchronisiert: '+(error.name==='AbortError'?'Zeitüberschreitung. Deine lokalen Änderungen bleiben gespeichert.':error.message));}
  finally{testServerBusy=false;updateServerLoginControls();renderHomeSyncStatus();if(testServerPending){testServerPending=false;scheduleTestServerSync();}}
}
function pushKeyBytes(value) {return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
async function activateTestServerPush() {
  if(testServerBusy) {serverStatus('Bitte den laufenden Vorgang kurz abwarten.');return;}
  testServerBusy=true;
  try {
    if(!('Notification' in window)) throw new Error('Bitte die App über das Home-Bildschirm-Icon öffnen.');
    // Request permission directly in the tap, before a network request.
    const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
    if(permission!=='granted') throw new Error('Mitteilungen sind nicht erlaubt.');
    const config=await saveTestServerSettings();serverStatus('Push wird eingerichtet …');
    if(!config.publicKey) throw new Error('Push-Schlüssel fehlen noch im Server.');
    const registration=await ensureTestServiceWorker(),desiredKey=pushKeyBytes(config.publicKey);
    let sub=await registration.pushManager.getSubscription();
    if(sub?.options?.applicationServerKey) {
      const old=new Uint8Array(sub.options.applicationServerKey);
      if(old.length!==desiredKey.length||old.some((n,i)=>n!==desiredKey[i])) {
        if(!await sub.unsubscribe()) throw new Error('Alte Push-Anmeldung konnte nicht entfernt werden.');sub=null;
      }
    }
    if(!sub) sub=await withPushTimeout(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:desiredKey}),15000,'Push-Anmeldung dauert zu lange. Bitte erneut versuchen.');
    await testServerRequest('/api/subscribe',sub.toJSON());serverStatus('Dieses Gerät ist für echte Server-Push-Nachrichten angemeldet.');
    await renderPushTestStatus();
  } catch(error) {serverStatus(error.message);}
  finally {testServerBusy=false;updateServerLoginControls();renderHomeSyncStatus();if(testServerPending){testServerPending=false;scheduleTestServerSync();}}
}
function toggleTestServerCode() {const node=document.getElementById('testServerToken'),button=document.getElementById('testServerReveal');if(!node)return;node.type=node.type==='password'?'text':'password';if(button)button.textContent=node.type==='text'?'Code verbergen':'Code anzeigen';}
async function restoreTestServerBackup(confirmed=false) {
  if(testServerBusy){serverStatus('Bitte den laufenden Vorgang kurz abwarten.');return;}
  if(!confirmed||!document.getElementById('serverRestoreDialog')?.open){showServerRestorePrompt(true);return;}
  testServerBusy=true;serverStatus('Deine Daten werden wiederhergestellt …');
  const errorNode=document.getElementById('serverRestoreError');if(errorNode)errorNode.textContent='';
  try {
    await saveTestServerSettings();
    const status=await testServerRequest('/api/v2/status');
    if(status.ready){const snapshot=await readV2Snapshot();await storageV2().resetToServer(snapshot.records,snapshot.cursor);}
    else{const saved=await testServerRequest('/api/backup');if(!saved.data?.Haushalt||!saved.data?.Einstellungen)throw Error('Keine gültige Sicherung vorhanden.');await storageV2().replace(saved.data);}
    adoptDatabase();await storageV2().flush();
    localStorage.removeItem('kostenApp_test_backup_check');
    serverBackupRequired=false;testServerBusy=false;updateServerLoginControls();
    dependencies.closeAccessibleDialog('serverRestoreDialog');
    location.reload();
  } catch(error) {
    const message='Daten konnten nicht wiederhergestellt werden: '+(error.name==='AbortError'?'Zeitüberschreitung. Bitte erneut versuchen.':error.message);
    if(errorNode)errorNode.textContent=message;serverStatus(message);
  } finally {testServerBusy=false;updateServerLoginControls();renderHomeSyncStatus();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializePaymentReviewGate,{once:true});else initializePaymentReviewGate();
window.addEventListener('kostentracker:storage-status',renderHomeSyncStatus);
window.addEventListener('offline',renderHomeSyncStatus);
window.addEventListener('online',()=>{renderHomeSyncStatus();syncTestServer(false);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderHomeSyncStatus();renderServerPaymentReview();syncTestServer(false);}});
const startServerConnection=()=>{renderTestServerSettings();if(testServerConfig.token) syncTestServer(false);};
if(document.readyState==='complete')startServerConnection();else window.addEventListener('load',startServerConnection,{once:true});
document.addEventListener('kostentracker:boot-complete',syncPaymentReviewGate);


return { prepareStorageSettings, closeBackupPreview, confirmBackupPreview, exportStorageMigrationBackup, renderStorageV2, resolveStorageConflict, renderServerBackupHistory, createServerBackup, restoreHistoricalBackup, simulatePaymentConfirmation, renderHomeSyncStatus, updateServerLoginControls, showServerRestorePrompt, closeServerRestorePrompt, pendingPaymentCount, syncPaymentReviewGate, initializePaymentReviewGate, reviewCategories, withPushTimeout, ensureTestServiceWorker, openServerSettings, renderPushTestStatus, serverStatus, renderTestServerSettings, bindTestServerUser, saveTestServerSettings, testServerRequest, scheduleTestServerSync, normalizedProvider, showPaymentImportedNotice, classifyPushPayment, importedPaymentDestination, appendImportedPayment, renderServerPaymentReview, resolveServerPaymentReview, importTestServerPayments, syncTestServer, pushKeyBytes, activateTestServerPush, toggleTestServerCode, restoreTestServerBackup };
});
