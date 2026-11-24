// paroxysm loader worker: verifies m.json files, serves them and runs controller.sw.js + sw-glue.js virtually
const ORIGIN = location.origin;
const BASE = new URL(self.registration.scope).pathname;
const DEV = new URLSearchParams(location.search).has("dev") && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
// cdn.jsdelivr.net shared by every repo so caches are namespaced by scope
const NS = "paroxysm-ld:" + BASE + ":";
const STATE = NS + "state";
const DEFAULT_SW = ["controller/controller.sw.js", "sw-glue.js"];
const TYPES = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json",
    map: "application/json",
    wasm: "application/wasm",
    svg: "image/svg+xml",
    png: "image/png",
    ico: "image/x-icon",
    woff2: "font/woff2",
    txt: "text/plain; charset=utf-8"
};

let manifest = null;
let app = null;
let lastCheck = 0;
const inflight = new Map();

const urlOf = path => ORIGIN + BASE + path.split("/").map(encodeURIComponent).join("/");
const typeOf = path => TYPES[path.split(".").pop().toLowerCase()] || "application/octet-stream";
const cacheOf = m => NS + m.seq;
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const log = (...a) => console.info("[paroxysm] loader:", ...a);

async function readState(key) {
    const r = await (await caches.open(STATE)).match(ORIGIN + BASE + "__" + key);
    return r ? r.json() : null;
}

async function writeState(key, value) {
    const c = await caches.open(STATE);
    if (value == null) await c.delete(ORIGIN + BASE + "__" + key);
    else await c.put(ORIGIN + BASE + "__" + key, new Response(JSON.stringify(value)));
}

async function fetchManifest() {
    const r = await fetch(urlOf("m.json"), { cache: "no-store" });
    if (!r.ok) throw new Error("m.json: HTTP " + r.status);
    const m = await r.json();
    if (m.v !== 1 || !m.files || !m.seq) throw new Error("m.json: unknown format");
    return m;
}

async function download(m, path, cache) {
    const entry = m.files[path];
    const r = await fetch(urlOf(path), { cache: "no-store" });
    if (!r.ok) throw new Error(path + ": HTTP " + r.status);
    const data = await r.arrayBuffer();
    if (b64(await crypto.subtle.digest("SHA-256", data)) !== entry[0]) throw new Error(path + " failed its sha-256 check");
    await cache.put(urlOf(path), new Response(data, { headers: { "content-type": typeOf(path) } }));
}

async function file(m, path) {
    if (!m.files[path]) throw new Error(path + " is not in m.json");
    const cache = await caches.open(cacheOf(m));
    const hit = await cache.match(urlOf(path));
    if (hit) return hit;
    const key = cacheOf(m) + path;
    if (!inflight.has(key)) inflight.set(key, download(m, path, cache).finally(() => inflight.delete(key)));
    await inflight.get(key);
    return cache.match(urlOf(path));
}

async function each(list, n, fn) {
    const queue = [...list];
    await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

function warm() {
    if (manifest) each(manifest.warm || [], 2, p => file(manifest, p).catch(err => console.warn("[paroxysm] loader:", err.message)));
}

// verified build in next becomes current on next shell load
async function promote() {
    const next = await readState("next");
    if (!next || next.seq === manifest?.seq) return;
    const old = manifest;
    manifest = next;
    await writeState("current", next);
    await writeState("next", null);
    if (old) await caches.delete(cacheOf(old));
    log("now on build", next.seq);
    warm();
}

async function refresh() {
    if (Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    try {
        const m = await fetchManifest();
        const next = await readState("next");
        if (m.seq === manifest?.seq || m.seq === next?.seq) return;
        await each(m.boot, 4, p => file(m, p));
        if (next) await caches.delete(cacheOf(next));
        await writeState("next", m);
        log("build", m.seq, "downloaded; reload paroxysm to use it");
    } catch (err) {
        console.warn("[paroxysm] loader: update check failed:", err.message);
    }
}

function capture(sources) {
    const handlers = {};
    self.addEventListener = (type, fn) => { (handlers[type] ||= []).push(fn); };
    try { new Function(sources.join("\n;\n")).call(self); }
    finally { delete self.addEventListener; }
    return handlers;
}

function dispatch(handlers, type, event) {
    for (const fn of handlers[type] || []) {
        try { typeof fn === "function" ? fn.call(self, event) : fn.handleEvent(event); }
        catch (err) { console.error("[paroxysm] loader: " + type + " handler threw:", err); }
    }
}

// app worker evaluated once per worker start on first event needing it
function appReady() {
    return app ??= (async () => {
        if (DEV) {
            log("dev mode: files come straight from the server without checks");
            return capture(await Promise.all(DEFAULT_SW.map(async p => (await fetch(urlOf(p), { cache: "no-store" })).text())));
        }
        manifest ??= (await readState("current")) ?? (await readState("next"));
        if (!manifest) throw new Error("no build installed");
        return capture(await Promise.all((manifest.sw || DEFAULT_SW).map(async p => (await file(manifest, p)).text())));
    })().catch(err => { app = null; throw err; });
}

const failure = (status, text) => new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

async function respond(e, url) {
    let handlers;
    try { handlers = await appReady(); }
    catch (err) { return failure(503, "paroxysm's loader could not start: " + err.message); }
    let answer = null;
    dispatch(handlers, "fetch", {
        type: "fetch",
        request: e.request,
        clientId: e.clientId,
        resultingClientId: e.resultingClientId,
        preloadResponse: e.preloadResponse,
        respondWith: r => { answer ??= r; },
        waitUntil: p => { try { e.waitUntil(p); } catch {} }
    });
    if (answer) return answer;
    if (DEV) return fetch(e.request);
    const path = decodeURIComponent(url.pathname.slice(BASE.length)) || "index.html";
    if (e.request.method !== "GET" || !manifest.files[path]) return fetch(e.request);
    if (e.request.mode === "navigate" && path === "index.html") {
        await promote();
        e.waitUntil(refresh());
    }
    try { return await file(manifest, path); }
    catch (err) {
        console.error("[paroxysm] loader:", err);
        return failure(502, "paroxysm could not load " + path + ": " + err.message);
    }
}

self.addEventListener("install", e => e.waitUntil((async () => {
    if (!DEV) {
        const m = await fetchManifest();
        await each(m.boot, 4, p => file(m, p));
        await writeState("next", m);
        log("installed build", m.seq, "(" + m.boot.length + " files checked)");
    }
    await self.skipWaiting();
})()));

self.addEventListener("activate", e => e.waitUntil((async () => {
    if (!DEV) {
        manifest = await readState("current");
        await promote();
        const keep = new Set([STATE, cacheOf(manifest), ...[await readState("next")].filter(Boolean).map(cacheOf)]);
        for (const name of await caches.keys()) if (name.startsWith(NS) && !keep.has(name)) await caches.delete(name);
        warm();
    }
    await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
    const url = new URL(e.request.url);
    if (url.origin !== ORIGIN || !url.pathname.startsWith(BASE)) return;
    e.respondWith(respond(e, url));
});

self.addEventListener("message", e => {
    if (e.data?.ld === "status") {
        e.waitUntil(appReady().catch(() => {}).then(() => e.source?.postMessage({ ld: "status", dev: DEV, seq: manifest?.seq ?? null, ref: manifest?.ref ?? null })));
        return;
    }
    e.waitUntil(appReady().then(h => dispatch(h, "message", e)));
});

for (const type of ["push", "notificationclick"]) {
    self.addEventListener(type, e => e.waitUntil(appReady().then(h => dispatch(h, type, e))));
}
