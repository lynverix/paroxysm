# paroxysm

A web proxy interface built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) with an Epoxy transport over WISP. paroxysm is the continuation of mirage.

Status: UI and page work, far along and waiting for feedback. The proxy engine is Scramjet 2.1.0 with controller 0.1.0 and Epoxy transport 3.0.2 (installed as one set on 2026-11-22, unchanged since); the single-file `index.svg` launcher is planned and not built yet (it starts after the user has re-run the baseline checklist).

## Run locally

Serve this folder from the root of a local static server and open it in Chrome (service workers do not run from `file://`). Chrome is the only browser tested:

```
python -m http.server 8080
```

then open `http://localhost:8080/`. VS Code Live Server also works.

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
| `paroxysm-transport.js` | Adapter around the Epoxy transport: after a wisp connection drop it reconnects and retries the request (epoxy/index.js is not modified) |
| `paroxysm-settings.js` | User settings (accent, theme, search engine, sidebar order, cloaking, panic key, wisp choice), stored in localStorage |
| `fonts/`, `assets/` | Inter (variable: latin, cyrillic, cyrillic-ext and greek subsets); logo and icons live in `assets/paroxysm/` |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | Proxy engine. Protected: do not edit |
| `protected.sha256`, `verify_protected.py` | Byte-for-byte check of the protected files |
| `licenses/` | Licenses for the bundled font and icons |

Check the protected files at any time with `python verify_protected.py`.

## Troubleshooting

- A proxied tab shows a white page saying `Cannot GET /~/sj/...`: that is the local server answering because the service worker did not route the request (it can happen after a hard reload, Ctrl+Shift+R, followed by a worker restart). paroxysm now repairs this on its own: a page the worker does not control reloads itself once, and a proxied page that loaded unserved is retried twice. If it still happens, open the console and look for lines starting with `[paroxysm]`; "Bypass for network" in DevTools > Application > Service workers must be off.
- Menu > Reconnect only replaces the connection to the wisp server; Menu > Find best server picks another server.

## Configuration

Wisp servers are listed in `paroxysm.config.js`, encoded (run `python encode_wisp.py urls.txt` to make entries; the encoding hides the URLs from a casual look, it is not a secret). They show in Settings > Proxy as "Wisp Server 1", "Wisp Server 2", ...; paroxysm tries the one you picked first and falls back to the rest in order, and you can add your own. The Home background (colours, speed, noise and so on) is the `PROPS` block at the top of `newtab-bg.js`; it uses Three.js from a CDN. Its shaders are the upstream ones, unchanged. Accent, theme, search engine, sidebar order, cloaking, the panic key and the AI settings (keys, Puter account, proxy switch, daily limit) are in Settings (`paroxysm://settings`). The Puter account card signs in with Puter's popup; Puter.js itself runs only in `puter-frame.html`, a sandboxed iframe, and "Send AI requests through the proxy" also sends Puter's chats through the wisp transport (its sign-in window always connects directly).

## Licenses

Scramjet is AGPL-3.0. Inter is SIL OFL 1.1, the icons are from Lucide (ISC), and the Home background is React Bits Color Bends (MIT + Commons Clause, by David Haz); the licenses are in `licenses/`.