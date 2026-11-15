// paroxysm: entrance animation for local pages (home, settings).
// Elements marked data-rise fade in and float up into place, one after another from top to bottom.
// The first call runs on DOMContentLoaded; paroxysmRise.run(root) replays it for part of a page
// (the settings page does this when you switch section).
// Until the first run, marked elements are hidden by CSS (html.rise-pending). If this file
// fails to load, nothing is hidden, so the page still shows.
(() => {
    const root = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) root.classList.add("rise-pending");

    function run(scope = document) {
        if (reduce) { root.classList.remove("rise-pending"); return; }
        const items = [...scope.querySelectorAll("[data-rise]")]
            .filter(el => el.getClientRects().length)                 // skip anything not displayed
            .map(el => [el, el.getBoundingClientRect()])
            .sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left);
        items.forEach(([el], i) => {
            el.style.setProperty("--i", i);
            el.classList.remove("rise");
            void el.offsetWidth;                                       // restart the animation
            el.classList.add("rise");
        });
        root.classList.remove("rise-pending");
    }

    window.paroxysmRise = { run };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => run());
    else run();
})();