// paroxysm: user settings, shared by every page.
// Stored in localStorage (same origin, so the shell, the Home page and the settings
// page all see the same values and update live through the "storage" event).
// Loaded in <head> so the accent colour and theme are applied before first paint.
(() => {
    const KEY = "paroxysm:settings";

    const DEFAULTS = {
        accent: "#ae72df",              // "Paroxysm", the main accent
        theme: "dark",                  // "dark" | "light"
        animatedBackground: true,
        searchEngine: "brave",
        customSearchUrl: "",            // must contain %s, e.g. https://example.com/?q=%s
        sidebarOrder: ["games", "assistant", "settings"],
        tabCloak: "off",                // id from CLOAKS
        tabCloakLast: "",              // the preset the menu switches back on
        bookmarksBar: true,             // false hides the bookmarks bar (the menu toggles it)
        charMask: 0,                    // 0 to 100, in steps of 10
        panicKey: "`",
        panicTemplate: "classroom",     // id from PANIC_TEMPLATES
        panicCustomUrl: "",
        wispPreferred: "",              // id of the wisp server to try first; empty = automatic
        customWisp: []                  // wisp URLs the user added
    };

    // One-word names for the accent colours. The first is the default.
    const ACCENTS = [
        { name: "Paroxysm", hex: "#ae72df" },
        { name: "Glacier",  hex: "#7ccbef" },
        { name: "Sunset",   hex: "#f59a5b" },
        { name: "Forest",   hex: "#4fb580" },
        { name: "Ember",    hex: "#f2643a" },
        { name: "Rose",     hex: "#ec6c9a" },
        { name: "Ocean",    hex: "#4a8fe0" },
        { name: "Mint",     hex: "#7fddb5" },
        { name: "Gold",     hex: "#e8c04a" },
        { name: "Crimson",  hex: "#e04b5a" },
        { name: "Orchid",   hex: "#d077d8" },
        { name: "Slate",    hex: "#8c97a8" }
    ];

    const ENGINES = {
        brave:      { name: "Brave",      url: "https://search.brave.com/search?q=" },
        google:     { name: "Google",     url: "https://www.google.com/search?q=" },
        duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
        ecosia:     { name: "Ecosia",     url: "https://www.ecosia.org/search?q=" }
    };

    // Tab disguise presets: the tab title and the site whose icon is shown.
    const CLOAKS = [
        { id: "off",       label: "Off" },
        { id: "docs",      label: "Google Docs",      title: "Untitled document - Google Docs",       domain: "docs.google.com" },
        { id: "classroom", label: "Google Classroom", title: "Classes",                               domain: "classroom.google.com" },
        { id: "drive",     label: "Google Drive",     title: "My Drive - Google Drive",               domain: "drive.google.com" },
        { id: "canvas",    label: "Canvas",           title: "Dashboard",                             domain: "canvas.instructure.com" },
        { id: "khan",      label: "Khan Academy",     title: "Khan Academy | Free Online Courses",    domain: "khanacademy.org" },
        { id: "wikipedia", label: "Wikipedia",        title: "Wikipedia, the free encyclopedia",      domain: "wikipedia.org" },
        { id: "notion",    label: "Notion",           title: "Notion \u2013 The all-in-one workspace", domain: "notion.so" },
        { id: "github",    label: "GitHub",           title: "GitHub",                                domain: "github.com" }
    ];

    const PANIC_TEMPLATES = [
        { id: "classroom", label: "Google Classroom", url: "https://classroom.google.com" },
        { id: "docs",      label: "Google Docs",      url: "https://docs.google.com" },
        { id: "drive",     label: "Google Drive",     url: "https://drive.google.com" },
        { id: "canvas",    label: "Canvas",           url: "https://canvas.instructure.com" },
        { id: "khan",      label: "Khan Academy",     url: "https://www.khanacademy.org" },
        { id: "wikipedia", label: "Wikipedia",        url: "https://www.wikipedia.org" },
        { id: "google",    label: "Google",           url: "https://www.google.com" },
        { id: "custom",    label: "Custom" }
    ];

    const SIDEBAR_ITEMS = ["games", "assistant", "settings"];

    const listeners = new Set();
    let cache = null;

    function read() {
        try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
        catch { return { ...DEFAULTS }; }
    }
    const get = () => (cache ??= read());

    // Keep only known links, once each, and add any that are missing at the end.
    function sidebarOrder() {
        const seen = [];
        for (const k of (get().sidebarOrder ?? []).map(x => x === "ai" ? "assistant" : x)) if (SIDEBAR_ITEMS.includes(k) && !seen.includes(k)) seen.push(k);
        for (const k of SIDEBAR_ITEMS) {
            if (seen.includes(k)) continue;
            // a link added in a later version goes above Settings, which stays at the bottom
            if (seen[seen.length - 1] === "settings") seen.splice(seen.length - 1, 0, k);
            else seen.push(k);
        }
        return seen;
    }

    function parseHex(hex) {
        const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!m) return null;
        let h = m[1];
        if (h.length === 3) h = h.split("").map(c => c + c).join("");
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }

    // WCAG relative luminance, so text on the accent is whichever of black or white reads better.
    function relativeLuminance([r, g, b]) {
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function applyAccent(hex) {
        const rgb = parseHex(hex) ?? parseHex(DEFAULTS.accent);
        const [r, g, b] = rgb;
        const lighter = rgb.map(v => Math.round(v + (255 - v) * 0.25));
        const L = relativeLuminance(rgb);
        const darkText = (L + 0.05) / 0.05 > 1.05 / (L + 0.05);   // contrast with black beats contrast with white
        const s = document.documentElement.style;
        s.setProperty("--accent", `rgb(${r}, ${g}, ${b})`);
        s.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
        s.setProperty("--accent-2", `rgb(${lighter.join(", ")})`);
        s.setProperty("--on-accent", darkText ? "#0a0a0a" : "#ffffff");
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    }

    function changed() {
        applyAccent(get().accent);
        applyTheme(get().theme);
        listeners.forEach(fn => { try { fn(get()); } catch (e) { console.error(e); } });
    }

    function set(patch) {
        cache = { ...get(), ...patch };
        try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
        changed();
    }

    // Full search URL for a query, from the chosen engine (or a valid custom template).
    function searchUrl(query) {
        const s = get();
        const q = encodeURIComponent(query);
        if (s.searchEngine === "custom" && /^https?:\/\/.+%s/i.test(s.customSearchUrl)) {
            return s.customSearchUrl.replace("%s", q);
        }
        return (ENGINES[s.searchEngine] ?? ENGINES.brave).url + q;
    }

    // Where the panic key sends you, or "" if nothing valid is set.
    function panicUrl() {
        const s = get();
        const t = PANIC_TEMPLATES.find(p => p.id === s.panicTemplate);
        if (t && t.url) return t.url;
        let u = String(s.panicCustomUrl || "").trim();
        if (!u) return "";
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
        return /^https?:\/\//i.test(u) ? u : "";
    }

    addEventListener("storage", e => { if (e.key === KEY) { cache = null; changed(); } });

    window.paroxysmSettings = {
        get, set, searchUrl, panicUrl, sidebarOrder, parseHex,
        defaults: DEFAULTS, engines: ENGINES, accents: ACCENTS, cloaks: CLOAKS,
        panicTemplates: PANIC_TEMPLATES,
        onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); }
    };

    applyAccent(get().accent);
    applyTheme(get().theme);
})();