// 手で描く・空中ギター・紙のピアノ：電波のない所でも動くように、ページと「手を読み取る部品」を端末に保存する
// 部品（十数MB）は外のサーバーにあるので、一度ネットのある所で「はじめる」を押したときに保存される
const VERSION = "te-de-egaku-v1";
const PARTS = "te-de-egaku-parts-0.10.14";   // 手を読み取る部品（MediaPipe 0.10.14 とモデル）。版が変わるまで使い回す
const FONTS = "te-de-egaku-fonts";
const CORE = ["./", "./index.html", "./guitar/", "./guitar/index.html", "./paper/", "./paper/index.html", "./paper/print.html"];
const isPart = u => (u.host === "cdn.jsdelivr.net" && u.pathname.includes("/@mediapipe/tasks-vision@"))
  || (u.host === "storage.googleapis.com" && u.pathname.startsWith("/mediapipe-models/"));

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // 同じ yannsi.github.io にある他の作品の保存は消さない（自分の古い版だけ消す）
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("te-de-egaku-") && ![VERSION, PARTS, FONTS].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 保存したものを先に使い、なければネットから取って保存する
async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone()).catch(() => {});   // 端末の空きが足りなくて保存できなくても、そのまま動かす
  return r;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isPart(url)) { e.respondWith(cacheFirst(PARTS, req)); return; }
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") { e.respondWith(cacheFirst(FONTS, req)); return; }
  if (url.origin !== location.origin) return;
  // ページ：ネットがあれば最新を取る。3秒待っても来なければ（圏外なら）保存したものを出す
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const r = await Promise.race([
        fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })),
        new Promise((_, ng) => setTimeout(() => ng(new Error("timeout")), 3000)),
      ]);
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    } catch (_) {
      return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
