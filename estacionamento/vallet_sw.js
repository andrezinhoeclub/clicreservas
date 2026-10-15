// ===== O QUE SEGURA O VALLET SEM INTERNET (Vallet 2.0 / Supabase) =====
// Mora na mesma pasta da tela de propósito: este tipo de arquivo só cuida
// da pasta em que ele está (/estacionamento/). Na raiz, ele cuidaria
// do site inteiro e acabaria guardando portaria e listas no Vallet.
//
// O nome do cache precisa bater com VALLET_BUILD_VERSION da tela
// ("eclub-vallet2-v" + versão): a tela apaga caches de versões antigas.
const CACHE_NAME = 'eclub-vallet2-v2.0-1';

// A biblioteca do Supabase (login e conexão) vem de fora do site. Ela
// também fica guardada: sem isso, abrir a tela sem internet nem carregava
// o login (era o ponto fraco do Vallet antigo com o Firebase).
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

const APP_SHELL = [
  './',
  './vallet_manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL)
        .then(() => cache.add(new Request(SUPABASE_JS, { mode: 'cors' })).catch(() => {}))
        // Visual comum das telas (fica na raiz do site). Opcional: se faltar,
        // a tela funciona do mesmo jeito, só com a letra padrão.
        .then(() => Promise.all(['../eclub-ui.css', '../eclub-ui.js'].map((u) => cache.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Só mexe nos caches do próprio Vallet 2.0 — nunca nos de outras telas.
      .then((keys) => Promise.all(keys.map((key) => (key.startsWith('eclub-vallet2-') && key !== CACHE_NAME) ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

function podeGuardar(url) {
  return url.startsWith(self.location.origin) || url.startsWith(SUPABASE_JS);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHtml = req.mode === 'navigate' || req.destination === 'document';

  if (isHtml) {
    // Primeiro a internet, e só depois a cópia guardada: assim uma versão nova
    // da tela chega no mesmo instante em que é publicada.
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Chamadas ao servidor do Supabase (login, vallet-api) nunca são guardadas.
  if (!podeGuardar(req.url)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      return fetch(req)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
