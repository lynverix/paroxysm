// writes m.json (sha-256 and size per app file) for loader-sw.js: node tools/make-manifest.mjs
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const SKIP_DIRS = new Set([".git", "tools", "node_modules"]);
const SKIP_FILES = new Set(["m.json", "loader-sw.js", "sw.js", "protected.sha256", ".gitattributes", ".gitignore"]);
const SKIP_EXT = [".md", ".py"];

const SW = ["controller/controller.sw.js", "sw-glue.js"];

// enough to show shell and proxy a page
const BOOT = [
    "index.html",
    "paroxysm.css",
    "paroxysm-settings.js",
    "paroxysm.config.js",
    "paroxysm-cloak.js",
    "scramjet/scramjet.js",
    "scramjet/scramjet.wasm",
    "controller/controller.api.js",
    "controller/controller.inject.js",
    "paroxysm-adapter.js",
    "epoxy/index.js",
    "paroxysm-transport.js",
    "newtab.html",
    "newtab-bg.js",
    "paroxysm-rise.js",
    "fonts/inter-latin-wght-normal.woff2",
    "assets/paroxysm/paroxysm_darkmode_icon.png",
    "assets/paroxysm/paroxysm_lightmode_icon.png",
    "assets/paroxysm/paroxysm_darkmode_logo.png",
    "assets/paroxysm/paroxysm_lightmode_logo.png",
    ...SW
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (!SKIP_DIRS.has(name)) walk(full, out);
        } else if (!SKIP_FILES.has(name) && !SKIP_EXT.some(ext => name.endsWith(ext))) {
            out.push(relative(root, full).split(sep).join("/"));
        }
    }
    return out;
}

let ref = "dev";
try { ref = execSync("git rev-parse HEAD", { cwd: root }).toString().trim(); } catch {}

const files = {};
for (const path of walk(root).sort()) {
    const data = readFileSync(join(root, path));
    files[path] = [createHash("sha256").update(data).digest("base64"), data.length];
}

const missing = BOOT.filter(p => !files[p]);
if (missing.length) throw new Error("boot files missing: " + missing.join(", "));

const manifest = {
    v: 1,
    seq: Date.now(),
    ref,
    sw: SW,
    docs: Object.keys(files).filter(p => p.endsWith(".html")),
    boot: [...new Set(BOOT)],
    warm: Object.keys(files).filter(p => !BOOT.includes(p) && !p.endsWith(".map")),
    files
};

writeFileSync(join(root, "m.json"), JSON.stringify(manifest, null, 1) + "\n");
const bytes = list => list.reduce((n, p) => n + files[p][1], 0);
console.log(`m.json: ${Object.keys(files).length} files, boot ${manifest.boot.length} (${(bytes(manifest.boot) / 1e6).toFixed(1)} MB), warm ${manifest.warm.length}, seq ${manifest.seq}, ref ${ref.slice(0, 7)}`);
