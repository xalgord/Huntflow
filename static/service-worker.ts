/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = 'huntflow-static-v2';
const APP_SHELL = ['/', '/manifest.json', '/favicon.svg', '/icons/huntflow.svg'];

async function offlineFallback(): Promise<Response> {
  const fallback = await caches.match('/');
  return (
    fallback ??
    new Response('HuntFlow is offline and this page is not cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  );
}

function isDocumentRequest(request: Request): boolean {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html') === true;
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      if (isDocumentRequest(request)) {
        try {
          const response = await fetch(request);
          if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await caches.match(request)) ?? offlineFallback();
        }
      }

      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
