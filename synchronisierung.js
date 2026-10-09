
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


function openServerSettings() {show('serverSettingsView');renderTestServerSettings();renderPushTestStatus();}
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
function serverStatus(message) {const node=document.getElementById('testServerStatus');if(node) node.textContent=message;}
function renderTestServerSettings() {
  renderServerPaymentReview();
  const node=document.getElementById('testServerToken');if(node) node.value=testServerConfig.token||'';
  serverStatus(testServerConfig.token?'Persönlicher Code gespeichert. Die App öffnet sich weiterhin direkt.':'Persönlichen Code einmal eintragen.');
}
function bindTestServerUser(config) {
  if(!config.userId||!/^[-a-zA-Z0-9_]{1,40}$/.test(config.userId)) throw new Error('Bitte zuerst den neuen Worker für getrennte Zugänge deployen.');
  if(testServerBoundUser&&testServerBoundUser!==config.userId) throw new Error('Dieser Code gehört zu einer anderen Person. Dieses App-Profil bleibt bei deinem bisherigen Zugang. Für die zweite Person deren eigenes Handy verwenden.');
  if(!testServerBoundUser) localStorage.setItem('kostenApp_test_backup_check',config.userId);
  localStorage.setItem('kostenApp_test_user',config.userId);testServerBoundUser=config.userId;
}
async function saveTestServerSettings() {
  const token=document.getElementById('testServerToken').value.trim();
  if(token.length<32) throw new Error('Bitte den vollständigen Zugangsschlüssel eintragen.');
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
  if(payment.source!=='bank-push') return {normal:true};
  const paid=parseISODate(payment.date), from=addDays(paid,-31), to=addDays(paid,31);
  const rows=[...laufendeKostenImZeitraum(from,to),...versicherungsZahlungenImZeitraum(from,to)];
  const matches=[],unknown=[];
  const calendar=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  for(const due of rows) {
    if(Math.round((parseBetrag(due.betrag)||0)*100)!==payment.amountCents) continue;
    const insurance=due.typ==='versicherung';
    const item=(insurance?daten.Versicherungen:daten['Laufende Kosten']?.fix)?.find(e=>String(e.id)===String(due.sourceId));
    if(!item||istEintragAusgeblendet(insurance?'versicherungen':'fixkosten',item.id)) continue;
    const window=normalizeFixkostenZuordnungTage(item.zuordnungTage);
    if(Math.abs(calendar(due.datum)-calendar(paid))/86400000>window) continue;
    const aliases=String(insurance?item.anbieter||'':item.haendler||'').split(';').map(normalizedProvider).filter(Boolean);
    if(!aliases.length) {unknown.push(due);continue;}
    if(aliases.includes(normalizedProvider(payment.merchant))) matches.push({...due,key:[due.typ,String(item.id),isoAusDate(due.datum)].join(':')});
  }
  if(matches.length===1&&!unknown.length) {
    if(daten.Einstellungen?.serverRecurringMatches?.[matches[0].key]) return {review:'Für diese Fälligkeit wurde bereits eine Zahlung zugeordnet.'};
    return {recurring:matches[0]};
  }
  if(matches.length>1||unknown.length) return {review:'Mögliche Fixkosten/Versicherung: Anbieter, Betrag und Fälligkeit bitte prüfen.'};
  return {normal:true};
}
function importedPaymentDestination(payment) {
  const merchant=normalizedProvider(payment.merchant).replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const bakery=/(?:^|[^a-z])(?:baeckerei|backerei|baecker|backer|backstube|bakery)(?=$|[^a-z])/.test(merchant);
  return bakery ? {area:'Freizeit',category:'Essen / Trinken'} : {area:'Haushalt',category:['Einkauf','Tanken','Drogerie','Sonstiges'].includes(payment.category)?payment.category:'Einkauf'};
}
function appendImportedPayment(payment) {
  const target=importedPaymentDestination(payment),month=Number(payment.date.slice(5,7));
  daten[target.area]??={};daten[target.area][month]??=[];
  daten[target.area][month].push({id:generateId(),text:String(payment.merchant||'Apple Pay').slice(0,200),betrag:payment.amountCents/100,datum:payment.date,kategorie:target.category,_serverPaymentId:payment.id});
}
function renderServerPaymentReview() {
  const host=document.getElementById('serverPaymentReview');if(!host)return;
  host.replaceChildren();
  const pending=daten.Einstellungen?.serverPendingReview||[];
  const title=document.createElement('strong');title.textContent=`Zahlungen zur Prüfung: ${pending.length}`;host.appendChild(title);
  const note=document.createElement('div');note.className='settings-note';note.textContent='Unsichere Zahlungen werden erst nach deiner Entscheidung als zusätzliche Ausgabe erfasst. Eindeutig zugeordnete Fixkosten werden nicht erneut abgezogen.';host.appendChild(note);
  for(const payment of pending) {
    const row=document.createElement('div');row.style.cssText='margin-top:12px;padding:12px;border-radius:12px;background:var(--secondary);';
    const label=document.createElement('div');label.textContent=`${payment.merchant} · ${formatBetragText(payment.amountCents/100)} · ${formatDatum(payment.date)}`;row.appendChild(label);
    const reason=document.createElement('div');reason.className='settings-note';reason.textContent=payment.reviewReason;row.appendChild(reason);
    for(const [text,book] of [['Als zusätzliche Ausgabe erfassen',true],['Bereits berücksichtigt / ignorieren',false]]) {
      const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',()=>resolveServerPaymentReview(payment.id,book));row.appendChild(button);
    }
    host.appendChild(row);
  }
}
function resolveServerPaymentReview(id,book) {
  const pending=daten.Einstellungen?.serverPendingReview||[],payment=pending.find(p=>p.id===id);if(!payment)return;
  const before=structuredClone(daten);
  try {
    if(book) appendImportedPayment(payment);
    daten.Einstellungen.serverPendingReview=pending.filter(p=>p.id!==id);
    localStorage.setItem('kostenApp_test',JSON.stringify(daten));zuletztGespeicherteDaten=JSON.stringify(daten);
  } catch(error) {daten=before;showPaymentImportedNotice(false);serverStatus('Entscheidung konnte nicht gespeichert werden. Bitte erneut versuchen.');return;}
  if(book) showPaymentImportedNotice();
  renderServerPaymentReview();renderHomeUebersicht();renderRecentAusgaben('haushalt');renderRecentAusgaben('freizeit');scheduleTestServerSync();
}

