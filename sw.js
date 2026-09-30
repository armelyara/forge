/* Forge — service worker (PWA hors-ligne)
   App shell précaché, cache-first pour le même origine, stale-while-revalidate
   pour les polices Google. Bumper CACHE à chaque déploiement pour rafraîchir. */
const CACHE = 'forge-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/solvers.js',
  './js/forge3d.js',
  './js/main.js',
  './vendor/three.min.js',
  './vendor/OrbitControls.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigations : renvoyer l'app (fonctionne hors-ligne / URL profondes)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Polices Google : stale-while-revalidate
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(req);
        const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Même origine : cache-first, repli réseau (et on met en cache au passage)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r && r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(req, cl)); }
        return r;
      }).catch(() => hit))
    );
  }
});
