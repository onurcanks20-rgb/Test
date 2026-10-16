Kostentracker.module({
  "id":"js/app/aktualisierung.js","dependencies":[],"session":[],"read":[],"write":[],"replace":false
}, () => {
  'use strict';
  const supported='serviceWorker' in navigator&&window.isSecureContext&&/^https?:$/.test(location.protocol);
  const workers=supported?navigator.serviceWorker:null;
  const pageVersion=document.querySelector?.('meta[name="app-version"]')?.content;
  const watched=new WeakSet();
  let registration=null,inFlight=null,lastCheck=0,ready=false,reloading=false,hasDraft=false;
  let opening=document.documentElement.classList.contains('boot-starting');
  function updateStatus(message){const el=document.getElementById('appUpdateStatus');if(el)el.textContent=message;}
  function canReload(){
    if(hasDraft||document.visibilityState==='hidden'||document.querySelector?.('dialog[open]'))return false;
    const active=document.activeElement;
    if(active&&(/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)||active.isContentEditable))return false;
    return !Array.from(document.querySelectorAll?.('input:not([type="hidden"]),textarea,select,[contenteditable="true"]')||[]).some(el=>el.getClientRects?.().length);
  }
  function applyAppUpdate(){if(ready&&!reloading&&opening&&canReload()){reloading=true;location.reload();}}
  function dismissAppUpdate(){opening=false;}
  function updateTimeout(promise){
    let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Zeitüberschreitung')),20000);})]).finally(()=>clearTimeout(timer));
  }
  async function readWorkerVersion(worker){
    if(!worker||typeof MessageChannel==='undefined')return null;
    return new Promise(resolve=>{
      const channel=new MessageChannel();let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
      const timer=setTimeout(()=>finish(null),1500);
      channel.port1.onmessage=event=>finish(typeof event.data?.version==='string'?event.data.version:null);
      try{worker.postMessage({type:'APP_VERSION'},[channel.port2]);}catch(_){finish(null);}
    });
  }
  async function detectUpdate(){
    const controller=workers?.controller,version=await readWorkerVersion(controller);
    if(!version||!pageVersion||controller!==workers.controller)return;
    ready=version!==pageVersion;
    if(ready){updateStatus('Update ist bereit und wird beim nächsten Öffnen automatisch übernommen.');applyAppUpdate();}
    else updateStatus('App ist auf dem aktuellen Stand.');
  }
  function observeRegistration(reg){
    if(watched.has(reg))return;watched.add(reg);
    const watch=worker=>{
      if(!worker||watched.has(worker))return;watched.add(worker);
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installing')updateStatus('Neue Version wird geladen …');
        else if(worker.state==='installed'||worker.state==='activating')updateStatus('Neue Version wird vorbereitet …');
        else if(worker.state==='activated')detectUpdate();
        else if(worker.state==='redundant')updateStatus('Update noch nicht verfügbar. Die bisherige Version bleibt erhalten.');
      });
    };
    reg.addEventListener('updatefound',()=>watch(reg.installing));watch(reg.installing);
  }
  function checkAppUpdate(manual=false){
    if(!supported){if(manual)updateStatus('App-Updates werden in diesem Browser nicht unterstützt.');return Promise.resolve();}
    if(ready){applyAppUpdate();return Promise.resolve();}
    if(navigator.onLine===false){if(manual)updateStatus('Du bist offline. Deine gespeicherte App bleibt verfügbar.');return Promise.resolve();}
    if(inFlight)return inFlight;
    if(!manual&&lastCheck&&Date.now()-lastCheck<60000)return Promise.resolve();
    lastCheck=Date.now();if(manual)updateStatus('Nach Updates suchen …');
    const button=document.getElementById('appUpdateCheckButton');if(button)button.disabled=true;
    inFlight=Promise.resolve().then(async()=>{
      try{
        if(!registration){registration=await updateTimeout(workers.register('./service-worker.js',{scope:'./',updateViaCache:'none'}));observeRegistration(registration);}
        await updateTimeout(registration.update());await detectUpdate();
        if(!ready&&registration.installing)updateStatus('Neue Version wird im Hintergrund geladen …');
      }catch(error){if(manual)updateStatus('Updateprüfung momentan nicht möglich. Wir versuchen es später automatisch erneut.');console.warn('App-Update konnte nicht geprüft werden:',error);}
      finally{if(button)button.disabled=false;inFlight=null;}
    });
    return inFlight;
  }
  if(supported){
    // Never interrupt a current interaction or discard an edited field, including across resume.
    document.addEventListener('input',()=>{hasDraft=true;opening=false;},true);
    document.addEventListener('change',()=>{hasDraft=true;opening=false;},true);
    for(const event of ['pointerdown','keydown','touchstart'])document.addEventListener(event,()=>{opening=false;},true);
    document.addEventListener('kostentracker:boot-complete',()=>{opening=false;});
    workers.addEventListener('controllerchange',detectUpdate);
    const start=()=>checkAppUpdate();
    if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
    window.addEventListener('online',()=>{lastCheck=0;checkAppUpdate();});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){opening=true;applyAppUpdate();checkAppUpdate();}else opening=false;
    });
  }
  return {checkAppUpdate,applyAppUpdate,dismissAppUpdate};
});
