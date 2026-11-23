// shared AI page parts as paroxysmAI.ui (needs paroxysm-ai.js first)
(() => {
    const AI = window.paroxysmAI;
    if (!AI) return;
    const NS = "http://www.w3.org/2000/svg";

    function h(tag, props = {}, ...kids) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (v == null || v === false) continue;
            if (k === "class") e.className = v;
            else if (k === "text") e.textContent = v;
            else if (k === "html") e.innerHTML = v;
            else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
            else e.setAttribute(k, v === true ? "" : v);
        }
        kids.flat().forEach(c => c != null && c !== false && e.append(c));
        return e;
    }
    function icon(name) {
        const s = document.createElementNS(NS, "svg");
        s.setAttribute("class", "icon");
        s.setAttribute("aria-hidden", "true");
        const u = document.createElementNS(NS, "use");
        u.setAttribute("href", "#i-" + name);
        s.append(u);
        return s;
    }
    const inShell = window.parent !== window;
    const openUrl = url => inShell ? window.parent.postMessage({ type: "paroxysm-open-url", url }, location.origin) : window.open(url, "_blank", "noopener");
    const timeText = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    function dismiss(back) {
        if (!back.isConnected || back.classList.contains("closing")) return;
        if (getComputedStyle(back).animationName === "none") { back.remove(); return; } // reduced motion
        back.classList.add("closing");
        back.addEventListener("animationend", e => { if (e.target === back) back.remove(); });
        setTimeout(() => back.remove(), 400);
    }
    // content: node or array of nodes. actions: [{ label, primary, danger, run }]
    function dialog({ title, content, actions = [], wide = false, onclose }) {
        const items = [].concat(content);
        items.forEach((c, i) => c.style?.setProperty("--i", i));
        const back = h("div", { class: "modal-back" });
        const box = h("div", { class: "modal glass" + (wide ? " wide" : ""), role: "dialog", "aria-label": title }, h("h3", { text: title }), h("div", { class: "m-body" }, items));
        let closed = false;
        const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
        function close() {
            if (closed) return;
            closed = true;
            removeEventListener("keydown", onKey, true);
            dismiss(back);
            onclose?.();
        }
        addEventListener("keydown", onKey, true);
        if (actions.length) box.append(h("div", { class: "actions" }, actions.map(a =>
            h("button", { class: "btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : ""), text: a.label, onclick: async () => { if ((await a.run?.()) !== false) close(); } }))));
        back.addEventListener("pointerdown", e => { if (e.target === back) close(); });
        back.append(box);
        document.body.append(back);
        return { close, box };
    }
    const confirmBox = (title, text, ok) => new Promise(resolve => {
        let answer = false;
        dialog({ title, content: h("p", { class: "modal-text", text }), onclose: () => resolve(answer), actions: [
            { label: "Cancel" }, { label: ok, primary: true, run: () => { answer = true; } }] });
    });
    function askText(title, label, value) {
        return new Promise(resolve => {
            let answer = null;
            const field = h("input", { class: "text-input", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": label });
            field.value = value ?? "";
            const d = dialog({ title, content: h("label", { class: "field" }, h("span", { text: label }), field), onclose: () => resolve(answer), actions: [
                { label: "Cancel" }, { label: "Save", primary: true, run: () => { answer = field.value.trim(); } }] });
            field.addEventListener("keydown", e => { if (e.key === "Enter") { answer = field.value.trim(); d.close(); } });
            field.focus(); field.select();
        });
    }

    // style: "card" (Settings > AI) or "dialog" (assistant page); returns array of elements
    function aiSettings({ style = "card", focusProvider = "", onChange, onDeleteAll, confirm = confirmBox } = {}) {
        const card = style === "card";
        const changed = () => onChange?.();
        const titleEl = text => h(card ? "h3" : "h4", { class: card ? "card-title" : "ais-title", text });
        function section({ title, desc, body, side, link }) {
            const d = desc ? h("p", { class: card ? "card-desc" : "ais-desc", text: desc }) : null;
            const wrap = (...kids) => card ? h("div", { class: "card", "data-rise": "" }, kids) : h("div", { class: "ais" }, kids);
            if (side) {
                if (d) d.style.marginBottom = "0";
                return wrap(h("div", { class: "row" }, h("div", {}, titleEl(title), d), side));
            }
            return wrap(h("div", { class: "ais-head" }, titleEl(title), link), d, body);
        }

        const s = AI.settings.get();
        const keyRow = (provider, desc) => {
            const P = AI.PROVIDERS[provider];
            const field = h("input", { class: "text-input", type: "password", autocomplete: "off", spellcheck: "false", placeholder: provider === "gemini" ? "AIza…" : "sk-…", "aria-label": P.label + " key" });
            field.value = AI.keys.get()[provider] || "";
            const stat = h("div", { class: "ais-stat" });
            const say = (kind, text) => { stat.className = "ais-stat " + kind; stat.textContent = text; };
            const save = async () => {
                const v = field.value.trim();
                if (!v) { say("", ""); return; }
                say("", "Testing…");
                try { const r = await AI.test(provider, v); AI.keys.set({ [provider]: v }); say("ok", `Works and saved (the model replied "${r}").`); changed(); }
                catch (e) { say("bad", e.message || "That didn't work."); }
            };
            const remove = () => { field.value = ""; AI.keys.set({ [provider]: "" }); say("", "Removed."); changed(); };
            if (provider === focusProvider) setTimeout(() => field.focus(), 120);
            return section({
                title: P.label + " key", desc,
                link: h("button", { class: "ais-link", text: "Get a free key", onclick: () => openUrl(P.keyUrl) }),
                body: h("div", {}, h("div", { class: "ais-key" }, field, h("button", { class: "btn", text: "Test and save", onclick: save }), h("button", { class: "btn", text: "Remove", onclick: remove })), stat)
            });
        };
        // Puter: sign in instead of key; Puter.js loads only once used
        const puterRow = () => {
            const box = h("div"), stat = h("div", { class: "ais-stat" });
            const say = (kind, text) => { stat.className = "ais-stat " + kind; stat.textContent = text; };
            const left = a => a.left == null ? "" : ` About ${Math.round(a.left * 100)}% of this month's allowance is left.`;
            const draw = () => {
                const on = AI.puter.signedIn();
                const first = on ? h("button", { class: "btn", text: "Check allowance", onclick: check }) : h("button", { class: "btn primary", text: "Sign in with Puter", onclick: signIn });
                box.replaceChildren(h("div", { class: "ais-key" }, first, on ? h("button", { class: "btn", text: "Sign out", onclick: out }) : null), stat);
                if (focusProvider === "puter" && !draw.focused) { draw.focused = true; setTimeout(() => first.focus(), 120); }
            };
            async function signIn() {
                say("", "Waiting for the Puter window…");
                try { const a = await AI.puter.connect(); say("ok", `Signed in${a.username ? " as " + a.username : ""}.${left(a)}`); changed(); draw(); }
                catch (e) { say("bad", e.message || "That didn't work."); }
            }
            async function check() {
                say("", "Checking…");
                try { const a = await AI.puter.account(); say("ok", `Signed in${a.username ? " as " + a.username : ""}.${left(a) || " Puter didn't report an allowance."}`); }
                catch (e) { say("bad", e.message || "That didn't work."); }
            }
            function out() { AI.puter.disconnect(); say("", "Signed out."); changed(); draw(); }
            draw();
            if (AI.puter.signedIn() && AI.puter.user()) say("", "Signed in as " + AI.puter.user() + ".");
            return section({
                title: "Puter account", desc: "No API key needed. Sign in with a free Puter account to chat with GPT, Gemini, DeepSeek and Gemma models using your account's monthly allowance. Requests go straight to Puter unless you send them through the proxy with the option below. Puter is blocked on Lightspeed, so stick with Quick unless a workaround turns up.",
                link: h("button", { class: "ais-link", text: "About Puter", onclick: () => openUrl("https://puter.com") }), body: box
            });
        };
        const keyBox = h("details", { class: "ais-hidden" },
            h("summary", {}, h("span", { text: "Hidden" }), h("span", { class: "ais-hint", text: "Needs an API key" })),
            keyRow("gemini", "Use your own free Google key to unlock Gemma 4 and the Gemini models, with image support. It's saved in this browser only."),
            keyRow("deepseek", "Unlocks DeepSeek V4.1 Flash, which thinks before it answers and can read images. It isn't free, but it's very cheap."));
        if (focusProvider === "gemini" || focusProvider === "deepseek") keyBox.open = true;
        const proxySwitch = h("button", { class: "switch", role: "switch", "aria-checked": String(!!s.viaProxy), "aria-label": "Send AI requests through the proxy" });
        proxySwitch.addEventListener("click", () => {
            const on = proxySwitch.getAttribute("aria-checked") !== "true";
            proxySwitch.setAttribute("aria-checked", String(on));
            AI.settings.set({ viaProxy: on });
            changed();
        });
        const cap = h("input", { class: "text-input ais-num", type: "number", min: "1", max: "500", "aria-label": "Daily limit" });
        cap.value = s.cap;
        cap.addEventListener("change", () => {
            const v = Math.min(500, Math.max(1, Math.round(Number(cap.value) || 30)));
            cap.value = v;
            AI.settings.set({ cap: v });
            changed();
        });
        const instr = h("textarea", { class: "text-input ais-area", maxlength: "1500", placeholder: "For example: explain things simply, keep answers short.", "aria-label": "Custom instructions" });
        instr.value = s.instructions || "";
        instr.addEventListener("change", () => { AI.settings.set({ instructions: instr.value.trim() }); changed(); });

        const u = AI.usage.get();
        const usage = h("div", { class: "ais-usage" },
            h("span", { text: `${u.capped} of ${s.cap} used on Quick and the shared key` }),
            h("span", { text: `${u.own} on your own keys and Puter` }),
            h("span", { text: `${u.chars.toLocaleString()} characters and ${u.images} images sent today` }),
            h("span", { text: "Resets at " + timeText(AI.nextReset()) }));

        const deleteBtn = h("button", { class: "btn danger", text: "Delete all" });
        deleteBtn.addEventListener("click", async () => {
            if (!(await confirm("Delete all chats?", "Every saved chat will be removed from this browser. This can't be undone.", "Delete all"))) return;
            await AI.store.clear();
            deleteBtn.textContent = "Deleted";
            setTimeout(() => deleteBtn.textContent = "Delete all", 2000);
            onDeleteAll?.();
        });

        return [
            keyBox,
            puterRow(),
            section({ title: "Send AI requests through the proxy", desc: "Turn this on if your network blocks AI sites. The proxy has to be connected. Quick always goes through it, and Puter chats will too (but not Puter's sign-in window).", side: proxySwitch }),
            section({ title: "Daily limit", desc: "Caps how many messages you can send per day on Quick and the shared key. Your own keys follow their own limits.", side: cap }),
            section({ title: "Custom instructions", desc: "Added to every chat. Handy for telling it how you like answers written.", body: instr }),
            section({ title: "Today", body: usage }),
            section({ title: "Delete all chats", desc: "Removes every saved chat from this browser.", side: deleteBtn }),
            section({ title: "Privacy", desc: "Your prompts leave your browser. Gemini's free tier may use them to improve Google's products, Quick sends them to a third-party service and Puter passes them on to the model's provider. Don't send passwords or personal details." })
        ];
    }

    AI.ui = { h, icon, openUrl, timeText, dialog, confirmBox, askText, aiSettings };
})();
