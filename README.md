<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/paroxysm/paroxysm_darkmode_logo.png">
    <img src="assets/paroxysm/paroxysm_lightmode_logo.png" alt="paroxysm" width="420">
  </picture>
</p>

<p align="center">A web proxy that runs from one file. Download it, open it in your browser, and browse.</p>

paroxysm is a full browser inside a browser tab: tabs, bookmarks, an address bar, games and an AI assistant, with every website loaded through an encrypted proxy. There is nothing to install and no account to make. It is the continuation of mirage and is built on [Scramjet](https://github.com/MercuryWorkshop/scramjet).

## Getting started

1. Download [`index.svg`](https://github.com/lynverix/paroxysm/blob/main/index.svg) (on that page, use the download button, "Download raw file").
2. Open the file in Chrome, for example by double-clicking it.
3. The first start downloads about 3 MB and checks every file, which takes a few seconds. After that, paroxysm opens almost instantly.

The address bar keeps showing the file you opened, and paroxysm runs inside it. Your settings, bookmarks and chats are saved in your browser, so they are still there next time.

**Updates are automatic.** When a new version comes out, paroxysm downloads it in the background the next time you open it and uses it the time after that. You never need to download `index.svg` again. Menu > Changelog shows what changed in each version.

paroxysm is made for Chrome. Other Chromium-based browsers such as Edge and Vivaldi also work.

## What you get

- **Browsing through the proxy:** type an address or a search in the address bar. Pages are fetched through a wisp server over an encrypted connection, so the network you are on only sees a connection to that server. YouTube and Discord work.
- **Tabs your way:** horizontal tabs along the top or a sidebar on the left (switch with the layout button), plus back, forward and reload.
- **Bookmarks:** the bookmark icon in the address bar saves a page to the bookmarks bar.
- **Home page:** a search box and shortcut tiles you can add, edit and reorder.
- **Games:** a large library from two sources, gn-math and LuminSDK, with favorites, recent games and a random pick.
- **AI:** a chat assistant with chat history, image input and real maths rendering. The Quick model works without any key, or you can use your own Gemini or DeepSeek key, or sign in with a Puter account.
- **Cloaking:**
  - **Tab disguise** makes the browser tab look like Google Docs, Classroom and other sites.
  - **Panic key** (backtick by default) leaves paroxysm instantly for a page you choose.
  - **Character masking** swaps letters in paroxysm's own text for lookalikes.
- **Make it yours:** named accent colours, dark and light themes, an animated or still Home background, and your choice of search engine (Brave by default, Google, DuckDuckGo, Ecosia or your own).

Everything else is in the Menu (top right) and in Settings.

## Good to know

- **Wisp servers:** paroxysm comes with several built-in wisp servers and picks one that answers. Menu > Reconnect re-opens the connection, and Menu > Find best server switches to the fastest one. In Settings > Proxy you can choose a server or add your own.
- **If a site is blocked:** paroxysm itself loads from jsDelivr and tries other jsDelivr addresses if the first is blocked. Each address keeps its own settings, so after a switch you start fresh.
- **Privacy:**
  - Tab and bookmark icons come from Google's favicon service, which sees the sites you visit.
  - AI keys and the Puter sign-in are stored in your browser. Some other web apps opened from downloaded files could read them, so use keys you can easily replace.
  - Prompts sent to Gemini's free tier may be used by Google, and Quick sends prompts to Pollinations, a third-party service.
- **Saved data:** Menu has buttons to clear bookmarks, game saves and the cookies of sites you visited through paroxysm.

## Troubleshooting

- **A tab shows "Cannot GET /~/sj/..."**: paroxysm usually fixes this by itself within a second or two. If it doesn't, reload the page (F5).
- **The whole tab crashes ("This page is having a problem", `STATUS_BREAKPOINT`, or a sad-tab picture)**: this is a Chrome bug with page-change animations on some sites ([Scramjet issue 222](https://github.com/MercuryWorkshop/scramjet/issues/222)). paroxysm already works around it on YouTube. If another site does it, please report it so it can be added.
- **Nothing loads at all**: try Menu > Find best server. If no wisp server answers, your network may block them; add a server that works for you in Settings > Proxy.
- **paroxysm won't start**: check your connection and press Try again. If your browser won't run paroxysm's service worker inside the file, paroxysm opens its hosted copy instead.

## Credits

paroxysm is built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) and the [Epoxy](https://github.com/MercuryWorkshop/epoxy-tls) transport by Mercury Workshop. It continues mirage, and its look is inspired by Fern and Refract. Games come from gn-math and LuminSDK. AI answers come from Pollinations, Google Gemini, DeepSeek and Puter. The typeface is [Inter](https://rsms.me/inter/), the icons are from [Lucide](https://lucide.dev), and the Home background is Color Bends from [React Bits](https://reactbits.dev) by David Haz.

## For developers

### Running locally

Serve the project folder from the root of a static server and open it in Chrome; service workers don't run from `file://`.

```
python -m http.server 8080
```

Then open `http://localhost:8080/`. VS Code Live Server also works.

paroxysm's service worker (`loader-sw.js`) only serves files whose SHA-256 matches the manifest. After changing a file, run `node tools/make-manifest.mjs` (Node 20 or newer, no packages); it writes `m.local.json`, which the worker reads first on localhost. Adding `?dev` to the address loads files straight from the server without checks. Live Server is detected and uses dev mode automatically, because it changes every HTML file it serves.

### Project layout

| Path | What it is |
|---|---|
| `index.svg` | The launcher. Opened from disk, it races its servers and embeds the winner in a full-window frame. On the server, it installs `loader-sw.js` and opens the app. A full-page redirect (`?ld=0`) is only the fallback when the frame can't run a service worker |
| `index.html`, `newtab.html`, `settings.html`, `paroxysm.css` | The browser shell, the Home page, Settings and all shared styles |
| `games.html`, `assistant.html`, `changelog.html` | The Games, AI and Changelog pages |
| `paroxysm-changelog.js` | The changelog entries, newest first. Add one entry per version: version, date, a short summary and `[kind, text]` changes (`added`, `improved`, `fixed`, `removed`). Keep `version` in `paroxysm.config.js` equal to the newest entry |
| `paroxysm-ai.js`, `paroxysm-ai-settings.js`, `puter-frame.html` | The AI engine (providers, usage, chat storage, markdown and maths), its settings cards, and the sandboxed frame that runs Puter.js |
| `paroxysm.config.js` | The encoded wisp server list, the version and the credit lines shown in Settings > About |
| `paroxysm-settings.js`, `paroxysm-cloak.js`, `paroxysm-rise.js`, `newtab-bg.js` | Settings storage, cloaking, the entrance animation and the Home background (Color Bends, Three.js from a CDN; its `PROPS` block holds the colours and speed) |
| `loader-sw.js`, `m.json` | The service worker and the signed release manifest. The worker downloads each release's files from their exact commit, checks them, serves them from its cache and runs the Scramjet controller's worker code inside itself |
| `paroxysm-adapter.js`, `sw-glue.js`, `paroxysm-transport.js`, `paroxysm-outer.js` | Small layers around the engine: run from any folder, register `loader-sw.js`, skip view transitions on YouTube, reconnect after a wisp drop, and pass the tab title and icon to the launcher |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | The proxy engine: Scramjet 2.1.0, controller 0.1.0 and Epoxy transport 3.0.2. These files are not edited; `python verify_protected.py` checks them against `protected.sha256` |
| `tools/` | `make-manifest.mjs` (local test manifest), `release.mjs` (publishing), `keygen.mjs` (signing key), and `epoxy/`, which rebuilds `epoxy/index.js` |
| `encode_wisp.py` | Turns a text file of `wss://` URLs into entries for `paroxysm.config.js` |
| `fonts/`, `assets/`, `licenses/` | Inter, the paroxysm logo and icons, and third-party licences |

### Wisp servers

The built-in list is in `paroxysm.config.js`. Make entries with `python encode_wisp.py urls.txt`. The encoding only hides the URLs from a casual look; it is not a secret.

### Publishing a release

Releases are signed, and the service worker refuses unsigned, tampered or older manifests.

1. Once: run `node tools/keygen.mjs`. It writes the private key to `%USERPROFILE%\.paroxysm\signing-key.json` and prints the public key, which goes into `KEYS` in `loader-sw.js`. Keep a backup of the key and never commit it.
2. Each release: add a changelog entry, set the version, commit, then run `node tools/release.mjs`. Add `--dry-run` first to see what it would do.

The release tool checks that the working tree is clean, `main` is up to date and the engine files are unchanged. It then writes `m.json` pointing at the current commit, commits and pushes it, and asks jsDelivr to refresh. Users get the release on their next start.

jsDelivr can take hours to serve a new `loader-sw.js` or `index.svg`, so keep those two compatible with the previous release.

### The Epoxy build

`epoxy/index.js` is the Epoxy transport rebuilt with Chrome's HTTP/2 header limit (256 KiB instead of 16 KiB). Without it YouTube fails with `Http2 ... PROTOCOL_ERROR`. Don't replace it with the npm file; rebuild it with the Docker setup and patches in `tools/epoxy/`.

## Licences

Scramjet and Epoxy are AGPL-3.0; the Epoxy patches and build script in `tools/epoxy/` are the modified source. Inter is SIL OFL 1.1, Lucide is ISC, and React Bits Color Bends is MIT + Commons Clause. The licence texts are in `licenses/`.
