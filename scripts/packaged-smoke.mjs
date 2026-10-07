import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function executableFor(target) {
  const directory = resolve(root, 'release', target === 'win' ? 'win-unpacked' : 'linux-unpacked');
  const candidates = readdirSync(directory)
    .map(name => ({ name, path: resolve(directory, name) }))
    .filter(entry => statSync(entry.path).isFile())
    .filter(entry => target === 'win' ? /\.exe$/i.test(entry.name) : (statSync(entry.path).mode & 0o111) !== 0)
    .filter(entry => !/^(chrome-sandbox|chrome_crashpad_handler|elevate|uninstall)/i.test(entry.name))
    .sort((a, b) => statSync(b.path).size - statSync(a.path).size);
  if (!candidates[0]) throw new Error(`Binaire empaqueté introuvable dans ${directory}`);
  return candidates[0].path;
}

async function main() {
  const target = process.argv[2];
  if (target !== 'win' && target !== 'linux') throw new Error('Usage: node scripts/packaged-smoke.mjs <win|linux> [rapport]');
  const report = resolve(root, process.argv[3] ?? `release/packaged-smoke-${target}.json`);
  if (existsSync(report)) unlinkSync(report);
  const executable = executableFor(target);
  const args = target === 'linux' ? ['--no-sandbox'] : [];
  const child = spawn(executable, args, {
    cwd: root,
    env: { ...process.env, CPCELESTE_PACKAGE_SMOKE_FILE: report },
    stdio: 'inherit',
    windowsHide: true,
  });
  const timeout = setTimeout(() => child.kill(), 30000);
  const code = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', resolveExit);
  });
  clearTimeout(timeout);
  if (code !== 0) throw new Error(`Le binaire empaqueté a quitté avec le code ${code}.`);
  if (!existsSync(report)) throw new Error('Le binaire empaqueté n’a pas produit sa preuve de démarrage.');
  const result = JSON.parse(readFileSync(report, 'utf8'));
  if (result.packaged !== true || result.wasmMagic !== true || result.page !== 'cpceleste://app/index.html') {
    throw new Error('Preuve empaquetée invalide : UI ou moteur WASM non accessible dans le paquet.');
  }
  console.log(JSON.stringify({ executable, ...result }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
