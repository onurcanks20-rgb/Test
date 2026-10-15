/* Nur die Startüberbrückung; keine App-Daten und keine Netzwerkaufrufe. */
(() => {
  const splash=document.getElementById('bootSplash');if(!splash)return;
  const started=performance.now(),duration=500;
  const fade=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:120;
  let finished=false,closeTimer=null,removeTimer=null;
  const remove=()=>{finished=true;splash.remove();clearTimeout(closeTimer);clearTimeout(removeTimer);clearTimeout(fallback);};
  const fallback=setTimeout(remove,8000);
  const ready=()=>{
    if(finished)return;finished=true;
    closeTimer=setTimeout(()=>{
      splash.classList.add('boot-splash-leaving');
      removeTimer=setTimeout(remove,fade);
    },Math.max(0,duration-fade-(performance.now()-started)));
  };
  // Two frames give the initialized first view a chance to be painted behind the logo.
  const afterFirstView=()=>requestAnimationFrame(()=>requestAnimationFrame(ready));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterFirstView,{once:true});
  else afterFirstView();
})();
