/* Nazari Express — service worker.
   L'application s'ouvre vite, même avec un réseau lent ou coupé.
   Les appels à la base de données (autre domaine) ne passent JAMAIS par ce cache.
   BUILD est recalculé automatiquement par tools/build.py : toute modification d'un fichier
   change cette ligne, donc le navigateur installe la nouvelle version tout seul. */
'use strict';

const BUILD = 'bc03474509';
const CACHE = 'nz-static-' + BUILD;

const CORE = [
  'index.html', 'app.css', 'simple.css', 'manifest.webmanifest',
  'ui.js', 'core.js', 'shared.js', 'kit.js', 'views-a.js', 'simple.js', 'chat.js',
  'driver.js', 'admin.js', 'admin2.js', 'push.js', 'map.js', 'track.js', 'places.js', 'boot.js'
];
const EXTRA = ['logo-nazari.webp', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'badge-96.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // fichiers indispensables : si l'un manque, l'installation échoue (l'ancienne version reste en place)
    await Promise.all(CORE.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (!res.ok) throw new Error(u + ' : ' + res.status);
      await cache.put(u, res);
    }));
    // icônes : au mieux
    await Promise.all(EXTRA.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (res.ok) await cache.put(u, res);
      } catch (e) { /* ignore */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('nz-static-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ---------- alertes sur le téléphone (Web Push) : l'application peut être fermée ---------- */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {
    try { d = { body: event.data.text() }; } catch (e2) { d = {}; }
  }
  const title = String(d.title || 'Nazari Express').slice(0, 80);
  const tag = typeof d.tag === 'string' && d.tag ? d.tag.slice(0, 60) : undefined;
  event.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || '').slice(0, 240),
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    lang: 'fr',
    tag,
    renotify: !!tag,
    data: { url: typeof d.url === 'string' ? d.url : '#/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '#/';
  const hash = /^#\/[\w\-./]*$/.test(raw) ? raw : '#/';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = list.find((c) => c.url.startsWith(self.registration.scope));
    if (mine) {
      try { await mine.focus(); } catch (e) { /* ignore */ }
      mine.postMessage({ type: 'nz-open', url: hash });
      return;
    }
    await self.clients.openWindow(self.registration.scope + hash);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // base de données, WhatsApp… : jamais interceptés

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('index.html')) || fetch(req);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
