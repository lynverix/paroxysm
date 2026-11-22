// paroxysm: cloaking, used by the shell (index.html).
//   - tab disguise: changes the title and icon of the page paroxysm runs in
//   - panic key: leaves straight away for the chosen URL
//   - character masking: swaps some letters in paroxysm's OWN interface (the shell and its local pages:
//     tab titles, the address display, bookmarks, Settings, Home, Games...) for lookalike Unicode
//     characters. It never touches the proxied page itself. It updates live as text changes.
// Written for paroxysm. Nothing here touches the proxy engine; it only acts on the shell and on
// same-origin frames. When paroxysm later runs inside an iframe under index.svg, the tab
// disguise and the panic key will need to message the outer document (not done yet).
(() => {
    const S = () => window.paroxysmSettings;

    // ── tab disguise ───────────────────────────────────────────────────────
    const original = {
        title: document.title,
        icon: document.querySelector('link[rel~="icon"]')?.getAttribute("href") ?? null
    };

    function setIcon(href) {
        document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove());
        if (!href) return;
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = href;
        document.head.appendChild(link);
    }

    function applyDisguise() {
        const p = S().cloaks.find(c => c.id === S().get().tabCloak && c.id !== "off");
        if (!p) { document.title = original.title; setIcon(original.icon); return; }
        document.title = p.title;
        setIcon(`https://www.google.com/s2/favicons?domain=${p.domain}&sz=64`);
    }

    // ── panic key ──────────────────────────────────────────────────────────
    let capturing = false;     // the settings page sets this while you choose a new key

    function panic() {
        const url = S().panicUrl();
        if (!url) return;
        try { (window.top || window).location.replace(url); }
        catch { window.location.replace(url); }
    }

    function onKey(e) {
        if (capturing || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key !== S().get().panicKey) return;
        e.preventDefault();
        e.stopPropagation();
        panic();
    }

    // ── character masking ──────────────────────────────────────────────────
    // Latin letters and their lookalikes (Cyrillic and Greek). Only letters that Inter itself has
    // (see the Cyrillic and Greek @font-face rules in paroxysm.css) are used, so a masked letter is
    // drawn in the same font, weight and size as its neighbours. Do not add letters from scripts
    // Inter lacks (Armenian and others): the browser would draw them from a mismatched system font.
    const LOOKALIKE = {
        a: "\u0430", c: "\u0441", e: "\u0435", h: "\u04bb", i: "\u0456", j: "\u0458",
        o: "\u043e", p: "\u0440", s: "\u0455", v: "\u03bd", x: "\u0445", y: "\u0443",
        A: "\u0410", B: "\u0412", C: "\u0421", E: "\u0415", H: "\u041d", I: "\u0406", J: "\u0408",
        K: "\u041a", M: "\u041c", N: "\u039d", O: "\u041e", P: "\u0420", S: "\u0405", T: "\u0422",
        X: "\u0425", Y: "\u03a5", Z: "\u0396"
    };
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "TITLE", "OPTION"]);
    const nodeState = new WeakMap();      // text node -> { orig, masked }
    const attached = new Set();           // { win, obs, level } for each document of paroxysm's own UI being masked

    function hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        return h >>> 0;
    }

    // A repeatable value in [0, 1) for each position, so a given text always masks the same way.
    function rnd(seed, i) {
        let t = (seed + Math.imul(i + 1, 0x9e3779b9)) | 0;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function maskText(text, level) {
        if (level <= 0) return text;
        const seed = hash(text);
        let out = "", i = 0;
        for (const ch of text) {
            const m = LOOKALIKE[ch];
            out += m && rnd(seed, i) < level / 100 ? m : ch;
            i++;
        }
        return out;
    }

    function eligible(node) {
        const p = node.parentElement;
        return !!p && !SKIP_TAGS.has(p.tagName) && !p.isContentEditable && node.data.trim() !== "";
    }

    function maskNode(node, level) {
        const st = nodeState.get(node);
        if (st && node.data === st.masked) {           // our own value: recompute from the original
            const next = maskText(st.orig, level);
            if (next !== node.data) { st.masked = next; node.data = next; }
            return;
        }
        if (!eligible(node)) return;                   // new text, or text the page changed
        const masked = maskText(node.data, level);
        nodeState.set(node, { orig: node.data, masked });
        if (masked !== node.data) node.data = masked;
    }

    function walk(root, level) {
        const w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) maskNode(n, level);
    }

    // The real text of an element, ignoring masking. Code that reads text from paroxysm's own pages
    // (for example Settings' search box) must use this instead of textContent.
    function plainText(el) {
        const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let out = "", n;
        while ((n = w.nextNode())) {
            const st = nodeState.get(n);
            out += st && n.data === st.masked ? st.orig : n.data;
        }
        return out;
    }

    function refresh(rec) {
        const level = S().get().charMask || 0;
        if (rec.level === level) return;
        rec.level = level;
        let doc;
        try { doc = rec.win.document; } catch { return; }
        if (!doc?.documentElement) return;
        if (level > 0 && !rec.obs) {
            rec.obs = new rec.win.MutationObserver(muts => {
                const lv = rec.level;
                if (lv <= 0) return;
                for (const m of muts) {
                    if (m.type === "characterData") maskNode(m.target, lv);
                    for (const n of m.addedNodes) {
                        if (n.nodeType === 3) maskNode(n, lv);
                        else if (n.nodeType === 1) walk(n, lv);
                    }
                }
            });
            rec.obs.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
        }
        walk(doc.documentElement, level);              // level 0 puts the original text back
        if (level <= 0 && rec.obs) { rec.obs.disconnect(); rec.obs = null; }
    }

    // Called by the shell each time a frame finishes loading. The panic key works everywhere; masking
    // is applied to paroxysm's own pages only (proxied pages are left exactly as the site sent them).
    function watchWindow(win, proxied) {
        try { win.addEventListener("keydown", onKey, true); } catch { return; }
        if (proxied) return;
        maskWindow(win);
    }

    function maskWindow(win) {
        const rec = { win, obs: null, level: 0 };
        attached.add(rec);
        win.addEventListener("pagehide", () => { rec.obs?.disconnect(); attached.delete(rec); });
        refresh(rec);
    }

    function init() {
        window.addEventListener("keydown", onKey, true);
        maskWindow(window);                              // the shell itself: tabs, address display, bookmarks, menus
        applyDisguise();
        S().onChange(() => { applyDisguise(); attached.forEach(refresh); });
    }

    window.paroxysmCloak = {
        init, watchWindow, panic, applyDisguise,
        setCapturing: on => { capturing = !!on; },
        plainText,
        maskText                                      // exposed for testing
    };
})();