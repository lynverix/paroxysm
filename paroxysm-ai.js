// paroxysm: the engine behind the AI page (assistant.html). The page only draws things; everything that talks to a
// provider, counts usage, stores chats or turns markdown into HTML lives here, as window.paroxysmAI.
//
// Where an answer comes from (resolve):
//   1. the person's own key, if they pasted one (Gemini or DeepSeek)
//   2. the shared key from paroxysm.config.js (aiKey), Gemma 4 only
//   3. Quick: Pollinations' keyless GPT-OSS 20B (text only, always sent through the proxy)
// If the shared key stops working (quota, blocked), run() answers with Quick instead and says so.
// Requests go straight from the browser to the provider, or through the wisp transport when "send through the
// proxy" is on (window.parent.paroxysm.fetch, see index.html).
// Written for paroxysm, no libraries. Provider request shapes follow the providers' public documentation.
(() => {
    "use strict";

    const CFG = () => window.PAROXYSM_CONFIG ?? {};
    const LS = { settings: "paroxysm:ai", keys: "paroxysm:ai-keys", usage: "paroxysm:ai-usage", dev: "paroxysm:ai-dev", puter: "paroxysm:ai-puter" };
    const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? { ...d, ...v } : { ...d }; } catch { return { ...d }; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

    // ── settings, keys ─────────────────────────────────────────────────────
    const DEFAULTS = { cap: 30, viaProxy: false, model: "", instructions: "" };
    const settings = { get: () => read(LS.settings, DEFAULTS), set: p => write(LS.settings, { ...settings.get(), ...p }) };
    const keys = { get: () => read(LS.keys, { gemini: "", deepseek: "" }), set: p => write(LS.keys, { ...keys.get(), ...p }) };

    const PROVIDERS = {
        gemini:   { label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey", base: "https://generativelanguage.googleapis.com" },
        deepseek: { label: "DeepSeek", keyUrl: "https://platform.deepseek.com/api_keys", base: "https://api.deepseek.com" },
        puter:    { label: "Puter" },
        quick:    { label: "Quick", base: "https://text.pollinations.ai" }
    };
    // Test hook: localStorage "paroxysm:ai-dev" = {"gemini":"http://localhost:5555", ...} points a provider somewhere else.
    const baseOf = p => String(read(LS.dev, {})[p] || PROVIDERS[p].base).replace(/\/$/, "");

    // shared: may use the shared key (its free quota is large enough for everyone). thinks: returns a thinking summary.
    const MODELS = [
        { id: "gemma-4-31b-it",        provider: "gemini",   name: "Gemma 4 31B",           note: "Free and fast, sees images",           vision: true,  shared: true },
        { id: "gemini-3.5-flash-lite", provider: "gemini",   name: "Gemini 3.5 Flash-Lite", note: "Quick answers, sees images",           vision: true,  thinks: true },
        { id: "gemini-3.8-flash",      provider: "gemini",   name: "Gemini 3.8 Flash",      note: "Best answers, sees images",            vision: true,  thinks: true },
        { id: "deepseek-flash",        provider: "deepseek", name: "DeepSeek V4.1 Flash",   note: "Thinks before answering, sees images", vision: true,  thinks: true },
        // Via Puter (sign in with a Puter account, no key). id is ours; puter is the model id Puter knows. Quick stays last.
        { id: "puter:gemma-4-31b-it", puter: "gemma-4-31b-it", provider: "puter", name: "Gemma 4 31B (Puter)", note: "Open model, sees images", vision: true },
        { id: "puter:gpt-5.4-nano", puter: "gpt-5.4-nano", provider: "puter", name: "GPT-5.4 nano (Puter)", note: "Fast, sees images", vision: true },
        { id: "puter:deepseek-v4.1-flash", puter: "deepseek-v4.1-flash", provider: "puter", name: "DeepSeek V4.1 Flash (Puter)", note: "Thinks, sees images", vision: true },
        { id: "puter:gemini-3.8-flash", puter: "gemini-3.8-flash", provider: "puter", name: "Gemini 3.8 Flash (Puter)", note: "Sees images", vision: true },
        { id: "puter:gpt-5.5", puter: "gpt-5.5", provider: "puter", name: "GPT-5.5 (Puter)", note: "Most capable, sees images", vision: true },
        { id: "openai-fast",           provider: "quick",    name: "Quick (GPT-OSS 20B)",   note: "No key needed, text only",             vision: false, thinks: true }
    ];
    const modelById = id => MODELS.find(m => m.id === id);

    // ── where the key comes from ───────────────────────────────────────────
    const SHARED_DOWN = "paroxysm:ai-shared-down";
    const sharedDown = () => { try { return Date.now() - Number(sessionStorage.getItem(SHARED_DOWN) || 0) < 3600e3; } catch { return false; } };
    const markSharedDown = () => { try { sessionStorage.setItem(SHARED_DOWN, String(Date.now())); } catch {} };

    // { kind: "own" | "shared" | "quick", key } or null when the model needs a key the person doesn't have
    function resolve(model) {
        if (model.provider === "quick") return { kind: "quick", key: "" };
        if (model.provider === "puter") { const t = puterAuth.token(); return t ? { kind: "puter", key: t } : null; }
        const own = (keys.get()[model.provider] || "").trim();
        if (own) return { kind: "own", key: own };
        const shared = String(CFG().aiKey || "").trim();
        if (model.provider === "gemini" && model.shared && shared && !sharedDown()) return { kind: "shared", key: shared };
        return null;
    }
    function defaultModelId() {
        const wanted = modelById(settings.get().model);
        if (wanted && resolve(wanted)) return wanted.id;
        return (MODELS.find(m => resolve(m)) ?? MODELS.at(-1)).id;
    }

    // ── usage: a local counter that resets when Gemini's own daily quota does (midnight, Pacific time) ──
    const dayKey = t => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(t);
    function nextReset(now = Date.now()) {
        const k = dayKey(now);
        let lo = now, hi = now + 26 * 3600e3;
        while (hi - lo > 60e3) { const mid = (lo + hi) / 2; if (dayKey(mid) === k) lo = mid; else hi = mid; }
        return hi;
    }
    const usage = {
        get() {
            const u = read(LS.usage, { day: "", capped: 0, own: 0, chars: 0, images: 0 });
            const day = dayKey(Date.now());
            return u.day === day ? u : { day, capped: 0, own: 0, chars: 0, images: 0 };
        },
        add(kind, chars, images) {
            const u = usage.get();
            if (kind === "own" || kind === "puter") u.own++; else u.capped++;
            u.chars += chars; u.images += images;
            write(LS.usage, u);
        }
    };
    const capLeft = () => Math.max(0, settings.get().cap - usage.get().capped);

    // ── errors ─────────────────────────────────────────────────────────────
    // kind: quota, key, balance, cap, blocked, network, server, bad
    class AIError extends Error { constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; } }
    function httpError(status, text) {
        let msg = text;
        try { const j = JSON.parse(text); msg = j.error?.message ?? j.message ?? (typeof j.error === "string" ? j.error : text); } catch {}
        msg = String(msg || "HTTP " + status).slice(0, 300);
        if (status === 429) return new AIError("quota", msg, status);
        if (status === 402) return new AIError("balance", msg, status);
        if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key/i.test(msg))) return new AIError("key", msg, status);
        return new AIError(status >= 500 ? "server" : "bad", msg, status);
    }

    // ── talking to a provider ──────────────────────────────────────────────
    async function post(url, headers, body, { viaProxy, signal }) {
        const init = { method: "POST", headers, body: JSON.stringify(body), signal };
        let res;
        try {
            if (viaProxy) {
                let bridge = null;
                try { bridge = window.parent !== window ? window.parent.paroxysm : window.paroxysm; } catch {}
                if (!bridge?.fetch) throw new AIError("network", "The proxy isn't available on this page.");
                res = await bridge.fetch(url, init);
            } else {
                res = await fetch(url, init);
            }
        } catch (e) {
            if (e.name === "AbortError" || e instanceof AIError) throw e;
            throw new AIError("network", e.message || "Network error");
        }
        if (!res.ok) throw httpError(res.status, await res.text().catch(() => ""));
        return res;
    }

    // Server-sent events: yields the data of each event.
    async function* sse(res, signal) {
        const reader = res.body.getReader();
        const onAbort = () => { try { reader.cancel(); } catch {} };
        signal?.addEventListener("abort", onAbort);
        const dec = new TextDecoder();
        let buf = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, "\n");
                let at;
                while ((at = buf.indexOf("\n\n")) >= 0) {
                    const block = buf.slice(0, at);
                    buf = buf.slice(at + 2);
                    const data = block.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).replace(/^ /, "")).join("\n");
                    if (data) yield data;
                }
            }
            const tail = buf.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).replace(/^ /, "")).join("\n");
            if (tail) yield tail;
        } finally {
            signal?.removeEventListener("abort", onAbort);
            try { reader.cancel(); } catch {}
        }
    }

    // The conversation the provider sees: only recent turns, images only from the latest few.
    function historyOf(messages) {
        const clean = messages.filter(m => (m.role === "user" || m.content) && !m.error);
        const recent = clean.slice(-24);
        let imagesLeft = 3;
        const out = recent.slice().reverse().map(m => {
            if (m.role !== "user" || !m.images?.length) return { role: m.role, content: m.content, images: [] };
            const keep = imagesLeft > 0;
            if (keep) imagesLeft--;
            return { role: m.role, content: m.content, images: keep ? m.images : [], dropped: keep ? 0 : m.images.length };
        }).reverse();
        while (out.length && out[0].role !== "user") out.shift();
        return out;
    }
    const textOf = (m, model) => {
        let t = m.content || "";
        if (m.dropped || (m.images?.length && !model.vision)) t += (t ? "\n" : "") + "[an image was attached here]";
        return t || " ";
    };

    async function geminiCall(ctx) {
        const { model, key, history, system, on } = ctx;
        const gemma = model.id.startsWith("gemma");
        const url = `${baseOf("gemini")}/v1beta/models/${model.id}:streamGenerateContent?alt=sse`;
        const build = minimal => {
            const contents = history.map(m => {
                const parts = [{ text: textOf(m, model) }];
                if (model.vision) m.images.forEach(i => parts.push({ inlineData: { mimeType: i.mime, data: i.data } }));
                return { role: m.role === "assistant" ? "model" : "user", parts };
            });
            const body = { contents };
            if (system) {
                if (gemma || minimal) contents[0].parts[0].text = system + "\n\n" + contents[0].parts[0].text;   // some models take no system instruction
                else body.systemInstruction = { parts: [{ text: system }] };
            }
            if (model.thinks && !gemma && !minimal) body.generationConfig = { thinkingConfig: { includeThoughts: true } };
            return body;
        };
        let res;
        for (const minimal of gemma ? [false] : [false, true]) {
            try {
                res = await post(url, { "Content-Type": "application/json", "x-goog-api-key": key }, build(minimal), ctx);
                break;
            } catch (e) {
                if (!minimal && !gemma && e.status === 400 && /think|system|instruction|developer|unknown name|payload/i.test(e.message)) continue;
                throw e;
            }
        }
        on.started();
        let finish = "", got = false;
        for await (const data of sse(res, ctx.signal)) {
            let j;
            try { j = JSON.parse(data); } catch { continue; }
            if (j.error) throw httpError(j.error.code ?? 500, JSON.stringify(j));
            if (j.promptFeedback?.blockReason) throw new AIError("blocked", "Google blocked this request (" + j.promptFeedback.blockReason + ").");
            const cand = j.candidates?.[0];
            for (const part of cand?.content?.parts ?? []) {
                if (!part.text) continue;
                got = true;
                part.thought ? on.thought(part.text) : on.text(part.text);
            }
            if (cand?.finishReason && cand.finishReason !== "STOP" && cand.finishReason !== "MAX_TOKENS") finish = cand.finishReason;
        }
        if (finish && !got) throw new AIError("blocked", "The answer was stopped (" + finish + ").");
    }

    // DeepSeek and Quick both speak the OpenAI chat format.
    async function openaiCall(ctx, url, headers) {
        const { model, history, system, on } = ctx;
        const messages = [];
        if (system) messages.push({ role: "system", content: system });
        for (const m of history) {
            if (m.role === "user" && model.vision && m.images.length) {
                messages.push({ role: "user", content: [{ type: "text", text: textOf(m, model) }, ...m.images.map(i => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.data}` } }))] });
            } else {
                messages.push({ role: m.role, content: textOf(m, model) });
            }
        }
        const res = await post(url, headers, { model: model.id, messages, stream: true }, ctx);
        on.started();
        if ((res.headers.get("content-type") || "").includes("application/json")) {      // a server that ignores stream:true
            const j = await res.json();
            const msg = j.choices?.[0]?.message ?? {};
            const r = msg.reasoning_content ?? msg.reasoning;
            if (r) on.thought(r);
            if (msg.content) on.text(msg.content);
            return;
        }
        for await (const data of sse(res, ctx.signal)) {
            if (data === "[DONE]") break;
            let j;
            try { j = JSON.parse(data); } catch { continue; }
            if (j.error) throw httpError(j.error.code ?? 500, JSON.stringify(j));
            const d = j.choices?.[0]?.delta ?? {};
            const r = d.reasoning_content ?? d.reasoning;
            if (r) on.thought(r);
            if (d.content) on.text(d.content);
        }
    }

    const callers = {
        gemini: ctx => geminiCall(ctx),
        deepseek: ctx => openaiCall(ctx, baseOf("deepseek") + "/chat/completions", { "Content-Type": "application/json", Authorization: "Bearer " + ctx.key }),
        quick: ctx => openaiCall(ctx, baseOf("quick") + "/openai", { "Content-Type": "application/json" }),
        puter: ctx => puterCall(ctx)
    };

    // ── Puter ──────────────────────────────────────────────────────────────
    // The person signs in to their own Puter account (no key; Puter bills the account's monthly allowance). Sign-in runs
    // here, in Puter's popup. Puter.js itself runs in puter-frame.html, an iframe sandboxed without allow-same-origin, so
    // it can't touch paroxysm's storage; it is only created when Puter is first needed. With "Send AI requests through the proxy"
    // on, its API calls go through the wisp transport (puterForward); the sign-in window itself is always direct. The token is kept in localStorage
    // (paroxysm:ai-puter) like the AI keys. Test hooks: paroxysm:ai-dev { puterFrame, puterGui }.
    const puterAuth = {
        get: () => read(LS.puter, { token: "", user: "" }),
        token: () => String(puterAuth.get().token || ""),
        set: p => write(LS.puter, { ...puterAuth.get(), ...p })
    };
    const puterCfg = () => { const d = read(LS.dev, {}); return { gui: String(d.puterGui || "https://puter.com").replace(/\/$/, ""), frame: String(d.puterFrame || "puter-frame.html") }; };

    let puterF = null, puterSeq = 0;
    const puterWaiters = new Map(), puterXhrs = new Map();
    const puterProxy = () => !!settings.get().viaProxy;    // "Send AI requests through the proxy" also covers Puter (not its sign-in window)

    // The frame's XMLHttpRequest, forwarded through the wisp transport: only https puter.com hosts, only while the setting is on.
    async function puterForward(el, m) {
        const reply = (r, transfer = []) => { try { el.contentWindow.postMessage({ ...r, fid: m.fid }, "*", transfer); } catch {} };
        const ctrl = new AbortController();
        puterXhrs.set(m.fid, ctrl);
        try {
            let url;
            try { url = new URL(String(m.url)); } catch { throw new Error("Bad address."); }
            if (!puterProxy()) throw new Error("Proxy mode is off.");
            if (url.protocol !== "https:" || !/(^|\.)puter\.com$/i.test(url.hostname)) throw new Error("Only puter.com is allowed here.");
            let bridge = null;
            try { bridge = window.parent !== window ? window.parent.paroxysm : window.paroxysm; } catch {}
            if (!bridge?.fetch) throw new Error("The proxy isn't available on this page.");
            const headers = (Array.isArray(m.headers) ? m.headers : []).filter(h => Array.isArray(h) && typeof h[0] === "string" && typeof h[1] === "string" && !/^(host|connection|content-length)$/i.test(h[0]));
            const body = typeof m.body === "string" ? m.body : m.body instanceof ArrayBuffer ? new Uint8Array(m.body) : undefined;
            const res = await bridge.fetch(url.href, { method: /^[A-Z]{3,7}$/.test(m.method) ? m.method : "GET", headers, body, signal: ctrl.signal });
            reply({ t: "xhr-head", status: res.status, statusText: res.statusText, headers: [...res.headers], url: url.href });
            const reader = res.body?.getReader();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const copy = value.slice().buffer;
                reply({ t: "xhr-chunk", data: copy }, [copy]);
            }
            reply({ t: "xhr-end" });
        } catch (e) {
            if (!ctrl.signal.aborted) { console.warn("[paroxysm] Puter request through the proxy failed:", e?.message || e); reply({ t: "xhr-err" }); }
        } finally { puterXhrs.delete(m.fid); }
    }
    function puterFrame() {
        if (puterF) return puterF.ready;
        const el = document.createElement("iframe");
        el.setAttribute("sandbox", "allow-scripts");
        el.setAttribute("aria-hidden", "true");
        el.tabIndex = -1;
        el.title = "Puter";
        el.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
        const ready = new Promise((resolve, reject) => {
            const timer = setTimeout(() => fail("Puter.js didn't start in time. If your network blocks cdn.jsdelivr.net or puter.com, Puter can't be used here."), 30000);
            const fail = text => { clearTimeout(timer); removeEventListener("message", onMsg); el.remove(); puterF = null; reject(new AIError("network", text)); };
            const onMsg = e => {
                const m = e.data;
                if (e.source !== el.contentWindow || !m || typeof m !== "object") return;
                if (m.t === "ready") { clearTimeout(timer); resolve(el); el.contentWindow.postMessage({ t: "proxy", on: puterProxy() }, "*"); const t = puterAuth.token(); if (t) el.contentWindow.postMessage({ t: "token", token: t }, "*"); }
                else if (m.t === "xhr") puterForward(el, m);
                else if (m.t === "xhr-abort") puterXhrs.get(m.fid)?.abort();
                else if (m.t === "fatal") fail("Puter.js couldn't be loaded (" + (m.message || "unknown error") + ").");
                else if (m.id != null) puterWaiters.get(m.id)?.(m);
            };
            addEventListener("message", onMsg);
            el.src = puterCfg().frame;
            document.body.append(el);
        });
        ready.catch(() => {});
        puterF = { el, ready };
        return ready;
    }

    function puterError({ message, code, status }) {
        const msg = String(message || "Puter returned an error."), tag = `${code || ""} ${msg}`;
        let e;
        if (status === 401 || /token_auth|signin_required|unauthori[sz]ed/i.test(tag)) e = new AIError("key", "Your Puter sign-in isn't valid any more. Sign in again in AI settings.", 401);
        else if (status === 402 || /insufficient|allowance|credit|funds|usage.?limit/i.test(tag)) e = new AIError("balance", `Your Puter allowance is used up for now. It renews every month, or you can add credit at puter.com. (${msg})`, 402);
        else if (status === 429 || /rate.?limit|too many/i.test(tag)) e = new AIError("quota", `Puter is limiting requests right now (${msg}). Try again in a moment.`, 429);
        else e = new AIError(status >= 500 ? "server" : "bad", msg, status);
        e.provider = "puter";
        return e;
    }

    // Sends one request to the frame; `on(message)` sees every reply with this id; resolves on "done"/"answer", rejects on "error".
    async function puterAsk(msg, { signal, on } = {}) {
        const el = await puterFrame();
        const id = "p" + (++puterSeq);
        return new Promise((resolve, reject) => {
            const end = (fn, v) => { puterWaiters.delete(id); signal?.removeEventListener("abort", onAbort); fn(v); };
            const onAbort = () => { try { el.contentWindow.postMessage({ t: "abort", id }, "*"); } catch {} end(reject, new DOMException("Aborted", "AbortError")); };
            puterWaiters.set(id, m => {
                if (m.t === "error") end(reject, puterError(m));
                else if (m.t === "done" || m.t === "account") end(resolve, m);
                else on?.(m);
            });
            if (signal?.aborted) return onAbort();
            signal?.addEventListener("abort", onAbort);
            el.contentWindow.postMessage({ t: "proxy", on: puterProxy() }, "*");
            el.contentWindow.postMessage({ ...msg, id }, "*");
        });
    }

    async function puterCall(ctx) {
        const { model, history, system, on, signal } = ctx;
        const messages = [];
        if (system) messages.push({ role: "system", content: system });
        for (const m of history) {
            if (m.role === "user" && model.vision && m.images.length)
                messages.push({ role: "user", content: [{ type: "text", text: textOf(m, model) }, ...m.images.map(i => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.data}` } }))] });
            else messages.push({ role: m.role, content: textOf(m, model) });
        }
        await puterAsk({ t: "chat", model: model.puter, messages }, { signal, on: m => {
            if (m.t === "started") on.started();
            else if (m.t === "text") on.text(m.text);
            else if (m.t === "thought") on.thought(m.text);
        } });
    }

    // Opens Puter's sign-in window and resolves with the token it sends back. Call it straight from a click (no await first),
    // or the browser blocks the window. Only a message from that window, from Puter's own origin, with our id, is accepted.
    function puterPopup() {
        const id = crypto.randomUUID(), gui = puterCfg().gui;
        const w = 600, h = 700;
        const popup = window.open(`${gui}/action/sign-in?embedded_in_popup=true&msg_id=${id}`, "paroxysm-puter-sign-in",
            `width=${w},height=${h},left=${Math.round((screen.width - w) / 2)},top=${Math.round((screen.height - h) / 2)}`);
        return new Promise((resolve, reject) => {
            if (!popup) { reject(new AIError("bad", "The browser blocked the Puter sign-in window. Allow pop-ups for this page and try again.")); return; }
            let done = false;
            const end = (fn, v) => { if (done) return; done = true; clearInterval(poll); removeEventListener("message", onMsg); fn(v); };
            const onMsg = e => {
                const m = e.data;
                if (e.origin !== new URL(gui).origin || e.source !== popup || m?.msg !== "puter.token" || String(m.msg_id) !== id) return;
                if (m.success && typeof m.token === "string" && m.token && m.token.length < 4096) end(resolve, m.token);
                else end(reject, new AIError("bad", "Puter didn't sign you in."));
            };
            const poll = setInterval(() => { if (popup.closed) end(reject, new AIError("bad", "The sign-in window was closed before you finished.")); }, 500);
            addEventListener("message", onMsg);
        });
    }

    const puter = {
        signedIn: () => !!puterAuth.token(),
        user: () => String(puterAuth.get().user || ""),
        // sign in, then check the token with Puter (and remember who it is); a token Puter won't accept is dropped
        async connect() {
            const token = await puterPopup();
            puterAuth.set({ token, user: "" });
            try {
                const el = await puterFrame();
                el.contentWindow.postMessage({ t: "proxy", on: puterProxy() }, "*");
                el.contentWindow.postMessage({ t: "token", token }, "*");
                const a = await puterAsk({ t: "account" });
                puterAuth.set({ user: a.username || "" });
                return a;
            } catch (e) {
                puter.disconnect();
                throw e;
            }
        },
        account: () => puterAsk({ t: "account" }),
        disconnect() {
            write(LS.puter, { token: "", user: "" });
            if (puterF) { puterF.el.remove(); puterF = null; }     // the frame goes away with the token it held
        }
    };

    const SYSTEM = "You are a helpful assistant inside paroxysm. Answer clearly and concisely, in the language the user writes in. Use markdown when it helps (lists, tables, fenced code blocks). If you are unsure, say so.";
    const systemPrompt = () => {
        const extra = String(settings.get().instructions || "").trim();
        return extra ? SYSTEM + "\n\nThe user's own instructions:\n" + extra.slice(0, 1500) : SYSTEM;
    };

    // One request. Counts it once the provider has accepted it.
    async function attempt(model, source, opts) {
        const history = historyOf(opts.messages);
        const last = opts.messages.at(-1);
        const chars = (last?.content || "").length, images = last?.images?.length || 0;
        const t0 = performance.now();
        let text = "", thought = "", firstText = 0, counted = false;
        const on = {
            started: () => { if (!counted) { counted = true; if (!opts.dry) usage.add(source.kind, chars, images); } },
            thought: s => { thought += s; opts.onThought?.(thought); },
            text: s => { if (!text) firstText = performance.now(); text += s; opts.onText?.(text); }
        };
        // Quick always goes through the proxy: Pollinations refuses direct browser requests ("Missing Turnstile token")
        const viaProxy = settings.get().viaProxy || model.provider === "quick";
        try {
            await callers[model.provider]({ model, key: source.key, history, system: systemPrompt(), viaProxy, signal: opts.signal, on });
        } catch (e) {
            if (model.provider === "quick" && (e.kind === "balance" || e.kind === "quota"))
                throw new AIError("quota", "Quick allows about one request every 45 seconds, shared by everyone using the same connection. Try again in a moment, or add your own key.", e.status);
            throw e;
        }
        if (!text && !thought) throw new AIError("bad", "The model sent back an empty answer.");
        return { text, thought, thoughtMs: thought ? Math.round((firstText || performance.now()) - t0) : 0, model, kind: source.kind };
    }

    // The public entry: picks the source, applies the daily cap, falls back from the shared key to Quick.
    async function run(opts) {
        const model = modelById(opts.modelId) ?? MODELS.at(-1);
        const source = resolve(model);
        if (!source) throw new AIError("key", model.provider === "puter" ? `Sign in to Puter to use ${model.name}.` : `Add a ${PROVIDERS[model.provider].label} key to use ${model.name}.`);
        if (source.kind !== "own" && source.kind !== "puter" && capLeft() <= 0) throw new AIError("cap", `You've used your ${settings.get().cap} requests for today.`);
        try {
            return await attempt(model, source, opts);
        } catch (e) {
            if (e.name === "AbortError" || source.kind !== "shared" || !["quota", "key", "balance"].includes(e.kind)) throw e;
            markSharedDown();
            const hasImages = opts.messages.some(m => m.images?.length);
            if (hasImages) throw new AIError("quota", "The shared key is out of requests right now. Add your own Gemini key to keep sending images.");
            const quick = MODELS.find(m => m.provider === "quick");
            const r = await attempt(quick, { kind: "quick", key: "" }, opts);
            r.fallbackFrom = model.name;
            return r;
        }
    }

    // For the key dialog: a tiny request that is not counted.
    async function test(provider, key) {
        const model = MODELS.find(m => m.provider === provider);
        const r = await attempt(model, { kind: "own", key }, { messages: [{ role: "user", content: "Reply with the single word OK." }], dry: true });
        return r.text.trim().slice(0, 40);
    }

    // ── images ─────────────────────────────────────────────────────────────
    async function prepareImage(file) {
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error("That file isn't a supported image (PNG, JPEG, WebP or GIF).");
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const g = canvas.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        g.drawImage(bmp, 0, 0, w, h);
        bmp.close?.();
        const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
        const data = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result).split(",")[1]);
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
        });
        return { mime: "image/jpeg", data, w, h };
    }

    // ── chat storage (IndexedDB: chats can hold images, which are too big for localStorage) ──
    let dbp = null;
    const idb = () => dbp ??= new Promise((resolve, reject) => {
        const r = indexedDB.open("paroxysm-ai", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("chats", { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    const tx = async (mode, fn) => {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const t = db.transaction("chats", mode);
            const req = fn(t.objectStore("chats"));
            t.oncomplete = () => resolve(req?.result);
            t.onerror = t.onabort = () => reject(t.error);
        });
    };
    const store = {
        put: chat => tx("readwrite", s => s.put(chat)),
        get: id => tx("readonly", s => s.get(id)),
        delete: id => tx("readwrite", s => s.delete(id)),
        clear: () => tx("readwrite", s => s.clear()),
        // one light entry per chat (no images), with the text lower-cased for searching
        async index() {
            const db = await idb();
            return new Promise((resolve, reject) => {
                const out = [];
                const req = db.transaction("chats").objectStore("chats").openCursor();
                req.onsuccess = () => {
                    const c = req.result;
                    if (!c) return resolve(out);
                    const v = c.value;
                    out.push({ id: v.id, title: v.title, created: v.created, updated: v.updated, pinned: !!v.pinned, text: (v.title + " " + v.messages.map(m => m.content).join(" ")).toLowerCase() });
                    c.continue();
                };
                req.onerror = () => reject(req.error);
            });
        }
    };

    const titleFrom = text => {
        const t = String(text).replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>\[\]()]/g, "").replace(/\s+/g, " ").trim();
        if (!t) return "New chat";
        const cut = t.length > 48 ? t.slice(0, 48).replace(/\s+\S*$/, "") + "…" : t;
        return cut.charAt(0).toUpperCase() + cut.slice(1);
    };

    // ── markdown → HTML (everything is escaped; only our own tags come out) ──
    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

    // ── LaTeX → MathML ─────────────────────────────────────────────────────
    // Models write equations as LaTeX (\[ ... \], \( ... \), $$ ... $$, $ ... $). We turn the common subset into
    // MathML, which Chrome lays out natively (fractions, roots, sub- and superscripts, matrices). Anything we
    // don't understand is shown as its own \command, so nothing is lost. Written for paroxysm, no libraries.
    const GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω" };
    const OPS = { times: "×", cdot: "⋅", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆", circ: "∘", bullet: "•", oplus: "⊕", otimes: "⊗", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼", simeq: "≃", cong: "≅", propto: "∝", ll: "≪", gg: "≫", perp: "⊥", parallel: "∥", mid: "∣", in: "∈", notin: "∉", ni: "∋", subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖", land: "∧", wedge: "∧", lor: "∨", vee: "∨", to: "→", rightarrow: "→", leftarrow: "←", gets: "←", leftrightarrow: "↔", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", longrightarrow: "⟶", longleftarrow: "⟵", longleftrightarrow: "⟷", Longrightarrow: "⟹", Longleftarrow: "⟸", Longleftrightarrow: "⟺", implies: "⟹", impliedby: "⟸", iff: "⟺", mapsto: "↦", longmapsto: "⟼", rightleftharpoons: "⇌", leftrightharpoons: "⇋", uparrow: "↑", downarrow: "↓", updownarrow: "↕", nearrow: "↗", searrow: "↘", therefore: "∴", because: "∵", cdotp: "⋅", colon: ":", lt: "<", gt: ">" };
    const ORD = { infty: "∞", partial: "∂", nabla: "∇", hbar: "ℏ", ell: "ℓ", emptyset: "∅", varnothing: "∅", angle: "∠", degree: "°", aleph: "ℵ", Re: "ℜ", Im: "ℑ", prime: "′", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", triangle: "△", square: "□", checkmark: "✓", imath: "ı", jmath: "ȷ", wp: "℘", top: "⊤", bot: "⊥" };
    const BIGOPS = { sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮", bigcup: "⋃", bigcap: "⋂", bigoplus: "⨁", bigotimes: "⨂", bigvee: "⋁", bigwedge: "⋀" };
    const LIMITS = new Set(["sum", "prod", "coprod", "bigcup", "bigcap", "bigoplus", "bigotimes", "bigvee", "bigwedge", "lim", "limsup", "liminf", "max", "min", "sup", "inf", "det", "gcd", "Pr"]);
    const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth", "log", "ln", "lg", "exp", "lim", "limsup", "liminf", "max", "min", "sup", "inf", "det", "gcd", "deg", "dim", "ker", "arg", "hom", "Pr", "mod"]);
    const DELIMS = { "{": "{", "}": "}", "|": "‖", lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", vert: "|", Vert: "‖", lvert: "|", rvert: "|", lVert: "‖", rVert: "‖", lbrack: "[", rbrack: "]" };
    const ESCAPED = { "%": "%", "&": "&", "$": "$", "#": "#", "_": "_" };
    const SPACES = { ",": ".1667", ":": ".2222", ">": ".2222", ";": ".2778", "!": "-.1667", " ": ".25", quad: "1", qquad: "2", enspace: ".5", thinspace: ".1667", medspace: ".2222", thickspace: ".2778", negthinspace: "-.1667" };
    const ACCENTS = { vec: "→", hat: "^", widehat: "^", bar: "¯", overline: "¯", tilde: "~", widetilde: "~", dot: "˙", ddot: "¨", dddot: "⃛", overrightarrow: "→", overleftarrow: "←", overleftrightarrow: "↔", check: "ˇ", breve: "˘", acute: "´", grave: "`", mathring: "˚" };
    const IGNORE = new Set(["displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "limits", "nolimits", "mathstrut", "relax", "nonumber", "notag", "allowbreak", "hfill", "strut", "left.", "protect", "bigstrut"]);
    const TEXTLIKE = new Set(["text", "textrm", "textbf", "textit", "textsf", "texttt", "mbox", "operatorname", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathbb", "mathcal", "mathscr", "mathfrak", "boldsymbol", "bm", "ce", "pu"]);
    const BIG = new Set(["big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr", "bigm", "Bigm"]);
    const ENV_FENCE = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""], dcases: ["{", ""] };
    const ENV_ALIGNED = /^(aligned|align\*?|alignat\*?|split|eqnarray\*?|gather\*?|gathered|multline\*?|flalign\*?)$/;

    function styled(s, up, low, digit, special = {}) {
        return [...s].map(ch => {
            if (special[ch]) return special[ch];
            const c = ch.codePointAt(0);
            if (c >= 65 && c <= 90) return String.fromCodePoint(up + c - 65);
            if (c >= 97 && c <= 122) return String.fromCodePoint(low + c - 97);
            if (digit && c >= 48 && c <= 57) return String.fromCodePoint(digit + c - 48);
            return ch;
        }).join("");
    }
    const bold = s => styled(s, 0x1D400, 0x1D41A, 0x1D7CE);
    const blackboard = s => styled(s, 0x1D538, 0x1D552, 0x1D7D8, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" });
    const script = s => styled(s, 0x1D49C, 0x1D4B6, 0, { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" });

    function braced(s, i) {                                   // s[i] is "{": the text up to the matching "}"
        let depth = 0;
        for (let j = i; j < s.length; j++) {
            const c = s[j];
            if (c === "\\") { j++; continue; }
            if (c === "{") depth++;
            else if (c === "}" && !--depth) return [s.slice(i + 1, j), j + 1];
        }
        return [s.slice(i + 1), s.length];
    }

    function tokenize(s) {
        const out = [], CMD = /\\([A-Za-z]+|[\s\S])/y, NUM = /\d+(?:\.\d+)?/y;
        let i = 0;
        while (i < s.length) {
            const c = s[i];
            if (c === "\\") {
                CMD.lastIndex = i;
                const m = CMD.exec(s);
                const name = m[1];
                i += m[0].length;
                if (/^[A-Za-z]/.test(name)) while (/\s/.test(s[i] ?? "")) i++;
                if (name === "begin" || name === "end") {
                    if (s[i] === "{") { const [inner, next] = braced(s, i); out.push({ t: name, v: inner.trim() }); i = next; }
                    continue;
                }
                if (TEXTLIKE.has(name)) {
                    let raw = "";
                    if (s[i] === "{") { const [inner, next] = braced(s, i); raw = inner; i = next; }
                    else if (i < s.length) raw = s[i++];
                    out.push({ t: "cmd", v: name, raw });
                    continue;
                }
                out.push({ t: "cmd", v: name });
            } else if (c === "{" || c === "}" || c === "^" || c === "_" || c === "&") {
                out.push({ t: c }); i++;
            } else if (/\s/.test(c)) {
                i++;
            } else if (/\d/.test(c)) {
                NUM.lastIndex = i;
                const m = NUM.exec(s);
                out.push({ t: "num", v: m[0] }); i += m[0].length;
            } else if (/[A-Za-z]/.test(c)) {
                out.push({ t: "id", v: c }); i++;
            } else {
                out.push({ t: "op", v: c }); i++;
            }
        }
        return out;
    }

    // a simple version of mhchem's \ce{...}: formulas, charges, arrows and state symbols
    function ceToTex(s) {
        const ARROWS = { "<->": "\\leftrightarrow ", "<=>": "\\rightleftharpoons ", "->": "\\longrightarrow ", "<-": "\\longleftarrow ", "=>": "\\Rightarrow " };
        let out = "", i = 0, afterElement = false, m;
        while (i < s.length) {
            const rest = s.slice(i);
            if ((m = /^(<->|<=>|->|<-|=>)/.exec(rest))) { out += " " + ARROWS[m[1]] + " "; afterElement = false; }
            else if ((m = /^\((s|l|g|aq)\)/.exec(rest))) { out += `\\mathrm{(${m[1]})}`; afterElement = false; }
            else if ((m = /^[A-Z][a-z]?/.exec(rest))) { out += `\\mathrm{${m[0]}}`; afterElement = true; }
            else if ((m = /^\d+/.exec(rest))) { out += afterElement ? `_{${m[0]}}` : m[0]; afterElement = false; }
            else if ((m = /^\^\{?([\d+-]*[+-]|[\d+-]+)\}?/.exec(rest))) { out += `^{${m[1].replace(/-/g, "−")}}`; afterElement = false; }
            else if ((m = /^\)/.exec(rest))) { out += ")"; afterElement = true; }
            else { m = [rest[0]]; out += rest[0]; afterElement = false; }
            i += m[0].length;
        }
        return out;
    }

    function textLike(name, raw) {
        raw = raw.replace(/\\([A-Za-z]+)/g, (m, n) => GREEK[n] ?? (/^(,|;|:|!|quad|qquad)$/.test(n) ? " " : ""))
            .replace(/\\([ ,;:!])/g, " ").replace(/\\([_%&$#{}])/g, "$1").replace(/[{}]/g, "").replace(/~/g, " ");
        const text = esc(raw).replace(/ /g, "&#160;");
        switch (name) {
            case "mathrm": case "operatorname": return `<mi mathvariant="normal">${esc(raw)}</mi>`;
            case "mathbf": case "boldsymbol": case "bm": return `<mi>${esc(bold(raw))}</mi>`;
            case "mathbb": return `<mi>${esc(blackboard(raw))}</mi>`;
            case "mathcal": case "mathscr": return `<mi>${esc(script(raw))}</mi>`;
            case "mathit": case "mathsf": case "mathtt": case "mathfrak": return `<mi>${esc(raw)}</mi>`;
            case "textbf": return `<mtext style="font-weight:700">${text}</mtext>`;
            case "textit": return `<mtext style="font-style:italic">${text}</mtext>`;
            case "texttt": return `<mtext style="font-family:monospace">${text}</mtext>`;
            default: return `<mtext>${text}</mtext>`;
        }
    }

    function latexToMathML(tex, display) {
        const toks = tokenize(tex);
        let p = 0;
        const mspace = w => `<mspace width="${w}em"></mspace>`;
        const mo = (v, extra = "") => `<mo${extra}>${esc(v)}</mo>`;
        const EMPTY = "<mrow></mrow>";

        function seq(stop) {
            const nodes = [];
            while (p < toks.length && !stop(toks[p])) {
                if (toks[p].t === "cmd" && toks[p].v === "over") {            // {a \over b}
                    p++;
                    const den = seq(stop);
                    return `<mfrac><mrow>${nodes.join("")}</mrow><mrow>${den}</mrow></mfrac>`;
                }
                const a = atom();
                if (a) nodes.push(scripts(a));
            }
            return nodes.join("");
        }

        function arg() {                                                      // one braced group or one token
            const t = toks[p];
            if (!t || t.t === "}" || t.t === "&" || t.t === "^" || t.t === "_") return EMPTY;
            if (t.t === "{") { p++; const inner = seq(x => x.t === "}"); p++; return `<mrow>${inner}</mrow>`; }
            if (t.t === "num" && t.v.length > 1 && !t.v.includes(".")) { toks[p] = { t: "num", v: t.v.slice(1) }; return `<mn>${t.v[0]}</mn>`; }
            return atom()?.ml ?? EMPTY;
        }
        const optArg = () => {                                                // [ ... ]
            if (toks[p]?.t !== "op" || toks[p].v !== "[") return null;
            p++;
            const inner = seq(x => x.t === "op" && x.v === "]");
            p++;
            return `<mrow>${inner}</mrow>`;
        };
        function delimiter() {
            const t = toks[p++];
            if (!t) return "";
            if (t.t === "op") return t.v;
            if (t.t === "cmd") return DELIMS[t.v] ?? OPS[t.v] ?? "";
            if (t.t === "id" || t.t === "num") return t.v;
            return "";
        }
        const fence = (d, open) => d && d !== "." ? mo(d, ' stretchy="true"') : "";

        function scripts(a) {
            let sub = null;
            const sup = [];
            for (;;) {
                const t = toks[p];
                if (t?.t === "^") { p++; sup.push(arg()); }
                else if (t?.t === "_") { p++; sub = arg(); }
                else if (t?.t === "op" && t.v === "'") { p++; sup.push("<mo>\u2032</mo>"); }
                else break;
            }
            const up = !sup.length ? null : sup.length === 1 ? sup[0] : `<mrow>${sup.join("")}</mrow>`;
            if (sub == null && up == null) return a.ml;
            const base = a.ml;
            if (a.limits) return sub != null && up != null ? `<munderover>${base}${sub}${up}</munderover>` : sub != null ? `<munder>${base}${sub}</munder>` : `<mover>${base}${up}</mover>`;
            return sub != null && up != null ? `<msubsup>${base}${sub}${up}</msubsup>` : sub != null ? `<msub>${base}${sub}</msub>` : `<msup>${base}${up}</msup>`;
        }

        function table(rows, cls) {
            return `<mtable${cls ? ` class="${cls}"` : ""}>${rows.map(r => `<mtr>${r.map(c => `<mtd>${c}</mtd>`).join("")}</mtr>`).join("")}</mtable>`;
        }
        function environment(name) {
            const base = name.replace(/\*$/, "");
            if (base === "array" && toks[p]?.t === "{") { p++; seq(x => x.t === "}"); p++; }
            const rows = [];
            let row = [];
            while (p < toks.length && toks[p].t !== "end") {
                row.push(seq(x => x.t === "&" || x.t === "end" || (x.t === "cmd" && x.v === "\\")));
                const t = toks[p];
                if (t?.t === "&") { p++; continue; }
                if (t?.t === "cmd" && t.v === "\\") { p++; rows.push(row); row = []; }
            }
            if (row.length) rows.push(row);
            if (toks[p]?.t === "end") p++;
            const cls = ENV_ALIGNED.test(name) ? "m-aligned" : base === "cases" || base === "dcases" ? "m-cases" : "";
            const t = table(rows, cls);
            const f = ENV_FENCE[base];
            if (f) return { ml: `<mrow>${mo(f[0], ' stretchy="true"')}${t}${f[1] ? mo(f[1], ' stretchy="true"') : ""}</mrow>` };
            return { ml: t };
        }

        function command(t) {
            const n = t.v;
            if (TEXTLIKE.has(n)) {
                if (n === "ce") return { ml: `<mrow>${latexToMathML.inner(ceToTex(t.raw ?? ""))}</mrow>` };
                if (n === "pu") return { ml: `<mtext>${esc(t.raw ?? "").replace(/ /g, "&#160;")}</mtext>` };
                return { ml: textLike(n, t.raw ?? "") };
            }
            if (GREEK[n]) return { ml: `<mi>${GREEK[n]}</mi>` };
            if (n in BIGOPS) return { ml: `<mo largeop="true">${BIGOPS[n]}</mo>`, limits: LIMITS.has(n) };
            if (FUNCS.has(n)) return { ml: `<mi>${n}</mi>`, limits: LIMITS.has(n) };
            if (n in OPS) return { ml: mo(OPS[n]) };
            if (n in ORD) return { ml: `<mi mathvariant="normal">${ORD[n]}</mi>` };
            if (n in DELIMS) return { ml: mo(DELIMS[n], ' stretchy="false"') };
            if (n in ESCAPED) return { ml: `<mtext>${esc(ESCAPED[n])}</mtext>` };
            if (n in SPACES) return { ml: mspace(SPACES[n]) };
            if (n in ACCENTS) return { ml: `<mover accent="true">${arg()}${mo(ACCENTS[n])}</mover>` };
            if (IGNORE.has(n)) return null;
            if (BIG.has(n)) return { ml: mo(delimiter(), ' stretchy="false"') };
            switch (n) {
                case "frac": case "dfrac": case "tfrac": case "cfrac": { const a = arg(), b = arg(); return { ml: `<mfrac>${a}${b}</mfrac>` }; }
                case "binom": case "dbinom": case "tbinom": { const a = arg(), b = arg(); return { ml: `<mrow>${mo("(", ' stretchy="true"')}<mfrac linethickness="0">${a}${b}</mfrac>${mo(")", ' stretchy="true"')}</mrow>` }; }
                case "sqrt": { const idx = optArg(); const a = arg(); return { ml: idx ? `<mroot>${a}${idx}</mroot>` : `<msqrt>${a}</msqrt>` }; }
                case "left": { const open = delimiter(); const inner = seq(x => x.t === "cmd" && x.v === "right"); p++; const close = delimiter(); return { ml: `<mrow>${fence(open)}${inner}${fence(close)}</mrow>` }; }
                case "right": return null;
                case "middle": return { ml: mo(delimiter(), ' stretchy="true"') };
                case "underline": return { ml: `<munder accent="true">${arg()}${mo("_")}</munder>` };
                case "xrightarrow": case "xleftarrow": case "xlongequal": case "xRightarrow": {
                    const arrow = { xrightarrow: "⟶", xleftarrow: "⟵", xlongequal: "═", xRightarrow: "⟹" }[n];
                    const below = optArg(), above = arg();
                    return { ml: below ? `<munderover>${mo(arrow)}${below}${above}</munderover>` : `<mover>${mo(arrow)}${above}</mover>` };
                }
                case "overset": case "stackrel": { const a = arg(), b = arg(); return { ml: `<mover>${b}${a}</mover>` }; }
                case "underset": { const a = arg(), b = arg(); return { ml: `<munder>${b}${a}</munder>` }; }
                case "boxed": return { ml: `<mrow style="border:1px solid currentColor;padding:.2em .35em">${arg()}</mrow>` };
                case "cancel": case "bcancel": case "xcancel": case "sout": case "mathop": case "mathrel": case "mathbin": case "mathord": case "mathpunct": case "mathclose": case "mathopen": case "substack": return { ml: arg() };
                case "pmod": return { ml: `<mrow><mo>(</mo><mi>mod</mi>${mspace(".25")}${arg()}<mo>)</mo></mrow>` };
                case "bmod": return { ml: `<mo>mod</mo>` };
                case "color": arg(); return null;
                case "textcolor": case "colorbox": arg(); return { ml: arg() };
                case "label": case "tag": case "phantom": case "hphantom": case "vphantom": case "hspace": case "vspace": case "rule": arg(); return null;
                case "\\": case "cr": return null;
                case "not": return { ml: mo("\u0338") };
                default: return { ml: `<mtext>${esc("\\" + n)}</mtext>` };
            }
        }

        function atom() {
            const t = toks[p++];
            switch (t.t) {
                case "{": { const inner = seq(x => x.t === "}"); p++; return { ml: `<mrow>${inner}</mrow>` }; }
                case "^": case "_": p--; return { ml: EMPTY };                  // a script with no base, as in {}^{14}C
                case "}": case "&": case "end": return null;
                case "begin": return environment(t.v);
                case "num": return { ml: `<mn>${t.v}</mn>` };
                case "id": return { ml: `<mi>${t.v}</mi>` };
                case "cmd": return command(t);
                default: {
                    const v = t.v;
                    if (v === "-") return { ml: mo("−") };
                    if (v === "*") return { ml: mo("∗") };
                    if (v === "~") return { ml: mspace(".25") };
                    if ("()[]|".includes(v)) return { ml: mo(v, ' stretchy="false"') };
                    return { ml: mo(v) };
                }
            }
        }

        const inner = seq(() => false);
        return display ? `<math display="block" class="tex" data-nomask>${inner}</math>` : `<math class="tex" data-nomask>${inner}</math>`;
    }
    latexToMathML.inner = tex => latexToMathML(tex, false).replace(/^<math[^>]*>|<\/math>$/g, "");

    function mathHtml(entry) {
        try {
            return latexToMathML(entry.tex, entry.display);
        } catch (e) {
            return `<code class="math-raw">${esc(entry.tex)}</code>`;
        }
    }

    // Pull the math out before markdown runs (markdown would eat the underscores), leaving code untouched.
    function extractMath(src, store) {
        const re = new RegExp([
            "(?<fence>(?:^|\\n)(?:`{3}|~{3})[\\s\\S]*?(?:\\n(?:`{3}|~{3})[^\\n]*|$))",
            "(?<code>`[^`\\n]*`)",
            "\\\\\\[(?<d1>[\\s\\S]+?)\\\\\\]",
            "\\$\\$(?<d2>[\\s\\S]+?)\\$\\$",
            "(?<env>\\\\begin\\{(?<envname>(?:aligned|align|alignat|gather|equation|split|multline|eqnarray|flalign|cases|[pbBvV]?matrix|array)\\*?)\\}[\\s\\S]*?\\\\end\\{\\k<envname>\\})",
            "\\\\\\((?<i1>[\\s\\S]+?)\\\\\\)",
            "\\$(?![\\s$])(?<i2>(?:\\\\[\\s\\S]|[^$\\\\\\n])+?)(?<![\\s\\\\])\\$(?!\\d)"
        ].join("|"), "g");
        return src.replace(re, (m, ...rest) => {
            const g = rest.at(-1);
            if (g.fence !== undefined || g.code !== undefined) return m;
            const display = g.d1 !== undefined || g.d2 !== undefined || g.env !== undefined;
            store.push({ tex: String(g.d1 ?? g.d2 ?? g.env ?? g.i1 ?? g.i2).trim(), display });
            return `\u0001${store.length - 1}\u0002`;
        });
    }
    let mathStore = null;

    function inline(s) {
        const codes = [];
        s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
        s = esc(s);
        s = s.replace(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`);
        s = s.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\w)/g, "$1<em>$2</em>");
        s = s.replace(/(^|[^_\w])_([^_\s][^_\n]*?)_(?!\w)/g, "$1<em>$2</em>");
        s = s.replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");
        s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" data-ext>${t}</a>`);
        s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, p, u) => `${p}<a href="${u}" data-ext>${u}</a>`);
        s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
        return s.replace(/\u0001(\d+)\u0002/g, (_, i) => mathStore?.[i] ? mathHtml(mathStore[i]) : "");
    }

    const KEYWORDS = "abstract|and|as|async|await|break|case|catch|class|const|continue|def|default|del|do|elif|else|enum|except|export|extends|false|final|finally|fn|for|from|func|function|if|implements|import|in|interface|is|lambda|let|loop|match|mod|new|nil|none|not|null|of|or|package|pass|private|protected|pub|public|raise|return|self|static|struct|super|switch|then|this|throw|true|try|type|typeof|use|using|var|void|while|with|yield|int|float|str|string|bool|boolean|char|double|long|print|println|echo|fi|done|namespace|template";
    function highlight(code, lang) {
        const hash = /^(py|python|sh|bash|shell|zsh|yaml|yml|toml|ruby|rb|r|perl|ini|dockerfile|makefile|powershell|ps1)$/i.test(lang);
        const slash = !/^(py|python|sh|bash|shell|zsh|yaml|yml|toml|ini|text|txt|plain|md|markdown|output)$/i.test(lang);
        const comments = [hash ? "#[^\\n]*" : "", slash ? "//[^\\n]*|/\\*[\\s\\S]*?(?:\\*/|$)" : ""].filter(Boolean).join("|") || "(?!)";
        const re = new RegExp(`(${comments})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|\\b(\\d[\\d_.]*)\\b|\\b(${KEYWORDS})\\b`, "gi");
        let out = "", last = 0, m;
        while ((m = re.exec(code))) {
            out += esc(code.slice(last, m.index));
            const cls = m[1] != null ? "c" : m[2] != null ? "s" : m[3] != null ? "n" : "k";
            out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
            last = m.index + m[0].length;
            if (!m[0]) re.lastIndex++;
        }
        return out + esc(code.slice(last));
    }
    const codeBlock = (code, lang) =>
        `<div class="code" data-nomask><div class="code-head"><span>${esc(lang || "code")}</span><button type="button" class="code-copy" data-copy>Copy</button></div><pre><code>${highlight(code, lang || "")}</code></pre></div>`;

    const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    function buildList(items, pos, indent) {
        const ordered = items[pos].ordered;
        let html = "";
        while (pos < items.length && items[pos].indent >= indent) {
            const it = items[pos++];
            let inner = inline(it.text);
            if (pos < items.length && items[pos].indent > it.indent) { const r = buildList(items, pos, items[pos].indent); inner += r.html; pos = r.pos; }
            html += `<li>${inner}</li>`;
        }
        return { html: `<${ordered ? "ol" : "ul"}>${html}</${ordered ? "ol" : "ul"}>`, pos };
    }

    function render(src) {
        const top = mathStore === null;
        if (top) {
            mathStore = [];
            src = extractMath(String(src ?? "").replace(/[\u0000-\u0002]/g, "").replace(/\r\n?/g, "\n"), mathStore);
        }
        try { return renderBlocks(String(src ?? "")); } finally { if (top) mathStore = null; }
    }

    function renderBlocks(src) {
        const lines = src.replace(/\r\n?/g, "\n").split("\n");
        const out = [], n = lines.length;
        const blank = l => !l.trim();
        const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        const sep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
        let i = 0, m;
        while (i < n) {
            const l = lines[i];
            if (blank(l)) { i++; continue; }
            if ((m = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(l))) {
                const close = new RegExp("^\\s{0,3}" + (m[1][0] === "`" ? "`" : "~") + "{" + m[1].length + ",}\\s*$");
                const body = [];
                i++;
                while (i < n && !close.test(lines[i])) body.push(lines[i++]);
                i++;
                out.push(codeBlock(body.join("\n"), m[2]));
                continue;
            }
            if ((m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(l))) { const h = m[1].length + 1; out.push(`<h${h}>${inline(m[2])}</h${h}>`); i++; continue; }
            if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
            if (/^\s*>/.test(l)) {
                const q = [];
                while (i < n && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
                out.push(`<blockquote>${render(q.join("\n"))}</blockquote>`);
                continue;
            }
            if (l.includes("|") && i + 1 < n && sep(lines[i + 1])) {
                const head = cells(l), rows = [];
                i += 2;
                while (i < n && lines[i].includes("|") && !blank(lines[i])) rows.push(cells(lines[i++]));
                out.push(`<div class="tbl"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
                continue;
            }
            if (LIST_ITEM.test(l)) {
                const items = [];
                while (i < n) {
                    const li = LIST_ITEM.exec(lines[i]);
                    if (li) {
                        const item = { indent: li[1].replace(/\t/g, "    ").length, ordered: /\d/.test(li[2]), text: li[3] };
                        if (items.length && item.indent === items[0].indent && item.ordered !== items[0].ordered) break;     // a bullet list followed by a numbered one
                        items.push(item); i++; continue;
                    }
                    if (blank(lines[i]) && i + 1 < n && LIST_ITEM.test(lines[i + 1])) { i++; continue; }
                    if (/^\s{2,}\S/.test(lines[i]) && items.length) { items.at(-1).text += " " + lines[i].trim(); i++; continue; }
                    break;
                }
                out.push(buildList(items, 0, items[0].indent).html);
                continue;
            }
            const p = [];
            do { p.push(lines[i++]); }
            while (i < n && !blank(lines[i]) && !/^\s{0,3}(`{3,}|~{3,}|#{1,4}\s|>)/.test(lines[i]) && !LIST_ITEM.test(lines[i]) && !(lines[i].includes("|") && i + 1 < n && sep(lines[i + 1])));
            const solo = /^\u0001(\d+)\u0002$/.exec(p.join("\n").trim());
            if (solo && mathStore?.[solo[1]]?.display) out.push(`<div class="mathbox">${mathHtml(mathStore[solo[1]])}</div>`);
            else out.push(`<p>${p.map(inline).join("<br>")}</p>`);
        }
        return out.join("");
    }

    window.paroxysmAI = {
        MODELS, PROVIDERS, modelById, settings, keys, usage, capLeft, nextReset, resolve, defaultModelId,
        run, test, prepareImage, store, render, titleFrom, AIError, markSharedDown, sharedDown, puter
    };
})();
