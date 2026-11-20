const prefix = '420pay-shell-';
const cacheName = prefix + '__PAY_SHELL_REVISION__';
const files = ['index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icons/pay-192.png', 'icons/pay-512.png', 'icons/pay-brand.webp', 'icons/pay-favicon.png'];
const scope = new URL(self.registration.scope);
const shell = new URL('index.html', scope).href;
const allowlist = new Set(files.map(file => new URL(file, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(files.map(file => new Request(new URL(file, scope), { cache: 'reload', credentials: 'omit' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || request.headers.has('authorization') ||
      request.cache === 'no-store') return;
  const navigation = request.mode === 'navigate' && (url.pathname === scope.pathname || url.href === shell);
  if (!navigation && !allowlist.has(url.href)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cached = await caches.match(navigation ? shell : request, { cacheName });
    return cached ?? Response.error();
  }));
});
