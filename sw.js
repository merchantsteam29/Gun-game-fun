// Gun Game 3D moved to /trigger-happy/. This replaces the old offline helper and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()));
