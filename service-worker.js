const WORKER_VERSION = "push-test-v3";
const APP_SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `kostentracker-test:${encodeURIComponent(APP_SCOPE.pathname)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${WORKER_VERSION}`;
const APP_URL = new URL("index.html", APP_SCOPE).href;
const STATIC_ASSETS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]
  .map(path => new URL(path, APP_SCOPE).href);

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
    // The app is required; an unavailable icon must not block notification tests.
    await cache.add(APP_URL);
    await Promise.all(STATIC_ASSETS.filter(url => url !== APP_URL).map(url =>
      cache.add(url).catch(() => console.warn("Optionale App-Datei konnte nicht gecacht werden:", url))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
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

  // Cache only this app's files, leaving future server/API calls to the network.
  if (!STATIC_ASSETS.includes(url.href)) return;
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

// Keep the short test alive until it has handed the notification to the system.
self.addEventListener("message", event => {
  if (event.data?.type !== "SCHEDULE_TEST_NOTIFICATION") return;
  const port = event.ports?.[0];
  const reply = message => { try { port?.postMessage(message); } catch (_) {} };
  if (!event.source?.url || !isAppPageUrl(event.source.url)) {
    reply({ ok: false, error: "Der Testauftrag stammt nicht aus dieser App." });
    return;
  }
  event.waitUntil((async () => {
    try {
      const delayMs = Math.min(10000, Math.max(0, Number(event.data.delayMs) || 0));
      reply({ ok: true, status: "scheduled", delayMs, version: WORKER_VERSION });
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await self.registration.showNotification(String(event.data.title || "Kostentracker Test"), {
        body: String(event.data.body || "Kurzer Benachrichtigungstest"),
        icon: new URL("icon-192.png", APP_SCOPE).href,
        badge: new URL("icon-192.png", APP_SCOPE).href,
        tag: String(event.data.tag || "kostentracker-delayed-test"),
        data: { url: APP_URL }
      });
      reply({ ok: true, status: "shown" });
    } catch (error) {
      reply({ ok: false, error: error?.message || String(error) });
    } finally { port?.close(); }
  })());
});

// Entry point for the future server's Web Push messages.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "" }; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
  const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {};
  event.waitUntil(self.registration.showNotification(String(payload.title || "Kostentracker Test"), {
    body: String(payload.body || "Neue Benachrichtigung"),
    icon: payload.icon || new URL("icon-192.png", APP_SCOPE).href,
    badge: payload.badge || new URL("icon-192.png", APP_SCOPE).href,
    tag: String(payload.tag || "kostentracker-test-push"),
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
