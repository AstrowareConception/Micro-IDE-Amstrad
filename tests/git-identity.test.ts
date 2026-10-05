import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, lstat, symlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitIdentityStore } from '../apps/desktop/git-identity-store.ts';
import { gitIdentity, commitInput } from '../packages/version-control/src/inspection.ts';
const author = { name: '  Térence de test  ', email: 'fixture@example.invalid' };
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'cpceleste-identity-')); return { root, store: new GitIdentityStore(root), path: join(root, 'git-profile/identity.json') }; }
test('identity is opt-in, normalised, private, durable across store restart and does not write repository data', async () => {
  const { root, store, path } = await fixture();
  assert.deepEqual(await store.status(), { revision: null, identity: null }); assert.deepEqual(await readdir(root), []);
  const saved = await store.remember(null, author); assert.deepEqual(saved.identity, { name: 'Térence de test', email: author.email }); assert.match(saved.revision!, /^[a-f0-9]{64}$/);
  assert.deepEqual(await new GitIdentityStore(root).status(), saved);
  const record = JSON.parse(await readFile(path, 'utf8')); assert.deepEqual(Object.keys(record).sort(), ['id', 'identity', 'version']); assert.equal(record.version, 1);
  assert.deepEqual(await readdir(root), ['git-profile']); assert.deepEqual(await readdir(join(root, 'git-profile')), ['identity.json']);
  if (process.platform !== 'win32') { assert.equal((await lstat(path)).mode & 0o777, 0o600); assert.equal((await lstat(join(root, 'git-profile'))).mode & 0o777, 0o700); }
  assert.equal(commitInput({ ...saved.identity, message: 'Message distinct' }).name, 'Térence de test'); assert.ok(!('message' in record.identity));
});
test('revisions protect replacements and forgetting; tombstones prevent stale absent snapshots from being reused', async () => {
  const { root, store, path } = await fixture(); const first = await store.remember(null, author);
  const other = new GitIdentityStore(root); const read = await other.status();
  const updated = await store.remember(first.revision, { ...author, name: 'Autre auteur' }); const bytes = await readFile(path);
  await assert.rejects(other.remember(read.revision, author), /modifié depuis/); await assert.rejects(other.forget(read.revision), /modifié depuis/); assert.deepEqual(await readFile(path), bytes);
  const forgotten = await store.forget(updated.revision); assert.equal(forgotten.identity, null); assert.ok(forgotten.revision); assert.notEqual(forgotten.revision, updated.revision);
  assert.deepEqual(await new GitIdentityStore(root).status(), forgotten); assert.doesNotMatch(await readFile(path, 'utf8'), /auteur|example.invalid/);
  await assert.rejects(store.remember(null, author), /modifié depuis/);
  const next = await store.remember(forgotten.revision, author); assert.notEqual(next.revision, first.revision);
});
test('identity validation rejects unknown fields, controls and invalid emails without creating a preference', async () => {
  const { root, store } = await fixture();
  for (const value of [null, [], { ...author, apiKey: 'forbidden' }, { name: '', email: author.email }, { name: 'A\nB', email: author.email }, { name: 'A<B', email: author.email }, { name: 'a'.repeat(101), email: author.email }, { name: 'A', email: 'x@@y' }, { name: 'A', email: 'x@y\n' }, { name: 'A', email: 'x'.repeat(255) + '@y' }]) {
    assert.throws(() => gitIdentity(value)); await assert.rejects(store.remember(null, value));
  }
  for (const revision of [undefined, '', 'not-a-hash', 123]) await assert.rejects(store.remember(revision, author), /Révision/);
  assert.deepEqual(await readdir(root), []);
});
test('corrupt, future, oversized and noncanonical preferences are retained and cannot be overwritten or forgotten', async () => {
  for (const raw of ['{', JSON.stringify({ version: 2, id: '00000000-0000-0000-0000-000000000000', identity: author }), JSON.stringify({ version: 1, id: 'bad', identity: null }), JSON.stringify({ version: 1, id: '00000000-0000-0000-0000-000000000000', identity: author }), 'x'.repeat(4097), Buffer.from([0xff]), '\ufeff{}', JSON.stringify({ version: 1, id: '00000000-0000-0000-0000-000000000000', identity: null, extra: true })]) {
    const { root, store, path } = await fixture(); await mkdir(join(root, 'git-profile')); await writeFile(path, raw); const bytes = await readFile(path);
    await assert.rejects(store.status(), /Profil Git/); await assert.rejects(store.remember(null, author)); await assert.rejects(store.forget(null)); assert.deepEqual(await readFile(path), bytes);
  }
});
test('links, hard links and special profile paths are refused without touching their target', async () => {
  for (const kind of ['folder', 'file', 'hardlink', 'directory-file']) {
    const { root, store, path } = await fixture(); const target = join(root, 'target'); await mkdir(target); const targetFile = join(target, 'outside.json'); await writeFile(targetFile, 'EXTERNAL');
    if (kind === 'folder') await symlink(target, join(root, 'git-profile'), 'dir');
    else { await mkdir(join(root, 'git-profile')); if (kind === 'file') await symlink(targetFile, path); else if (kind === 'hardlink') await link(targetFile, path); else await mkdir(path); }
    await assert.rejects(store.status()); await assert.rejects(store.remember(null, author)); await assert.rejects(store.forget(null)); assert.equal(await readFile(targetFile, 'utf8'), 'EXTERNAL');
  }
});
test('filesystem failures expose no host path and missing/corrupt preferences never affect commit identity validation', async () => {
  const { root, store, path } = await fixture(); await mkdir(path, { recursive: true });
  await assert.rejects(store.status(), error => !String(error).includes(root));
  await assert.rejects(new GitIdentityStore(join(root, 'missing')).status(), error => !String(error).includes(root));
  assert.deepEqual(gitIdentity({ name: 'Session uniquement', email: 'x@y' }), { name: 'Session uniquement', email: 'x@y' });
});
