#!/usr/bin/env python3
"""Fetch only locked emulator headers; no firmware, immutable SHA + byte hashes."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
lock = json.loads((ROOT / 'packages/emulator/chips.lock.json').read_text())
for relative, expected in lock['files'].items():
    target = ROOT / '.cache/chips' / relative
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
        continue
    url = f"https://raw.githubusercontent.com/floooh/chips/{lock['commit']}/{relative}"
    with urllib.request.urlopen(url, timeout=30) as response:
        content = response.read(2 * 1024 * 1024)
    if hashlib.sha256(content).hexdigest() != expected:
        raise SystemExit(f'Hash mismatch: {relative}')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
print(f"Verified {len(lock['files'])} locked chips headers; no ROM downloaded.")
