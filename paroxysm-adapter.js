// points controller config and mirage's register("/sw.js") at paroxysm's folder; load after controller.api.js
(() => {
    const base = new URL(".", location.href).pathname;
    Object.assign($scramjetController.config, {
        prefix: base + "~/sj/",
        scramjetPath: base + "scramjet/scramjet.js",
        injectPath: base + "controller/controller.inject.js",
        wasmPath: base + "scramjet/scramjet.wasm"
    });

    const sw = navigator.serviceWorker;
    if (!sw) return;
    const register = sw.register.bind(sw);
    const rootSw = new URL("/sw.js", location.origin).href;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const parsed = () => document.readyState === "loading" ? new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
    // live server injects a reload script into html so hashes never match there
    const liveServer = () => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        while (walker.nextNode()) if (walker.currentNode.data.includes("Code injected by live-server")) return true;
        return false;
    };

    sw.register = async (url, options) => {
        if (new URL(url, location.href).href !== rootSw) return register(url, options);
        await parsed();
        const dev = local && (new URLSearchParams(location.search).has("dev") || liveServer());
        if (dev) console.warn("[paroxysm] dev mode: files are loaded without hash checks.");
        const fail = err => {
            console.error("[paroxysm] loader worker failed to install:", err);
            setTimeout(() => window.paroxysmPill?.("error", "paroxysm couldn't install its files. Reload to try again.", 0));
        };
        let reg;
        try { reg = await register(base + "loader-sw.js" + (dev ? "?dev=1" : ""), { ...options, scope: base, updateViaCache: "none" }); }
        catch (err) { fail(err); throw err; }
        // register resolves before install so failed checks appear as redundant worker
        const w = reg.installing;
        if (w && !reg.active) w.addEventListener("statechange", () => {
            if (w.state === "redundant" && !reg.active) fail(new Error("install failed; the worker's console has the reason"));
        });
        return reg;
    };
})();
