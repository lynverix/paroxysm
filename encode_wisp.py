"""Encode wisp server URLs for paroxysm.config.js.

Usage (Windows):   python encode_wisp.py urls.txt
                   python encode_wisp.py            (then paste URLs, one per line, and press Ctrl+Z, Enter)

urls.txt holds one ws:// or wss:// URL per line. Keep it out of git (it is the readable list).
The output is the text to paste between the brackets of wispServers in paroxysm.config.js.
This is the same reversed-and-base64 idea Fern uses: it hides the URLs from a casual look,
it does not make them secret.
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