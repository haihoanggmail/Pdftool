// Service worker: lưu bộ nhớ đệm để dùng PDF Tool khi không có mạng.
// Thư viện từ CDN (jsDelivr, cdnjs, unpkg) được lưu lại ở lần tải đầu tiên (cache-first).
// Các file cùng thư mục (index.html, ...) ưu tiên bản mới từ mạng, mất mạng thì dùng bản đã lưu.
const CACHE = 'hachihi-pdf-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'tessdata.projectnaptha.com'];
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        for (const k of await caches.keys()) if (k !== CACHE && k.indexOf('hachihi-pdf-') === 0) await caches.delete(k);
        await self.clients.claim();
    })());
});

async function cdnFetch(req) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req.url);
    if (hit) return hit;
    // Tải lại bằng chế độ cors để lưu được phản hồi đầy đủ (không bị "opaque")
    const res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }));
    if (res && res.ok && res.status === 200) { try { await cache.put(req.url, res.clone()); } catch (e) {} }
    return res;
}
async function sameOriginFetch(req) {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
        return res;
    } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') { const idx = await cache.match('./index.html'); if (idx) return idx; }
        throw err;
    }
}
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || req.headers.has('range')) return;
    const url = new URL(req.url);
    if (CDN_HOSTS.indexOf(url.hostname) >= 0) e.respondWith(cdnFetch(req));
    else if (url.origin === self.location.origin) e.respondWith(sameOriginFetch(req));
});
