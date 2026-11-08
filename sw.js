/* Nazari Express — service worker.
   L'application s'ouvre vite, même avec un réseau lent ou coupé.
   Les appels à la base de données (autre domaine) ne passent JAMAIS par ce cache.
   BUILD est recalculé automatiquement par tools/build.py : toute modification d'un fichier
   change cette ligne, donc le navigateur installe la nouvelle version tout seul. */
'use strict';

const BUILD = '2da0b59e38';
const CACHE = 'nz-static-' + BUILD;

const CORE = [
  'index.html', 'app.css', 'simple.css', 'manifest.webmanifest',
  'ui.js', 'core.js', 'shared.js', 'voice.js', 'views-a.js', 'simple.js', 'chat.js',
  'driver.js', 'admin.js', 'admin2.js', 'boot.js'
];
const EXTRA = ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

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
