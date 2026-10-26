const BUNDLE_BUILD = "da75c65e901d";
const CACHE = "avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention-sf-ui-flight-scan-weather-view-scan-shortcuts" + (BUNDLE_BUILD === "source-unbuilt" ? "" : "-sdk-" + BUNDLE_BUILD);
const SHELL = [
  "/workspace/flight-conflict.js",
  "/workspace/capabilities.js",
  "/",
  "/index.html",
  "/app.js",
  "/style.css",
  "/navy-teal.css",
  "/ui/system.css",
  "/ui/tokens.css",
  "/ui/weather-attention.css",
  "/ui/weather-report-highlights.js",
  "/ui/flight-scan-shortcuts.css",
  "/ui/flight-scan-shortcuts.js",
  "/workspace/weather-attention.js",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  "/lib/domain.js",
  "/lib/flight-times.js",
  "/lib/flight-audit.js",
  "/lib/flight-assist.js",
  "/lib/flight-v14-ui.js",
  "/lib/utc-input.js",
  "/lib/flight-editor.js",
  "/lib/appearance.js",
  "/lib/crew-entry.js",
  "/examples/e190-oooi.png",
  "/lib/parsers.js",
  "/lib/a320-scan.js",
  "/lib/scan-screen.js",
  "/lib/rules.js",
  "/lib/sample.js",
  "/lib/storage.js",
  "/lib/importers.js",
  "/atpl/",
  "/atpl/index.html",
  "/atpl/catalog.json",
  "/atpl/offline.js",
  "/atpl/catalog-ui.js",
  "/atpl/bank-bridge.js",
  "/atpl/atpl.css",
  "/atpl/avilog-theme.css",
  "/atpl/account-bootstrap.js",
  "/atpl/account.js",
  "/account/coordinator.js",
  "/account/client.js",
  "/workspace/schema.js",
  "/workspace/model.js",
  "/workspace/projection.js",
  "/workspace/repository.js",
  "/workspace/controller.js",
  "/workspace/evidence.js",
  "/workspace/transfers.js",
  "/workspace/migration.js",
  "/workspace/backup.js",
  "/workspace/pull.js",
  "/workspace/session.js",
  "/workspace/ui.js",
  "/workspace/backup-ui.js",
  "/workspace/weather.js",
  "/workspace/weather-report.js",
  "/workspace/weather-watch.js",
  "/workspace/weather-watch-ui.js",
  "/workspace/weather-groups.js",

  "/atpl/account-ui.js",
  "/atpl/sync/model.js",
  "/atpl/sync/common.js",
  "/atpl/sync/store.js",
  "/atpl/sync/import.js",
  "/atpl/sync/controller.js",
  "/atpl/vendor/firebase-client.js",
  "/atpl/identities.json",
  "/atpl/privacy.html",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async(c) => {
        await c.addAll(SHELL);
        // Public config is optional; provider setup/failure cannot poison shell install.
        try{const r=await fetch('/atpl/firebase-config.json',{cache:'no-store',signal:AbortSignal.timeout(3000)});if(r.ok)await c.put('/atpl/firebase-config.json',r);}catch{}
      })
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("avilog-shell-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    e.request.headers?.has?.("Authorization") ||
    new URL(e.request.url).origin !== self.location.origin ||
    new URL(e.request.url).pathname.startsWith("/api/") ||
    new URL(e.request.url).pathname.startsWith("/__/auth/")
  )
    return;
  const requestURL=new URL(e.request.url);
  if(requestURL.search)return;
  const pathname = requestURL.pathname;
  // Cache public OCR runtime assets after their first successful online use.
  // Model data itself is retained by Tesseract's IndexedDB cache.
  if(/^\/vendor\/(tesseract|tesseract-core)\/[a-zA-Z0-9._-]+\.(js|wasm)$/.test(pathname)){
    e.respondWith((async()=>{const cache=await caches.open('avilog-ocr-v1'),saved=await cache.match(e.request);if(saved)return saved;const response=await fetch(e.request);if(response.ok)e.waitUntil(cache.put(e.request,response.clone()).catch(()=>{}));return response;})());return;
  }
  if(!SHELL.includes(pathname)&&pathname!=="/atpl/firebase-config.json"&&!/^\/atpl\/(media|banks)\//.test(pathname))return;
  if (/^\/atpl\/(media|banks)\//.test(pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open("avilog-atpl-v1");
      if (e.request.cache !== "reload") {
        const saved = await cache.match(e.request);
        if (saved) return saved;
      }
      try {
        const response = await fetch(e.request);
        if (response.ok && e.request.cache !== "reload") {
          const put = cache.put(e.request, response.clone()).catch(() => {});
          e.waitUntil(put);
        }
        return response;
      } catch {
        // Reload still needs downloaded immutable assets when the network is unavailable.
        const saved = await cache.match(e.request);
        if (saved) return saved;
        return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chưa tải môn này</title><h1>Môn này chưa tải đầy đủ để học offline</h1><p>Kết nối mạng rồi bấm Tải offline. Tiến độ đã lưu vẫn được giữ.</p><a href="/atpl/">← Danh sách môn</a></html>', {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    // A shell version is installed as one module graph. Prefer those exact
    // installed bytes; provider/gateway failures cannot replace individual modules.
    if(SHELL.includes(pathname)){const cached=await(await caches.open(CACHE)).match(e.request);if(cached)return cached;}
    return fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(()=>{}));
        }
        return r;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then(
            (r) =>
              r ||
              (e.request.mode === "navigate"
                ? caches.match("/")
                : new Response("Offline asset unavailable", { status: 503 })),
          ),
      );
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window" })
      .then((cs) => (cs.length ? cs[0].focus() : clients.openWindow("/"))),
  );
});
// Readiness is a controller property, not just the presence of a cache bucket.
self.addEventListener('message',event=>{if(event.data?.type==='avilog-shell-version')event.ports?.[0]?.postMessage({version:CACHE});});
