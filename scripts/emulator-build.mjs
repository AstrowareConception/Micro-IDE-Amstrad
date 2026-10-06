import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function engineAvailable(directory = root) {
  try {
    const wasm = readFileSync(resolve(directory, 'out/cpc.wasm'));
    return readFileSync(resolve(directory, 'out/cpc.mjs')).length > 0
      && wasm.length > 8 && wasm.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  } catch { return false; }
}

export function runPython(args, { cwd = root, env = process.env } = {}) {
  const candidates = env.CPC_BUILD_PYTHON ? [[env.CPC_BUILD_PYTHON]]
    : process.platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];
  for (const [command, ...prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)'], { cwd, env, stdio: 'ignore' });
    if (probe.status !== 0) continue;
    const result = spawnSync(command, [...prefix, ...args], { cwd, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Préparation du moteur CPC échouée (code ' + result.status + '). Voir le diagnostic ci-dessus.');
    return;
  }
  throw new Error('Python 3.12+ requis pour construire le moteur CPC. Installer Python avec son lanceur Windows ou le PATH, puis relancer npm run build:desktop. CPC_BUILD_PYTHON peut désigner un exécutable Python.');
}

export function prepareEngine() {
  console.log('Préparation du moteur CPC : headers vérifiés et SDK Emscripten figé (premier build : téléchargement volumineux). Aucune ROM téléchargée.');
  runPython(['scripts/prepare_emulator.py']);
  if (!engineAvailable()) throw new Error('La compilation n’a pas produit un moteur CPC complet. Relancer npm run emulator:prepare.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { prepareEngine(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
