// PMMP3 service worker: keeps the app shell (page, config, icons) so it opens instantly and offline.
// It only ever handles same-origin GET requests. Microsoft sign-in, Graph, OneDrive downloads and audio are
// all cross-origin and pass straight through untouched.
const CACHE = 'pmmp3-shell-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so a new version of the page is picked up straight away), cache as the offline fallback.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200 && res.type === 'basic'){
        const key = req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;   // ignore the ?code=… sign-in parameters
        caches.open(CACHE).then(c => c.put(key, res.clone())).catch(() => {});
      }
      return res;
    } catch(err){
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate'){
        const shell = (await caches.match('index.html')) || (await caches.match('./'));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
