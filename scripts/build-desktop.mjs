import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync } from 'node:fs';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['run', 'build:renderer'], { stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync(npm, ['run', 'build:main'], { stdio: 'inherit', shell: process.platform === 'win32' });
copyFileSync('apps/desktop/preload.cjs', 'dist/apps/desktop/preload.cjs');
cpSync('knowledge/locomotive-basic', 'dist/knowledge/locomotive-basic', { recursive: true });
