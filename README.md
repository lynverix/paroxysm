# paroxysm

A web proxy interface built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) with an Epoxy transport over WISP. paroxysm is the continuation of mirage.

Status: UI redesign phase. The proxy engine is unchanged from mirage; the single-file `index.svg` launcher is planned and not built yet.

## Run locally

Serve this folder from the root of a local static server and open it in Chrome (service workers do not run from `file://`):

```
python -m http.server 8080
```

then open `http://localhost:8080/`. VS Code Live Server also works.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `newtab.html`, `settings.html`, `paroxysm.css` | The interface (browser shell, new tab page, settings page) |
| `newtab-bg.js` | The new tab background: a small original WebGL shader, no libraries |
| `paroxysm.config.js` | Settings you edit: the wisp endpoint list (tried in order) and the version |
| `paroxysm-settings.js` | User settings (accent, search engine, background animation), stored in localStorage |
| `fonts/`, `assets/` | Inter Tight (variable, latin); logo and icons live in `assets/paroxysm/` |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | Proxy engine. Protected: do not edit |
| `protected.sha256`, `verify_protected.py` | Byte-for-byte check of the protected files |
| `licenses/` | Licenses for the bundled font and icons |

Check the protected files at any time with `python verify_protected.py`.

## Configuration

Wisp endpoints are listed in `paroxysm.config.js`; paroxysm tries them in order and uses the first that responds. The new tab background (colours, speed, brightness and so on) is the `CONFIG` block at the top of `newtab-bg.js`; it uses Three.js from a CDN. Accent colour, search engine and the animation toggle are in Settings (`paroxysm://settings`).

## Licenses

Scramjet is AGPL-3.0. Inter Tight is SIL OFL 1.1 and the icons are from Lucide (ISC); both licenses are in `licenses/`.