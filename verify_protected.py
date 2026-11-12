#!/usr/bin/env python3
"""Verify the protected proxy files are byte-for-byte unchanged.
Run from the project folder:  python3 verify_protected.py [protected.sha256]
"""
import hashlib, sys, os
listing = sys.argv[1] if len(sys.argv) > 1 else "protected.sha256"
bad = 0
for line in open(listing, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    want, path = line.split(None, 1)
    path = path.lstrip("*").strip()
    if not os.path.exists(path):
        print("MISSING ", path); bad += 1; continue
    got = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if got == want:
        print("ok      ", path)
    else:
        print("CHANGED ", path); bad += 1
print("\nALL PROTECTED FILES UNCHANGED" if not bad else f"\n{bad} PROBLEM(S) FOUND")
sys.exit(1 if bad else 0)
