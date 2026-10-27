/* Erst das sichtbare Logo zeichnen, dann die App in ihrer bisherigen Reihenfolge starten. */
(() => {
  const splash=document.getElementById('bootSplash');
  const selector='script[type="application/x-kostentracker"]';
  if(!splash||!document.querySelector?.(selector))return;
  const root=document.documentElement,logo=document.getElementById('bootSplashLogo'),image=document.getElementById('bootSplashIcon'),fallback=document.getElementById('bootSplashFallback');
  root.classList.add('boot-starting','boot-covering');
  // Match the saved theme without waiting for the rest of the application.
  try{const mode=JSON.parse(localStorage.getItem('kostenApp_test')||'null')?.Einstellungen?.designModus;const dark=mode==='dunkel'||(!['hell','dunkel'].includes(mode)&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);root.dataset.theme=dark?'dark':'light';}catch(_){}
  const height=window.visualViewport?.height||window.innerHeight,offset=window.visualViewport?.offsetTop||0;
  if(Number.isFinite(height)&&height>0)splash.style.setProperty('--boot-logo-center',Math.round(offset+height/2)+'px');
  const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const revealDuration=reduced?0:160,fadeDuration=reduced?0:280;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  let failed=false,finished=false,visibleAt=null,assetLocked=false;
  function fail() {
    if(finished||failed)return;failed=true;clearTimeout(watchdog);
    document.getElementById('bootSplashError').hidden=false;
    splash.setAttribute('aria-label','App konnte nicht gestartet werden. Bitte erneut laden.');
    console.warn('App-Start unvollständig. Die gespeicherten App-Daten bleiben erhalten.');
  }
  const watchdog=setTimeout(fail,20000);
  // A missing image must never hold the startup indefinitely or cause a later logo swap.
  const imageReady=new Promise(resolve=>{
    let timer;
    const settle=showImage=>{
      if(assetLocked||failed)return;assetLocked=true;clearTimeout(timer);
      image.hidden=!showImage;fallback.hidden=showImage;resolve();
    };
    const loaded=async()=>{try{if(image.decode)await image.decode();settle(true);}catch(_){settle(false);}};
    image.addEventListener('load',loaded,{once:true});image.addEventListener('error',()=>settle(false),{once:true});
    timer=setTimeout(()=>settle(false),1200);
    if(image.complete){if(image.naturalWidth>0)loaded();else settle(false);}
  });
  const logoVisible=(async()=>{
    await imageReady;if(failed)return;await frame();if(failed)return;
    logo.classList.add('boot-logo-visible');visibleAt=performance.now();
    // Yield a real paint before loading/executing the main application.
    await frame();
  })();
  function loadStyle(link) {
    return new Promise((resolve,reject)=>{
      const done=()=>{link.media='all';resolve();};
      if(link.dataset.failed==='true'){reject(Error('Stylesheet fehlt'));return;}
      if(link.sheet||link.dataset.loaded==='true'){done();return;}
      link.addEventListener('load',done,{once:true});link.addEventListener('error',()=>reject(Error('Stylesheet fehlt')),{once:true});
    });
  }
  function loadScript(original) {
    return new Promise((resolve,reject)=>{
      if(failed){reject(Error('Start abgebrochen'));return;}
      const script=document.createElement('script');script.src=original.src;script.async=false;
      script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(Error('App-Datei fehlt')),{once:true});
      document.body.appendChild(script);
    });
  }
  async function start() {
    try{
      await logoVisible;if(failed)return;
      const scripts=Array.from(document.querySelectorAll(selector));
      const styles=Array.from(document.querySelectorAll('link[data-app-style]'));
      // Fetch in parallel, but keep execution in the application's original order.
      for(const item of scripts){const link=document.createElement('link');link.rel='preload';link.as='script';link.href=item.src;document.head.appendChild(link);}
      await delay(Math.max(0,revealDuration-(performance.now()-visibleAt)));
      await Promise.all(styles.map(loadStyle));if(failed)return;
      for(const script of scripts){await loadScript(script);if(failed)return;}
      await frame();await frame();if(failed)return;
      await delay(Math.max(0,revealDuration+500-(performance.now()-visibleAt)));if(failed)return;
      // Reveal the initialized view under the fading cover, without moving the logo.
      root.classList.remove('boot-covering');splash.classList.add('boot-splash-leaving');
      await delay(fadeDuration);if(failed)return;
      finished=true;clearTimeout(watchdog);splash.remove();root.classList.remove('boot-starting');
      document.dispatchEvent(new Event('kostentracker:boot-complete'));
    }catch(_){fail();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
