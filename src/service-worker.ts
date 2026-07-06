/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

type InjectedManifestEntry = {
  url: string;
  revision: string | null;
};

type HuntFlowServiceWorker = ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: InjectedManifestEntry[];
};

const sw = self as unknown as HuntFlowServiceWorker;
const CACHE = 'huntflow-command-center-v4';
const INJECTED_ASSETS = ((self as unknown as HuntFlowServiceWorker).__WB_MANIFEST || []).map(
  (asset) => asset.url
);
const ASSETS = Array.from(new Set(['/', '/manifest.json', ...INJECTED_ASSETS]));

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

/**
 * Files that change shape between releases without their URL changing —
 * the PWA manifest is the canonical example. We deliberately use a
 * network-first strategy for them so a freshly-deployed app picks up
 * theme color, icon, or shortcut changes on the next reload instead of
 * being pinned to whatever shipped with the very first install.
 */
function isMutableStaticAsset(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest';
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineFallback();
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
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

  if (isDocumentRequest(request) || isMutableStaticAsset(request)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
