<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/paroxysm/paroxysm_darkmode_logo.png">
    <img src="assets/paroxysm/paroxysm_lightmode_logo.png" alt="paroxysm" width="420">
  </picture>
</p>

<p align="center">A whole browser in one file. Download it, open it, and go.</p>

paroxysm is a web proxy that feels like a normal browser: tabs, bookmarks, an address bar, a pile of games and an AI to chat with. Every site you visit goes through an encrypted proxy, so the network you're on only sees you talking to one server. You don't install anything and you don't need an account.

It grew out of an older project called mirage and runs on [Scramjet](https://github.com/MercuryWorkshop/scramjet).

## Getting started

1. Grab [`index.svg`](https://github.com/lynverix/paroxysm/blob/main/index.svg). On that page, hit the download button ("Download raw file").
2. Open the file in Chrome. Double-clicking it usually does the trick.
3. Give it a few seconds the first time. paroxysm downloads about 3 MB and checks every file before it starts. After that it opens almost instantly.

Your address bar will keep showing the file you opened; paroxysm lives inside it. Your settings, bookmarks and chats stay in your browser, so they'll be waiting for you next time.

You'll never need to download it again. When there's a new version, paroxysm quietly fetches it in the background and switches to it the next time you open it. Curious what changed? Open the menu and pick **Changelog**.

paroxysm is made for Chrome, but Edge and Vivaldi work too.

## What's inside

- **Browse anything.** Type an address or a search into the address bar, just like you're used to. YouTube and Discord work.
- **Tabs how you like them.** Along the top or down the side; the layout button switches between the two.
- **Bookmarks.** Tap the bookmark icon in the address bar and the page lands on your bookmarks bar.
- **A Home page that's yours.** A search box and shortcut tiles you can add, edit and drag around.
- **Games.** A big library from gn-math and LuminSDK, with favorites, your recent games and a dice button for when you can't decide.
- **An AI to talk to.** Ask questions, send pictures, get maths written out properly. The Quick model works right away with no key. If you want more, bring your own Gemini or DeepSeek key, or sign in with a Puter account.
- **Cloaking.**
  - **Tab disguise** makes your tab look like Google Docs, Classroom or another site.
  - **Panic key** (backtick by default) whisks you off to a page of your choice in an instant.
  - **Character masking** swaps letters in paroxysm's own text for lookalikes.
- **Make it look right.** Pick an accent colour, dark or light theme, an animated or still Home background, and your search engine (Brave, Google, DuckDuckGo, Ecosia or your own).

Everything else lives in the menu (top right) and in Settings.

## Good to know

- **Connection trouble?** paroxysm comes with several servers and uses the first one that answers. If things feel slow or stuck, try **Reconnect** or **Find best server** in the menu. You can also pick a server yourself, or add your own, in Settings > Proxy.
- **Blocked network?** paroxysm loads from jsDelivr and tries other jsDelivr addresses if the first one is blocked. Each address keeps its own settings, so you'll start fresh after a switch.
- **Your privacy, honestly:**
  - Tab and bookmark icons come from Google's favicon service, so Google sees which sites they're for.
  - AI keys and your Puter sign-in are saved in your browser. Other web apps opened from downloaded files could read them, so use keys you can easily replace.
  - Google may use prompts sent to Gemini's free tier, and Quick sends your prompts to Pollinations, a third-party service.
- **Cleaning up.** The menu can clear your bookmarks, your game saves, and the cookies of sites you visited through paroxysm.

## When something goes wrong

- **A tab says "Cannot GET /~/sj/..."**: paroxysm usually sorts this out on its own within a second or two. If it doesn't, press F5.
- **The whole tab crashes** ("This page is having a problem", `STATUS_BREAKPOINT`, or a sad-tab picture): that's a Chrome bug with page animations on some sites ([Scramjet issue 222](https://github.com/MercuryWorkshop/scramjet/issues/222)). paroxysm already works around it on YouTube. If you hit it somewhere else, let us know so we can add that site.
- **Nothing loads at all**: try **Find best server** in the menu. If none of the servers answer, your network may block them; adding one that works for you in Settings > Proxy can help.
- **paroxysm won't start**: check your connection and press **Try again**. If your browser won't let paroxysm run inside the file, it opens its online copy instead.

## Thanks

paroxysm stands on the shoulders of [Scramjet](https://github.com/MercuryWorkshop/scramjet) and the [Epoxy](https://github.com/MercuryWorkshop/epoxy-tls) transport by Mercury Workshop. It carries on from mirage, and its look takes inspiration from Fern and Refract. Games come from gn-math and LuminSDK. AI answers come from Pollinations, Google Gemini, DeepSeek and Puter. The typeface is [Inter](https://rsms.me/inter/), the icons are [Lucide](https://lucide.dev), and the Home background is Color Bends from [React Bits](https://reactbits.dev) by David Haz. Thanks also to x8rr's [scramjet-templates](https://github.com/x8rr/scramjet-templates).

## For developers

Want to poke around, run your own copy or help out? Here's how it fits together.

### Running it locally

Serve the project folder from the root of any static server and open it in Chrome (service workers don't run from `file://`):

```
python -m http.server 8080
```

Then visit `http://localhost:8080/`. VS Code's Live Server works too.

The service worker (`loader-sw.js`) only serves files whose SHA-256 matches the manifest. After you change a file, run `node tools/make-manifest.mjs` (Node 20 or newer, no packages needed); it writes `m.local.json`, which the worker reads first on localhost. If you'd rather skip the checks while you work, add `?dev` to the address. Live Server switches to dev mode on its own, because it changes every HTML file it serves.

### How the project is laid out

| Path | What it is |
|---|---|
| `index.svg` | The launcher. Opened from disk, it races its servers and embeds the winner in a full-window frame. On the server, it installs `loader-sw.js` and opens the app. A full-page redirect (`?ld=0`) is only the fallback when the frame can't run a service worker |
| `index.html`, `newtab.html`, `settings.html`, `paroxysm.css` | The browser shell, the Home page, Settings and the shared styles |
| `games.html`, `assistant.html`, `changelog.html` | The Games, AI and Changelog pages |
| `paroxysm-changelog.js` | The changelog, newest first. Each version gets one entry: version, date, a short summary and `[kind, text]` changes (`added`, `improved`, `fixed`, `removed`). Keep `version` in `paroxysm.config.js` equal to the newest entry |
| `paroxysm-ai.js`, `paroxysm-ai-settings.js`, `puter-frame.html` | The AI engine (providers, usage, chat storage, markdown and maths), its settings cards, and the sandboxed frame that runs Puter.js |
| `paroxysm.config.js` | The encoded wisp server list, the version and the credit lines in Settings > About |
| `paroxysm-settings.js`, `paroxysm-cloak.js`, `paroxysm-rise.js`, `newtab-bg.js` | Settings storage, cloaking, the entrance animation and the Home background (Color Bends with Three.js from a CDN; its `PROPS` block holds the colours and speed) |
| `loader-sw.js`, `m.json` | The service worker and the signed release manifest. The worker downloads each release's files from their exact commit, checks them, serves them from its cache and runs the Scramjet controller's worker code inside itself |
| `paroxysm-adapter.js`, `sw-glue.js`, `paroxysm-transport.js`, `paroxysm-outer.js` | Small layers around the engine: run from any folder, register `loader-sw.js`, skip view transitions on YouTube, reconnect after a wisp drop, and pass the tab title and icon to the launcher |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | The proxy engine: Scramjet 2.1.0, controller 0.1.0 and Epoxy transport 3.0.2. Leave these alone; `python verify_protected.py` checks them against `protected.sha256` |
| `tools/` | `make-manifest.mjs` (local test manifest), `release.mjs` (publishing), `keygen.mjs` (signing key) and `epoxy/` (rebuilds `epoxy/index.js`) |
| `encode_wisp.py` | Turns a text file of `wss://` URLs into entries for `paroxysm.config.js` |
| `fonts/`, `assets/`, `licenses/` | Inter, the paroxysm logo and icons, and third-party licences |

### Wisp servers

The built-in list is in `paroxysm.config.js`. To make new entries, run `python encode_wisp.py urls.txt`. The encoding only keeps the URLs from being read at a glance; it isn't a secret.

### Publishing a release

Releases are signed, and the service worker refuses anything unsigned, tampered with or older than what it has.

1. Once: run `node tools/keygen.mjs`. It saves the private key to `%USERPROFILE%\.paroxysm\signing-key.json` and prints the public key, which goes into `KEYS` in `loader-sw.js`. Back the key up and never commit it.
2. Every release: add a changelog entry, bump the version, commit, then run `node tools/release.mjs`. Try `--dry-run` first to see what it would do.

The release tool makes sure the working tree is clean, `main` is up to date and the engine files are untouched. Then it writes `m.json` pointing at the current commit, commits and pushes it, and asks jsDelivr to refresh. People get the new version the next time they open paroxysm.

One thing to watch: jsDelivr can take hours to serve a new `loader-sw.js` or `index.svg`, so keep those two compatible with the previous release.

### The Epoxy build

`epoxy/index.js` is the Epoxy transport rebuilt with Chrome's HTTP/2 header limit (256 KiB instead of hyper's 16 KiB); without it YouTube fails with `Http2 ... PROTOCOL_ERROR`. Please don't swap it for the npm file. To rebuild it, start Docker and run this from Git Bash in the project folder (use Windows paths for `-v`):

```
docker build -t paroxysm-epoxy tools/epoxy
MSYS_NO_PATHCONV=1 docker run --rm -v "<project>\tools\epoxy:/p:ro" -v "<output folder>:/out" -v epx-src:/src -v epx-cargo:/root/.cargo/registry -v epx-git:/root/.cargo/git paroxysm-epoxy bash /p/build.sh
```

The first run takes about five minutes. It prints the hash of npm's original rebuilt from source (it should be `55ac6bb8…`) and of the new `/out/index.js` (`a436e3cb…` with the current patches). After replacing `epoxy/index.js`, update its line in `protected.sha256`.

## Licences

Scramjet and Epoxy are AGPL-3.0; the Epoxy patches and build script in `tools/epoxy/` are the modified source. Inter is SIL OFL 1.1, Lucide is ISC, and React Bits Color Bends is MIT + Commons Clause. You'll find the licence texts in `licenses/`.
