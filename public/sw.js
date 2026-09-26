/* LifeOS service worker — installable app + offline read-only mode.
   - app shell & hashed bundles: cache-first
   - pages: network-first, fall back to the cached shell (the app routes by ?page=…)
   - GET /api/*: network-first, fall back to the last good response (so data is readable offline)
   Nothing is ever written offline; mutations fail with a clear message. */
const VERSION = 'lifeos-v39';
const SHELL = VERSION + '-shell', DATA = VERSION + '-data';
const PRECACHE = ['/', '/manifest.webmanifest', '/assets/img/icon-192.png', '/assets/img/icon-512.png', '/assets/img/logo-mask.png', '/assets/fonts/vazirmatn-arabic.woff2', '/assets/fonts/vazirmatn-latin.woff2'];
const NO_CACHE_API = /^\/api\/(auth|telegram|backup|export|google|spotify|youtube|ai\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { credentials: 'same-origin' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const okToCache = r => r && r.ok && !r.redirected && r.type === 'basic';
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    if (NO_CACHE_API.test(url.pathname)) return;
    e.respondWith(fetch(req).then(r => { if (okToCache(r)) { const c = r.clone(); caches.open(DATA).then(x => x.put(req, c)); } return r; }).catch(() =>
      caches.match(req).then(m => m || new Response(JSON.stringify({ error: 'آفلاین هستی و این داده هنوز ذخیره نشده.', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }))));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (okToCache(r) && (r.headers.get('content-type') || '').includes('text/html') && !url.pathname.startsWith('/design/')) { const c = r.clone(); caches.open(SHELL).then(x => x.put('/', c)); } return r; })
      .catch(() => caches.match('/').then(m => m || caches.match(req))));
    return;
  }
  if (/^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(url.pathname) || url.pathname.startsWith('/assets/fonts/') || url.pathname.startsWith('/assets/img/')) {
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => { if (okToCache(r)) { const c = r.clone(); caches.open(SHELL).then(x => x.put(req, c)); } return r; })));
    return;
  }
  e.respondWith(caches.match(req).then(m => { const net = fetch(req).then(r => { if (okToCache(r)) { const c = r.clone(); caches.open(SHELL).then(x => x.put(req, c)); } return r; }).catch(() => m); return m || net; }));
});

// ── Web Push: the server sends an empty push; we fetch what to show (keeps payloads out of push services) ──
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try { const r = await fetch('/api/push/pending', { credentials: 'include', cache: 'no-store' }); if (r.ok) items = (await r.json()).items || []; } catch {}
    if (!items.length) items = [{ id: 'x' + Date.now(), title: 'LifeOS', body: 'یادآوری تازه داری.', url: '/' }];
    await Promise.all(items.map(n => self.registration.showNotification(n.title || 'LifeOS', {
      body: n.body || '', tag: n.rid || n.id, renotify: true, dir: 'rtl', lang: 'fa',
      icon: '/assets/img/icon-192.png', badge: '/assets/img/favicon-32.png',
      data: { url: n.url || '/', rid: n.rid || null },
      actions: n.rid ? [{ action: 'done', title: '✓ انجام شد' }, { action: 'snooze', title: '⏰ ۱۵ دقیقه بعد' }] : []
    })));
  })());
});
self.addEventListener('notificationclick', e => {
  const d = e.notification.data || {};
  e.notification.close();
  if (d.rid && (e.action === 'done' || e.action === 'snooze')) {
    e.waitUntil(fetch(`/api/reminders/${d.rid}/act`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ act: e.action }) }).catch(() => {}));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => new URL(x.url).origin === location.origin); if (c) { c.focus(); return c.navigate(d.url || '/').catch(() => {}); } return self.clients.openWindow(d.url || '/'); }));
});
