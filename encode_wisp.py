"""Encode wisp URLs for paroxysm.config.js.

Usage: python encode_wisp.py urls.txt
Or run without arguments and paste URLs (finish with Ctrl+Z then Enter on Windows).

urls.txt holds one ws:// or wss:// URL per line; keep it out of git.
Output goes between the brackets of wispServers. It hides URLs from casual view and is not a secret.
"""
import base64
import sys

def encode(url):
    return base64.b64encode(url[::-1].encode()).decode()

def main():
    text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    urls = [line.strip() for line in text.splitlines() if line.strip() and not line.startswith("#")]
    bad = [u for u in urls if not u.lower().startswith(("ws://", "wss://"))]
    if bad:
        sys.exit("These do not start with ws:// or wss://: " + ", ".join(bad))
    print(",\n".join('        "%s"' % encode(u) for u in urls))

if __name__ == "__main__":
    main()