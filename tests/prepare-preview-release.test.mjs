import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateSource, validateTag, verifyBundle } from '../scripts/prepare-preview-release.mjs';
import { writeChecksums } from '../scripts/release-checksums.mjs';

const repository = 'example/cpceleste';
const sha = 'a'.repeat(40);
const run = { id: 123, repository: { full_name: repository }, head_repository: { full_name: repository },
  path: '.github/workflows/package-preview.yml', head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', head_sha: sha };
const artifacts = ['cpceleste-windows-preview', 'cpceleste-linux-preview'].map(name => ({
  name, expired: false, size_in_bytes: 100, workflow_run: { id: 123, head_sha: sha },
}));

test('release promotion accepts one successful main packaging run only', () => {
  assert.equal(validateSource(run, artifacts, repository, '123'), sha);
  for (const patch of [{ conclusion: 'failure' }, { status: 'in_progress' }, { head_branch: 'feature' },
    { event: 'pull_request' }, { path: '.github/workflows/editor.yml' }, { head_repository: { full_name: 'fork/cpceleste' } }]) {
    assert.throws(() => validateSource({ ...run, ...patch }, artifacts, repository, '123'));
  }
  assert.throws(() => validateSource(run, artifacts, repository, '124'));
});

test('missing, expired, duplicated and mixed-commit artifacts cannot be promoted', () => {
  assert.throws(() => validateSource(run, artifacts.slice(0, 1), repository, '123'));
  assert.throws(() => validateSource(run, [...artifacts, artifacts[0]], repository, '123'));
  for (const patch of [{ expired: true }, { size_in_bytes: 0 }, { workflow_run: { id: 123, head_sha: 'b'.repeat(40) } }]) {
    assert.throws(() => validateSource(run, [{ ...artifacts[0], ...patch }, artifacts[1]], repository, '123'));
  }
});

test('preview tag uses the built version and excludes shell or option syntax', () => {
  validateTag('v0.38.1-preview.1', '0.38.1');
  for (const tag of ['v0.38.2-preview.1', 'v0.38.1', '--latest', 'v0.38.1-preview.1;echo bad']) {
    assert.throws(() => validateTag(tag, '0.38.1'));
  }
});

function fixture(platform, callback) {
  const directory = mkdtempSync(join(tmpdir(), 'cpceleste-promotion-test-'));
  const files = platform === 'win' ? ['CPCeleste-Setup-0.38.1.exe', 'CPCeleste-Portable-0.38.1.exe']
    : ['CPCeleste-0.38.1-x86_64.AppImage', 'cpceleste_0.38.1_amd64.deb'];
  const smokeFile = join(directory, `packaged-smoke-${platform === 'win' ? 'windows' : 'linux'}.json`);
  try {
    for (const name of files) writeFileSync(join(directory, name), `fixture ${name}`);
    const smoke = { version: '0.38.1', packaged: true, wasmMagic: true, page: 'cpceleste://app/index.html' };
    writeFileSync(smokeFile, JSON.stringify(smoke));
    writeChecksums(directory, `SHA256SUMS-${platform}.txt`);
    callback({ directory, files, smoke, smokeFile });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

for (const platform of ['win', 'linux']) {
  test(`${platform}: original checksums and smoke proof validate the exact distribution`, () => fixture(platform, ({ directory, files }) => {
    assert.deepEqual(verifyBundle(directory, platform, '0.38.1').files.sort(), files.sort());
    writeFileSync(join(directory, files[0]), 'tampered');
    assert.throws(() => verifyBundle(directory, platform, '0.38.1'), /SHA-256 incorrect/);
  }));
}

test('false or mismatched smoke proof fails despite intact executable hashes', () => fixture('win', ({ directory, smoke, smokeFile }) => {
  for (const patch of [{ version: '0.38.0' }, { packaged: false }, { wasmMagic: false }, { page: 'file:///index.html' }]) {
    writeFileSync(smokeFile, JSON.stringify({ ...smoke, ...patch }));
    assert.throws(() => verifyBundle(directory, 'win', '0.38.1'), /Preuve/);
  }
}));

test('unlisted files and traversal checksum entries are refused', () => fixture('win', ({ directory }) => {
  const manifest = join(directory, 'SHA256SUMS-win.txt');
  const original = readFileSync(manifest, 'utf8');
  writeFileSync(manifest, original.replace('CPCeleste-Portable-0.38.1.exe', '../outside.exe'));
  assert.throws(() => verifyBundle(directory, 'win', '0.38.1'), /Entrée/);
  writeFileSync(manifest, original);
  writeFileSync(join(directory, 'unexpected.exe'), 'unknown');
  assert.throws(() => verifyBundle(directory, 'win', '0.38.1'), /Contenu/);
}));
