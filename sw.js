// Service Worker: macht die App offlinefähig.
// - App-Dateien: aus dem Cache (schnell), im Hintergrund aktualisiert
// - Daten (data/, config/): erst Netz, bei Offline aus dem Cache
const VERSION = 'v2';
const APP_CACHE = `gb-app-${VERSION}`;
const DATEN_CACHE = 'gb-daten';

const APP_DATEIEN = [
  './',
  'index.html',
  'styles.css',
  'js/app.js',
  'js/relevanz.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];
const DATEN_DATEIEN = [
  'data/news.json',
  'data/gremien.json',
  'data/termine.json',
  'data/termine-auto.json',
  'data/kontakte.json',
  'config/themen.json',
  'config/vorlagen.json',
  'config/feeds.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await app.addAll(APP_DATEIEN);
    const daten = await caches.open(DATEN_CACHE);
    await Promise.all(DATEN_DATEIEN.map((u) => daten.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('gb-app-') && key !== APP_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // externe Links nicht anfassen

  const istDaten = /\/(data|config)\/[^/]+\.json$/.test(url.pathname);
  if (istDaten) {
    // Netz zuerst, damit neue Meldungen sofort erscheinen
    event.respondWith((async () => {
      const cache = await caches.open(DATEN_CACHE);
      const schluessel = url.origin + url.pathname; // ohne ?-Parameter
      try {
        const antwort = await fetch(req, { cache: 'no-cache' });
        if (antwort.ok) cache.put(schluessel, antwort.clone());
        return antwort;
      } catch {
        const alt = await cache.match(schluessel);
        return alt || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // App-Dateien: Cache zuerst, parallel aktualisieren
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const treffer = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    const netz = fetch(req).then((antwort) => {
      if (antwort.ok) cache.put(req, antwort.clone());
      return antwort;
    }).catch(() => null);
    return treffer || (await netz) || new Response('Offline', { status: 503 });
  })());
});
