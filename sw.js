const VERSION = "dashboard-v4";
const CORE_CACHE = `${VERSION}-core`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const REMOTE_CACHE = `${VERSION}-remote`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.webmanifest",
  "./offline.html",
  "./shared/pwa.js",
  "./img/dashboard-icon.svg",
  "./MoneyCounter.html",
  "./clock.html",
  "./Time%20Converter.html",
  "./Timer.html",
  "./Unit%20Converter.html",
  "./Notepad.html",
  "./QR%20Tool.html",
  "./Date%20Math%20Tool.html",
  "./Games/index.html",
  "./TimeTools/index.html",
  "./Phase10/index.html",
  "./Phase10/phase10.css",
  "./Phase10/phase10.js",
  "./ScoreKeeper/index.html",
  "./ScoreKeeper/SK.css",
  "./ScoreKeeper/SK.js",
  "./ScoreKeeper/js/config.js",
  "./ScoreKeeper/js/history.js",
  "./ScoreKeeper/js/inputUx.js",
  "./ScoreKeeper/js/roundEntry.js",
  "./ScoreKeeper/js/rules.mjs",
  "./ScoreKeeper/js/scoreboard.js",
  "./ScoreKeeper/img/Crazy8s.png",
  "./ScoreKeeper/img/Hearts.png",
  "./ScoreKeeper/img/Phase%2010.png",
  "./ScoreKeeper/img/SK.png",
  "./ScoreKeeper/img/SkyJo.png",
  "./ScoreKeeper/img/Spades.png",
  "./ScoreKeeper/img/Uno.png",
  "./ScoreKeeper/img/scorekeeper-favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("dashboard-v") &&
              ![CORE_CACHE, RUNTIME_CACHE, REMOTE_CACHE].includes(key),
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol)) return;

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, CORE_CACHE, "./offline.html"));
      return;
    }
    if (isAppShellAsset(url)) {
      event.respondWith(networkFirst(request, RUNTIME_CACHE));
      return;
    }
    event.respondWith(cacheFirst(request, CORE_CACHE, RUNTIME_CACHE));
    return;
  }

  if (isRuntimeRemote(url)) {
    event.respondWith(staleWhileRevalidate(request, REMOTE_CACHE));
  }
});

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = await caches.match(fallbackUrl, { ignoreSearch: true });
    if (fallback) return fallback;
    throw new Error("Offline");
  }
}

function isAppShellAsset(url) {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith(".html") ||
    path.endsWith(".js") ||
    path.endsWith(".mjs") ||
    path.endsWith(".css") ||
    path.endsWith(".webmanifest")
  );
}

async function cacheFirst(request, primaryCache, secondaryCache) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(secondaryCache || primaryCache);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const fetchPromise = fetch(request)
    .then(async (response) => {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

function isRuntimeRemote(url) {
  return [
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ].includes(url.hostname);
}
