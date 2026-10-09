// Kostentracker TEST backend. Deploy in the existing kostentracker-test Worker.
// Required binding: DB (D1). Required secrets: APP_TOKEN, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY. Optional ACCESS_CODES: JSON object {"person2":"code"}.
// APP_TOKEN remains the code for person1. Keep user IDs stable when rotating codes.
// Never put those secrets in GitHub or this source file.
const APP_URL = 'https://onurcanks20-rgb.github.io/Test/';
const ORIGIN = new URL(APP_URL).origin;
const enc = new TextEncoder();
const schema = [
  'CREATE TABLE IF NOT EXISTS notification_events (user_id TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,occurred INTEGER NOT NULL,PRIMARY KEY(user_id,id))',
  'CREATE INDEX IF NOT EXISTS notification_events_lookup ON notification_events(user_id,fingerprint,occurred)',
  'CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, payload TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS subscriptions (endpoint TEXT PRIMARY KEY, payload TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS backup (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS user_payments (user_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, PRIMARY KEY(user_id,id))',
  'CREATE TABLE IF NOT EXISTS user_subscriptions (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS user_subscriptions_owner ON user_subscriptions(user_id)',
  'CREATE TABLE IF NOT EXISTS user_backup (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY)',
  "INSERT OR IGNORE INTO user_payments(user_id,id,payload,acknowledged,created) SELECT 'person1',id,payload,acknowledged,created FROM payments WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE name='users-v1')",
  "INSERT OR IGNORE INTO user_subscriptions(endpoint,user_id,payload) SELECT endpoint,'person1',payload FROM subscriptions WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE name='users-v1')",
  "INSERT OR IGNORE INTO user_backup(user_id,payload,updated) SELECT 'person1',payload,updated FROM backup WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE name='users-v1')",
  "INSERT OR IGNORE INTO app_migrations(name) VALUES('users-v1')"
];
let initializedDB;
async function initialize(db) {
  if (!db) throw new Error('DB fehlt');
  if (initializedDB !== db) { await db.batch(schema.map(sql => db.prepare(sql))); initializedDB = db; }
}
function reply(request, value, status=200) {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if (request.headers.get('Origin') === ORIGIN) Object.assign(headers, {
    'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Authorization, Content-Type'
  });
  return new Response(JSON.stringify(value), {status,headers});
}
async function authorized(request, token) {
  if (!token || token.length < 32) return false;
  const supplied = request.headers.get('Authorization') || '';
  const digest = value => crypto.subtle.digest('SHA-256', enc.encode(value));
  const a = new Uint8Array(await digest(supplied)), b = new Uint8Array(await digest('Bearer '+token));
  let diff=0; for(let i=0;i<a.length;i++) diff |= a[i]^b[i]; return diff===0;
}
async function identifyUser(request,env) {
  let extra={};
  try {if(env.ACCESS_CODES) extra=JSON.parse(env.ACCESS_CODES);}
  catch {fail('ACCESS_CODES muss ein gültiges JSON-Objekt sein',503);}
  if(!extra||typeof extra!=='object'||Array.isArray(extra)||Object.keys(extra).length>19||Object.hasOwn(extra,'person1')||Object.entries(extra).some(([id,code])=>!/^[-a-zA-Z0-9_]{1,40}$/.test(id)||typeof code!=='string'||code.length<32||code.length>256)) fail('ACCESS_CODES ist ungültig. person1 verwendet APP_TOKEN.',503);
  const entries=[['person1',env.APP_TOKEN],...Object.entries(extra)];
  if(entries.some(([,code])=>typeof code!=='string'||code.length<32||code.length>256)||new Set(entries.map(([,code])=>code)).size!==entries.length) fail('Für jeden Zugang ist ein eigener gültiger Code erforderlich',503);
  let user=null;
  for(const [id,code] of entries) if(await authorized(request,code)) user=id;
  return user;
}
async function body(request) {
  if (!request.body) throw new Error('Leere Anfrage');
  const reader=request.body.getReader(), chunks=[]; let size=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length;
    if(size>1024*1024) throw new Error('Anfrage zu groß'); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const value=JSON.parse(new TextDecoder().decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('JSON-Objekt erwartet'); return value;
}
function fail(message,status=400) { const error=new Error(message);error.status=status;throw error; }
function b64(bytes) {return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unb64(s) { if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s)) fail('Ungültiger Schlüssel');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)); }
function concat(...arrays) { const bytes=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){bytes.set(a,p);p+=a.length;}return bytes; }
async function hmac(key,data) {return new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),data));}
async function expand(key,info,length) {return (await hmac(key,concat(info,new Uint8Array([1])))).slice(0,length);}
function subscription(value) {
  let url;try{url=new URL(value.endpoint);}catch{fail('Ungültiges Push-Ziel');}
  const host=url.hostname;
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!(host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='updates-autopush.stage.mozaws.net')) fail('Push-Dienst wird nicht unterstützt');
  if(url.href.length>2048||unb64(value.keys?.p256dh).length!==65||unb64(value.keys?.auth).length!==16) fail('Ungültige Push-Subscription');
  return {endpoint:url.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
// RFC 8291 / 8292. Single aes128gcm record, WebCrypto P-256 and HKDF-SHA256.
async function encryptPush(sub,payload) {
  const userPublic=unb64(sub.keys.p256dh), auth=unb64(sub.keys.auth);
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const serverPublic=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const userKey=await crypto.subtle.importKey('raw',userPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:userKey},pair.privateKey,256));
  const ikm=await expand(await hmac(auth,shared),concat(enc.encode('WebPush: info\0'),userPublic,serverPublic),32);
  const salt=crypto.getRandomValues(new Uint8Array(16)), prk=await hmac(salt,ikm);
  const cek=await expand(prk,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await expand(prk,enc.encode('Content-Encoding: nonce\0'),12);
  const text=enc.encode(JSON.stringify(payload));if(text.length>3500) fail('Push-Nachricht zu groß');
  const key=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,concat(text,new Uint8Array([2]))));
  return concat(salt,new Uint8Array([0,0,16,0,65]),serverPublic,encrypted);
}
async function vapid(env,endpoint) {
  const pub=unb64(String(env.VAPID_PUBLIC_KEY||'').trim()), d=String(env.VAPID_PRIVATE_KEY||'').trim();
  if(pub.length!==65||pub[0]!==4||unb64(d).length!==32) fail('Push-Schlüssel fehlen oder sind ungültig',503);
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:b64(pub.slice(1,33)),y:b64(pub.slice(33)),d,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const head=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claim=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+43200,sub:APP_URL})));
  const input=head+'.'+claim, signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(input));
  return 'vapid t='+input+'.'+b64(signature)+', k='+b64(pub);
}
async function pushStep(code,message,operation) {
  try {return await operation();}
  catch(error) {
    // Only fixed messages and a known exception type reach the client/logs.
    // Never return raw errors, endpoints, subscriptions or secret values.
    const type=['TypeError','DataError','OperationError','NotSupportedError','InvalidAccessError','AbortError','TimeoutError','SyntaxError'].includes(error?.name)?error.name:'Error';
    fail(message+' ['+code+' / '+type+']',502);
  }
}
async function deliver(env,sub,payload,userId) {
  const authorization=await pushStep('PUSH-KEY','Push-Signatur konnte nicht erstellt werden. VAPID_PRIVATE_KEY und VAPID_PUBLIC_KEY müssen zum selben Schlüsselpaar gehören.',()=>vapid(env,sub.endpoint));
  const encrypted=await pushStep('PUSH-ENCRYPT','Die Push-Nachricht konnte nicht verschlüsselt werden.',()=>encryptPush(sub,payload));
  // Explicit controller avoids depending on AbortSignal.timeout support.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let response;
  try {
    response=await pushStep('PUSH-NETWORK','Der Push-Dienst konnte nicht erreicht werden.',()=>fetch(sub.endpoint,{method:'POST',redirect:'manual',signal:controller.signal,headers:{
      Authorization:authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal'
    },body:encrypted}));
  } finally {clearTimeout(timer);}
  if(response.status===404||response.status===410) await env.DB.prepare('DELETE FROM user_subscriptions WHERE endpoint=? AND user_id=?').bind(sub.endpoint,userId).run();
  return {accepted:response.ok,status:response.status};
}
function normalizePayment(value) {
  if(typeof value.id!=='string'||!/^[-A-Za-z0-9_:]{1,128}$/.test(value.id)) fail('id fehlt: pro Zahlung eine neue UUID verwenden');
  let raw=value.amount;if(typeof raw==='string'){raw=raw.trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) fail('Betrag ungültig');raw=Number(raw.replace(',','.'));}
  if(typeof raw!=='number'||!Number.isFinite(raw)||raw<=0||raw>1000000||Math.abs(raw*100-Math.round(raw*100))>1e-7) fail('Betrag ungültig');
  const date=value.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) fail('Datum ungültig');
  const merchant=typeof value.merchant==='string'?value.merchant.trim().slice(0,200):'Apple Pay';
  const category=['Einkauf','Tanken','Drogerie','Sonstiges'].includes(value.category)?value.category:'Einkauf';
  return {id:value.id,amountCents:Math.round(raw*100),date,merchant,category};
}
function compactNotificationText(value) {return value.normalize('NFKC').replace(/\s+/g,' ').trim();}
async function parseBankNotification(value) {
  for(const key of ['app','title','text','notificationDate']) if(typeof value[key]!=='string'||value[key].length>(key==='text'?4000:300)) fail('Mitteilungsfelder fehlen oder sind zu lang');
  const app=compactNotificationText(value.app), title=compactNotificationText(value.title), text=compactNotificationText(value.text);
  const occurred=Date.parse(value.notificationDate);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.notificationDate)||!Number.isFinite(occurred)||new Date(value.notificationDate.slice(0,10)+'T12:00:00Z').toISOString().slice(0,10)!==value.notificationDate.slice(0,10)) fail('Mitteilungsdatum muss ISO 8601 mit Uhrzeit und Zeitzone sein');
  if(app.toLocaleLowerCase('de-DE')!=='trade republic') return {ignored:true,reason:'Für diese App fehlt noch ein geprüftes Zahlungsformat.'};
  // Only the observed card-expense sentence is accepted; transfers, income and ads stay out.
  const match=text.match(/^((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*€ bei (.+?) ausgegeben[.!]?$/u);
  if(!match) return {ignored:true,reason:'Keine erkannte Kartenausgabe. Titel und Text im Kurzbefehl prüfen.'};
  const merchant=match[2].trim();if(!merchant||merchant.length>200) return {ignored:true,reason:'Händler fehlt oder ist zu lang.'};
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(occurred));
  const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
  const fingerprint=await digest(JSON.stringify([app.toLowerCase(),title.toLowerCase(),text.toLowerCase()]));
  const id='push-'+await digest(JSON.stringify([fingerprint,new Date(occurred).toISOString()]));
  const payment=normalizePayment({id,amount:match[1].replace(/\./g,'').replace(',','.'),date,merchant,category:'Einkauf'});
  return {payment:{...payment,currency:'EUR',source:'bank-push',bank:'trade_republic',notificationDate:new Date(occurred).toISOString()},fingerprint,occurred};
}

