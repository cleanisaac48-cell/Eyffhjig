
// ⚡ Cache name (bump this if you want to force refresh again later)
const CACHE_NAME = "takeyours-cache-v1";

// ✅ Files to cache for offline use (not HTML)
const STATIC_ASSETS = [
  "/styles.css",
  "/images/favicon.png",
  "/hero-illustration.svg",
  "/video1.mp4",
  "/video2.mp4",
  "/video3.mp4",
  "/takeyours.apk"
];

// 🧹 Install: clear *all* old caches and re-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => caches.delete(name)))
    ).then(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      });
    })
  );
});

// 🌍 Fetch: 
// - Always fetch fresh HTML from network
// - Cache-first for static assets
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    // Always fetch latest HTML
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html") // optional fallback if offline
      )
    );
  } else {
    // Cache-first for assets
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// 🔄 Activate: claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
