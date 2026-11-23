// entrance animation: data-rise elements fade in and float up in order
// paroxysmRise.run(root) replays it for part of a page
(() => {
    const root = document.documentElement;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) root.classList.add("rise-pending");

    function run(scope = document) {
        if (reduce) { root.classList.remove("rise-pending"); return; }
        const items = [...scope.querySelectorAll("[data-rise]")]
            .filter(el => el.getClientRects().length) // skip anything not displayed
            .map(el => [el, el.getBoundingClientRect()])
            .sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left);
        items.forEach(([el], i) => {
            el.style.setProperty("--i", i);
            el.classList.remove("rise");
            void el.offsetWidth; // restart animation
            el.classList.add("rise");
        });
        root.classList.remove("rise-pending");
    }

    window.paroxysmRise = { run };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => run());
    else run();
})();