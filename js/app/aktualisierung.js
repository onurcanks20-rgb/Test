Kostentracker.module({
  "id":"js/app/aktualisierung.js","dependencies":[],"session":[],"read":[],"write":[],"replace":false
}, (context, dependencies) => {
  'use strict';
  const supported='serviceWorker' in navigator&&window.isSecureContext&&/^https?:$/.test(location.protocol);
  const workers=supported?navigator.serviceWorker:null;
  const watched=new WeakSet();
  let registration=null,inFlight=null,lastCheck=0,hadController=!!workers?.controller,ready=false,dismissed=false;
  function updateStatus(message) {const el=document.getElementById('appUpdateStatus');if(el)el.textContent=message;}
  function showAppUpdate() {
    ready=true;
    if(!dismissed)document.getElementById('appUpdateNotice')?.classList.remove('hidden');
    updateStatus('Eine neue Version ist bereit. Eingaben bitte vor dem Neuladen speichern.');
  }
  function dismissAppUpdate() {dismissed=true;document.getElementById('appUpdateNotice')?.classList.add('hidden');}
  function applyAppUpdate() {if(ready)location.reload();}
  function updateTimeout(promise) {
    let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Zeitüberschreitung')),20000);})]).finally(()=>clearTimeout(timer));
  }
  function observeRegistration(reg) {
    if(watched.has(reg))return;watched.add(reg);
    const watch=worker=>{
      if(!worker||watched.has(worker))return;watched.add(worker);
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installing')updateStatus('Neue Version wird geladen …');
        else if(worker.state==='installed'||worker.state==='activating')updateStatus('Neue Version wird vorbereitet …');
        else if(worker.state==='activated'&&!ready)updateStatus('App ist auf dem aktuellen Stand.');
        else if(worker.state==='redundant')updateStatus('Update konnte nicht vollständig geladen werden. Die bisherige Version bleibt verfügbar.');
      });
    };
    reg.addEventListener('updatefound',()=>{updateStatus('Neue Version wird geladen …');watch(reg.installing);});watch(reg.installing);
  }
  function checkAppUpdate(manual=false) {
    if(!supported){if(manual)updateStatus('App-Updates werden in diesem Browser nicht unterstützt.');return Promise.resolve();}
    if(ready){if(manual){dismissed=false;showAppUpdate();}return Promise.resolve();}
    if(navigator.onLine===false){if(manual)updateStatus('Du bist offline. Deine gespeicherte App bleibt verfügbar.');return Promise.resolve();}
    if(inFlight)return inFlight;
    if(!manual&&lastCheck&&Date.now()-lastCheck<60000)return Promise.resolve();
    lastCheck=Date.now();if(manual)updateStatus('Nach Updates suchen …');
    const button=document.getElementById('appUpdateCheckButton');if(button)button.disabled=true;
    inFlight=Promise.resolve().then(async()=>{
      try {
        if(!registration){registration=await updateTimeout(workers.register('./service-worker.js',{scope:'./',updateViaCache:'none'}));observeRegistration(registration);}
        await updateTimeout(registration.update());
        if(!ready){
          if(registration.installing)updateStatus('Neue Version wird geladen …');
          else if(registration.waiting)updateStatus('Update wird beim nächsten vollständigen Öffnen der App bereitgestellt.');
          else updateStatus('Keine neue Version gefunden.');
        }
      }catch(error){if(manual)updateStatus('Updateprüfung nicht möglich. Bitte später mit Internet erneut versuchen.');console.warn('App-Update konnte nicht geprüft werden:',error);}
      finally{if(button)button.disabled=false;inFlight=null;}
    });
    return inFlight;
  }
  if(supported){
    workers.addEventListener('controllerchange',()=>{
      if(!workers.controller)return;
      if(hadController)showAppUpdate();
      hadController=!!workers.controller;
    });
    const start=()=>checkAppUpdate();
    if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
    window.addEventListener('online',()=>{lastCheck=0;checkAppUpdate();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkAppUpdate();});
  }
  return { checkAppUpdate, applyAppUpdate, dismissAppUpdate };
});
