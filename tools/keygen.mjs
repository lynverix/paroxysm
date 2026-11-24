// creates release signing key once: node tools/keygen.mjs; private key stays outside repository, public key goes into loader-sw.js
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const KEY_FILE = process.env.PAROXYSM_KEY || join(homedir(), ".paroxysm", "signing-key.json");

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (existsSync(KEY_FILE)) {
        console.error("a signing key already exists at " + KEY_FILE + "; delete it first if you really want a new one");
        process.exit(1);
    }
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    mkdirSync(dirname(KEY_FILE), { recursive: true });
    writeFileSync(KEY_FILE, JSON.stringify(privateKey.export({ format: "jwk" })) + "\n", { mode: 0o600 });
    const { x, y } = publicKey.export({ format: "jwk" });
    console.log("private key written to " + KEY_FILE + " (back it up; never commit it)");
    console.log("public key for KEYS in loader-sw.js:");
    console.log(`    { kty: "EC", crv: "P-256", x: "${x}", y: "${y}" }`);
}