function importTestServerPayments(payments) {
  if(!Array.isArray(payments)||payments.length>100) throw new Error('Ungültige Zahlungsliste.');
  const ids=new Set(daten.Einstellungen?.serverImportIds||[]);
  for(const area of ['Haushalt','Freizeit']) Object.values(daten[area]||{}).forEach(list=>Array.isArray(list)&&list.forEach(e=>{if(e._serverPaymentId)ids.add(e._serverPaymentId);}));
  const before=structuredClone(daten);let count=0;
  try {
    for(const payment of payments) {
      if(!payment||typeof payment.id!=='string'||!/^[-A-Za-z0-9_:]{1,128}$/.test(payment.id)||!Number.isInteger(payment.amountCents)||payment.amountCents<=0||payment.amountCents>100000000||typeof payment.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)||!Number.isFinite(Date.parse(payment.date+'T12:00:00Z'))||new Date(payment.date+'T12:00:00Z').toISOString().slice(0,10)!==payment.date) throw new Error('Ungültige Zahlung vom Server.');
      if(ids.has(payment.id)) continue;
      const classification=classifyPushPayment(payment);
      daten.Einstellungen??={};
      if(classification.review) {
        daten.Einstellungen.serverPendingReview??=[];
        if(!daten.Einstellungen.serverPendingReview.some(p=>p.id===payment.id)) daten.Einstellungen.serverPendingReview.push({...payment,reviewReason:classification.review});
      } else if(classification.recurring) {
        daten.Einstellungen.serverRecurringMatches??={};
        daten.Einstellungen.serverRecurringMatches[classification.recurring.key]={paymentId:payment.id,date:payment.date,merchant:payment.merchant};
      } else {appendImportedPayment(payment);count++;}
      ids.add(payment.id);
    }
    daten.Einstellungen??={};daten.Einstellungen.serverImportIds=[...ids];
    // Save before acknowledgment: after a crash/retry the IDs prevent duplication.
    localStorage.setItem('kostenApp_test',JSON.stringify(daten));zuletztGespeicherteDaten=JSON.stringify(daten);
  } catch(error) {daten=before;showPaymentImportedNotice(false);throw error;}
  if(count>0) showPaymentImportedNotice();
  renderServerPaymentReview();
  return count;
}
async function syncTestServer(saveSettings=false) {
  if(testServerBusy) {testServerPending=true;return;}
  try {
    testServerBusy=true;serverStatus('Verbindung wird geprüft …');
    if(saveSettings) await saveTestServerSettings();else {
      if(!testServerConfig?.token) return;
      bindTestServerUser(await testServerRequest('/api/config'));
    }
    // A fresh device must not overwrite an existing personal server backup.
    if(localStorage.getItem('kostenApp_test_backup_check')===testServerBoundUser) {
      const saved=await testServerRequest('/api/backup');
      if(saved.data) {serverStatus('Für deinen Zugang gibt es bereits ein Serverbackup. Bitte „Serverbackup wiederherstellen“ verwenden. Deine lokalen Daten bleiben bis dahin erhalten.');return;}
      localStorage.removeItem('kostenApp_test_backup_check');
    }
    let count=0;for(let page=0;page<10;page++) {
      const result=await testServerRequest('/api/payments');
      count+=importTestServerPayments(result.payments);
      if(result.payments.length) renderHomeUebersicht();
      if(result.payments.length) await testServerRequest('/api/payments/ack',{ids:result.payments.map(p=>p.id)});
      if(result.payments.length<100) break;
    }
    renderHomeUebersicht();
    await testServerRequest('/api/backup',{data:daten});
    serverStatus('Verbunden. '+count+' zusätzliche Ausgabe'+(count===1?'':'n')+' übernommen. '+(daten.Einstellungen?.serverPendingReview?.length||0)+' zur Prüfung. Serverbackup aktualisiert.');
  } catch(error) {serverStatus('Noch nicht synchronisiert: '+(error.name==='AbortError'?'Zeitüberschreitung. Später erneut verbinden.':error.message));}
  finally {testServerBusy=false;if(testServerPending){testServerPending=false;scheduleTestServerSync();}}
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
  finally {testServerBusy=false;if(testServerPending){testServerPending=false;scheduleTestServerSync();}}
}
function toggleTestServerCode() {const node=document.getElementById('testServerToken'),button=document.getElementById('testServerReveal');if(!node)return;node.type=node.type==='password'?'text':'password';if(button)button.textContent=node.type==='text'?'Code verbergen':'Code anzeigen';}
async function restoreTestServerBackup() {
  if(testServerBusy) {serverStatus('Bitte den laufenden Vorgang kurz abwarten.');return;}
  testServerBusy=true;
  try {
    await saveTestServerSettings();
    const saved=await testServerRequest('/api/backup');if(!saved.data) throw new Error('Für deinen Zugang gibt es noch kein Serverbackup.');
    if(!saved.data.Haushalt||typeof saved.data.Haushalt!=='object'||!saved.data.Einstellungen||typeof saved.data.Einstellungen!=='object') throw new Error('Das Serverbackup ist nicht gültig.');
    if(!confirm('Deine lokalen Daten durch dein Serverbackup ersetzen? Vorher bei Bedarf deine lokalen Daten in den Backup-Einstellungen exportieren.')) return;
    localStorage.setItem('kostenApp_test',JSON.stringify(saved.data));
    localStorage.removeItem('kostenApp_test_backup_check');location.reload();
  } catch(error) {serverStatus(error.message);}
  finally {testServerBusy=false;}
}
window.addEventListener('online',()=>syncTestServer(false));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') syncTestServer(false);});
window.addEventListener('load',()=>{renderTestServerSettings();if(testServerConfig.token) syncTestServer(false);});

