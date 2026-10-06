import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { engineAvailable, prepareEngine } from './emulator-build.mjs';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  if (!engineAvailable()) prepareEngine();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
mkdirSync('apps/desktop/public/emulator', { recursive: true });
for (const name of ['cpc.mjs', 'cpc.wasm']) copyFileSync('out/' + name, 'apps/desktop/public/emulator/' + name);
copyFileSync('licenses/chips.txt', 'apps/desktop/public/emulator/chips.txt');
copyFileSync('licenses/emscripten.txt', 'apps/desktop/public/emulator/emscripten.txt');
execFileSync(npm, ['run', 'build:renderer'], { stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync(npm, ['run', 'build:main'], { stdio: 'inherit', shell: process.platform === 'win32' });
copyFileSync('apps/desktop/preload.cjs', 'dist/apps/desktop/preload.cjs');
cpSync('knowledge/locomotive-basic', 'dist/knowledge/locomotive-basic', { recursive: true });
