Kostentracker.module({
  "id": "js/server/synchronisierung.js",
  "dependencies": [
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
  const node=document.getElementById('homeSyncStatus');if(!node)return;
  let state='local',text='Nur auf diesem Gerät';
  if(testServerConfig?.token){
    const reviews=pendingPaymentCount();
    if(serverBackupRequired){state='restore';text='Daten wiederherstellen';}
    else if(navigator.onLine===false){state='offline';text='Offline · Synchronisierung folgt';}
    else if(testServerBusy){state='busy';text='Wird synchronisiert …';}
    else if(serverSyncError){state='error';text='Noch nicht synchronisiert';}
    else if(serverSyncedRevision<serverSyncRevision||!serverSyncConfirmed){state='pending';text=serverSyncConfirmed?'Übertragung ausstehend':'Verbindung wird geprüft';}
    else if(reviews){state='review';text=reviews===1?'Eine Zahlung prüfen':reviews+' Zahlungen prüfen';}
    else{state='synced';text='Alles synchronisiert';}
  }
  node.textContent=text;node.dataset.state=state;node.setAttribute('aria-label',text+' – Anmeldung öffnen');
}
function serverStatus(message) {serverLastStatus=message;const node=document.getElementById('testServerStatus');if(node)node.textContent=message;updateServerLoginControls();renderHomeSyncStatus();}
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
      headers:{Authorization:'Bearer '+token,...(value===undefined?{}:{'Content-Type':'application/json'})},
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
function showPaymentImportedNotice(success=true) {
  const node=document.getElementById('paymentImportedNotice');if(!node)return;
  clearTimeout(showPaymentImportedNotice.hideTimer);
  node.textContent=success?'✅ Zahlung übernommen':'❌ Zahlung fehlgeschlagen';
  node.classList.toggle('is-error',!success);
  node.classList.add('is-visible');
  showPaymentImportedNotice.hideTimer=setTimeout(()=>{
    node.classList.remove('is-visible');
    showPaymentImportedNotice.hideTimer=null;
  },3000);
}

function classifyPushPayment(payment) {
  if(payment.reviewReason) return {review:payment.reviewReason};
  if(payment.amountCents===null)return dependencies.routeTravelPayment(payment);
  if(payment.source!=='bank-push') return classifyMerchantPayment(payment);
  const paid=dependencies.parseISODate(payment.date), from=dependencies.addDays(paid,-31), to=dependencies.addDays(paid,31);
  const rows=[...dependencies.laufendeKostenImZeitraum(from,to),...dependencies.versicherungsZahlungenImZeitraum(from,to)];
  const matches=[],unknown=[];
  const calendar=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  for(const due of rows) {
    if(Math.round((dependencies.parseBetrag(due.betrag)||0)*100)!==payment.amountCents) continue;
    const insurance=due.typ==='versicherung';
    const item=(insurance?context.repository.view.Versicherungen:context.repository.view['Laufende Kosten']?.fix)?.find(e=>String(e.id)===String(due.sourceId));
    if(!item||dependencies.istEintragAusgeblendet(insurance?'versicherungen':'fixkosten',item.id)) continue;
    const window=dependencies.normalizeFixkostenZuordnungTage(item.zuordnungTage);
    if(Math.abs(calendar(due.datum)-calendar(paid))/86400000>window) continue;
    const aliases=String(insurance?item.anbieter||'':item.haendler||'').split(';').map(normalizedProvider).filter(Boolean);
    if(!aliases.length) {unknown.push(due);continue;}
    if(aliases.includes(normalizedProvider(payment.merchant))) matches.push({...due,key:[due.typ,String(item.id),dependencies.isoAusDate(due.datum)].join(':')});
  }
  if(matches.length===1&&!unknown.length) {
    if(context.repository.view.Einstellungen?.serverRecurringMatches?.[matches[0].key]) return {review:'Für diese Fälligkeit wurde bereits eine Zahlung zugeordnet.'};
    return {recurring:matches[0]};
  }
  if(matches.length>1||unknown.length) return {review:'Mögliche Fixkosten/Versicherung: Anbieter, Betrag und Fälligkeit bitte prüfen.'};
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
  const entry={id:dependencies.generateId(),text:String(payment.merchant||'Apple Pay').slice(0,200),betrag:payment.amountCents/100,datum:payment.date,kategorie:target.category,_serverPaymentId:payment.id,...(payment.notificationDate?{_notificationDate:payment.notificationDate}:{}),...dependencies.importedEntryTime(payment),...(payment.testOnly?{_testPayment:true}:{})};
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
  const options=target.startsWith('reise:')?Object.keys(context.repository.view.Reisen?.[target.slice(6)]||{}):dependencies.merchantCategories(target);
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
    const reason=document.createElement('div');reason.className='settings-note';reason.textContent=payment.reviewReason;row.appendChild(reason);
    if(payment.notificationText){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Mitteilung anzeigen';details.appendChild(summary);const raw=document.createElement('div');raw.className='settings-note';raw.textContent=[payment.notificationTitle,payment.notificationSubtitle,payment.notificationText].filter(Boolean).join(' · ');details.appendChild(raw);row.appendChild(details);}
    const route=dependencies.routeTravelPayment(payment),target=document.createElement('select');target.id='reviewTarget-'+payment.id;target.setAttribute('aria-label','Zahlung zuordnen');
    const empty=document.createElement('option');empty.value='';empty.textContent='Ziel auswählen';target.appendChild(empty);
    for(const area of ['Haushalt','Freizeit']){const option=document.createElement('option');option.value=area;option.textContent=area;target.appendChild(option);}
    for(const land of Object.keys(context.repository.view.Reisen||{})){const option=document.createElement('option');option.value='reise:'+land;option.textContent='Reise: '+land;target.appendChild(option);}
    const known=dependencies.merchantDestination(payment.merchant);target.value=route.destination?'reise:'+route.destination.land:route.review?'':known?.area||'';target.addEventListener('change',()=>reviewCategories(payment.id));row.appendChild(target);
    const category=document.createElement('select');category.id='reviewCategory-'+payment.id;category.setAttribute('aria-label','Kategorie');row.appendChild(category);
    const rememberLabel=document.createElement('label');rememberLabel.className='merchant-remember';const remember=document.createElement('input');remember.type='checkbox';remember.id='reviewRemember-'+payment.id;rememberLabel.appendChild(remember);const rememberText=document.createElement('span');rememberText.textContent='Für diesen Händler merken';rememberLabel.appendChild(rememberText);row.appendChild(rememberLabel);
    if(payment.amountCents===null){const euro=document.createElement('input');euro.id='reviewEuro-'+payment.id;euro.type='text';euro.inputMode='decimal';euro.placeholder='Abgerechneter Betrag in Euro';euro.setAttribute('aria-label','Abgerechneter Betrag in Euro');row.appendChild(euro);}
    const accept=document.createElement('button');accept.type='button';accept.textContent='Zahlung übernehmen';accept.addEventListener('click',()=>resolveServerPaymentReview(payment.id,true,target.value,document.getElementById('reviewEuro-'+payment.id)?.value,category.value,remember.checked));row.appendChild(accept);
    const ignore=document.createElement('button');ignore.type='button';ignore.textContent='Bereits berücksichtigt / ignorieren';ignore.addEventListener('click',()=>resolveServerPaymentReview(payment.id,false));row.appendChild(ignore);
    host.appendChild(row);reviewCategories(payment.id);
    if(route.destination&&known)category.value=route.destination.category;
  }
  syncPaymentReviewGate();
}
function resolveServerPaymentReview(id,book,target=null,euroValue=null,category=null,remember=false) {
  const pending=context.repository.view.Einstellungen?.serverPendingReview||[],payment=pending.find(p=>p.id===id);if(!payment)return;
  let resolved=payment,destination;
  if(book){
    if(payment.amountCents===null){const euro=dependencies.parseBetrag(euroValue);if(!Number.isFinite(euro)||euro<=0||euro>1000000){alert('Bitte den abgerechneten Eurobetrag ergänzen.');return;}resolved={...payment,amountCents:Math.round(euro*100)};if(resolved.amountCents<=0){alert('Eurobetrag ist kleiner als ein Cent.');return;}}
    const route=dependencies.routeTravelPayment(resolved);
    if(target===null&&(route.review||!dependencies.merchantDestination(resolved.merchant))){alert('Bitte Bereich und Kategorie auswählen.');return;}
    if(target===''){alert('Bitte ein Ziel auswählen.');return;}
    if(target?.startsWith('reise:')){
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
    if(book){dependencies.validateImportedPayment(resolved);if(remember){if(!destination||!['Haushalt','Freizeit'].includes(destination.area))throw Error('Händlerzuordnungen bitte für Haushalt oder Freizeit speichern.');dependencies.rememberMerchantRule(resolved.merchant,destination.area,destination.category);}appendImportedPayment(resolved,destination);}
    context.repository.view.Einstellungen.serverPendingReview=pending.filter(p=>p.id!==id);
    context.storage.setItem(context.storage.key,JSON.stringify(context.repository.view));context.storage.lastSaved=JSON.stringify(context.repository.view);
  } catch(error) {context.repository.view=before;showPaymentImportedNotice(false);serverStatus('Entscheidung konnte nicht gespeichert werden. Ziel prüfen und erneut versuchen.');const status=document.getElementById('paymentReviewError');if(status)status.textContent='Entscheidung konnte nicht gespeichert werden. Die Zahlung bleibt offen. Ziel prüfen und erneut versuchen.';syncPaymentReviewGate();return;}
  if(book)showPaymentImportedNotice();renderServerPaymentReview();dependencies.refreshReiseImportedViews();dependencies.renderHomeUebersicht();dependencies.renderRecentAusgaben('haushalt');dependencies.renderRecentAusgaben('freizeit');scheduleTestServerSync();
}

function importTestServerPayments(payments) {
  if(!Array.isArray(payments)||payments.length>100) throw new Error('Ungültige Zahlungsliste.');
  const ids=new Set(context.repository.view.Einstellungen?.serverImportIds||[]);
  for(const area of ['Haushalt','Freizeit']) Object.values(context.repository.view[area]||{}).forEach(list=>Array.isArray(list)&&list.forEach(e=>{if(e._serverPaymentId)ids.add(e._serverPaymentId);}));
  for(const trip of Object.values(context.repository.view.Reisen||{}))Object.values(trip||{}).forEach(list=>Array.isArray(list)&&list.forEach(e=>{if(e._serverPaymentId)ids.add(e._serverPaymentId);}));
  const before=context.clone(context.repository.view);let count=0;
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
      } else {appendImportedPayment(payment);count++;}
      if(payment.testOnly){context.repository.view.Einstellungen.serverTravelDemoIds??=[];context.repository.view.Einstellungen.serverTravelDemoIds.push(payment.id);}
      ids.add(payment.id);
    }
    context.repository.view.Einstellungen??={};context.repository.view.Einstellungen.serverImportIds=[...ids];
    // Save before acknowledgment: after a crash/retry the IDs prevent duplication.
    context.storage.setItem(context.storage.key,JSON.stringify(context.repository.view));context.storage.lastSaved=JSON.stringify(context.repository.view);
  } catch(error) {context.repository.view=before;showPaymentImportedNotice(false);throw error;}
  if(count>0) showPaymentImportedNotice();
  renderServerPaymentReview();dependencies.refreshReiseImportedViews();
  return count;
}
async function syncTestServer(saveSettings=false) {
  if(testServerBusy) {testServerPending=true;return;}
  try {
    testServerBusy=true;serverStatus(saveSettings?'Anmeldung wird geprüft …':'Daten werden synchronisiert …');
    if(saveSettings) await saveTestServerSettings();else {
      if(!testServerConfig?.token){serverStatus('Noch nicht angemeldet.');return;}
      bindTestServerUser(await testServerRequest('/api/config'));
    }
    // A fresh device must not overwrite an existing personal server backup.
    if(localStorage.getItem('kostenApp_test_backup_check')===testServerBoundUser) {
      const saved=await testServerRequest('/api/backup');
      if(saved.data) {serverBackupRequired=true;serverStatus('Bitte deine Daten wiederherstellen, um neue Zahlungen zu übernehmen.');showServerRestorePrompt(saveSettings);return;}
      localStorage.removeItem('kostenApp_test_backup_check');
      serverBackupRequired=false;serverRestorePromptSeen=false;updateServerLoginControls();
    }
    let count=0;for(let page=0;page<10;page++) {
      const result=await testServerRequest('/api/payments');
      count+=importTestServerPayments(result.payments);
      if(result.payments.length) dependencies.renderHomeUebersicht();
      if(result.payments.length) await testServerRequest('/api/payments/ack',{ids:result.payments.map(p=>p.id)});
      if(result.payments.length<100) break;
    }
    dependencies.renderHomeUebersicht();
    const uploadRevision=serverSyncRevision;
    await testServerRequest('/api/backup',{data:context.repository.view});
    serverSyncedRevision=uploadRevision;serverSyncConfirmed=true;serverSyncError=false;
    serverStatus('Du bist angemeldet. Deine Daten sind aktuell.'+(count?' '+count+' neue Ausgabe'+(count===1?'':'n')+' übernommen.':'')+((context.repository.view.Einstellungen?.serverPendingReview?.length||0)?' Zahlungen zur Prüfung offen.':''));
  } catch(error) {serverSyncError=true;serverStatus('Noch nicht synchronisiert: '+(error.name==='AbortError'?'Zeitüberschreitung. Später erneut verbinden.':error.message));}
  finally {testServerBusy=false;updateServerLoginControls();renderHomeSyncStatus();if(testServerPending){testServerPending=false;scheduleTestServerSync();}}
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
    const saved=await testServerRequest('/api/backup');
    if(!saved.data)throw new Error('Für diesen Zugang gibt es noch keine gespeicherte Sicherung.');
    if(!saved.data.Haushalt||typeof saved.data.Haushalt!=='object'||!saved.data.Einstellungen||typeof saved.data.Einstellungen!=='object')throw new Error('Die gespeicherte Sicherung ist nicht gültig. Deine aktuellen Daten bleiben erhalten.');
    context.storage.setItem(context.storage.key,JSON.stringify(saved.data));
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
window.addEventListener('offline',renderHomeSyncStatus);
window.addEventListener('online',()=>{renderHomeSyncStatus();syncTestServer(false);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderHomeSyncStatus();renderServerPaymentReview();syncTestServer(false);}});
const startServerConnection=()=>{renderTestServerSettings();if(testServerConfig.token) syncTestServer(false);};
if(document.readyState==='complete')startServerConnection();else window.addEventListener('load',startServerConnection,{once:true});
document.addEventListener('kostentracker:boot-complete',syncPaymentReviewGate);


return { renderHomeSyncStatus, updateServerLoginControls, showServerRestorePrompt, closeServerRestorePrompt, pendingPaymentCount, syncPaymentReviewGate, initializePaymentReviewGate, reviewCategories, withPushTimeout, ensureTestServiceWorker, openServerSettings, renderPushTestStatus, serverStatus, renderTestServerSettings, bindTestServerUser, saveTestServerSettings, testServerRequest, scheduleTestServerSync, normalizedProvider, showPaymentImportedNotice, classifyPushPayment, importedPaymentDestination, appendImportedPayment, renderServerPaymentReview, resolveServerPaymentReview, importTestServerPayments, syncTestServer, pushKeyBytes, activateTestServerPush, toggleTestServerCode, restoreTestServerBackup };
});
