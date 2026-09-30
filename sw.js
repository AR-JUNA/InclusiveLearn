const CACHE = 'inclusivelearn-v46';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './icons.js', './manifest.json', './icon.svg', './learning-classroom-hero.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('inclusivelearn-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); cache.put(event.request, copy); return response;
  }).catch(() => cache.match('./index.html')))));
});




