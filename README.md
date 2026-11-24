# paroxysm

A web proxy interface built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) with an Epoxy transport over WISP. paroxysm is the continuation of mirage.

Status: the interface is finished and the baseline checklist has been re-run on it. The proxy engine is Scramjet 2.1.0 with controller 0.1.0 and Epoxy transport 3.0.2 (installed as one set on 2026-11-22); `epoxy/index.js` was rebuilt on 2026-11-23 with a larger HTTP/2 header limit so YouTube works. The single-file `index.svg` launcher works, with signed releases and automatic updates (milestones M4 to M9, version 0.8.0-alpha).

## Open it

Download `index.svg` and open it in Chrome (double-click). It finds a paroxysm server, shows a loading screen while the files download and are checked, and then runs paroxysm inside the page; the address bar keeps showing the local file. The first start downloads about 3 MB; later starts are instant. If the page can't start its service worker it opens the hosted copy directly instead. New versions arrive by themselves: the next start downloads and checks a new release in the background, and the start after that uses it.

## Run locally

Serve this folder from the root of a local static server and open it in Chrome (service workers do not run from `file://`). Chrome is the only browser tested:

```
python -m http.server 8080
```

then open `http://localhost:8080/`. VS Code Live Server also works.

The registered service worker is `loader-sw.js`. It only serves files whose SHA-256 matches the manifest, so for local testing run `node tools/make-manifest.mjs` after changing any file (Node 20 or newer, no packages); it writes `m.local.json`, which the loader reads first on localhost. On localhost, adding `?dev` to the address (or using Live Server, which is detected automatically because it changes every HTML file) loads files straight from the server without checks.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `newtab.html`, `settings.html`, `paroxysm.css` | The interface (browser shell, Home page, settings page) |
| `games.html` | The Games page and the game player, with a picker between two sources: gn-math (default; catalogue, covers and game pages from the `freebuisness` repos on jsDelivr, games run in a sandboxed iframe) and LuminSDK (loaded from jsDelivr, pinned to a commit) |
| (shell, Home) | `index.html` has the horizontal/vertical tab layouts, the bookmarks bar and the coloured omnibox; `newtab.html` has the shortcuts panel |
| `assistant.html`, `paroxysm-ai.js`, `paroxysm-ai-settings.js` | The AI page (`paroxysm://assistant`; LaTeX equations are shown as real maths; its settings are also in Settings > AI): chat history, Gemma 4 and Gemini (your own free key or an optional shared one), DeepSeek (your own key), Puter models (sign in with a Puter account, no key), and a keyless Quick model sent through the proxy. The engine file holds the providers, usage counter, chat storage, markdown renderer and the Puter bridge |
| `puter-frame.html` | Runs Puter.js (pinned, integrity-checked) in a sandboxed iframe for the AI page's optional Puter models; created only when Puter is used. Its requests can go through the proxy |
| `newtab-bg.js` | The Home page background: React Bits Color Bends ported to plain JavaScript (Three.js from a CDN) |
| `paroxysm-rise.js` | The fade-and-float-in entrance animation on the Home and Settings pages |
| `paroxysm.config.js` | Settings you edit: the encoded wisp server list, the version and the credit strings (developers, game source, AI provider, extensions, UI inspiration) |
| `encode_wisp.py` | Turns a text file of wss:// URLs into the encoded entries for `paroxysm.config.js` |
| `paroxysm-cloak.js` | Tab disguise, panic key and character masking |
| `paroxysm-adapter.js`, `sw-glue.js` | Let paroxysm run from any folder (the site root or a jsDelivr-style path such as `/gh/<owner>/<repo>@<ref>/`): the adapter points the proxy engine at the folder the page is served from and registers `loader-sw.js` instead of `sw.js`; `sw-glue.js` is mirage's fetch glue without `importScripts` |
| `index.svg` | The launcher: opened from disk it races its servers and embeds the winner in a full-window frame; on the server it installs `loader-sw.js` with a progress bar and opens the app. A full-page redirect (`?ld=0`) is only the fallback when the frame can't run a service worker |
| `paroxysm-outer.js` | Inside the launcher's frame: tells the launcher when paroxysm is ready and copies the tab title and icon to the real browser tab (so the tab disguise shows) |
| `loader-sw.js`, `m.json`, `tools/make-manifest.mjs`, `tools/release.mjs` | The service worker: it downloads the files listed in `m.json` from the release's commit, checks each one's SHA-256, serves them from its cache and runs the Scramjet controller's worker code inside itself. `make-manifest.mjs` writes the local test manifest `m.local.json`; `release.mjs` writes `m.json` and publishes |
| `tools/epoxy/` | How `epoxy/index.js` is built: a Docker image, a build script and two small patches to epoxy-tls (Epoxy's HTTP/2 header limit raised from 16 KiB to Chrome's 256 KiB, without which YouTube fails) |
| `paroxysm-transport.js` | Adapter around the Epoxy transport: after a wisp connection drop it reconnects and retries the request (it works from outside epoxy/index.js) |
| `paroxysm-settings.js` | User settings (accent, theme, search engine, sidebar order, cloaking, panic key, wisp choice), stored in localStorage |
| `fonts/`, `assets/` | Inter (variable: latin, cyrillic, cyrillic-ext and greek subsets); logo and icons live in `assets/paroxysm/` |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | Proxy engine. Protected: do not edit (`sw.js` is kept but no longer registered) |
| `protected.sha256`, `verify_protected.py` | Byte-for-byte check of the protected files |
| `licenses/` | Licenses for the bundled font and icons |

