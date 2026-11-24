# paroxysm — research and architecture proposal

*Original status (2026-11-10): research only, no project files changed, awaiting approval. Revised 2026-11-13: the user's approvals are recorded in `PROJECT_STATUS.md`, and sections marked **[revised]** below were updated where later work verified or contradicted the original. Everything else is the original research, kept as a permanent reference. Revised again 2026-11-19 (marked **[revised 2026-11-19]**) for UI rounds 4 to 6 and the Games page; extension support (Sapphire) was tried and removed, see section 15. Revised 2026-11-22 (marked **[revised 2026-11-22]**): the engine update, the recovery findings, the AI page and Puter; see sections 12 and 16. Revised 2026-11-23 (marked **[revised 2026-11-23]**): the UI redesign (M2) and the baseline re-run (M3) are closed; the roadmap in section 13 now starts at M4. Revised again 2026-11-23 after M4 to M9 were built (marked **[verified 2026-11-23]** or **[revised 2026-11-23]**); the next task is B10 (section 12 item 16).*

**How to read this.** `[confirmed]` means it was read in source or measured in the provided files. `[inferred]` means deduced from code structure. `[unverified]` means it must be tested in a real browser. `[verified 2026-11-13]` marks an item that was `[unverified]` and has since been tested. Claude cannot drive Chrome with real Service Workers from the chat sandbox, so milestones end with manual checklists the user runs.

**Sources inspected:** the user's mirage ZIP (git HEAD `563527b` plus a modified working tree), `frnlol/frn` at `2e26cb8` (built output only, no sources), `MercuryWorkshop/scramjet` at `517206b` (2026-11-08).

## Executive summary

1. mirage was Scramjet `2.0.67-alpha.1` plus `scramjet-controller 0.0.13` plus Epoxy transport over WISP; **[revised 2026-11-22]** paroxysm now runs Scramjet `2.1.0`, `scramjet-controller 0.1.0` and `epoxy-transport 3.0.2` (the rest of this document describes the original alpha.1 research; the architecture is unchanged). The proxy logic runs in the controller page (`index.html`); the Service Worker is a thin router. `[confirmed]`
2. Fern's app Service Worker (`omm3do.js`) contains the same Scramjet controller SW code as mirage's `controller/controller.sw.js`, and upstream's demo `sw.js` is identical to mirage's `sw.js`. So Fern-style virtualization is compatible in principle. `[confirmed]`
3. **No file in `scramjet/`, `controller/` or `epoxy/` needs to change.** The controller already exposes a `config` object (prefix, `scramjetPath`, `injectPath`, `wasmPath`) that Fern overrides to make everything scope-relative. An external adapter can do the same.
4. **[revised]** The one real conflict with the "protected" rule was in the UI shell, not the engine: `index.html` and `newtab.html` hard-coded root-absolute paths (`/sw.js`, `/scramjet/...`, `/newtab.html`) and one regex that assumed the prefix is `/~/sj/`. The user approved path-only edits (A1, A2); they were done during the redesign. A3 (the `register("/sw.js")` string) stays untouched until the SVG phase, handled by the adapter.
5. Fern ships no license file, only minified output, and its app page loads an obfuscated third-party ad script. paroxysm's loader is written independently from the documented behavior rather than copying Fern's code.
6. Recommendation (approved): the SVG is only the bootstrap. After the Service Worker takes over, it serves the app as normal `text/html`, so mirage's HTML UI does not have to survive SVG/XML quirks.
7. **[revised]** The riskiest assumptions were tested in milestone 0 and held: jsDelivr serves SVG as `image/svg+xml` with no CSP, a worker registers at the subpath scope, and `new Function()` works in the worker. One path is still untested: embedding the HTTPS copy in an **iframe** from a `file://` SVG (see section 4). **[verified 2026-11-23]** M4 tested it in headless Chrome for Testing 158 and it works (`PROJECT_STATUS.md` section 6).

## 1. How mirage works today

mirage is fully static, with no `package.json`, no build step and no server code in the working tree. All proxy behavior comes from vendored files.

**Request path (confirmed from `index.html`, `sw.js` and the minified controller files):**

