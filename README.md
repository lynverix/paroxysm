# paroxysm

A web proxy interface built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) with an Epoxy transport over WISP. paroxysm is the continuation of mirage.

Status: UI redesign phase (round 4 delivered, waiting for the baseline re-check). The proxy engine is unchanged from mirage; the single-file `index.svg` launcher is planned and not built yet.

## Run locally

Serve this folder from the root of a local static server and open it in Chrome (service workers do not run from `file://`):

```
python -m http.server 8080
```

then open `http://localhost:8080/`. VS Code Live Server also works.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `newtab.html`, `settings.html`, `paroxysm.css` | The interface (browser shell, Home page, settings page) |
| `games.html`, `music.html`, `ai.html` | Empty pages behind the sidebar links, for later |
| `newtab-bg.js` | The Home page background: React Bits Color Bends ported to plain JavaScript (Three.js from a CDN) |
| `paroxysm-rise.js` | The fade-and-float-in entrance animation on the Home and Settings pages |
| `paroxysm.config.js` | Settings you edit: the encoded wisp server list, the version and the credit strings (developers, game source, AI provider, extensions, UI inspiration) |
| `encode_wisp.py` | Turns a text file of wss:// URLs into the encoded entries for `paroxysm.config.js` |
| `paroxysm-cloak.js` | Tab disguise, panic key and character masking |
| `paroxysm-settings.js` | User settings (accent, theme, search engine, sidebar order, cloaking, panic key, wisp choice), stored in localStorage |
| `fonts/`, `assets/` | Inter (variable, latin); logo and icons live in `assets/paroxysm/` |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | Proxy engine. Protected: do not edit |
| `protected.sha256`, `verify_protected.py` | Byte-for-byte check of the protected files |
| `licenses/` | Licenses for the bundled font and icons |

Check the protected files at any time with `python verify_protected.py`.

## Configuration

Wisp servers are listed in `paroxysm.config.js`, encoded (run `python encode_wisp.py urls.txt` to make entries; the encoding hides the URLs from a casual look, it is not a secret). They show in Settings > Proxy as "Wisp Server 1", "Wisp Server 2", ...; paroxysm tries the one you picked first and falls back to the rest in order, and you can add your own. The Home background (colours, speed, noise and so on) is the `PROPS` block at the top of `newtab-bg.js`; it uses Three.js from a CDN. Its shaders are the upstream ones, unchanged. Accent, theme, search engine, sidebar order, cloaking and the panic key are in Settings (`paroxysm://settings`).

## Licenses

Scramjet is AGPL-3.0. Inter is SIL OFL 1.1, the icons are from Lucide (ISC), and the Home background is React Bits Color Bends (MIT + Commons Clause, by David Haz); the licenses are in `licenses/`.