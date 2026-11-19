/* Clic Reservas — service worker do app da casa (permite instalar; não guarda dados pessoais) */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#0A0A0A;color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px"><h2>Sem internet</h2><p>Conecte-se para ver seus ingressos.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
