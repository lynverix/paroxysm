// inside index.svg's iframe: tells outer page when shell is ready and mirrors tab title and icon to it
(() => {
    if (window.parent === window) return;
    // outer page is file:// with origin "null" so no narrower target exists
    const send = msg => parent.postMessage(msg, "*");
    const last = {};
    const sync = () => {
        if (document.title !== last.title) send({ ld: "title", title: last.title = document.title });
        const icon = document.querySelector('link[rel~="icon"]')?.href;
        if (icon && icon !== last.icon) send({ ld: "icon", href: last.icon = icon });
    };
    new MutationObserver(sync).observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true });
    addEventListener("load", () => { sync(); send({ ld: "ready" }); });
})();
