Kostentracker.module({
  "id":"js/app/aktualisierung.js","dependencies":[],"session":[],"read":[],"write":[],"replace":false
}, () => {
  'use strict';
  const supported='serviceWorker' in navigator&&window.isSecureContext&&/^https?:$/.test(location.protocol);
  const workers=supported?navigator.serviceWorker:null;
  const pageVersion=document.querySelector?.('meta[name="app-version"]')?.content;
  const watched=new WeakSet(),pollDelay=5*60*1000;
  let registration=null,inFlight=null,lastCheck=0,ready=false,reloading=false,restartTimer=null,pollTimer=null;
  let lastInteraction=-Infinity,pointerActive=false;
  function updateStatus(message){const el=document.getElementById('appUpdateStatus');if(el)el.textContent=message;}
  function visible(el){
    if(!el||!el.getClientRects?.().length)return false;
    const style=typeof getComputedStyle==='function'?getComputedStyle(el):null;
    return !style||(style.display!=='none'&&style.visibility!=='hidden');
  }
  function canReload(){
    if(document.visibilityState==='hidden'||pointerActive||Date.now()-lastInteraction<1200)return false;
    if(document.getElementById('homeSyncStatus')?.dataset.state==='busy')return false;
    const active=document.activeElement;
    if(active&&visible(active)&&(/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)||active.isContentEditable))return false;
    const blockers='input:not([type="hidden"]),textarea,select,[contenteditable="true"],dialog[open],.sheet-backdrop:not(.hidden),.category-add-panel:not(.hidden),#undoToast:not(.hidden)';
    return !Array.from(document.querySelectorAll?.(blockers)||[]).some(visible);
  }
  function dismissAppUpdate(){document.getElementById('appUpdateNotice')?.classList.add('hidden');}
  function scheduleRestart(delay=0){
    if(!ready||reloading||restartTimer!==null||document.visibilityState==='hidden')return;
    restartTimer=setTimeout(()=>{
      restartTimer=null;if(!ready||reloading)return;
      if(canReload()){
        reloading=true;clearTimeout(pollTimer);dismissAppUpdate();location.reload();
      }else{
        scheduleRestart(500);
      }
    },delay);
  }
  function applyAppUpdate(){scheduleRestart();}
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
    if(ready){updateStatus('Update bereit. Die App lädt automatisch neu, sobald deine Eingabe abgeschlossen ist.');applyAppUpdate();}
    else{clearTimeout(restartTimer);restartTimer=null;dismissAppUpdate();updateStatus('App ist auf dem aktuellen Stand.');}
  }
  function observeRegistration(reg){
    if(watched.has(reg))return;watched.add(reg);
    const watch=worker=>{
      if(!worker||watched.has(worker))return;watched.add(worker);
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installing')updateStatus('Neue Version wird geladen …');
        else if(worker.state==='installed'||worker.state==='activating')updateStatus('Neue Version wird vorbereitet …');
        else if(worker.state==='activated')detectUpdate();
        else if(worker.state==='redundant')updateStatus('Update konnte nicht vollständig geladen werden. Die bisherige Version bleibt verfügbar.');
      });
    };
    reg.addEventListener('updatefound',()=>watch(reg.installing));watch(reg.installing);
  }
  function checkAppUpdate(manual=false){
    if(!supported){if(manual)updateStatus('App-Updates werden in diesem Browser nicht unterstützt.');return Promise.resolve();}
    if(reloading)return Promise.resolve();
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
  function schedulePoll(){
    clearTimeout(pollTimer);pollTimer=null;
    if(document.visibilityState==='hidden'||reloading)return;
    pollTimer=setTimeout(()=>{pollTimer=null;checkAppUpdate().finally(schedulePoll);},pollDelay);
  }
  if(supported){
    const interacted=()=>{lastInteraction=Date.now();};
    for(const name of ['input','change','keydown','keyup','scroll'])document.addEventListener(name,interacted,{capture:true,passive:true});
    for(const name of ['pointerdown','touchstart'])document.addEventListener(name,()=>{pointerActive=true;interacted();},{capture:true,passive:true});
    for(const name of ['pointerup','pointercancel','touchend','touchcancel'])document.addEventListener(name,()=>{pointerActive=false;interacted();},{capture:true,passive:true});
    workers.addEventListener('controllerchange',detectUpdate);
    const start=()=>{schedulePoll();return checkAppUpdate();};
    if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
    window.addEventListener('online',()=>{lastCheck=0;checkAppUpdate();});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){schedulePoll();applyAppUpdate();checkAppUpdate();}
      else{pointerActive=false;clearTimeout(pollTimer);pollTimer=null;clearTimeout(restartTimer);restartTimer=null;}
    });
  }
  return {checkAppUpdate,applyAppUpdate,dismissAppUpdate};
});
