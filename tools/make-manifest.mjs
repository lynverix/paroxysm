// writes m.local.json (sha-256 and size per app file) for testing loader-sw.js on localhost: node tools/make-manifest.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));

const SKIP_DIRS = new Set([".git", "tools", "node_modules"]);
const SKIP_FILES = new Set(["m.json", "m.local.json", "index.svg", "loader-sw.js", "sw.js", "protected.sha256", ".gitattributes", ".gitignore"]);
const SKIP_EXT = [".md", ".py"];

const SW = ["controller/controller.sw.js", "sw-glue.js"];

// enough to show shell and proxy a page
const BOOT = [
    "index.html",
    "paroxysm.css",
    "paroxysm-settings.js",
    "paroxysm.config.js",
    "paroxysm-cloak.js",
    "paroxysm-outer.js",
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

// ref = commit files are fetched from; "local" = loader folder
export function build(ref) {
    const files = {};
    for (const path of walk(root).sort()) {
        const data = readFileSync(join(root, path));
        files[path] = [createHash("sha256").update(data).digest("base64"), data.length];
    }
    const missing = BOOT.filter(p => !files[p]);
    if (missing.length) throw new Error("boot files missing: " + missing.join(", "));
    return {
        v: 1,
        seq: Date.now(),
        ref,
        sw: SW,
        docs: Object.keys(files).filter(p => p.endsWith(".html")),
        boot: [...new Set(BOOT)],
        warm: Object.keys(files).filter(p => !BOOT.includes(p) && !p.endsWith(".map")),
        files
    };
}

// sign(text) returns base64 signature; signed files are { s, m } with m as exact signed text
export function write(name, manifest, sign) {
    const body = JSON.stringify(manifest);
    writeFileSync(join(root, name), (sign ? JSON.stringify({ s: sign(body), m: body }, null, 1) : JSON.stringify(manifest, null, 1)) + "\n");
    const { files, boot, warm } = manifest;
    const bytes = list => list.reduce((n, p) => n + files[p][1], 0);
    console.log(`${name}: ${Object.keys(files).length} files, boot ${boot.length} (${(bytes(boot) / 1e6).toFixed(1)} MB), warm ${warm.length}, seq ${manifest.seq}, ref ${manifest.ref.slice(0, 7)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) write("m.local.json", build("local"));
