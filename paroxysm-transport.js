// paroxysm: keeps the Epoxy transport alive after a wisp connection drop.
// Epoxy's client ends for good when its wisp connection closes ("Wisp(MuxTaskEnded)"); every later
// request then fails even though the server is back. This adapter wraps EpoxyTransport from the outside
// (epoxy/index.js is not modified): when a request fails that way it makes a new client with the transport's
// own init(), once the server answers again, and retries the request. Load it after epoxy/index.js.
(() => {
    const T = self.EpoxyTransport?.default;
    if (!T) return;

    const MUX_ENDED = /MuxTaskEnded|Multiplexor task ended/i;
    const ended = e => MUX_ENDED.test(String(e?.message ?? e));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const say = (kind, message, ms) => { try { window.paroxysmPill?.(kind, message, ms); } catch {} };

    function probe(url) {
        return new Promise((resolve, reject) => {
            let ws;
            const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("timed out")); }, 5000);
            try { ws = new WebSocket(url); } catch (e) { clearTimeout(timer); reject(e); return; }
            ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(); };
            ws.onerror = () => { clearTimeout(timer); reject(new Error("connection failed")); };
        });
    }

    // One reconnect at a time per transport; every failing request waits for the same one.
    function reconnect(t, manual = false) {
        if (t.__reconnect) return t.__reconnect;
        return t.__reconnect = (async () => {
            say("warn", manual ? "Reconnecting to the wisp server…" : "Lost the wisp connection. Reconnecting…", 0);
            for (let i = 0; i < 15; i++) {
                try {
                    await probe(t.wisp);
                    await t.init();
                    t.__generation = (t.__generation ?? 0) + 1;
                    say("ok", "Wisp connection restored.", 2500);
                    return true;
                } catch (e) {
                    console.error("[paroxysm] wisp reconnect attempt failed:", e);
                    await sleep(2000);
                }
            }
            say("error", "Can't reach the wisp server. Try Settings > Proxy > Find best server.", 8000);
            return false;
        })().finally(() => { t.__reconnect = null; });
    }

    T.prototype.reconnect = function (manual) { return reconnect(this, manual); };   // the menu's Reconnect item

    const request = T.prototype.request;
    T.prototype.request = async function (...args) {
        for (let attempt = 0; ; attempt++) {
            const generation = this.__generation ?? 0;
            try {
                return await request.apply(this, args);
            } catch (e) {
                if (!ended(e) || attempt >= 2) throw e;
                // a client made after this request started is already fresh; otherwise make one
                const ok = (this.__generation ?? 0) !== generation || await reconnect(this);
                if (!ok || args[2] instanceof ReadableStream) throw e;   // a streamed body cannot be sent twice
            }
        }
    };

    const connect = T.prototype.connect;
    T.prototype.connect = function (url, protocols, headers, onopen, onmessage, onclose, onerror) {
        const start = () => connect.call(this, url, protocols, headers, onopen, onmessage, onclose, err => {
            if (ended(err)) reconnect(this);
            onerror(err);
        });
        if (!this.__reconnect) return start();
        const started = this.__reconnect.then(start);
        return [async data => (await started)[0](data), async (code, reason) => (await started)[1](code, reason)];
    };
})();
