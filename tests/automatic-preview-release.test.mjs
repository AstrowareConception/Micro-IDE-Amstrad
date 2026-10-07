import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';
import { affectsPackage, packageFingerprint, distributionNames, planPreview, publishPreview } from '../scripts/automatic-preview-release.mjs';
import { writeChecksums } from '../scripts/release-checksums.mjs';

const version = '0.38.1';
const hash = 'a'.repeat(64);
const entry = (path, object = 'a'.repeat(40), mode = '100644') => `${mode} blob ${object}\t${path}\0`;
const assetNames = [...distributionNames(version), 'SHA256SUMS.txt', 'build-provenance.json',
  'packaged-smoke-windows.json', 'packaged-smoke-linux.json', 'README-PREVIEW.md'];
const release = (fingerprint = hash, extra = {}) => ({
  draft: false, prerelease: true, published_at: '2026-10-07T20:00:00Z', html_url: 'https://example.test/release',
  body: `Notes\n<!-- cpceleste-preview-inputs:${fingerprint} -->`,
  assets: assetNames.map(name => ({ name, size: 100, state: 'uploaded' })), ...extra,
});

test('code, resources, locks and packaging count; ordinary documentation/tests do not', () => {
  for (const path of ['apps/desktop/main.ts', 'packages/emulator/chips.lock.json', 'knowledge/locomotive-basic/README.md',
    'licenses/chips.txt', 'package-lock.json', 'tsconfig.json', 'scripts/build-desktop.mjs', '.github/workflows/package-preview.yml']) {
    assert.equal(affectsPackage(path), true, path);
  }
  for (const path of ['README.md', 'AGENTS.md', 'docs/guide-utilisateur.md', 'tests/example.test.mjs',
    'examples/hello-cpc/README.md', '.github/workflows/editor.yml']) assert.equal(affectsPackage(path), false, path);
});

test('fingerprint ignores docs but observes deletions, renames, mode and content changes', () => {
  const source = entry('apps/desktop/main.ts');
  const baseline = packageFingerprint(source + entry('package.json'));
  assert.equal(packageFingerprint(entry('package.json') + source + entry('docs/test.md')), baseline);
  for (const changed of [source, source + entry('package.json', 'b'.repeat(40)), source + entry('other.json'),
    source + entry('package.json', 'a'.repeat(40), '100755')]) assert.notEqual(packageFingerprint(changed), baseline);
  assert.throws(() => packageFingerprint('broken'), /invalide/);
});

test('first publication builds; identical complete published preview skips', () => {
  assert.equal(planPreview([], hash, version).build, true);
  assert.equal(planPreview([release()], hash, version).build, false);
  assert.equal(planPreview([release('b'.repeat(64))], hash, version).build, true);
});

test('drafts and stable releases do not suppress previews; missing assets require rebuilding', () => {
  for (const patch of [{ draft: true }, { prerelease: false }, { assets: [] },
    { assets: release().assets.map(asset => ({ ...asset, state: 'new' })) }]) {
    assert.equal(planPreview([release(hash, patch)], hash, version).build, true);
  }
});

test('compare the latest publication, so reverting to an older source still publishes', () => {
  const newer = release('b'.repeat(64), { published_at: '2026-10-08T20:00:00Z' });
  assert.equal(planPreview([release(), newer], hash, version).build, true);
  assert.equal(planPreview([newer, release()], 'b'.repeat(64), version).build, false);
});

const ctx = { repository: 'example/cpceleste', sourceSha: 'a'.repeat(40), runId: '123', fingerprint: hash,
  version, tag: 'v0.38.1-preview.123' };
function fakeGh(corrupt, mutations) {
  return args => {
    if (args[0] === 'run') {
      assert.equal(args[2], ctx.runId);
      const directory = args[args.indexOf('--dir') + 1];
      const win = args[args.indexOf('--name') + 1].includes('windows');
      mkdirSync(directory);
      for (const name of distributionNames(version).filter(name => win ? name.endsWith('.exe') : !name.endsWith('.exe'))) {
        writeFileSync(join(directory, name), 'fixture executable');
      }
      writeFileSync(join(directory, `packaged-smoke-${win ? 'windows' : 'linux'}.json`), JSON.stringify({
        version, packaged: true, wasmMagic: !corrupt, page: 'cpceleste://app/index.html',
      }));
      writeChecksums(directory, `SHA256SUMS-${win ? 'win' : 'linux'}.txt`);
      return '';
    }
    mutations.push(args);
    assert.deepEqual(args.slice(0, 3), ['release', 'create', ctx.tag]);
    assert.ok(args.includes('--prerelease'));
    assert.ok(args.includes('--latest=false'));
    assert.equal(args[args.indexOf('--target') + 1], ctx.sourceSha);
    assert.ok(!args.includes('--clobber'));
    const files = args.filter(arg => assetNames.includes(basename(arg)));
    // Notes file appears once as an option and once as an attached asset.
    assert.deepEqual([...new Set(files.map(file => basename(file)))].sort(), assetNames.sort());
    const provenance = JSON.parse(readFileSync(files.find(file => basename(file) === 'build-provenance.json'), 'utf8'));
    assert.equal(provenance.inputFingerprint, hash);
    assert.equal(provenance.sourceSha, ctx.sourceSha);
    return 'https://example.test/release\n';
  };
}

test('publication attaches all four verified binaries, checksums and provenance at the built commit', () => {
  const mutations = [];
  assert.equal(publishPreview(ctx, fakeGh(false, mutations)), 'https://example.test/release');
  assert.equal(mutations.length, 1);
});

test('bad packaged proof stops publication before any remote mutation', () => {
  const mutations = [];
  assert.throws(() => publishPreview(ctx, fakeGh(true, mutations)), /Preuve/);
  assert.equal(mutations.length, 0);
  assert.throws(() => publishPreview({ ...ctx, tag: 'v1.0.0' }, fakeGh(false, mutations)), /Provenance/);
});
