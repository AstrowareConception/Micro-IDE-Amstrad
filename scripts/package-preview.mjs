import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeChecksums } from './release-checksums.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
if (target !== 'win' && target !== 'linux') {
  console.error('Usage: node scripts/package-preview.mjs <win|linux>');
  process.exit(2);
}
if (target === 'win' && process.platform !== 'win32') {
  console.error('Le preview Windows se construit sur Windows afin de qualifier NSIS et le binaire natif.');
  process.exit(2);
}
if (target === 'linux' && process.platform !== 'linux') {
  console.error('Le preview Linux se construit sur Linux afin de qualifier AppImage et deb.');
  process.exit(2);
}

process.chdir(root);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const common = { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' };
rmSync(resolve(root, 'release'), { recursive: true, force: true });
mkdirSync(resolve(root, 'release'), { recursive: true });

execFileSync(npm, ['run', 'build:desktop'], common);
const platformArgs = target === 'win'
  ? ['--win', 'nsis', 'portable', '--x64']
  : ['--linux', 'AppImage', 'deb', '--x64'];
// Avoid npm exec/npx here: npm's temporary-package lock is known to fail
// nondeterministically on Windows with large cold dependency trees.
execFileSync(npm, [
  'install', '--no-save', '--package-lock=false', '--ignore-scripts', 'electron-builder@26.17.0',
], common);
const builder = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
execFileSync(builder, ['--config', 'electron-builder.yml', '--publish', 'never', ...platformArgs], {
  cwd: root, stdio: 'inherit', shell: false,
});

const result = writeChecksums(resolve(root, 'release'), `SHA256SUMS-${target}.txt`);
console.log(`CPCéleste 0.38.1 packaging preview : ${result.artifacts.join(', ')}`);
