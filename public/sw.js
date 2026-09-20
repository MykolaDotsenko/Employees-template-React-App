/* global self, caches, fetch, Response, URL */
const CACHE = "__DAYDOCK_CACHE__";
const PRECACHE = __DAYDOCK_PRECACHE__;
const APP_BASE = new URL("./", self.registration.scope).pathname;

function absolutePrecacheUrls() {
  return PRECACHE.map((path) => new URL(path, self.registration.scope).href);
}

function isSuccessful(response) {
  return response && response.ok;
}

async function cacheResponse(request, response) {
  if (!isSuccessful(response)) return;

  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes are a resilience enhancement. A successful network response
    // should still reach the app even if the browser declines the cache write.
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (isSuccessful(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(new URL("./", self.registration.scope).href, response.clone());
    }

    return response;
  } catch {
    return (
      (await caches.match(new URL("./", self.registration.scope).href)) ??
      Response.error()
    );
  }
}

async function cacheFirstResource(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(absolutePrecacheUrls())),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("daydock-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(APP_BASE)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirstResource(request));
});
