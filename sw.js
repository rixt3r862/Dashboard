const VERSION = "dashboard-v145";
const CORE_CACHE = `${VERSION}-core`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const REMOTE_CACHE = `${VERSION}-remote`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./dashboard.generated.css",
  "./app.webmanifest",
  "./offline.html",
  "./shared/pwa.js",
  "./shared/app-catalog.js",
  "./shared/category-launcher.js",
  "./shared/category-launcher.css",
  "./shared/utility-shell.js",
  "./shared/cashbox.js",
  "./shared/notepad-storage.js",
  "./shared/notepad-notes.js",
  "./shared/timer-state.js",
  "./shared/timer.js",
  "./shared/clock-extras.js",
  "./shared/cashbox-history.js",
  "./shared/utility-shell.css",
  "./img/dashboard-icon.svg",
  "./MoneyCounter.html",
  "./clock.html",
  "./Time%20Converter.html",
  "./Timer.html",
  "./Time%20Unit%20Converter.html",
  "./Unit%20Converter.html",
  "./URL%20Tool.html",
  "./Notepad.html",
  "./QR%20Tool.html",
  "./Date%20Math%20Tool.html",
  "./Games/index.html",
  "./SkipBo/index.html",
  "./SkipBo/skipbo.css",
  "./SkipBo/skipbo.js",
  "./SkipBo/discard-dialog.mjs",
  "./SkipBo/engine.mjs",
  "./SkipBo/motion.mjs",
  "./SkipBo/icon.svg",
  "./SkipBo/cards/0.svg",
  "./SkipBo/cards/1.svg",
  "./SkipBo/cards/2.svg",
  "./SkipBo/cards/3.svg",
  "./SkipBo/cards/4.svg",
  "./SkipBo/cards/5.svg",
  "./SkipBo/cards/6.svg",
  "./SkipBo/cards/7.svg",
  "./SkipBo/cards/8.svg",
  "./SkipBo/cards/9.svg",
  "./SkipBo/cards/10.svg",
  "./SkipBo/cards/11.svg",
  "./SkipBo/cards/12.svg",
  "./SkipBo/cards/back.svg",
  "./shared/game-room.css",
  "./shared/game-room.js",
  "./TimeTools/index.html",
  "./Phase10/index.html",
  "./Phase10/phase10.css",
  "./Phase10/phase10.js",
  "./SkyJo/index.html",
  "./SkyJo/skyjo.css",
  "./SkyJo/skyjo.js",
  "./Hearts/index.html",
  "./Hearts/hearts.css",
  "./Hearts/hearts.js",
  "./Spades/index.html",
  "./Spades/spades.css",
  "./Spades/spades.js",
  "./Crazy8s/index.html",
  "./Crazy8s/crazy8s.css",
  "./Crazy8s/crazy8s.js",
  "./FiveCrowns/index.html",
  "./FiveCrowns/fivecrowns.css",
  "./FiveCrowns/fivecrowns.js",
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
  "./ScoreKeeper/img/5%20Crowns.png",
  "./ScoreKeeper/img/Hearts.png",
  "./ScoreKeeper/img/Phase%2010.png",
  "./ScoreKeeper/img/Rummikub.jpg",
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
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "APPLY_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
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
