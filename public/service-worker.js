/* global self, caches, Request, URL, fetch, Response */

const CACHE_PREFIX = "daydock-runtime-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const MAX_CACHE_ENTRIES = 80;
const SCOPE_URL = new URL("./", self.registration.scope).href;
const SCOPE_PATH = new URL(SCOPE_URL).pathname;

async function trimCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_CACHE_ENTRIES;

  if (overflow <= 0) return;

  await Promise.all(
    keys.slice(0, overflow).map((request) => cache.delete(request)),
  );
}

async function cacheResponse(request, response) {
  if (!response.ok || response.type === "opaque") return;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  await trimCache(cache);
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SCOPE_URL, response.clone());
    }

    return response;
  } catch {
    const cachedShell = await caches.match(SCOPE_URL);

    return (
      cachedShell ??
      new Response(
        "<!doctype html><title>DayDock offline</title><p>DayDock is offline and the app shell is not cached yet.</p>",
        {
          status: 503,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      )
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await cacheResponse(request, response);
  return response;
}

function isCacheableStaticAsset(url) {
  if (!url.pathname.startsWith(SCOPE_PATH)) return false;

  const relativePath = url.pathname.slice(SCOPE_PATH.length);

  return (
    relativePath.startsWith("assets/") ||
    relativePath.startsWith("icons/") ||
    relativePath === "manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.add(
          new Request(SCOPE_URL, {
            cache: "reload",
          }),
        );
      } catch {
        // A transient install fetch must not brick the service worker.
        // The shell can still be cached by the first successful navigation.
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(SCOPE_PATH)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
