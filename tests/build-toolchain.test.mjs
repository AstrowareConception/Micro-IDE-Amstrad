import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { engineAvailable, runPython } from '../scripts/emulator-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('un moteur absent, partiel ou tronqué déclenche sa préparation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cpceleste build '));
  try {
    mkdirSync(join(directory, 'out'));
    assert.equal(engineAvailable(directory), false);
    writeFileSync(join(directory, 'out/cpc.mjs'), 'export default function() {}');
    assert.equal(engineAvailable(directory), false);
    writeFileSync(join(directory, 'out/cpc.wasm'), 'truncated');
    assert.equal(engineAvailable(directory), false);
    writeFileSync(join(directory, 'out/cpc.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 0, 1, 0]));
    assert.equal(engineAvailable(directory), true);
    writeFileSync(join(directory, 'out/cpc.mjs'), '');
    assert.equal(engineAvailable(directory), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Python absent fournit une instruction portable et échoue sans télécharger', () => {
  assert.throws(() => runPython(['scripts/prepare_emulator.py'], {
    cwd: root, env: { ...process.env, CPC_BUILD_PYTHON: join(tmpdir(), 'cpceleste-absent-python') },
  }), /Python 3\.12\+ requis/);
});

test('les lanceurs emcc Windows et chemins avec espaces passent sans shell', () => {
  runPython(['tests/toolchain-python.py']);
});

test('build:desktop échoue proprement sur un checkout sans moteur ni Python', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cpceleste checkout '));
  try {
    // Copy only the build scripts: no engine, SDK or dependencies can be used.
    mkdirSync(join(directory, 'scripts'));
    for (const name of ['build-desktop.mjs', 'emulator-build.mjs']) {
      copyFileSync(join(root, 'scripts', name), join(directory, 'scripts', name));
    }
    const result = spawnSync(process.execPath, [join(directory, 'scripts/build-desktop.mjs')], {
      cwd: tmpdir(), encoding: 'utf8',
      env: { ...process.env, CPC_BUILD_PYTHON: join(directory, 'absent-python') },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Python 3\.12\+ requis/);
    assert.doesNotMatch(result.stderr, /at file:|ModuleJob/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
