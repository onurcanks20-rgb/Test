const WORKER_VERSION = "test-entry-help-v1";
const APP_SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `kostentracker-test:${encodeURIComponent(APP_SCOPE.pathname)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${WORKER_VERSION}`;
const APP_URL = new URL("index.html", APP_SCOPE).href;
const CODE_ASSETS = [
  "./js/ui/eingabehilfen.js?v=test-entry-help-v1",
  "./js/ui/ansicht-speichern.js?v=test-entry-help-v1",
  "./js/app/ladebildschirm.js?v=test-entry-help-v1",
  "./js/core/dateninitialisierung.js?v=test-entry-help-v1",
  "./js/core/dienste.js?v=test-entry-help-v1",
  "./js/core/speicherung-backup.js?v=test-entry-help-v1",
  "./js/ui/rueckgaengig.js?v=test-entry-help-v1",
  "./js/ui/erinnerungen.js?v=test-entry-help-v1",
  "./js/core/formatierung.js?v=test-entry-help-v1",
  "./js/budget/gehalt.js?v=test-entry-help-v1",
  "./js/ui/navigation.js?v=test-entry-help-v1",
  "./js/ui/eintragsaktionen.js?v=test-entry-help-v1",
  "./js/ui/einstellungen.js?v=test-entry-help-v1",
  "./js/ui/archiv.js?v=test-entry-help-v1",
  "./js/budget/wochenbudget.js?v=test-entry-help-v1",
  "./js/ui/schnelleingabe.js?v=test-entry-help-v1",
  "./js/kategorien/geplante-ausgaben.js?v=test-entry-help-v1",
  "./js/kategorien/sparen-investieren.js?v=test-entry-help-v1",
  "./js/kategorien/reise-waehrung.js?v=test-entry-help-v1",
  "./js/kategorien/reise-budget-kurs.js?v=test-entry-help-v1",
  "./js/kategorien/reisen.js?v=test-entry-help-v1",
  "./js/kategorien/fixkosten.js?v=test-entry-help-v1",
  "./js/ui/listen.js?v=test-entry-help-v1",
  "./js/kategorien/versicherungen.js?v=test-entry-help-v1",
  "./js/budget/berechnungen.js?v=test-entry-help-v1",
  "./js/ui/verschieben.js?v=test-entry-help-v1",
  "./js/kategorien/einnahmen.js?v=test-entry-help-v1",
  "./js/kategorien/haushalt.js?v=test-entry-help-v1",
  "./js/kategorien/freizeit.js?v=test-entry-help-v1",
  "./js/ui/formulare.js?v=test-entry-help-v1",
  "./js/kategorien/alltag-gemeinsam.js?v=test-entry-help-v1",
  "./js/ui/ausgabenarchiv.js?v=test-entry-help-v1",
  "./js/budget/faelligkeiten.js?v=test-entry-help-v1",
  "./js/budget/zeitraeume.js?v=test-entry-help-v1",
  "./js/budget/uebersicht.js?v=test-entry-help-v1",
  "./js/grafik/diagramme.js?v=test-entry-help-v1",
  "./js/app/design-start.js?v=test-entry-help-v1",
  "./js/app/aktualisierung.js?v=test-entry-help-v1",
  "./js/app/start.js?v=test-entry-help-v1",
  "./js/ui/wischgesten.js?v=test-entry-help-v1",
  "./js/ui/zurueckwischen.js?v=test-entry-help-v1",
  "./js/server/haendler.js?v=test-entry-help-v1",
  "./js/server/reise-zahlungen.js?v=test-entry-help-v1",
  "./js/server/synchronisierung.js?v=test-entry-help-v1",
  "./css/app.css?v=test-entry-help-v1",
  "./css/bedienung.css?v=test-entry-help-v1"
].map(path => new URL(path, APP_SCOPE).href);
const STATIC_ASSETS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]
  .map(path => new URL(path, APP_SCOPE).href).concat(CODE_ASSETS);

function isAppUrl(value) {
  try {
    const url = new URL(value, APP_SCOPE);
    return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_SCOPE.pathname);
  } catch (_) { return false; }
}

function notificationTarget(value) {
  return isAppPageUrl(value || APP_URL) ? new URL(value || APP_URL, APP_SCOPE).href : APP_URL;
}

