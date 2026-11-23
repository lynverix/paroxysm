// points controller config and mirage's register("/sw.js") at the folder paroxysm is served from; load after controller.api.js
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
    sw.register = (url, options) => new URL(url, location.href).href === rootSw
        ? register(base + "paroxysm-sw.js", { ...options, scope: base })
        : register(url, options);
})();
