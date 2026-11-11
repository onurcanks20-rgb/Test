/* IndexedDB is authoritative. A small synchronous write-ahead journal bridges existing UI saves. */
(() => {
 'use strict';
 const KEY='kostenApp_test',JOURNAL=KEY+'_v2_journal',NAME='kostentracker-test-records-v2';
 const codec=globalThis.KostentrackerRecords,uuid=()=>crypto.randomUUID();
 let db,rows=new Map(),versions=new Map(),acks=new Map(),pending=[],conflicts=new Map(),memory=null,revision=0,order=0,cursor=0,deviceId='',hadLegacy=false,confirmedServer=false,queue=Promise.resolve(),failure=null,exclusive=false;
 const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 function transaction(stores,mode,work){return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode,{durability:mode==='readwrite'?'strict':'default'});let result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Datenbankfehler'));tx.onabort=()=>reject(tx.error||Error('Speichern wurde abgebrochen'));try{result=work(tx);}catch(error){tx.abort();reject(error);}});}
 const changed=()=>window.dispatchEvent(new Event('kostentracker:storage-status'));
 function journal(){const text=localStorage.getItem(JOURNAL);if(!text)return [];const value=JSON.parse(text);if(!Array.isArray(value))throw Error('Lokales Speicherjournal ist beschädigt. Bitte Daten sichern.');return value;}
 function applyRows(operations){for(const op of operations)op.payload===null?rows.delete(op.key):rows.set(op.key,op.payload);memory=JSON.stringify(codec.decode(rows));}
 function operationsFor(next){
  const operations=[];
  for(const key of new Set([...rows.keys(),...next.keys()])){
   const payload=next.get(key)??null;if((rows.get(key)??null)===payload)continue;
   const previous=[...pending].reverse().find(op=>op.key===key);
   operations.push({id:uuid(),key,payload,baseVersion:versions.get(key)||0,predecessor:previous?.id||null,order:++order});
  }
  return operations;
 }
 async function commitJournals(){
  const entries=journal().filter(entry=>entry.revision>revision);if(!entries.length){localStorage.removeItem(JOURNAL);return;}
  await transaction(['records','outbox','meta'],'readwrite',tx=>{
   for(const entry of entries)for(const op of entry.operations){if(op.payload===null)tx.objectStore('records').delete(op.key);else tx.objectStore('records').put(op.payload,op.key);tx.objectStore('outbox').put(op,op.id);}
   tx.objectStore('meta').put(entries.at(-1).revision,'revision');tx.objectStore('meta').put(order,'order');
  });
  revision=entries.at(-1).revision;const remaining=journal().filter(entry=>entry.revision>revision);if(remaining.length)localStorage.setItem(JOURNAL,JSON.stringify(remaining));else localStorage.removeItem(JOURNAL);
 }
 async function flush(){
  queue=queue.catch(()=>{}).then(commitJournals);
  try{await queue;failure=null;changed();}catch(error){failure=error;changed();throw error;}
 }
 function write(serialized){
  if(!db)throw Error('Lokale Datenbank ist noch nicht bereit.');
  if(exclusive)throw Error('Die Datenübernahme läuft. Bitte kurz warten und erneut speichern.');
  const next=codec.encode(JSON.parse(serialized),rows),operations=operationsFor(next);if(!operations.length){memory=serialized;return;}
  const entries=journal();const nextRevision=Math.max(revision,...entries.map(entry=>entry.revision))+1;
  // The UI reports success only after a recoverable journal was synchronously saved.
  localStorage.setItem(JOURNAL,JSON.stringify([...entries,{revision:nextRevision,operations}]));
  pending.push(...operations);rows=next;memory=serialized;try{localStorage.setItem(KEY+'_design',JSON.stringify(JSON.parse(serialized)?.Einstellungen?.designModus||'system'));}catch{}changed();flush().catch(()=>{});
 }
 async function replace(data){
  if(exclusive)throw Error('Eine Datenübernahme läuft bereits.');exclusive=true;try{
  await flush();const next=codec.encode(data,rows),operations=operationsFor(next);const nextRevision=revision+1;
  await transaction(['records','outbox','meta'],'readwrite',tx=>{
   tx.objectStore('records').clear();for(const [key,payload]of next)tx.objectStore('records').put(payload,key);
   for(const op of operations)tx.objectStore('outbox').put(op,op.id);tx.objectStore('meta').put(nextRevision,'revision');tx.objectStore('meta').put(order,'order');tx.objectStore('meta').put(true,'hadLegacy');
  });
  hadLegacy=true;revision=nextRevision;pending.push(...operations);rows=next;memory=JSON.stringify(data);changed();
  }finally{exclusive=false;}
 }
 async function accept(accepted){
  await flush();
  const ids=new Set(accepted.map(row=>row.id));const remaining=pending.filter(op=>!ids.has(op.id));
  const byId=new Map(accepted.map(row=>[row.id,row]));
  for(const op of remaining){const previous=byId.get(op.predecessor);if(previous){op.baseVersion=previous.version;op.predecessor=null;}}
  await transaction(['outbox','versions','remote','acks'],'readwrite',tx=>{
   for(const row of accepted){tx.objectStore('outbox').delete(row.id);tx.objectStore('versions').put(Math.max(versions.get(row.key)||0,row.version),row.key);tx.objectStore('remote').put(row,row.key);tx.objectStore('acks').put(row.version,row.id);}
   for(const op of remaining)tx.objectStore('outbox').put(op,op.id);
  });
  pending=pending.filter(op=>!ids.has(op.id));for(const row of accepted){versions.set(row.key,Math.max(versions.get(row.key)||0,row.version));acks.set(row.id,row.version);}changed();
 }
 async function receive(result){
  await flush();const next=new Map(rows),nextConflicts=new Map(conflicts),keys=new Set(pending.map(op=>op.key));
  for(const row of result.records){
   if((versions.get(row.key)||0)>row.version)continue;
   if(!keys.has(row.key)){row.payload===null?next.delete(row.key):next.set(row.key,row.payload);}
   else if(nextConflicts.has(row.key))nextConflicts.set(row.key,{...nextConflicts.get(row.key),remote:row});
  }
  const serialized=JSON.stringify(codec.decode(next));
  await transaction(['records','versions','remote','meta','conflicts'],'readwrite',tx=>{
   for(const row of result.records){if((versions.get(row.key)||0)>row.version)continue;tx.objectStore('versions').put(row.version,row.key);tx.objectStore('remote').put(row,row.key);if(!keys.has(row.key)){row.payload===null?tx.objectStore('records').delete(row.key):tx.objectStore('records').put(row.payload,row.key);}if(nextConflicts.has(row.key))tx.objectStore('conflicts').put(nextConflicts.get(row.key),row.key);}
   tx.objectStore('meta').put(result.cursor,'cursor');
  });
  const currentKeys=new Set(pending.map(op=>op.key));for(const row of result.records)if(!currentKeys.has(row.key)&&(versions.get(row.key)||0)<=row.version){row.payload===null?rows.delete(row.key):rows.set(row.key,row.payload);}memory=JSON.stringify(codec.decode(rows));cursor=result.cursor;conflicts=nextConflicts;for(const row of result.records)versions.set(row.key,Math.max(versions.get(row.key)||0,row.version));changed();
 }
 async function rememberConflicts(items){
  await flush();const next=new Map(conflicts);for(const item of items)next.set(item.key,{key:item.key,remote:item.remote,local:rows.get(item.key)??null});
  await transaction(['conflicts'],'readwrite',tx=>{for(const [key,value]of next)tx.objectStore('conflicts').put(value,key);});conflicts=next;changed();
 }
 async function resolve(key,keepLocal){
  if(exclusive)throw Error('Eine Datenübernahme läuft bereits.');exclusive=true;try{
  await flush();const item=conflicts.get(key);if(!item)return;
  const nextPending=pending.filter(op=>op.key!==key),payload=keepLocal?(rows.get(key)??null):item.remote.payload;
  const newOp=keepLocal?{id:uuid(),key,payload,baseVersion:item.remote.version,predecessor:null,order:++order}:null;
  const next=new Map(rows);payload===null?next.delete(key):next.set(key,payload);const serialized=JSON.stringify(codec.decode(next));
  await transaction(['conflicts','outbox','records','versions','meta'],'readwrite',tx=>{
   tx.objectStore('conflicts').delete(key);for(const op of pending)if(op.key===key)tx.objectStore('outbox').delete(op.id);if(newOp)tx.objectStore('outbox').put(newOp,newOp.id);
   payload===null?tx.objectStore('records').delete(key):tx.objectStore('records').put(payload,key);tx.objectStore('versions').put(item.remote.version,key);tx.objectStore('meta').put(order,'order');
  });
  if(newOp)nextPending.push(newOp);pending=nextPending;rows=next;memory=serialized;versions.set(key,item.remote.version);conflicts.delete(key);changed();
  }finally{exclusive=false;}
 }
 function batch(limit=40){const seen=new Set();return pending.filter(op=>{if(seen.has(op.key)||conflicts.has(op.key)||op.predecessor&&pending.some(p=>p.id===op.predecessor))return false;seen.add(op.key);return true;}).slice(0,limit).map(op=>({...op,baseVersion:op.predecessor&&acks.has(op.predecessor)?acks.get(op.predecessor):op.baseVersion}));}
 async function resetToServer(records,newCursor){
  if(exclusive)throw Error('Eine Datenübernahme läuft bereits.');exclusive=true;try{
  await flush();const next=new Map(records.filter(row=>row.payload!==null).map(row=>[row.key,row.payload]));const serialized=JSON.stringify(codec.decode(next));
  await transaction(['records','outbox','versions','remote','meta','conflicts'],'readwrite',tx=>{
   for(const store of ['records','outbox','versions','remote','conflicts'])tx.objectStore(store).clear();
   for(const row of records){if(row.payload!==null)tx.objectStore('records').put(row.payload,row.key);tx.objectStore('versions').put(row.version,row.key);tx.objectStore('remote').put(row,row.key);}tx.objectStore('meta').put(newCursor,'cursor');tx.objectStore('meta').put(true,'confirmedServer');
  });
  rows=next;memory=serialized;pending=[];versions=new Map(records.map(row=>[row.key,row.version]));conflicts.clear();cursor=newCursor;hadLegacy=true;confirmedServer=true;changed();
  }finally{exclusive=false;}
 }
 async function archiveLegacy(){
  const original=localStorage.getItem(KEY);if(!original)return;
  await transaction(['meta'],'readwrite',tx=>tx.objectStore('meta').put(original,'migrationSnapshot'));
  // Remove the large old browser-storage copy only after a successful V2 server backup.
  // Its exact contents remain available inside IndexedDB and through the export button.
  try{localStorage.setItem(KEY+'_design',JSON.stringify(JSON.parse(memory)?.Einstellungen?.designModus||'system'));}catch{}
  if(localStorage.getItem(KEY)===original)localStorage.removeItem(KEY);
 }
 async function migrationSnapshot(){
  const tx=db.transaction('meta','readonly');return await request(tx.objectStore('meta').get('migrationSnapshot'))||localStorage.getItem(KEY);
 }
 async function initialize(){
  if(!window.indexedDB)throw Error('IndexedDB ist nicht verfügbar. Die bisherigen Daten bleiben unverändert.');
  if(!navigator.locks)throw Error('Bitte iOS bzw. den Browser aktualisieren: Für die Datenbank wird Web Locks benötigt.');
  await new Promise((resolve,reject)=>{navigator.locks.request(NAME+'-writer',{ifAvailable:true},async lock=>{if(!lock){reject(Error('Die Test-App ist bereits in einem anderen Fenster geöffnet. Bitte dieses schließen und hier neu laden.'));return;}resolve();await new Promise(()=>{});}).catch(reject);});
  db=await new Promise((resolve,reject)=>{const req=indexedDB.open(NAME,1);req.onupgradeneeded=()=>{for(const name of ['records','outbox','meta','versions','remote','conflicts','acks'])req.result.createObjectStore(name);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Bitte weitere geöffnete Test-App-Fenster schließen.'));});
  db.onversionchange=()=>{db.close();failure=Error('Datenbank wurde geändert. Bitte App neu öffnen.');changed();};
  const read=async name=>{const tx=db.transaction(name,'readonly');return Promise.all([request(tx.objectStore(name).getAllKeys()),request(tx.objectStore(name).getAll())]);};
  const [metaKeys,metaValues]=await read('meta'),meta=new Map(metaKeys.map((key,index)=>[key,metaValues[index]]));
  deviceId=meta.get('deviceId')||uuid();hadLegacy=!!meta.get('hadLegacy');confirmedServer=!!meta.get('confirmedServer');revision=meta.get('revision')||0;order=meta.get('order')||0;cursor=meta.get('cursor')||0;
  if(!meta.get('initialized')){
   const legacy=localStorage.getItem(KEY);hadLegacy=!!legacy;const data=legacy?JSON.parse(legacy):{};rows=codec.encode(data);pending=[];
   for(const [key,payload]of rows)pending.push({id:uuid(),key,payload,baseVersion:0,predecessor:null,order:++order});
   await transaction(['records','outbox','meta'],'readwrite',tx=>{for(const [key,payload]of rows)tx.objectStore('records').put(payload,key);for(const op of pending)tx.objectStore('outbox').put(op,op.id);for(const [key,value]of [['initialized',true],['deviceId',deviceId],['hadLegacy',hadLegacy],['order',order],['revision',0]])tx.objectStore('meta').put(value,key);});
  }else{
   const [keys,values]=await read('records');rows=new Map(keys.map((key,index)=>[key,values[index]]));
   const [,ops]=await read('outbox');pending=ops.sort((a,b)=>a.order-b.order);
   const [versionKeys,versionValues]=await read('versions');versions=new Map(versionKeys.map((key,index)=>[key,versionValues[index]]));
   const [ackKeys,ackValues]=await read('acks');acks=new Map(ackKeys.map((key,index)=>[key,ackValues[index]]));
   const [conflictKeys,conflictValues]=await read('conflicts');conflicts=new Map(conflictKeys.map((key,index)=>[key,conflictValues[index]]));
  }
  const recovery=journal().filter(entry=>entry.revision>revision);for(const entry of recovery){applyRows(entry.operations);for(const op of entry.operations)if(!pending.some(p=>p.id===op.id))pending.push(op);order=Math.max(order,...entry.operations.map(op=>op.order));}
  memory=JSON.stringify(codec.decode(rows));await flush();
  // Request persistence without treating a refusal as a failure.
  navigator.storage?.persist?.().catch(()=>{});
  return true;
 }
 const ready=initialize();ready.catch(()=>{});
 globalThis.KostentrackerDB=Object.freeze({ready,archiveLegacy,migrationSnapshot,markServerReady:async()=>{await transaction(['meta'],'readwrite',tx=>tx.objectStore('meta').put(true,'confirmedServer'));confirmedServer=true;},read:()=>memory,write,flush,replace,accept,receive,rememberConflicts,resolve,batch,resetToServer,
  status:()=>({pending:pending.length,conflicts:[...conflicts.values()],cursor,deviceId,hadLegacy,confirmedServer,error:failure?.message||'',bytes:new TextEncoder().encode(memory||'').length}),
  data:()=>JSON.parse(memory),records:()=>new Map(rows)});
})();
