# PROJECT_STATUS.md — paroxysm current development status

Snapshot: 2026-11-22 (character masking fixed and approved; gn-math games source added; Menu button is next). Written from an inspection of the project files; the earlier snapshot was 2026-11-13. If anything here disagrees with the actual files, the files win; tell the user and fix this document.

## 1. Where we are

| Phase / milestone | State |
|---|---|
| M0 feasibility spike (jsDelivr, file://, worker features) | **Done.** User ran it; results in section 6. |
| M1 untouched mirage baseline checklist | **Done.** User ran it; results in section 6. |
| M2 UI redesign and page work (first substantial development phase) | **Rounds 1 to 6 delivered.** Round 6 corrected the character masking; extension support (Sapphire with built-in uBlock Origin Lite) was built, measured as slowing every page load, and removed again on 2026-11-19. Waiting for the user's feedback. |
| M3 verification gate (user re-runs the baseline checklist on the redesigned UI) | **Not done.** The user has not reported checklist results for any redesigned build. |
| M4 subpath + iframe-embedding spike, M5 adapter, M6 loader worker, M7 SVG loader, M8 release tooling, M9 hardening (ECDSA) | **Not started.** Nothing SVG- or Service-Worker-related is implemented, by design, until M3 passes. |

Currently being worked on: nothing open. Done 2026-11-22: the character masking appearance fix (approved by the user) and the gn-math games source (section 7). Next, in the user's order: (1) the small Menu button task, (2) the AI page, (3) the M3 baseline checklist on the finished build. The user has said there are more plans than these two; ask for the full list before starting M3.

## 2. Completed

- Research and architecture proposal (`RESEARCH_AND_ARCHITECTURE.md`), and the user's approvals of it (section 8).
- M0 spike (`paroxysm-spike.zip`, throwaway repo `lynverix/paroxysm-spike` created by the user) and its analysis.
- M1 baseline package (`mirage-baseline.zip`: the user's mirage with only the WISP list changed, plus `protected.sha256`, `verify_protected.py`, `baseline-checklist.md`).
- UI redesign round 1 (vertical tabs, near-black theme, tokens, Inter Tight, inline Lucide icons, pill notification instead of the WISP status dot, relative paths A1, address-bar pattern from the controller prefix A2).
- UI redesign round 2 (Fern-like layout, purple accent, Settings as a real tab with Appearance/Search/Proxy/About, ordered WISP fallback, resizable and collapsible rail, Three.js new tab background with editable `CONFIG`, logo/icon wiring, fully rounded shapes, solid-accent selection). Then a small fix: the Settings tab icon is built in code, so `assets/settings.svg` is no longer needed.
- Round 6 (2026-11-17 to 19): character masking corrected to mask paroxysm's own interface (not proxied pages) live. Extension support (Sapphire, built-in uBlock Origin Lite) was built, measured as slowing every page load, and removed again (section 7); every engine and service-worker file is back to mirage's original.
- UI redesign round 4: fully rounded rail and settings items, Settings without the accent colour, named accents, Light/Dark theme, sidebar with Games/AI plus a reorder setting, search engine picker (Brave default), wisp servers named not shown, encoded, add custom and pick manually, Cloaking (tab disguise, character masking, panic key), tinted text colours, build ID removed, credit strings in config.
- UI redesign round 3 (section 7): Fern-like Settings page and shell, Inter, `#ae72df` accent with accent-tinted surfaces, Home tab, menu icon, ColorBends background fixed, entrance animation, white-flash fix.
- Handoff documents (this set).

## 3. Not finished

- The M3 verification gate.
- Everything in the SVG/Service Worker phase: iframe-embedding spike, subpath test, adapter (A3 `register` shim), loader worker, SVG loader, release tooling (`make-manifest`), GitHub/jsDelivr publishing of the real app, hardening.
- None of the WISP endpoint URLs besides `api.scvmath.org` has been tested by Claude (the config now lists nine).
- Light-mode assets are unused (no light theme exists).

## 4. Files

**Current project tree** (the user's local folder is the source of truth; this is what Claude last built, then the user adds the logo files):

```
paroxysm/
├─ index.html              shell: toolbar, vertical tab rail, frames, pill; inline script = mirage's script + asserted edits
├─ newtab.html             Home page: logo, search pill, Color Bends background (Three.js from CDN, pinned 0.128.0 + integrity hash)
├─ settings.html           Settings page: Appearance, Search, Proxy, About
├─ paroxysm.css            all styles; accent/spacing/shape tokens at the top
├─ newtab-bg.js            React Bits Color Bends ported to plain JS; upstream shaders verbatim; PROPS block at the top
├─ paroxysm-rise.js        staggered fade-and-float-in entrance for Home and Settings (data-rise)
├─ paroxysm.config.js      encoded wispServers, version, credit strings (developers, gameSource, aiProvider, extensions, uiInspiration)
├─ encode_wisp.py          makes the encoded wisp entries from a text file of URLs
├─ paroxysm-cloak.js       tab disguise, panic key, character masking (shell only)
├─ games.html              Games page and player (LuminSDK, headless; pinned commit + SRI)
├─ ai.html                 empty page for the AI sidebar link
├─ paroxysm-settings.js    user settings in localStorage (accent, search engine, animated background)
├─ sw.js                   PROTECTED (mirage's, unchanged)
├─ scramjet/ controller/ epoxy/   PROTECTED (unchanged)
├─ protected.sha256, verify_protected.py   hash check of the protected files
├─ fonts/                  inter-{latin,cyrillic,cyrillic-ext,greek}-wght-normal.woff2
├─ licenses/inter-OFL.txt, lucide-ISC.txt, react-bits-MIT-CommonsClause.txt
├─ assets/paroxysm/        user-provided logo/icon files: paroxysm_{lightmode,darkmode}_{favicon.ico,icon.png,logo.png}
└─ README.md
```

**Relative to the original mirage ZIP**
- Created: `paroxysm.css`, `settings.html`, `newtab-bg.js`, `paroxysm.config.js`, `paroxysm-settings.js`, `fonts/`, `licenses/`, `protected.sha256`, `verify_protected.py`, `assets/paroxysm-icon.svg`.
- Modified: `index.html` (markup rewritten; script edited, see below), `newtab.html` (rewritten), `README.md` (rewritten).
- Deleted: `styles.css`, `assets/mirage_logo_black.png`, `assets/mirage_logo_white.png`, `assets/miragefavicon.ico`, `assets/miragefaviconbutpng.png`. (`assets/settings.svg` existed briefly and was removed.)
- Moved: none.
- Unchanged and verified: all protected files (`python verify_protected.py` printed `ALL PROTECTED FILES UNCHANGED` on the final build).
- Out of scope for v1 (exist in mirage's git history only, deleted in the ZIP): `ai.html`, `arcade.html`, `music.html`, `worker/ai-proxy.js`, `models_dump.json`.

**Edits to the original `index.html` script** (everything else is verbatim): lucide runtime calls removed; `WISP_SERVERS` built from `paroxysm.config.js`; new constants (`LOCAL_SCHEME`, `LOCAL_PAGES`, `SETTINGS_URL`, `DEFAULT_FAVICON`, `SETTINGS_FAVICON`); status dot replaced by `showPill`/`hidePill` and a `setStatus` mapper; server-picker dialog replaced by `findWispServer`, an `init` wrapper, `checkConnection`, `testAll`, `findBestServer` and the `window.paroxysm` API used by `settings.html`; search URL from `paroxysmSettings.searchUrl`; tab markup/icons/titles/relative `newtab.html` path; `openSettings()` (singleton Settings tab); `proxiedUrlPattern()` (A2); `paroxysm://` internal pages (`newtab`, `settings`) in `go()`; queueing of a URL typed before a wisp server is ready; favicon error fallback; rail collapse and drag-to-resize with remembered state (localStorage keys `paroxysm:rail-collapsed`, `paroxysm:rail-width`; settings key `paroxysm:settings`); `[mirage]` log tags renamed `[paroxysm]`. Verified byte-identical to the original: `probeWisp`, the `Controller` construction, the service worker wait, the `register("/sw.js")` bootstrap block, `isUrl`/`norm`; `init()` differs only in its two log tags and in the internal-page check (`"mirage://"` became the `LOCAL_SCHEME` constant, i.e. `paroxysm://`); its probing, transport and controller logic is untouched.

**Round 3 changes to `index.html`'s script** (all outside the protected logic, which was re-checked byte-identical): `HOME_URL` and `LOCAL_PAGES` now include `home` (`newtab` kept as an alias); `iconNameFor`, `syncOmnibox`, `setTabIcon` (Lucide icon in the tab and omnibox); `watchFrame` (hide on `pagehide`, fade in on `load`); `about()` also returns `build`; the go button and its handler were removed; the favicon fallback is a globe icon, not the paroxysm logo. `DEFAULT_FAVICON` and `SETTINGS_FAVICON` were removed.

**Delivery history** (Claude delivered individual files, newest wins): `paroxysm.zip` (round 1, before the "no ZIP" preference), `files/` (round 2 first pass), `files2/` (round 2 complete: index, newtab, settings, css, newtab-bg, config, settings store, README), `files3/index.html` (data-URI Settings icon), round 3 (2026-11-14: `index.html`, `newtab.html`, `settings.html`, `paroxysm.css`, `newtab-bg.js`, `paroxysm-rise.js`, `paroxysm.config.js`, `paroxysm-settings.js`, `fonts/inter-latin-wght-normal.woff2`, `licenses/`, README, CLAUDE.md, this file). Round 3 markers: `paroxysm.css` contains `--r-tab`; `paroxysm.config.js` contains `build:`; `newtab-bg.js` contains `uBandWidth`; `paroxysm-rise.js` exists. If the user's local copy might be mixed, check for these markers: `index.html` contains `SETTINGS_FAVICON = "data:image/svg+xml,"`; `paroxysm.css` contains `--rail-default`; `settings.html` contains `sec-proxy`; `paroxysm.config.js` exists.

## 5. Bugs, errors and unresolved issues

Pre-existing in mirage (reproduced on the untouched baseline, not caused by the redesign):
- **B4** Wikipedia article pages reload repeatedly (a Wikipedia script warning, `movePinnableElement`, is only noise). Cause unknown; possibly a Scramjet alpha.1 issue.
- **B8** `httpbin.org/cookies/set?a=1` fails with Scramjet's "attempted to fetch from same origin" error; the page ends at `localhost/httpbin.org/cookies/set?a=1`. mirage's `norm()`/`isUrl()` were checked and are not the cause. Possibly a redirect-handling problem.
- **B10** YouTube loads but video playback fails with an Epoxy/hyper HTTP/2 `PROTOCOL_ERROR`; likely transport or the public WISP server.
- Console noise: `l -> h unrewriteurl: unexpected url .../newtab.html` (harmless message about the local new tab page).

Introduced or open on our side:
- **Unverified in a real browser:** the Three.js script's integrity hash against the live jsDelivr file (computed from the npm package; jsDelivr was unreachable from Claude's sandbox). If it fails, the new tab shows a plain gradient and the console shows an integrity error.
- The six logo/icon files were never seen by Claude. Sizes: logo 2000×512 shown at up to 420 px wide, icons 512×512; padding inside the logo canvas may need a size tweak. The logo has a text fallback.
- Tab icons still come from Google's favicon service (sends visited domains to Google; kept deliberately by the user; falls back to a globe icon if blocked).
- `index.html`'s `message` listener (inherited from mirage) accepts messages from any origin, and `window.paroxysm` is a same-origin API on the shell; whether proxied pages could reach either was not tested.
- After "Find best server" re-initialises, tabs that already have a frame keep their old controller (inherited behaviour of mirage's old server switching).
- Worst case with every wisp endpoint dead: about 5 s per endpoint per retry round (cap in `findWispServer`).
- Only Google search is tested; DuckDuckGo needs a newer Scramjet (alpha.2 has URL errors, fix is in upstream `main`, 2.1.0 not released as of 2026-11-13).
- Round 3 has only been checked in Claude's headless Chrome (below). Open questions about it are in section 8.

- **Known, not fixed (found in Claude's tests with a local wisp server; please check in a real Chrome):** in one tab, going proxied page -> a local page (Settings, Games...) -> the same proxied address again does not load (a different address loads fine). It was also reproduced with the Sapphire bundle blocked, and again after Sapphire was removed, so it is in the shell's frame handling (the local-page branch of `go()` sets `tab.frame = null` and later `attachFrame` creates a second frame on the same iframe), not in Sapphire. Giving the tab a fresh iframe element did not fix it.


## 6. Tests and actual results

**M0 spike, run by the user on Chrome 156 / Windows** (JSON saved by the user):
- `file://`: `navigator.serviceWorker` exists, `isSecureContext` true, origin `null`; `register()` fails ("The URL protocol of the current origin ('null') is not supported"). A WebSocket to `wss://api.scvmath.org/wi/` opened and received 9 bytes.
- jsDelivr copy (`cdn.jsdelivr.net/gh/lynverix/paroxysm-spike@main/`): SVG served as `image/svg+xml`, no CSP; worker script `application/javascript`; `cache-control: public, max-age=604800, s-maxage=43200`. Worker registered at the subpath scope; `new Function()` and indirect `eval` allowed in the worker; `importScripts()` after install blocked; worker-synthesized `text/html` worked for fetch and as a top-level page (`controlled: true`); a `~/sj/.../https://...` path was intercepted; WISP WebSocket opened. Not tested: GitHub Pages as a home, loading the jsDelivr page **in an iframe from a `file://` SVG** (needed next), service worker idle restarts.
- Separately confirmed by Claude: `raw.githubusercontent.com` sends `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` on SVG and `access-control-allow-origin: *`.

**Baseline checklist on the untouched mirage (WISP list changed to `api.scvmath.org/wi/`), run by the user:** pass: B0 worker active, B1 WISP connected, B2 example.com, B3 search (captcha page first, then Google), B5 address-bar sync, B6 back/forward/reload, B7 multiple tabs, B11 worker restart recovery, B12 page reload, B13 server picker, B14 new tab page. Fail (pre-existing): B4, B8. B10 loads then video fails. B9 inconclusive (the site used showed an HTTP echo, not a WebSocket test). B15 noise above. Used Live Server (port 5500) and Python (port 8080) with the same results.

**Redesign tests run by Claude (headless Chrome in its sandbox, using mocked WebSocket endpoints, dummy placeholder logo images, and Three.js served from the npm package through request interception):** layout renders; Inter Tight loads; no external requests except the Three.js URL; ordered fallback picked endpoint 3 after endpoints 1 and 2 failed (tried in array order); Settings opens as a tab, a second click focuses it, and the rail Settings button is not highlighted; accent swatch change updates the shell's `--accent`; Bing selection changes `searchUrl()`; Proxy "Test all endpoints" shows per-endpoint results; About shows version `0.1.0`, Scramjet `2.0.67-alpha.1`, controller `0.0.13`; rail drag-resize works and a quick second press resets to 216 px; collapse works; the Three.js background renders and the logo image loads; URL typed before ready shows the "still connecting" pill and queues; no uncaught page errors.

**Round 4 tests run by Claude (same headless Chrome setup):** sidebar order and reordering; Games opens as a tab with the right omnibox icon; `paroxysm.servers()` returns names only; adding an invalid, valid and duplicate custom server; picking an unreachable server leaves the current one and the preference unchanged; removing custom and built-in servers; tab disguise changes title and icon; character masking at 0, 50, 100 and back to 0 percent on a same-origin stand-in frame (text in textarea and script untouched, page updates masked); the panic key navigates the top window to the chosen URL; Settings and Home render in dark and light with the accent-coloured Color Bends background; the encoded wisp list decodes to the original nine URLs; protected files and protected `index.html` blocks unchanged.

**Round 3 tests run by Claude (headless Chrome with SwiftShader WebGL in its sandbox, mocked/blocked network, Three.js from the npm package; plus jsdom):** Home renders with the Color Bends background and the user's real logo; `newtab-bg.js` shaders are byte-identical to upstream and every declared uniform is set from JS; Settings renders, the section nav, "Search settings" filter and the inset accent scrollbar work; the version and build ID show in the footer and About; hovering an inactive tab gives `rgba(174, 114, 223, 0.16)`; the omnibox and tab icon change between house and settings; the iframe class sequence on reload is hidden then shown; no page errors; `verify_protected.py` prints `ALL PROTECTED FILES UNCHANGED` and the protected blocks of the `index.html` script are byte-identical to the previous build.

**Round 4, tested by the user in their own Chrome (reported 2026-11-15, all fine):** character masking and the panic key on real proxied pages, picking a reachable wisp server, the tab disguise. **Still open:** the light theme on proxied sites (idea: make sites see a light colour scheme / a different client fingerprint; brainstorm pending).

**Round 5 (2026-11-16), items 1 to 4 of the user's list:** top bar 46 px with the paroxysm icon (theme file) at the far left; omnibox with cosmetic colouring (no https://, bright domain, gray rest; the real address is untouched); horizontal tabs as the default with a layout button to switch to the sidebar (New tab button moves into the top bar, no collapse button in horizontal); Home shortcuts panel (sites then system pages last, add/edit/remove/reorder, system pages locked); bookmarks (icon in the omnibox, bookmarks bar, rename/delete/reorder). Tested by Claude in headless Chrome: default horizontal layout, switching and persistence across a reload, icon follows the theme, omnibox colouring and focus behaviour, bookmark add/remove/rename/open/toggle, shortcuts defaults and order, add, edit mode, remove (sites only), system-page shortcut opens the Games tab, a site shortcut navigates, the brand icon reuses the existing Home tab, and the Games flow still works in the sidebar layout. **Not tested:** real favicons (the sandbox blocks the Google service; letter and globe fallbacks were seen), dragging to reorder with a real mouse (the logic is plain HTML5 drag and drop), very many tabs in the horizontal strip. **Item 5 (Sapphire, extensions and uBlock Origin) was built later and then removed again; see section 7.**

**Games (2026-11-15):** built from the LuminSDK docs (headless mode: `getGames`, `getRandomGames`, `getImageUrl`, `getGameUrl`; game links are single use, so every player load asks for a fresh one). The SDK file is pinned to commit `e1107337f26529e032d7873cbbb310d485d5d403` with `sha384-SgXJY217C22inNWfmmJ3ffxB1rIh4BmSkT9PDfvMqXoNI1p/td9wKrAjt8SboUHv`; to update it, change both in `games.html`. Tested by Claude **only against a mock SDK** (LuminSDK's servers are not reachable from Claude's sandbox): sidebar, Browse/Recents/Favorites with counts, load more, search, heart on cards and in the player (kept in sync), opening a game in a new tab named after it with the `?g=` URL, player layout, Back focusing the Games tab without closing the game tab, other games replacing the game in the same tab, dice, the SDK-failure message and light theme. **Not tested:** the real catalogue, real covers, real games, fullscreen on a real game, whether Lumin's backend and game hosts are reachable from a restricted network (they are not proxied; a "play through the proxy" mode is a possible later step).

**Games, user test (2026-11-16):** the real catalogue and covers load, and favorited games keep their covers. Opening a game did not work: the tab URL changed but the page showed the Games grid again, and reloading did not help. Suspected cause (not confirmed against the real SDK): `games.html` only accepted ids made of letters, digits and `_ . ~ -`, and fell back to the grid for anything else (a real id with an apostrophe, a space and so on). The check is removed (an id is only passed to the SDK and shown as text). The player now also shows errors on screen with the game id, logs to the console, has a Reload button (asks for a fresh single-use link) and a "still loading" hint after 20 s. Re-tested with a mock that has awkward ids (apostrophe, slash, space, hash, accents, percent). **Awaiting the user's retest.** The console message `googletagmanager.com ... ERR_BLOCKED_BY_CLIENT` is the SDK's analytics script being blocked by the user's own extension and is harmless.

**Manga and Movies (2026-11-15):** a Manga page was built and then removed at the user's request; Movies was declined (x8rr/movies scrapes unauthorized streaming providers). **Music:** the user dropped the Music page; x8rr/music is not wanted either (it rips YouTube audio with yt-dlp, caches it in R2 and uses baked-in Tidal credentials; Claude declined to set it up or host it). Direction under discussion: reuse the user's own tempo.html (bring-your-own-music player, IndexedDB, folder import, playlists, metadata editing) as the Music page, optionally with a launcher to official streaming sites opened through the proxy. The only hosts the app should depend on are jsDelivr and the wisp server. **Light theme on proxied sites:** works, reported by the user (setting `color-scheme` on the shell is passed to the frames; no fingerprint change is needed). Sapphire stays deferred (see section 7).

**Not tested by anyone:** the entrance animation as it looks in motion (only that the classes are applied); the white-flash fix on real proxied pages (only the hide/show logic on a local page); real proxying (page loads, cookies, WebSockets, video) on **any redesigned build**; the real wisp endpoints beyond `api.scvmath.org`; the live Three.js integrity check; persistence across browser restarts; behaviour in the user's real Chrome of the resize handle and Settings page.

**Round 6 tests run by Claude:** character masking: with the slider at 100% the shell's tab titles and the Settings page were masked, a stand-in for a proxied page was untouched, text changed afterwards was masked, Settings search still matched what was typed, and 0% restored everything. **Sapphire experiment (2026-11-17 to 19), kept as history:** with a local wisp server and test site it installed extensions, ran content scripts and blocked requests with declarativeNetRequest, and uBlock Origin Lite's popup rendered; it was never confirmed to block real ads (no internet in the sandbox). Timing a test page with 150 sub-requests (one run each, in Claude's slow sandbox): no Sapphire 2.3 s total (0.55 s for the 150 requests); Sapphire on with uBlock Origin Lite **off** 5.7 s (0.80 s); Sapphire on with uBlock Origin Lite on 6.7 s (0.84 s). So Sapphire added about 3 s to every page load and made sub-requests about 45% slower even with its extension off, matching the user's report. The user decided to remove it. After the removal: protected files and blocks identical to mirage's, `sw.js` byte-identical to mirage's, the layout, bookmarks, shortcuts, Games and masking checks passed again, and a proxied test page loaded in 2.4 s. **Not tested:** the user's own machine and wisp servers.

## 7. Next specific task

**Done 2026-11-22: gn-math games source.** `games.html` now has two sources behind one interface (`ready`, `list`, `random`, `cover`, `play`) and a picker in the page header (gn-math default, LuminSDK second; the choice is `source` in `paroxysm:games`; favorites and recents are per source, old entries count as lumin; player links carry `&s=gnmath|lumin`, no `s` means lumin). gn-math: `zones.json` from `freebuisness/assets@main` on jsDelivr (unpkg does not serve GitHub; `gn-math/*` upstream repos return 403), searched and paged locally, 800 games shown (the id -1 Discord entry, the `[!] COMMENTS` widget and 53 emulator-tagged games are hidden); covers from `freebuisness/covers` (344 MB of full-size PNGs, median 195 KB, loaded only near the screen, six at a time, a slot is held until the image has loaded; `loading="lazy"` was not added because covers are only given a `src` when they scroll into view); game pages are fetched as text (jsDelivr serves .html as text/plain), the original site's Google Analytics snippet is stripped, and the page runs through `srcdoc` in an iframe with `sandbox` and no `allow-same-origin` (user-approved). A storage bridge script (in-memory `localStorage`/`sessionStorage`/`cookie`, `localStorage` saved by the page under `paroxysm:game-saves`) is added to each game page because sandboxed pages have no storage. Tests (Chrome 158, local server, real jsDelivr): picker, search, paging, covers, per-source favorites, LuminSDK browse and player, error messages for the 25 MB Minecraft 1.8.8 (jsDelivr returns 403) and unknown ids; sandbox confirmed (`origin` null, no access to the parent); no analytics requests; saves survive a reload. On 51 games that looked broken in a first pass of 83 random games, a working-screen check (more than 3 colours after 7 s; rough, headless, software WebGL) gave: sandbox without bridge 27, sandbox with bridge 41, no sandbox 44. The remaining failures with the bridge are mostly emulator-style games (IndexedDB denied), so those are hidden. Known limits: IndexedDB games, games that fetch their own page URL, ads and some game hosts failing, games over 20 MB. **Not tested:** the user's own machine and network, all 800 games (about 130 were loaded), sound, controllers, fullscreen on a real game, whether jsDelivr is reachable on the target network, game hosts other than jsDelivr (a few use githack). Temporary decision: Flash games are kept (they run through Ruffle; mixed results in the headless test, blank screens may be a click-to-play overlay).

**Done 2026-11-22: character masking appearance.** The user reported weight/size mismatch and letter shapes that do not match the font. Cause (confirmed by rendering): the bundled Inter was latin only, so Cyrillic/Greek/Armenian lookalikes were drawn from fallback system fonts. Fix: added `fonts/inter-cyrillic-wght-normal.woff2`, `inter-cyrillic-ext-wght-normal.woff2` and `inter-greek-wght-normal.woff2` (from `@fontsource-variable/inter@5`, unmodified) with `@font-face` rules and `unicode-range` in `paroxysm.css` (`font-display: block` for these three, so a lookalike never flashes in a fallback font; the latin rule got the standard latin `unicode-range`); `paroxysm-cloak.js` `LOOKALIKE` now only has letters Inter has (the Armenian/Komi `d`, `n`, `q`, `w` were dropped; Fern also uses only Cyrillic). Behaviour is unchanged: it masks paroxysm's own interface, never proxied pages, and updates live. Tested in a real Chrome 158 (Chrome for Testing, local server): all four Inter faces load; every kept lookalike has the same advance width as its Latin letter (except `v` vs `ν`, 0.025 em); the dropped four differed by 0.06 to 0.13 em; masking at 100% is active in the shell and its Home frame and looks identical to unmasked text. **Not tested:** the user's own Chrome and screen, light theme, a Games page with the real catalogue. Ideas not done: check how kerning looks across a Latin/Cyrillic boundary; add `ς`/`κ`-style letters (rejected: shapes differ from Latin in Inter).

**Sapphire (extensions): tried and removed (2026-11-17 to 19).** It worked in tests but cost about 3 s per page load even with its extension off (section 6). Removed: `sapphire/`, `extensions/`, `extensions.html`, the Extensions button, dropdown and popup, the `extensions` route, `sw.js` (back to mirage's original, with its hash), the `createFrame` option in `attachFrame` and the controller attach in the `init` wrapper. A one-time cleanup in `index.html` deletes the old extension storage (`sapphire_extensions`, `paroxysm:builtin-extensions`). Do not bring extensions back unless the user asks; a much lighter idea, untested, would be a small block list in the service worker.

**After that, in the user's order:** (1) the small Menu button task, (2) the AI page (a free provider with API keys and mainstream models such as DeepSeek with image support; the user hopes it is the last page), then (3) the M3 gate: the user re-runs the baseline checklist on the finished build (B1 now means "no pill appears and a page loads"; the old server picker B13 is replaced by Settings > Proxy; B14 is the Home page), and also checks the two known issues in section 5. Only after M3 passes does the SVG phase begin, starting with the iframe-embedding spike (a `file://` SVG that embeds the jsDelivr copy in an iframe, registers the worker inside it, and reports back, including which `allow` attributes and frame headers matter). Tab disguise and the panic key must be revisited in that phase (they act on the page paroxysm runs in).



Round 4 requests are all implemented; CLAUDE.md section 5 holds the resulting rules.

## 8. Decisions

**Approved by the user**
- Preserve the protected proxy; external adapters only; stop and ask before any engine change.
- A1 (relative paths), A2 (address-bar pattern from the controller prefix) done during the redesign; A3 (`register` shim) in the SVG phase via the adapter.
- Arcade/AI/music pages left out of v1. Repository: public, named `paroxysm`, owned by the user (GitHub account `lynverix`). Old Render WISP servers dropped; public endpoint `api.scvmath.org/wi/` for now; the user has 9 endpoints and will supply the rest, to be tried as ordered fallbacks.
- Serve the app as `text/html` after the worker takes over; write the loader independently; vendor the font and Lucide icons; ECDSA signing later.
- The SVG behaves like Fern: local SVG stays the outer shell, HTTPS copy in an iframe, redirect only as a `nosw`/no-service-worker fallback.
- Keep the Google favicon service for now. Individual files, not ZIPs.
- UI direction: Fern-like layout, purple default accent, Settings as a tab with Appearance/Search/Proxy/About, solid-accent selection, pill shapes, slimmer resizable rail, Three.js CDN background with editable properties, dark-mode logo files from `assets/paroxysm/`.

**Awaiting a decision or input**
- Whether gn-math games work well on the user's machine (saves, sound, controllers, which games fail), and what the menu button should open (nothing yet, by decision). The user has more planned tasks beyond the Menu button and the AI page (list not yet given).
- Values for the `developers`, `gameSource` and `aiProvider` strings in `paroxysm.config.js` (empty for now; empty strings are hidden in About).
- Whether "tab radius smaller" meant the rail tabs (done, 12 px), the page area (done, 14 px) or both; Claude changed both.
- Whether the parallax (default 0.5, which makes the background shift slightly with the mouse) should be 0 too.
- Scramjet: Claude recommended staying on alpha.1 and treating a 2.1.0 upgrade as its own milestone (baseline before/after); the user has not decided. DuckDuckGo depends on it.
- (Settled in round 3) Lucide stays inline in each page's sprite; no CDN loader.
- The remaining WISP endpoint URLs.
- Whether the URL bar should stay fully rounded (Claude rounded it for consistency; no objection yet).
- Whether the search engine list and the Appearance options should change (Claude's choices, not specified by the user).
- Running the iframe-embedding spike before M4; testing GitHub Pages as a fallback home (optional).
- Whether to use the light-mode assets (a light theme is not planned).
- Extension support (Sapphire) was tried and removed on 2026-11-19 because it slowed every page load; do not re-add it unless the user asks.

## 9. Tooling notes

- Claude can run a headless Chrome in its sandbox for layout and script tests: `npm i puppeteer-core @sparticuz/chromium` (bundled Chromium; needs `--no-sandbox`, and `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL). The sandbox cannot reach jsDelivr or the real WISP endpoints, so mock `WebSocket` and intercept the Three.js request for tests. This does not replace the user's real-browser checklist.
- The sandbox filesystem does not persist between conversations. The build scripts Claude used to generate the HTML are not part of the project; edit the project files directly.
- Local testing: `python -m http.server 8080` in the project folder (or Live Server), then `http://localhost:8080/`. Service workers do not run from `file://`.

### New Chat Instructions

Copy everything in this box into a new Claude conversation, and attach the paroxysm project ZIP (or the files) with it.

```
You are continuing development of paroxysm, a web proxy being built from a project called mirage. I am attaching the project (the ZIP, or the files). Do not start building anything yet.

1. Before doing anything else, read all four Markdown files in the project root, in full: CLAUDE.md, PROJECT_STATUS.md, RESEARCH_AND_ARCHITECTURE.md and README.md. CLAUDE.md holds the standing rules and the UI conventions; PROJECT_STATUS.md holds the current state, decisions, known issues and the next tasks.
2. Then inspect the actual project files to verify the documented state: list the tree, run `python verify_protected.py` (it must report ALL PROTECTED FILES UNCHANGED), and open index.html, paroxysm.css, paroxysm-settings.js, paroxysm-cloak.js, paroxysm.config.js, settings.html, newtab.html, games.html and newtab-bg.js. If anything differs from PROJECT_STATUS.md, tell me and trust the files.
3. Work out which milestone we are on. According to the docs: M0 (spike) and M1 (baseline) are done; M2 (UI and pages) has had six rounds (layout, bookmarks, shortcuts, Games, corrected character masking, and more) and is waiting for my feedback; extension support (Sapphire) was tried and removed because it slowed page loads; M3 (my re-run of the baseline checklist on the finished build) has not happened. The SVG bootstrap and Service Worker phase has not started and must not start until M3 passes.
4. Continue from exactly where the last conversation stopped (PROJECT_STATUS.md section 7): the character masking fix is done and waits for my verdict. Ask me whether it looks right now and what my other planned tasks are, then present a short plan and wait for me to say "go". My known order is the small Menu button task, the AI page, then M3.
5. Follow every rule in CLAUDE.md: the proxy engine (scramjet/, controller/, epoxy/, sw.js and the protected logic in index.html) stays untouched; any engine change needs me to approve it first; use adapters; keep names lowercase (paroxysm, mirage); deliver updated or new files individually (not as a ZIP) and say where each goes, or, if you can edit the repository directly, list every changed file; tell me honestly what you could not test; do not build until I say "go".
6. Do not repeat completed work, do not redo research that is already in the docs, and do not re-ask decisions listed as approved in PROJECT_STATUS.md section 8. Keep replies concise. Some third-party projects I may ask about (movies and music scrapers) were already declined; see CLAUDE.md.

Start by confirming what you read, summarising the current state in a few lines, and asking whether the character masking looks right now.
```
