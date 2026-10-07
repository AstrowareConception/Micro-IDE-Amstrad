import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { distributionArtifacts, writeChecksums } from '../scripts/release-checksums.mjs';

test('release checksums only cover top-level distributable artifacts in stable order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpceleste-release-'));
  try {
    writeFileSync(join(dir, 'CPCeleste-Setup-0.38.1.exe'), 'win');
    writeFileSync(join(dir, 'CPCeleste-0.38.1-x86_64.AppImage'), 'linux');
    writeFileSync(join(dir, 'cpceleste_0.38.1_amd64.deb'), 'deb');
    writeFileSync(join(dir, 'latest.yml'), 'metadata');
    assert.deepEqual(distributionArtifacts(dir), [
      'CPCeleste-0.38.1-x86_64.AppImage',
      'CPCeleste-Setup-0.38.1.exe',
      'cpceleste_0.38.1_amd64.deb',
    ]);
    const result = writeChecksums(dir);
    assert.equal(result.lines.length, 3);
    assert.match(readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8'), /CPCeleste-Setup-0\.38\.1\.exe/);
    assert.doesNotMatch(readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8'), /latest\.yml/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