Check the protected files at any time with `python verify_protected.py`.

## Troubleshooting

- A proxied tab shows a white page saying `Cannot GET /~/sj/...`: that is the local server answering because the service worker did not route the request (it can happen after a hard reload, Ctrl+Shift+R, followed by a worker restart, or when an updated service worker replaces the old one while paroxysm is open). paroxysm now repairs this on its own: a page the worker does not control reloads itself once, and a proxied page that loaded unserved is retried twice. If it still happens, open the console and look for lines starting with `[paroxysm]`; "Bypass for network" in DevTools > Application > Service workers must be off.
- YouTube used to fail with a `Hyper client ... Http2 ... PROTOCOL_ERROR` error; paroxysm's own Epoxy build fixes that. If it comes back after an engine update, `epoxy/index.js` was probably replaced with the npm file: rebuild it with `tools/epoxy/` instead.
- The whole tab crashes with `STATUS_BREAKPOINT` (or a sad-tab page) on a site: a Chromium bug with view transitions in proxied pages ([Scramjet issue 222](https://github.com/MercuryWorkshop/scramjet/issues/222)). paroxysm skips those transitions on YouTube; if another site does it, its host can be added to `SKIP_TRANSITIONS` in `paroxysm-adapter.js`.
- Menu > Reconnect only replaces the connection to the wisp server; Menu > Find best server picks another server.

## Publishing a release

Releases are signed. Once, run `node tools/keygen.mjs`: it writes the private key to `%USERPROFILE%\.paroxysm\signing-key.json` (keep a backup, never commit it) and prints the public key, which goes into `KEYS` in `loader-sw.js`. The service worker refuses unsigned, tampered or older manifests.

Commit your changes, then run `node tools/release.mjs` (add `--dry-run` to only see what it would do). It checks that the working tree is clean, `main` is up to date and the protected files are unchanged, writes `m.json` pointing at the current commit, commits and pushes it, and asks jsDelivr to refresh its `@main` copies. Files are always downloaded from that exact commit, so they can't be stale; `m.json` itself is read from jsDelivr and GitHub and the newest valid one wins. jsDelivr can take hours to serve a new `loader-sw.js` or `index.svg` from `@main`, so keep those two backward compatible. `index.svg` tries `cdn.jsdelivr.net` first, then `fastly.jsdelivr.net` and `gcore.jsdelivr.net` if it is blocked (each keeps its own settings).

## Configuration

Wisp servers are listed in `paroxysm.config.js`, encoded (run `python encode_wisp.py urls.txt` to make entries; the encoding hides the URLs from a casual look, it is not a secret). They show in Settings > Proxy as "Wisp Server 1", "Wisp Server 2", ...; paroxysm tries the one you picked first and falls back to the rest in order, and you can add your own. The Home background (colours, speed, noise and so on) is the `PROPS` block at the top of `newtab-bg.js`; it uses Three.js from a CDN. Its shaders are the upstream ones, unchanged. Accent, theme, search engine, sidebar order, cloaking, the panic key and the AI settings (keys, Puter account, proxy switch, daily limit) are in Settings (`paroxysm://settings`). The Puter account card signs in with Puter's popup; Puter.js itself runs only in `puter-frame.html`, a sandboxed iframe, and "Send AI requests through the proxy" also sends Puter's chats through the wisp transport (its sign-in window always connects directly).

## Licenses

Scramjet is AGPL-3.0. Inter is SIL OFL 1.1, the icons are from Lucide (ISC), and the Home background is React Bits Color Bends (MIT + Commons Clause, by David Haz); the licenses are in `licenses/`.