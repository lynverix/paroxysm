// publishes a release: m.json pinned to current commit, commit and push, refresh jsDelivr @main: node tools/release.mjs [--dry-run]
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build, root, write } from "./make-manifest.mjs";

const dry = process.argv.includes("--dry-run");
const git = args => execSync("git " + args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const stop = msg => { console.error("release stopped: " + msg); process.exit(1); };

const [, owner, repo] = git("remote get-url origin").match(/github\.com[/:]([^/]+)\/([^/.]+)/) || stop("origin is not a GitHub repository");
if (git("rev-parse --abbrev-ref HEAD") !== "main") stop("switch to the main branch first");
if (git("status --porcelain")) stop("commit or stash your changes first");
git("fetch origin main");
if (git("rev-list --count HEAD..origin/main") !== "0") stop("origin/main has commits you don't have; pull first");

for (const line of readFileSync(join(root, "protected.sha256"), "utf8").split("\n")) {
    const [hash, file] = line.trim().split(/\s+/);
    if (!file) continue;
    if (createHash("sha256").update(readFileSync(join(root, file))).digest("hex") !== hash) stop(file + " differs from protected.sha256");
}

const version = readFileSync(join(root, "paroxysm.config.js"), "utf8").match(/version:\s*"([^"]+)"/)?.[1] ?? "unknown";
const ref = git("rev-parse HEAD");
const manifest = build(ref);
console.log(`release ${version}: files from ${owner}/${repo}@${ref.slice(0, 7)}, seq ${manifest.seq}`);
if (dry) { console.log("dry run: nothing written, committed or pushed"); process.exit(0); }

write("m.json", manifest);
git("add m.json");
git(`commit -m "Release ${version} (files from ${ref.slice(0, 7)})"`);
git("push origin main");
console.log("pushed " + git("rev-parse --short HEAD"));

// jsDelivr caches @main for up to 12 hours; files themselves come from @ref and never go stale
for (const file of ["m.json", "index.svg", "loader-sw.js"]) {
    const url = `https://purge.jsdelivr.net/gh/${owner}/${repo}@main/${file}`;
    try {
        const r = await fetch(url);
        console.log(`refresh ${file}: ${r.ok ? "ok" : "HTTP " + r.status}`);
    } catch (err) {
        console.log(`refresh ${file} failed (${err.message}); open ${url} by hand`);
    }
}
