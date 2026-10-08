// Service worker: makes the game installable as an app. Network first, so updates always come
// straight from the site (the in-game updater keeps working); the last copy of each file is kept
// for when the network is down (practice still works offline). Other sites (fonts, three.js,
// relays) are left alone.
const CACHE = 'gg3d-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && !new URL(req.url).pathname.endsWith('version.json')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req.url.split('?')[0], copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req.url.split('?')[0]);
      if (hit) return hit;
      throw err;
    }
  })());
});
