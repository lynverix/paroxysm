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
| `index.html`, `newtab.html`, `paroxysm.css` | The interface |
| `fonts/`, `assets/` | Inter Tight (variable, latin) and the placeholder icon |
| `scramjet/`, `controller/`, `epoxy/`, `sw.js` | Proxy engine. Protected: do not edit |
| `protected.sha256`, `verify_protected.py` | Byte-for-byte check of the protected files |
| `licenses/` | Licenses for the bundled font and icons |

Check the protected files at any time with `python verify_protected.py`.

## Settings

The wisp server list is `WISP_SERVERS` near the top of the script in `index.html`. The search engine is the `SEARCH_URL` line next to it.

## Licenses

Scramjet is AGPL-3.0. Inter Tight is SIL OFL 1.1 and the icons are from Lucide (ISC); both licenses are in `licenses/`.