1. `index.html` registers `/sw.js`. That 6-line file runs `importScripts("/controller/controller.sw.js")` and adds a `fetch` listener: `if ($scramjetController.shouldRoute(e)) e.respondWith($scramjetController.route(e))`.
2. `init()` waits for the SW, probes the WISP server with a raw `WebSocket` (retrying every 2 s because the servers are on Render's free tier), builds `new EpoxyTransport({ wisp })`, calls `transport.init()`, then `new Controller({ serviceworker, transport, scramjetConfig: defaultConfig })` and `await controller.wait()`.
3. Each tab is an `<iframe>`. `controller.createFrame(iframe)` returns a `Frame`; `frame.go(url)` sets `iframe.src` to a rewritten URL under `/~/sj/<controllerId>/<frameId>/<encoded url>`.
4. The iframe navigation is a fetch event in the SW. `controller.sw.js` does not proxy anything itself: `route()` serializes the request and sends it over a `MessagePort` (RPC id `tabchannel-<id>`) to the controller page. There `frame.fetchHandler.handleFetch` (Scramjet core) rewrites and fetches through `transport.request` (Epoxy, over WISP), and the response travels back to the SW.
5. Rewritten HTML gets four scripts injected: `scramjet.js`, a virtual `<prefix>scramjet.wasm.js` (the controller serves the wasm as base64 in `self.WASM`), `controller.inject.js`, and a bootstrap data URL calling `$scramjetController.load(...)`. The injected client hooks the page's DOM and network APIs, and asks the SW (`$sw$initRemoteTransport`) for its own channel to the controller's transport. Cookies live in an IndexedDB database (`__scramjet_controller`) synced over a `BroadcastChannel`.
6. If the SW is killed while idle, it restarts, notifies clients with `$controller$swrevive`, and the page re-sends `$controller$init` with a fresh port.

**Version coupling `[confirmed]`:** `controller.api.js` throws at load unless the loaded `scramjet.js` is a compatible version. **[revised 2026-11-22]** For controller 0.1.0 and Scramjet 2.1.0 the rule is: release versions match if major.minor are equal (any patch), prerelease versions must match exactly (the original alpha.1 controller required exactly `2.0.67-alpha.1`). The controller no longer exports `VERSION`; it exports `versionInfo` (`version`, `build`, `date`). Never mix versions between the packages; take the controller from npm or a tagged release, not from the moving "Continuous Build".

**Other observations `[confirmed]`:**
- The ZIP's working tree deletes `ai.html`, `arcade.html`, `music.html`, `worker/ai-proxy.js` and `models_dump.json` relative to git HEAD, but `index.html` and `newtab.html` still linked to `mirage://arcade|ai|music`. **[revised 2026-11-19]** Those pages were left out at first and the links were removed in paroxysm. Since then Games was built on LuminSDK and an AI page is planned; Music, Manga and Movies were dropped or declined.
- The address-bar sync (500 ms poll) parsed the proxied URL with `/https?:\/\/[^/]+\/~\/sj\/[^/]+\/[^/]+\/(https?.+)/`, tying UI code to the `/~/sj/` prefix. **[revised]** paroxysm derives the pattern from `$scramjetController.config.prefix` (A2).
- External runtime dependencies were Google Fonts and `unpkg.com/lucide@latest` (unpinned). **[revised]** paroxysm bundles the font and inlines the icons.
- WISP servers were two Render hosts (`psiw-lynverix[-2].onrender.com`); no WISP server source is in the repo. **[revised 2026-11-19]** paroxysm uses an ordered list of nine public endpoints in `paroxysm.config.js`, stored encoded (reversed and base64, the same idea as Fern's) and shown in the interface as "Wisp Server N"; the user can pick one or add their own.
- Scramjet is AGPL-3.0-only (its `package.json`), so distributing it carries source-offer obligations. The public repo satisfies this.

## 2. Inventory of Scramjet and controller files

| Path | Size | Role | Loaded by |
|---|---|---|---|
| `scramjet/scramjet.js` | 227,493 B | Scramjet runtime/rewriter, global `$scramjet`, v`2.1.0` (was alpha.1, 225,759 B) | `<script src="/scramjet/scramjet.js">`; also injected into proxied pages |
| `scramjet/scramjet.wasm` | 583,678 B | Rewriter wasm | fetched by the controller (`config.wasmPath`) |
| `controller/controller.api.js` | 25,802 B | Page-side API: `Controller`, `Frame`, `config`, `ManagedPlugin`, `versionInfo` (0.1.0; was 17,058 B, `VERSION 0.0.13`) | `<script>` in `index.html` |
| `controller/controller.sw.js` | 4,576 B | SW-side router: `shouldRoute`, `route`, message/install/activate handlers | `importScripts` from `/sw.js` |
| `controller/controller.inject.js` | 6,408 B | In-page client for proxied documents | injected by rewriter |
| `controller/controller-external.mjs` | 321 B | ES re-export stub; unused by mirage | nothing |
| `controller/*.map` | ~110 KB | Source maps; optional | nothing |
| `epoxy/index.js` | 1,746,810 B | `EpoxyTransport` UMD (wasm appears embedded; version string not found) | `<script src="/epoxy/index.js">` |
| `sw.js` | 366 B | Fetch glue (mirage-authored) | `register("/sw.js")` |

## 3. UI assessment and redesign direction

**[revised]** This section records the original assessment and the first proposed direction. **[revised 2026-11-19]** The redesign has since gone through six rounds (Fern-like UI, named accents, light theme, horizontal tabs, bookmarks, shortcuts, Games, extensions); the typeface is now Inter (not Inter Tight) and bookmarks exist; the live design rules are in `CLAUDE.md` section 5 and the history is in `PROJECT_STATUS.md`.

**Original state `[confirmed]`:** the background was already `#000`, but the stylesheet was 59 KB and 480 rules with hard-coded hex values and no CSS variables. Roughly 2,000 lines served pages that no longer exist in the ZIP (`ai-page`, arcade, music). Tabs sat in a 38 px horizontal bar with 12 px text; inactive tab text was `#3a3a3a` on `#000`, which is very low contrast. The new tab page had a logo, a search box, three bookmarks and a hint line. The settings button was wired to nothing. Branding strings were mixed case (the old name capitalised in the iframe title and the logo alt text, plus asset names like `miragefavicon.ico`).

**First proposed direction (superseded by later rounds):** a left vertical tab rail, a slim top toolbar, one `:root` token block, an 8 px spacing scale, one type scale (Inter Tight), a new tab page with logo, one search field and one hint line, no bookmarks, vendored icons and font, and the same DOM ids and proxy calls kept intact.

## 4. Fern's complete loading process

Fern's repo contains built output only. Function names below are minified, so each is given by role and minified name. `[confirmed]` unless marked.

**Files:** root `index.svg` (14.8 KB, the user-facing loader), `index.html` (same loader as HTML), `v7m.js` (the real Service Worker, 26 KB), `m.json` (signed manifest, 46 KB), and `b/` (the app: 429 files, 125 MB). Mirror URLs and WISP URLs inside the loader are stored reversed and base64-encoded (decoder `G`).

1. **Open the local `index.svg`.** Its inline script holds a config object: `sw:"v7m.js"`, `entry:"index.svg"`, an ECDSA P-256 public key list, `homes` (HTTPS mirrors of the repo), `heads` (places to fetch `m.json`), and `wisp` (WISP servers).
2. **[revised] Decide.** The entry code checks whether `navigator.serviceWorker` exists. If it does and the page is not inside an iframe, not already marked `?ld=0`, and no recent failure is remembered (a timestamp in `localStorage`), it tries to register the worker (`ye`). If a recent failure is remembered, it skips the attempt and goes straight to the mirror race with the iframe option. If the browser has no `navigator.serviceWorker` at all, it reports that and runs the race with the **redirect** option. **[verified 2026-11-13]** On `file://` in Chrome, `navigator.serviceWorker` exists and `isSecureContext` is true, but `register()` fails with an opaque-origin error. So Chrome on `file://` takes the failed-registration path: the failure is remembered, then the iframe option is used (`K` calls `U(!!navigator.serviceWorker && self.isSecureContext)`, which is true).
3. **Mirror race (`U`, `J`, `de`).** It decodes `homes`, skips the current location, and starts `fetch(home + "index.svg", {cache:"no-store"})` against one mirror every 1.5 s (6 s timeout each). The first success aborts the rest.
4. **Fallback if every HTTPS mirror fails (`he`).** It opens a WebSocket to an embedded WISP server, speaks the WISP stream protocol by hand, issues a raw HTTP/1.1 GET for `m.json` from a plain-HTTP host through it, verifies the ECDSA signature (`H`, `X`), reads `src.homes` from the verified manifest, and races those.
5. **[revised] Embed first, redirect only as a fallback.** With the iframe option (`U(true)`, `pe`), the local SVG **stays the outer document** and appends an iframe whose `src` is `<winning mirror>index.svg` plus the page's `#hash`. The iframe gets a long `allow` list (fullscreen, autoplay, clipboard read/write, microphone, camera, display capture, encrypted media, picture-in-picture, gamepad, screen wake lock). The parent listens for a `message` from that iframe's window; if it receives `{ld:"nosw"}` it falls back to a full-page redirect (`D`): `location.replace(home + "index.svg?ld=0" + hash)`. `ld=0` marks "already on a mirror" so a failure there shows a message instead of looping. With the redirect option (`U(false)`, browser without service workers) it goes directly to that redirect.
6. **[revised] In the iframe (or on the HTTPS copy).** The same loader script runs in the HTTPS document (`k` flags "inside an iframe"). If service workers work there (`ye`), it registers `v7m.js` (scope defaults to that file's directory, e.g. the jsDelivr `/gh/<owner>/<repo>@<ref>/` path), waits for `ready`, starts a SharedWorker for WISP probing, and posts `{ld:"prepare"}` to the active worker. If the worker cannot start inside the iframe, `K` posts `{ld:"nosw"}` to the parent.
7. **SW prepares (`Nt`).** It fetches `m.json` from several sources in parallel, verifies the ECDSA envelope (`et`), keeps the highest `seq`, rejects anything not newer than what it holds, and downloads the manifest's `boot` set (9 files, about 7.1 MB, 4 at a time). Each file is checked against its SHA-256 and cached in Cache Storage `ld-1` (`P`, `oe`). Mirror order for files (`se`): HTTPS bases pinned to the manifest's commit `ref`, then plain-HTTP bases via WISP, then same-origin. It builds the virtual worker (section 5), saves state, and posts `{ld:"ready"}`.
8. **Reload.** The page reloads itself (max 3 times per 30 s, tracked in `sessionStorage`).
9. **SW serves the app.** A navigation to `index.svg` or `index.html` under the scope is answered from the manifest's `docs` list (`pe` then `he`): the app's own `b/index.svg`, with a registration shim injected.
10. **App boot.** The app document loads Scramjet, the controller API, and its UI bundle. Near byte 6,110,664 of the bundle it builds the transport and calls `new Controller({ serviceworker, transport, config: { prefix: scope + "4upld1/", codec, scramjetPath, injectPath, wasmPath }})`, where `scope = new URL(registration.scope).pathname`. The `warm` set (44 files) prefetches in the background.

**Manifest v1 `[confirmed]`:** `{ v, seq, id, ref, dir, sw, docs[], boot[], warm[], files{ path: [sha256-base64, size] }, src{ heads, bases, homes, wisp } }`, wrapped as `{ s: signature, m: "<manifest JSON string>" }`. `seq` is a millisecond timestamp. Fern's repo contains no tool that generates it.

**Fern's app page also contains an obfuscated ad loader `[confirmed]`:** an XOR-encoded URL list (`https://photon.girlspreples.org/v1/m.js`) is fetched, run, and then `aclib.runPop({zoneId:...})` is called. paroxysm must not include anything like it; it would run third-party code in the same origin as the proxy. `rq.js` (305 KB, base64+`eval`) is also obfuscated and was not analyzed in depth.

**[verified 2026-11-23]** M4 tested this path in headless Chrome for Testing 158: no frame-blocking headers, the worker registers and controls the iframe, the `allow` list is needed, the `nosw` redirect and `ld=0` guard work, storage persists partitioned under the `file://` top site (details in `PROJECT_STATUS.md` section 6). The user confirmed it in their own Chrome 156 the same day. Original note: **Untested for paroxysm:** the iframe path from a `file://` outer document (cross-site iframe service worker registration, jsDelivr frame-blocking headers, the `allow` list, the `nosw` fallback). This is the first spike of the SVG phase.

## 5. How Fern's Service Worker virtualization works

The registered worker (`v7m.js`) is a loader and package manager. The "actual" application worker (`omm3do.js`) is just a file listed in the manifest. `[confirmed]`

1. **Capture (`Ot`).** The loader reads the app worker's source from the verified cache, temporarily replaces `self.addEventListener` with a function that stores handlers by event type, evaluates the source with `new Function(source).call(self)`, then deletes the override. The result is a map such as `{ fetch:[...], message:[...], push:[...], install:[...] }`.
2. **Fetch dispatch (`ce`, `pe`).** For every in-scope request the loader builds a synthetic event (`request`, `clientId`, `resultingClientId`, `preloadResponse`, `respondWith` that records the promise, a no-op `waitUntil`) and calls each captured fetch handler. If one calls `respondWith`, that promise answers the real event. If none do, it serves manifest files from cache, otherwise `fetch(request)`. `respondWith` on the real event is called synchronously, with the async work inside the promise.
3. **Other events (`rt`).** `message`, `push` and `notificationclick` are re-dispatched with a copied event (`data`, `ports`, `source`, `origin`, `lastEventId`). Ports are preserved, which the Scramjet controller needs.
4. **Not dispatched.** The captured `install` and `activate` handlers are never called. The loader has its own (`skipWaiting`, `clients.claim`).
5. **Persistence.** The loader's top-level listeners are registered synchronously (a browser requirement); handlers `await` a state-restore promise that re-reads the manifest and re-evaluates the app worker from Cache Storage after the browser restarts an idle worker.
6. **Document rewriting (`he`).** Served documents get a script that wraps `navigator.serviceWorker.register` so that if the app's own registration fails, the existing registration is returned. The app's worker filename string is replaced with the loader's filename, so the app's `register("omm3do.js")` resolves to the loader itself.
7. **Two builds.** The loader keeps up to two manifests (current and previous) so already-open tabs stay on their build; each client is mapped to a build.

**Constraints this imposes on the app worker:** one self-contained script with no `importScripts`; no reliance on `install`/`activate`; globals declared with `var` stay local to the evaluating function. **[revised]** `importScripts()` of a new script after install is blocked, and `new Function()` and indirect `eval` are allowed inside a jsDelivr-served worker. `[verified 2026-11-13]`

## 6. Integrating mirage without touching its protected implementation

**Protected (byte-for-byte unchanged):** everything in `scramjet/`, `controller/`, `epoxy/`, and the proxy-facing logic of `index.html`'s script: `register`, `probeWisp`, `new EpoxyTransport`, `transport.init()`, `new Controller({...})`, `controller.wait()`, `createFrame`, `frame.go`.

**New files that wrap it (SVG phase; [revised 2026-11-23] `paroxysm-adapter.js` and `sw-glue.js` were built in M5, together with a plain `paroxysm-sw.js` that M6's loader replaced (deleted after M6); `loader-sw.js`, `m.json` and `tools/make-manifest.mjs` were built in M6; `index.svg` and `paroxysm-outer.js` in M7):**
- **`loader-sw.js`** (own implementation of section 5): the registered worker.
- **`sw-glue.js`**: the five lines from mirage's `sw.js` minus `importScripts`. The manifest's `sw` becomes a list: `controller/controller.sw.js`, then `sw-glue.js`, evaluated in one function body (so `$scramjetController` is visible to the glue). No concatenation step and no edit to `controller.sw.js`.
- **`paroxysm-adapter.js`**, loaded after `controller.api.js` and before the inline script, does two things: it sets `$scramjetController.config.{prefix, scramjetPath, injectPath, wasmPath}` from the SW scope (the `Controller` constructor deep-merges this exported object, and upstream's own `packages/bootstrap` uses the same pattern); and it wraps `navigator.serviceWorker.register` so mirage's `register("/sw.js")` registers the loader instead.

**Approval items [revised: all answered]:**
- **A1. Path-only edits in `index.html`/`newtab.html`.** Approved and done during the redesign (relative URLs).
- **A2. Address-bar regex.** Approved and done (pattern derived from the controller's prefix).
- **A3. Registration.** Approved to remain for the SVG phase: keep `register("/sw.js")` unchanged and rely on the adapter's shim (zero edits).
- **Added later, approved by request:** the wisp endpoint is chosen by an ordered-fallback wrapper around `init()` (`init()`'s logic unchanged; its only edits are log tags and the internal-page scheme check), with endpoints in `paroxysm.config.js`.

The inline script stays in `index.html` (option A) rather than being extracted, to keep the diff to the protected code at zero lines.

## 7. Scramjet compatibility with Fern's virtualization

**Compatible `[confirmed]`:** Fern's `omm3do.js` embeds the same controller SW (same RPC class, `$controller$init`, `$sw$initRemoteTransport`, `$sw$setCookieDone`, `shouldRoute`/`route`). The controller's SW only uses `message`, `install`, `activate` and `fetch` (via glue) plus a 100 ms `setTimeout` that sends `$controller$swrevive`. All are supported by the virtualization or harmlessly skipped.

**Not compatible as-is, and the adapter for each:**

| Issue | Cause | Adapter |
|---|---|---|
| `importScripts("/controller/controller.sw.js")` | not allowed after install; root-absolute path | manifest lists the controller SW file plus `sw-glue.js`, loader evaluates them together |
| Root-absolute config (`/~/sj/`, `/scramjet/...`) | `controller.api.js` defaults | `paroxysm-adapter.js` writes scope-relative `config` before `new Controller` |
| `register("/sw.js")` | wrong origin path | adapter's register shim |
| Address-bar regex | assumed `/~/sj/` | done (A2) |
| Version lock | `controller.api.js` asserts a compatible Scramjet version (2.1.x since the 2026-11-22 update) | ship the Scramjet, controller and Epoxy files as one unit; never mix with Fern's alpha.2 |

**Behavioral risks:** the loader must restore the virtual worker before the first proxied request after an idle restart. mirage already depends on the revive handshake, but the loader adds a Cache Storage read to that path, so the loader milestone tests it explicitly. Fern's synthetic events lack `preventDefault`; Scramjet's route does not use it.

## 8. Proposed paroxysm structure

**[revised]** This is the target structure for the SVG phase. The current UI-phase project is flat (see `PROJECT_STATUS.md` section 4); the app files move under `app/` when the loader and manifest are built.

```
paroxysm/                    (repo root = jsDelivr base path)
├─ index.svg                 the single user-facing loader
├─ loader-sw.js              registered Service Worker (virtualization + updates)
├─ m.json                    manifest: hashes now, signature later
├─ loader/                   readable sources for index.svg
├─ tools/make-manifest.mjs   hash app/ -> m.json; inline loader -> index.svg
└─ app/                      everything the loader SW serves; relative paths only
   ├─ index.html newtab.html settings.html paroxysm.css ... (the UI files)
   ├─ paroxysm-adapter.js    new
   ├─ sw-glue.js             new
   ├─ scramjet/              unchanged
   ├─ controller/            unchanged
   ├─ epoxy/                 unchanged
   └─ assets/                logo/icon files (assets/paroxysm/...), lowercase names
```

Every file name, UI string and doc uses lowercase `mirage` or `paroxysm`.

## 9. Dependencies and runtime assets

- **Reused from mirage:** `scramjet.js`, `scramjet.wasm`, `controller.api.js`, `controller.sw.js`, `controller.inject.js`, `epoxy/index.js`, the tab/navigation logic.
- **New (SVG phase):** `loader-sw.js`, `sw-glue.js`, `paroxysm-adapter.js`, the SVG loader script, `m.json`.
- **Tooling:** a static file server for local tests (`python -m http.server`) and one small script, `make-manifest.mjs` (Node 20+, no packages), because SHA-256 hashing of the app files has to be generated. This is the only build-like step.
- **External services:** GitHub (storage), jsDelivr (delivery), at least one WISP server (backend; cannot be static). **[revised]** Google Fonts and unpkg were removed by vendoring; the only UI runtime third-party requests now are Three.js from jsDelivr (pinned, integrity-checked, new tab background only), Google's favicon service (kept by the user's choice), and the chosen search engine. **[revised 2026-11-19]** Also: the LuminSDK script (jsDelivr, pinned to a commit with an integrity hash) and LuminSDK's own catalogue and game hosts (Games page, not proxied); Google's favicon service is also used for shortcut and bookmark icons and the tab disguise.
- **Browser features:** Service Workers, Cache Storage, IndexedDB, WebCrypto (SHA-256 now, ECDSA later), `DecompressionStream` only if the WISP-HTTP fallback is built.

## 10. Embedded in `index.svg` versus hosted

| Embed in `index.svg` | Must be hosted |
|---|---|
| bootstrap logic (mirror race, `file://` detection, iframe embed and redirect fallback, progress UI) | `loader-sw.js`: a Service Worker script must be fetched from a same-origin `http(s)` URL; it cannot come from a data/blob URL or `file://` |
| mirror list and (later) public key | `scramjet.wasm` (584 KB), `epoxy/index.js` (1.7 MB), `scramjet.js` (226 KB), all app HTML/CSS/JS |
| icon and loading screen as data URIs | `m.json` and every hashed asset |

The SVG stays around 10–20 KB. Embedding the wasm would not help because the app still needs an HTTPS origin to register a worker.

## 11. How GitHub, jsDelivr, WISP and the HTTPS origin fit

- **[revised 2026-11-23] Built in M8:** `index.svg` uses `@main`; `loader-sw.js` reads `m.json` from `@main` and from raw.githubusercontent.com (newest `seq` wins) and downloads files from `@<ref>`; `tools/release.mjs` pins and publishes.
- **GitHub** stores the repo. **jsDelivr** serves it from `cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/...`. Pinning to a commit hash makes files immutable; `@main` is cached and can be stale, so the manifest pins file URLs to `ref` and only the loader entry points use `@main`. **[revised]** Measured on jsDelivr: `cache-control: public, max-age=604800, s-maxage=43200` (7 days in browsers, 12 hours on the CDN) for `@main`. `[verified 2026-11-13]`
- **The HTTPS origin** is whichever mirror won the race. Its path (`/gh/<owner>/<repo>@<ref>/`) becomes the SW scope, which is why the controller prefix and asset paths must be scope-relative.
- **Why SVG:** jsDelivr's documentation says HTML files are served as `text/plain`, so an HTML entry page would show as text. An SVG with `foreignObject` is served as an image type but renders as a script-capable document when navigated to. **[revised]** Verified on jsDelivr: SVG is served as `image/svg+xml` with no `content-security-policy` header and scripts run. `[verified 2026-11-13]` Whether it can be loaded **inside an iframe** (frame-blocking headers were not recorded) is untested. Once the SW is active it can return `text/html` for in-scope navigations, so the app itself can be plain HTML (verified).
- **raw.githubusercontent.com** is useful for file fetches (`access-control-allow-origin: *`) but unusable as an app origin: it sends `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` on SVG. `[confirmed by header request]`
- **jsDelivr limits `[confirmed from its README]`:** single GitHub files over 20 MB and packages over 50 MB are unsupported by default. paroxysm's app is about 3 MB.
- **WISP** is separate from all of this. It is the proxy transport (`wss://` from an HTTPS page). Fern additionally uses WISP to reach plain-HTTP mirrors when every HTTPS mirror is blocked; leave that for the hardening milestone.

## 12. Technical problems and limitations

1. **`file://` Service Workers. [revised, verified 2026-11-13]** Chrome exposes `navigator.serviceWorker` on `file://` but `register()` fails with "The URL protocol of the current origin ('null') is not supported". The loader should check `location.protocol === "file:"` as well as catching the failed `register()`.
2. **jsDelivr SVG behavior. [revised, verified 2026-11-13]** It serves SVG with scripts enabled and no sandbox CSP. GitHub Pages (`<owner>.github.io/<repo>/`) remains an untested optional fallback home.
3. **Shared origin.** Everything on `cdn.jsdelivr.net` shares one origin, so storage and SW registrations are visible to any other script-capable page on it. Fern's app page unregisters other workers it finds. paroxysm should never enumerate registrations, should namespace storage, and should treat this origin as untrusted for secrets.
4. **Scope and prefix.** Navigations to proxied URLs must be inside the SW scope; hence the scope-relative `config`.
5. **Idle worker restarts** (section 7).
6. **[revised 2026-11-23] Signed since M9:** releases are signed with ECDSA P-256 and the loader refuses unsigned, tampered or older manifests; `loader-sw.js` itself still comes from the repository, so signing protects the manifest channel (CDN, GitHub raw, mirrors), not a takeover of the repository. Original note: **Unsigned manifest** until ECDSA lands: hashes protect files only if the manifest is trusted. Interim mitigation: pin by commit; first release from the user's own repo only.
7. **WISP availability.** Without a reachable WISP server the proxy does not work at all. **[revised]** paroxysm now tries an ordered list of endpoints, so one dead endpoint is survivable.
8. **Takedown risk.** jsDelivr's acceptable-use policy requires content to conform to the policies of the source host; mirrors can be removed.
9. **Third-party storage partitioning.** **[verified 2026-11-23]** Chrome registers and keeps the worker in the iframe; its storage persists across reloads and restarts, is invisible to top-level jsDelivr pages and is shared by every local `file://` page (one top-level site); blocked third-party cookies do not stop it. **[revised]** This now matters: the iframe-first design runs the app in a cross-site iframe under a `file://` outer document, so its storage and Service Worker are partitioned and the partition is keyed to the outer document. Whether Chrome registers and keeps the worker in that setup is the first thing the SVG-phase spike must test.
10. **Chrome-only** is the target; other browsers are untested.
11. **Licensing:** Scramjet is AGPL-3.0; Fern has no license file, so no Fern code is copied.
12. **[revised 2026-11-19] Games are not proxied.** LuminSDK's catalogue and game hosts are contacted directly and could be blocked on a restricted network; a play-through-the-proxy mode is a possible later step.
13. **[revised 2026-11-19] Same-address re-navigation hang.** In one tab, proxied page, then a local page, then the same proxied address again does not load (a different address loads). It also happened with Sapphire blocked and after Sapphire was removed. Not fixed; see `PROJECT_STATUS.md` section 5.
14. **[revised 2026-11-22] Secrets on the shared origin.** The AI keys (`paroxysm:ai-keys`) and the Puter token (`paroxysm:ai-puter`) are kept in `localStorage`. On a localhost or own-domain origin only paroxysm's code can read them; on `cdn.jsdelivr.net` (the SVG phase) any script-capable page on that origin could, which is the point of item 3. Before the SVG phase decide whether secrets stay in `localStorage` with a namespaced prefix, move into the iframe's partitioned storage, or are not stored (ask each session). Third-party code (Puter.js) already runs only in a sandboxed frame without `allow-same-origin`.
15. **[revised 2026-11-22] Uncontrolled pages and worker restarts.** A page the service worker does not control (the shell after Ctrl+Shift+R) never receives the worker's `clients.matchAll()` messages (the revive announcement and cookie updates), so a restarted worker stays without routes and every proxied navigation falls through to the static server (B16). Found by reproduction with `Page.reload { ignoreCache: true }` and `ServiceWorker.stopAllWorkers`. The shell now reloads itself once when it is uncontrolled and retries proxied frames that loaded unserved. In the SVG phase the app runs in an iframe under a `file://` outer document and the loader worker re-creates the virtual worker after a restart, so this needs a test there too (controlled or not, restart at any moment, hard reload of the outer page).
16. **[revised 2026-11-23] YouTube pages fail in the transport.** Through the Epoxy transport (epoxy-tls 2.1.20-1, hyper/h2) `www.youtube.com/`, `/feed/trending`, `youtu.be/...` and HEAD requests fail every time with `Http2 ... Reset(StreamId(n), PROTOCOL_ERROR, Library)`, from any wisp server, while `/robots.txt`, `i.ytimg.com`, Google and Discord work (`httpstat.us` showed it too). Likely cause, not proven: YouTube's HTML response headers are large (about 12.8 KB measured against about 1 KB for robots.txt) and epoxy-tls exposes no HTTP/2 header-list-size setting (its `header_limit` is HTTP/1 only); a Servo report from Nov 2026 describes the same signature. The fix belongs in epoxy-tls (a rebuilt, protected `epoxy/index.js`, needs approval); nothing in the SVG loader or an adapter can work around it. Present since the baseline. **Next task (the user's choice, 2026-11-23):** first check for an existing Epoxy option that could be set from outside, otherwise rebuild epoxy-tls with a larger HTTP/2 header limit; the plan and the user's approval come before any change (`PROJECT_STATUS.md` section 7).

## 13. Roadmap

**[revised]** The approved order (the original table placed the subpath test and adapter before the loader, inside the redesign phase; they now start the SVG phase, after the verification gate). The user's order is: preliminary checks, UI redesign, verify the proxy still works, then the SVG architecture. Status of each milestone is in `PROJECT_STATUS.md`.

| # | Milestone | Done when (the user tests) |
|---|---|---|
| 0 | **Feasibility spike**, throwaway repo | **Done.** Results recorded. |
| 1 | **Baseline** of the untouched mirage with a proxy checklist | **Done.** Results recorded. |
| 2 | **UI redesign** (shell, new tab, settings, cleanup, vendored icons/font, WISP notification; relative paths A1/A2) | **Done 2026-11-22**, declared finished by the user: rounds 1 to 6, Games with two sources, the Menu, the AI page with Puter, the recovery adapters, B16, back and forward greying, the code style cleanup, the B8 and plain-text fixes (`PROJECT_STATUS.md` section 7) |
| 3 | **Verification gate:** the user re-runs the checklist on the redesigned UI | Results match the baseline. **Done 2026-11-22:** B8 fixed (a bug in `norm()`), B10 (YouTube, an Epoxy HTTP/2 limit) known, the rest passed |
| 4 | **Spikes and subpath test:** `file://` SVG embedding the jsDelivr copy in an iframe and registering a worker inside it (including the `nosw` fallback and frame headers); serve the app at `localhost:8080/gh/paroxysm@dev/` | Iframe worker registers; checklist passes under a subpath |
| 5 | **Adapter** (`paroxysm-adapter.js`, `sw-glue.js`) with a plain SW at the subpath, before any loader exists | Proxy works with scope-relative config |
| 6 | **Loader SW** (own implementation): manifest v1 with hashes, one mirror (localhost), `boot`/`warm`, virtual `fetch` and `message` dispatch | Checklist passes via the loader; kill the SW in DevTools mid-session and tabs recover |
| 7 | **SVG loader:** `file://` detection, mirror race, **iframe-first embedding** with the full-page redirect only as the `nosw` fallback, `ld=0` guard, progress and error states | Open the downloaded `index.svg` from disk, reach the app inside the iframe |
| 8 | **Release tooling:** `make-manifest.mjs`, GitHub repo, commit-pinned `ref`, jsDelivr purge | Same flow against the real jsDelivr URL |
| 9 | **Hardening:** ECDSA signing and `seq` anti-rollback, more mirrors, update flow, optional WISP-HTTP fallback | Tampered manifest is rejected. **Built 2026-11-23:** signing, rollback, `fastly`/`gcore` hostnames (the user's choice; the rest not chosen) |

## 14. Decisions (resolved)

**[revised]** The original section listed seven questions. They were answered; the current record is `PROJECT_STATUS.md` section 8. In summary: path-only edits approved (A1, A2 done, A3 later); arcade/ai/music left out of v1 (**[revised 2026-11-19]** Games built, AI planned, Music dropped); GitHub repository `paroxysm` owned by the user; the old Render WISP servers dropped in favor of public endpoints starting with `api.scvmath.org/wi/` (ordered fallbacks, the user supplies the rest); serving the app as `text/html` after the worker takes over approved; independent loader approved; vendored Lucide icons and font approved. Added by the user later: the local SVG stays the outer document and the HTTPS copy runs in an iframe, with a full-page redirect only as a fallback.

## 15. Extension support (Sapphire): tried and removed

**[revised 2026-11-19]** Nothing in the architecture above changed; this section is a record so the idea is not redone blindly.

- **What was tried (2026-11-17).** x8rr/sapphire, a library that emulates part of Chrome's extension APIs inside Scramjet frames, was built into a bundle and wired in with three small edits (the service worker, one `createFrame` option, a controller attach), plus an Extensions page and a built-in uBlock Origin Lite.
- **What worked `[verified]`, in headless Chrome with a local wisp server:** installing extensions, content scripts with `chrome.runtime`, injected CSS, messaging, a declarativeNetRequest rule blocking a request, and uBlock Origin Lite's popup. Real ad blocking was never confirmed (no internet in the test sandbox).
- **Why it was removed `[measured]`.** On a test page with 150 sub-requests, a load took about 2.3 s without Sapphire and about 5.7 s with Sapphire on and uBlock Origin Lite switched off (6.7 s with it on), and the sub-requests themselves were about 45% slower (one run each, in a slow sandbox). The user also found pages much slower in a real browser and decided on 2026-11-19 to remove it.
- **Risks that were also seen.** Sapphire was written for controller 0.0.14 and Scramjet alpha.2 (paroxysm has 0.0.13 and alpha.1); the first page load after installing an extension could stall for a long time; its repository has no license file.
- **State now.** Every file is back to mirage's original, including `sw.js`, and the protected blocks of `index.html` are byte-identical. If ad blocking is wanted again, a small block list applied in the service worker would be a much lighter, untested idea.

## 16. AI page and third-party code in an isolated frame (added 2026-11-22)

**[revised 2026-11-22]** Nothing in the architecture above changed; this section records what the AI page taught that matters later. The rules are in `CLAUDE.md` section 5 and the history in `PROJECT_STATUS.md` section 7.

- **Pattern for third-party code in the app origin:** run it in `puter-frame.html`, an iframe with `sandbox="allow-scripts"` (no `allow-same-origin`, so an opaque origin with no access to paroxysm's storage), a CSP meta tag that limits where it can connect, loaded only when needed, pinned to an exact version, and checked with an integrity hash. `postMessage` is the only channel and each side checks the sender (`event.source`). Use the same pattern for any later third-party script.
- **Integrity without `<script src>` `[verified 2026-11-22]`:** jsDelivr serves `.cjs` files as `application/node` with `x-content-type-options: nosniff`, so a `<script src>` is refused. `fetch(url, { integrity })` works (jsDelivr sends `access-control-allow-origin: *`), and the verified text is then run as an inline script. The same applies to any npm file with an unusual extension.
- **Sign-in popups need a real origin `[confirmed in Puter.js source, and a real sign-in worked]`:** `puter.auth.signIn()` rejects with `unsupported_origin` in a frame without `allow-same-origin`. paroxysm opens Puter's popup from the AI page and accepts only a `puter.token` message from the popup window, from Puter's origin, with its own `msg_id`; the token is then handed to the frame. In the SVG phase the opener will be the iframe on a jsDelivr origin; whether Puter accepts that origin is untested.
- **Puter.js talks with XMLHttpRequest, not `fetch` `[confirmed in source]`.** To send its calls through the wisp transport the frame replaces `window.XMLHttpRequest` with a small class that forwards requests to the page (https `puter.com` hosts only) and streams answers back; WebSockets are blocked in that mode. The pattern (a frame that never touches the network itself and asks the page to fetch through the transport) also fits other sandboxed third-party code.
- **The model catalogue is public** (`api.puter.com/puterai/chat/models/details`), so model ids can be checked without an account. Free quotas elsewhere are per project, not per person (`PROJECT_STATUS.md` section 7, the AI page entry).