function isAppPageUrl(value) {
  try {
    const url = new URL(value, APP_SCOPE);
    return isAppUrl(url.href) && (url.pathname === APP_SCOPE.pathname || url.pathname === new URL(APP_URL).pathname);
  } catch (_) { return false; }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Fetch a complete revision without reusing a stale HTTP cache entry.
    try {
      const page=await fetch(new Request(APP_URL,{cache:'reload'}));
      if(!page.ok||!(page.headers.get('Content-Type')||'').includes('text/html'))throw Error('App-Seite fehlt');
      const html=await page.clone().text();
      if(!html.includes('<meta name="app-version" content="'+WORKER_VERSION+'">'))throw Error('HTML und Service Worker haben unterschiedliche Versionen');
      const references=new Set(Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g),m=>new URL(m[1],APP_URL).href));
      if(CODE_ASSETS.some(url=>!references.has(url)))throw Error('App-Dateien und HTML passen nicht zusammen');
      for(const reference of references){const url=new URL(reference);if(isAppUrl(reference)&&/\.(?:js|css)$/.test(url.pathname)&&!CODE_ASSETS.includes(reference))throw Error('App-Datei fehlt im Offline-Paket');}
      await cache.put(APP_URL,page);
      await Promise.all(CODE_ASSETS.map(async url=>{
        const response=await fetch(new Request(url,{cache:'reload'}));
        if(!response.ok||(response.headers.get('Content-Type')||'').includes('text/html'))throw Error('App-Datei fehlt: '+url);
        await cache.put(url,response);
      }));
    }catch(error){await caches.delete(CACHE_NAME);throw error;}
    await Promise.all(STATIC_ASSETS.filter(url=>url!==APP_URL&&!CODE_ASSETS.includes(url)).map(async url=>{
      try{const response=await fetch(new Request(url,{cache:'reload'}));if(response.ok)await cache.put(url,response);}
      catch(_){console.warn('Optionale App-Datei konnte nicht gecacht werden:',url);}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME);
    const retained=previous.at(-1);
    await Promise.all(previous.filter(key=>key!==retained).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function putInCache(key, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, response);
  } catch (error) {
    console.warn("Offline-Kopie konnte nicht aktualisiert werden:", error);
  }
}

function offlineResponse() {
  return new Response("Die App ist offline und noch nicht gespeichert. Bitte einmal mit Internetverbindung öffnen.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!isAppUrl(url.href)) return;
  const isAppPage = url.pathname === APP_SCOPE.pathname || url.pathname === new URL(APP_URL).pathname;
  if (event.request.mode === "navigate") {
    if (!isAppPage) return;
    event.respondWith((async () => {
      // The cached HTML belongs to these scripts: activate a complete new worker for updates.
      const installed = await caches.match(APP_URL, { cacheName: CACHE_NAME });
      if (installed) return installed;
      try {
        const response = await fetch(event.request);
        if (response.ok && (response.headers.get("Content-Type") || "").includes("text/html")) {
          await putInCache(APP_URL, response.clone());
          return response;
        }
        // A failed deployment must not overwrite the last working HTML.
        return await caches.match(APP_URL, { cacheName: CACHE_NAME }) || response;
      } catch (_) {
        return await caches.match(APP_URL, { cacheName: CACHE_NAME }) || offlineResponse();
      }
    })());
    return;
  }

  // An already open page may still request its previous versioned asset.
  if(!CODE_ASSETS.includes(url.href)&&CODE_ASSETS.some(asset=>new URL(asset).pathname===url.pathname)){
    event.respondWith((async()=>{
      const names=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX));
      for(const name of names.reverse()){const saved=await caches.match(event.request,{cacheName:name});if(saved)return saved;}
      try{return await fetch(event.request);}catch(_){return offlineResponse();}
    })());return;
  }

  // Cache only this app's files, leaving future server/API calls to the network.
  if (!STATIC_ASSETS.includes(url.href)) return;
  if (CODE_ASSETS.includes(url.href)) {
    event.respondWith((async () => {
      const installed = await caches.match(event.request, { cacheName: CACHE_NAME });
      if (installed) return installed;
      try {
        const response = await fetch(event.request);
        if (response.ok) await putInCache(event.request, response.clone());
        return response;
      } catch (_) { return offlineResponse(); }
    })());
    return;
  }
  const network = (async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && (url.href !== APP_URL || (response.headers.get("Content-Type") || "").includes("text/html"))) {
        await putInCache(event.request, response.clone());
      }
      return response;
    } catch (_) {
      return await caches.match(event.request, { cacheName: CACHE_NAME }) || offlineResponse();
    }
  })();
  event.waitUntil(network.then(() => undefined));
  event.respondWith((async () => await caches.match(event.request, { cacheName: CACHE_NAME }) || await network)());
});

// Receive Web Push messages from the server.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "" }; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
  const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {};
  event.waitUntil(self.registration.showNotification(String(payload.title || "Kostentracker"), {
    body: String(payload.body || "Neue Benachrichtigung"),
    icon: payload.icon || new URL("icon-192.png", APP_SCOPE).href,
    badge: payload.badge || new URL("icon-192.png", APP_SCOPE).href,
    tag: String(payload.tag || "kostentracker-push"),
    data: { ...data, url: notificationTarget(payload.url || data.url) }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = notificationTarget(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (!isAppPageUrl(client.url) || !("focus" in client)) continue;
      try {
        const navigated = client.url === target ? client : await client.navigate(target);
        if (navigated) return await navigated.focus();
      } catch (_) {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

// A page reloads only after a different complete revision controls it.
self.addEventListener('message', event => {
  if(event.data?.type==='APP_VERSION'&&event.ports?.[0])event.ports[0].postMessage({version:WORKER_VERSION});
});