export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(request.method==='OPTIONS') return reply(request,{},request.headers.get('Origin')===ORIGIN?200:403);
    if(path==='/health'&&request.method==='GET') return reply(request,{ok:true,service:'kostentracker-test'});
    if(!path.startsWith('/api/')) return reply(request,{error:'Nicht gefunden'},404);
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==ORIGIN) return reply(request,{error:'Herkunft nicht erlaubt'},403);
    try {
      const userId=await identifyUser(request,env);
      if(!userId) return reply(request,{error:'Zugriff verweigert: persönlichen Code prüfen'},401);
      await initialize(env.DB);
      if(path==='/api/config'&&request.method==='GET') return reply(request,{ok:true,userId,publicKey:env.VAPID_PUBLIC_KEY||'',appUrl:APP_URL});
      if(path==='/api/notifications'&&request.method==='POST') {
        const event=await parseBankNotification(await body(request));
        if(event.ignored) return reply(request,{ok:true,...event});
        const {payment,fingerprint,occurred}=event;
        // The exact event ID is idempotent. Similar events with a different time
        // are kept for review instead of silently merging two real purchases.
        await env.DB.batch([
          env.DB.prepare("INSERT INTO user_payments(user_id,id,payload,created) VALUES(?,?,CASE WHEN EXISTS(SELECT 1 FROM notification_events WHERE user_id=? AND fingerprint=? AND id<>? AND ABS(occurred-?)<=120000) THEN json_set(?, '$.reviewReason', 'Möglicherweise doppelte Push-Nachricht: gleiche Nachricht innerhalb von 2 Minuten') ELSE ? END,?) ON CONFLICT(user_id,id) DO NOTHING").bind(userId,payment.id,userId,fingerprint,payment.id,occurred,JSON.stringify(payment),JSON.stringify(payment),Date.now()),
          env.DB.prepare('INSERT OR IGNORE INTO notification_events(user_id,id,fingerprint,occurred) VALUES(?,?,?,?)').bind(userId,payment.id,fingerprint,occurred)
        ]);
        const saved=await env.DB.prepare('SELECT payload FROM user_payments WHERE user_id=? AND id=?').bind(userId,payment.id).first();
        return reply(request,{ok:true,id:payment.id,review:!!JSON.parse(saved.payload).reviewReason});
      }
      if(path==='/api/payments'&&request.method==='POST') {
        const payment=normalizePayment(await body(request)), payload=JSON.stringify(payment);
        await env.DB.prepare('INSERT INTO user_payments(user_id,id,payload,created) VALUES(?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').bind(userId,payment.id,payload,Date.now()).run();
        const saved=await env.DB.prepare('SELECT payload FROM user_payments WHERE user_id=? AND id=?').bind(userId,payment.id).first();
        if(saved.payload!==payload) fail('Diese Zahlungs-ID gehört bereits zu einer anderen Zahlung',409);
        return reply(request,{ok:true,id:payment.id});
      }
      if(path==='/api/payments'&&request.method==='GET') {
        const {results}=await env.DB.prepare('SELECT payload FROM user_payments WHERE user_id=? AND acknowledged=0 ORDER BY created,id LIMIT 100').bind(userId).all();
        return reply(request,{payments:results.map(row=>JSON.parse(row.payload))});
      }
      if(path==='/api/payments/ack'&&request.method==='POST') {
        const value=await body(request);if(!Array.isArray(value.ids)||value.ids.length>100||value.ids.some(id=>typeof id!=='string'||id.length>128)) fail('Ungültige IDs');
        if(value.ids.length) await env.DB.batch(value.ids.map(id=>env.DB.prepare('UPDATE user_payments SET acknowledged=1 WHERE user_id=? AND id=?').bind(userId,id)));
        return reply(request,{ok:true});
      }
      if(path==='/api/backup'&&request.method==='POST') {
        const value=await body(request);if(!value.data?.Haushalt||typeof value.data.Haushalt!=='object') fail('Ungültige App-Daten');
        await env.DB.prepare('INSERT INTO user_backup(user_id,payload,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated').bind(userId,JSON.stringify(value.data),Date.now()).run();
        return reply(request,{ok:true});
      }
      if(path==='/api/backup'&&request.method==='GET') {
        const saved=await env.DB.prepare('SELECT payload,updated FROM user_backup WHERE user_id=?').bind(userId).first();return reply(request,saved?{data:JSON.parse(saved.payload),updated:saved.updated}:{data:null});
      }
      if(path==='/api/subscribe'&&request.method==='POST') {
        if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY) fail('Push-Schlüssel fehlen',503);
        const sub=subscription(await body(request));
        await crypto.subtle.importKey('raw',unb64(sub.keys.p256dh),{name:'ECDH',namedCurve:'P-256'},false,[]);
        await env.DB.prepare('INSERT INTO user_subscriptions(endpoint,user_id,payload) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET payload=excluded.payload WHERE user_subscriptions.user_id=excluded.user_id').bind(sub.endpoint,userId,JSON.stringify(sub)).run();
        const owner=await env.DB.prepare('SELECT user_id FROM user_subscriptions WHERE endpoint=?').bind(sub.endpoint).first();
        if(owner?.user_id!==userId) fail('Diese Push-Anmeldung gehört zu einem anderen Zugang. Ein eigenes Gerät verwenden.',409);
        return reply(request,{ok:true});
      }
      if(path==='/api/push-test'&&request.method==='POST') {
        const value=await body(request);if(typeof value.endpoint!=='string') fail('Push-Ziel fehlt');
        const saved=await env.DB.prepare('SELECT payload FROM user_subscriptions WHERE endpoint=? AND user_id=?').bind(value.endpoint,userId).first();if(!saved) fail('Dieses Gerät zuerst für diesen Zugang für Push anmelden',404);
        const result=await deliver(env,JSON.parse(saved.payload),{title:'Kostentracker · Server-Test',body:'Diese Nachricht kommt von deinem persönlichen Zugang 🙂',tag:'server-test',data:{url:APP_URL}},userId);
        if(!result.accepted) return reply(request,{error:'Push-Dienst hat die Nachricht abgelehnt [HTTP '+result.status+']. '+(result.status===401||result.status===403?'VAPID-Schlüsselpaar prüfen.':result.status===404||result.status===410?'Server-Push erneut aktivieren.':'Bitte später erneut testen.'),pushStatus:result.status},502);
        return reply(request,{ok:true,accepted:true});
      }
      return reply(request,{error:'Nicht gefunden'},404);
    } catch(error) { console.error('Kostentracker API:',path,error.status||500);return reply(request,{error:error.status?error.message:'Server konnte die Anfrage nicht verarbeiten. DB und Secrets prüfen.'},error.status||500); }
  }
};
