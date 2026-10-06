#!/usr/bin/env python3
"""Prepare the locked CPC toolchain on Windows/Linux/macOS; never fetch ROMs."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    lock = json.loads((ROOT / 'packages/emulator/chips.lock.json').read_text())
    subprocess.run([sys.executable, str(ROOT / 'scripts/fetch_chips.py')], check=True, cwd=ROOT)
    compiler = os.environ.get('EMCC') or shutil.which('emcc')
    if not compiler:
        sdk = ROOT / '.cache/emsdk'
        if not shutil.which('git'):
            raise SystemExit('Git requis pour installer le SDK Emscripten figé. Installer Git et relancer npm run build:desktop, ou fournir EMCC.')
        if not sdk.exists():
            sdk.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['git', 'clone', '--depth', '1', '--branch', lock['emscripten'],
                            'https://github.com/emscripten-core/emsdk.git', str(sdk)], check=True, cwd=ROOT)
        commit = subprocess.check_output(['git', '-C', str(sdk), 'rev-parse', 'HEAD'], text=True).strip()
        if commit != lock['emsdkCommit']:
            raise SystemExit('Cache .cache/emsdk différent du commit verrouillé ; conservé sans modification. Fournir EMCC vers Emscripten ' + lock['emscripten'] + '.')
        launcher = [sys.executable, str(sdk / 'emsdk.py')]
        # emsdk reuses complete installations and resumes missing dependencies.
        subprocess.run([*launcher, 'install', lock['emscripten']], check=True, cwd=ROOT)
        subprocess.run([*launcher, 'activate', lock['emscripten']], check=True, cwd=ROOT)
        compiler = str(sdk / 'upstream/emscripten/emcc.py')
    env = dict(os.environ, EMCC=compiler)
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_emulator.py'), 'wasm'], check=True, cwd=ROOT, env=env)


if __name__ == '__main__':
    try:
        prepare()
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit('Préparation CPC interrompue : ' + str(error)) from error
