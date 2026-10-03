#!/usr/bin/env python3
"""J0 native/sanitized/WASM builds. Dependencies must already be fetched."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
lock = json.loads((ROOT / 'packages/emulator/chips.lock.json').read_text())
for relative, expected in lock['files'].items():
    path = ROOT / '.cache/chips' / relative
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit('Run npm run chips:fetch first: missing/mismatching ' + relative)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('target', choices=['native', 'test', 'wasm'])
args = parser.parse_args()
out = ROOT / 'out'
out.mkdir(exist_ok=True)
common = ['-std=c11', '-Wall', '-Wextra', '-Werror', '-I' + str(ROOT / '.cache/chips')]
if args.target == 'wasm':
    compiler = os.environ.get('EMCC', 'emcc')
    version = subprocess.check_output([compiler, '--version'], text=True)
    if not re.search(r'\b' + re.escape(lock['emscripten']) + r'\b', version.splitlines()[0]):
        raise SystemExit('Expected Emscripten ' + lock['emscripten'])
    exports = re.findall(r'\b(cpc_bridge_\w+)\s*\(', (ROOT / 'packages/emulator/src/cpc_bridge.h').read_text())
    command = [compiler, *common, '-O2', str(ROOT / 'packages/emulator/src/cpc_bridge.c'),
        '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,node', '-sFILESYSTEM=0',
        '-sALLOW_MEMORY_GROWTH=0', '-sINITIAL_MEMORY=16777216', '-sSTACK_SIZE=1048576',
        '-sASSERTIONS=1', '-sABORTING_MALLOC=0', '-sEXPORTED_RUNTIME_METHODS=["HEAPU8","HEAPF32"]',
        '-sEXPORTED_FUNCTIONS=' + json.dumps(['_malloc', '_free'] + ['_' + name for name in exports]),
        '-o', str(out / 'cpc.mjs')]
else:
    compiler = os.environ.get('CC', 'gcc')
    command = [compiler, *common, '-g', '-O1', '-fsanitize=address,undefined', '-fno-omit-frame-pointer',
        str(ROOT / 'tests/native_bridge.c'), '-lm', '-o', str(out / 'native-bridge-test')]
subprocess.run(command, check=True, cwd=ROOT)
print('Built ' + args.target)
if args.target == 'test':
    subprocess.run(['node', 'scripts/disk-cli.mjs', 'build', 'examples/hello-cpc/src/main.bas', 'out/hello.dsk'], check=True, cwd=ROOT)
    env = dict(os.environ)
    env.setdefault('ASAN_OPTIONS', 'detect_leaks=1:halt_on_error=1')
    env.setdefault('UBSAN_OPTIONS', 'halt_on_error=1:print_stacktrace=1')
    subprocess.run([str(out / 'native-bridge-test'), str(out / 'hello.dsk')], check=True, env=env)
