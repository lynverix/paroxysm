// paroxysm: user settings, shared by every page.
// Stored in localStorage (same origin, so the shell, the new tab page and the settings
// page all see the same values and update live through the "storage" event).
// Loaded in <head> so the accent colour is applied before first paint.
(() => {
    const KEY = "paroxysm:settings";

    const DEFAULTS = {
        accent: "#8b5cf6",
        animatedBackground: true,
        searchEngine: "google",
        customSearchUrl: ""          // must contain %s, e.g. https://example.com/search?q=%s
    };

    const ENGINES = {
        google:     { name: "Google",        url: "https://www.google.com/search?q=" },
        bing:       { name: "Bing",          url: "https://www.bing.com/search?q=" },
        duckduckgo: { name: "DuckDuckGo",    url: "https://duckduckgo.com/?q=" },
        brave:      { name: "Brave Search",  url: "https://search.brave.com/search?q=" }
    };

    const listeners = new Set();
    let cache = null;

    function read() {
        try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
        catch { return { ...DEFAULTS }; }
    }
    const get = () => (cache ??= read());

    function parseHex(hex) {
        const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!m) return null;
        let h = m[1];
        if (h.length === 3) h = h.split("").map(c => c + c).join("");
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }

    function applyAccent(hex) {
        const rgb = parseHex(hex) ?? parseHex(DEFAULTS.accent);
        const [r, g, b] = rgb;
        const lighter = rgb.map(v => Math.round(v + (255 - v) * 0.25));
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const s = document.documentElement.style;
        s.setProperty("--accent", `rgb(${r}, ${g}, ${b})`);
        s.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
        s.setProperty("--accent-2", `rgb(${lighter.join(", ")})`);
        s.setProperty("--on-accent", luminance > 0.6 ? "#0a0a0a" : "#ffffff");
    }

    function changed() {
        applyAccent(get().accent);
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
        return (ENGINES[s.searchEngine] ?? ENGINES.google).url + q;
    }

    addEventListener("storage", e => { if (e.key === KEY) { cache = null; changed(); } });

    window.paroxysmSettings = {
        get, set, searchUrl, defaults: DEFAULTS, engines: ENGINES,
        onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); }
    };

    applyAccent(get().accent);
})();