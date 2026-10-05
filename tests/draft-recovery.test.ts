import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rename, symlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { DraftStore } from '../apps/desktop/draft-store.ts';
import { SaveJournal } from '../apps/desktop/save-journal.ts';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-drafts-')); await mkdir(join(root, 'src'));
  const manifest = addProjectSource(newProject('Brouillons originaux', randomUUID()), 'UTIL');
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n'); await writeFile(join(root, 'microide.project.json'), manifestBytes);
  for (const file of manifest.sources) await writeFile(join(root, file.path), `10 REM BASE ${file.id}\r\n20 END\r\n`);
  const { store, snapshot } = await ProjectStore.open(root);
  const buffers = snapshot.files.map(file => ({ id: file.id, source: file.source + `30 REM DRAFT ${file.id}\n` }));
  return { root, manifest, manifestBytes, store, snapshot, buffers, file: join(root, '.microide/drafts/current.json'), folder: join(root, '.microide/drafts') };
}
test('draft copies keep sources/manifest/CRLF intact, preserve dirty-only text, deduplicate and survive relocation/reopen', async () => {
  const item = await fixture(); const { store, root, file, buffers, manifestBytes } = item;
  assert.deepEqual(await store.draftStatus(), { revision: null, snapshot: null }); assert.equal((await readdir(root)).includes('.microide'), false);
  const status = await store.captureDrafts([buffers[0]!, { id: 'util', source: item.snapshot.files[1]!.source }], null);
  assert.equal(status.snapshot?.files.length, 1); assert.ok(status.revision);
  const original = await readFile(file), record = JSON.parse(original.toString());
  assert.equal(Buffer.from(record.files[0].base, 'base64').toString(), '10 REM BASE main\r\n20 END\r\n');
  assert.equal((await store.readDrafts(status.revision)).files[0]!.source, buffers[0]!.source);
  assert.deepEqual(await readFile(join(root, 'microide.project.json')), manifestBytes);
  for (const source of item.manifest.sources) assert.equal(await readFile(join(root, source.path), 'utf8'), `10 REM BASE ${source.id}\r\n20 END\r\n`);
  const same = await store.captureDrafts([buffers[0]!, { id: 'util', source: item.snapshot.files[1]!.source }], status.revision);
  assert.deepEqual(same, status); assert.deepEqual(await readFile(file), original);
  const parent = await mkdtemp(join(tmpdir(), 'cpceleste-moved-drafts-')); const moved = join(parent, 'project'); await rename(root, moved);
  const reopened = (await ProjectStore.open(moved)).store; assert.deepEqual(await reopened.draftStatus(), status);
  assert.equal((await reopened.readDrafts(status.revision)).files[0]!.source, buffers[0]!.source);
});
test('SIGKILL after a published copy leaves recoverable unsaved sources with unchanged original files', async () => {
  const { root, manifestBytes, manifest } = await fixture();
  const child = spawn(process.execPath, ['tests/draft-crash-fixture.ts', root], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); let errors = '';
  child.stderr?.on('data', value => { errors += value; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Draft crash timeout: ' + errors)), 10000);
      child.once('message', () => { clearTimeout(timer); resolve(); }); child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Draft fixture exited ${code}: ${errors}`)); });
    });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exited;
    const reopened = (await ProjectStore.open(root)).store; const status = await reopened.draftStatus(); assert.ok(status.revision);
    const recovery = await reopened.readDrafts(status.revision); assert.equal(recovery.files.length, 2);
    for (const source of manifest.sources) {
      assert.equal(await readFile(join(root, source.path), 'utf8'), `10 REM BASE ${source.id}\r\n20 END\r\n`);
      assert.ok(recovery.files.find(file => file.id === source.id)!.source.includes(`UNSAVED ${source.id}`));
    }
    assert.deepEqual(await readFile(join(root, 'microide.project.json')), manifestBytes);
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
});
test('stale copy revisions guard capture/read/forget, and explicit forget leaves source bytes intact', async () => {
  const { store, file, buffers, root } = await fixture(); const first = await store.captureDrafts(buffers, null); assert.ok(first.revision);
  await assert.rejects(store.captureDrafts(buffers, null), /périmée/);
  const second = await store.captureDrafts(buffers.map(buffer => ({ ...buffer, source: buffer.source + '40 REM NEW\n' })), first.revision); assert.ok(second.revision);
  const saved = await readFile(file);
  await assert.rejects(store.readDrafts(first.revision), /périmée/); await assert.rejects(store.forgetDrafts(first.revision), /périmée/);
  assert.deepEqual(await readFile(file), saved);
  const cleared = await store.forgetDrafts(second.revision); assert.equal(cleared.snapshot, null); assert.ok(cleared.revision);
  await assert.rejects(store.readDrafts(cleared.revision), /Aucun/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM BASE main\r\n20 END\r\n');
});
test('external sources and manifests block recovery and keep the copy untouched, including after a reopen', async () => {
  const { root, store, buffers, file, manifestBytes } = await fixture(); const status = await store.captureDrafts(buffers, null); assert.ok(status.revision); const copy = await readFile(file);
  await writeFile(join(root, 'src/util.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.readDrafts(status.revision), /Conflit externe/); await assert.rejects(store.captureDrafts(buffers, status.revision), /Conflit externe/);
  const reopened = (await ProjectStore.open(root)).store; await assert.rejects(reopened.readDrafts(status.revision), /Conflit externe/);
  assert.deepEqual(await readFile(file), copy); assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), '10 REM EXTERNAL\n');
  const manifest = JSON.parse(manifestBytes.toString()); manifest.name = 'Changed'; await writeFile(join(root, 'microide.project.json'), JSON.stringify(manifest));
  const changed = (await ProjectStore.open(root)).store; await assert.rejects(changed.readDrafts(status.revision), /Manifeste différent/);
  assert.deepEqual(await readFile(file), copy);
});
test('future/corrupt/path/hash/extra-field copies are preserved and never overwritten by capture or forget', async () => {
  const { store, buffers, file } = await fixture(); const status = await store.captureDrafts(buffers, null); assert.ok(status.revision); const copy = await readFile(file);
  const mutators = [(value: Record<string, unknown>) => { value.version = 2; }, (value: Record<string, unknown>) => { value.projectId = randomUUID(); }, (value: Record<string, unknown>) => { value.extra = true; },
    (value: Record<string, unknown>) => { (value.files as { path: string }[])[0]!.path = '../outside.bas'; },
    (value: Record<string, unknown>) => { (value.files as { draftHash: string }[])[0]!.draftHash = '0'.repeat(64); }];
  for (const mutate of mutators) {
    const record = JSON.parse(copy.toString()); mutate(record); const modified = Buffer.from(JSON.stringify(record)); await writeFile(file, modified);
    await assert.rejects(store.draftStatus()); await assert.rejects(store.captureDrafts(buffers, status.revision)); await assert.rejects(store.forgetDrafts(status.revision));
    assert.deepEqual(await readFile(file), modified);
  }
});
test('source snapshots and byte budgets reject incomplete/unknown/duplicate/oversized/BOM/NUL input before creating metadata', async () => {
  const { root, store, buffers } = await fixture();
  for (const invalid of [[buffers[0]!], [buffers[0]!, buffers[0]!], [{ id: 'unknown', source: '10 END\n' }, buffers[1]!], [{ ...buffers[0]!, source: 'x'.repeat(1024 * 1024 + 1) }, buffers[1]!], [{ ...buffers[0]!, source: '\ufeff10 END\n' }, buffers[1]!], [{ ...buffers[0]!, source: '10\0END' }, buffers[1]!]]) await assert.rejects(store.captureDrafts(invalid, null));
  assert.equal((await readdir(root)).includes('.microide'), false);
  const drafts = new DraftStore(root, store.manifest.projectId);
  await assert.rejects(drafts.capture(hash(Buffer.from('manifest')), Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, path: `src/f${i}.bas`, base: Buffer.alloc(1024 * 1024, 65), source: 'B'.repeat(1024 * 1024) })), null), /Budget|limitée/);
});
test('symlinked draft directories/files and hardlinks refuse access; incomplete temporaries stay intact', async () => {
  const first = await fixture(); await mkdir(join(first.root, '.microide')); await symlink(first.root, first.folder);
  await assert.rejects(first.store.captureDrafts(first.buffers, null), /lien/);
  const second = await fixture(); const status = await second.store.captureDrafts(second.buffers, null); assert.ok(status.revision);
  await link(second.file, join(second.root, 'draft-link.json')); await assert.rejects(second.store.draftStatus(), /ordinaire/);
  const third = await fixture(); await mkdir(third.folder, { recursive: true }); const temporary = join(third.folder, `.microide-${randomUUID()}.tmp`);
  await writeFile(temporary, '{unfinished'); await third.store.captureDrafts(third.buffers, null); assert.equal(await readFile(temporary, 'utf8'), '{unfinished');
  const fourth = await fixture(); await mkdir(fourth.folder, { recursive: true }); await symlink(join(fourth.root, 'src/main.bas'), fourth.file);
  await assert.rejects(fourth.store.draftStatus(), /ordinaire/);
});
test('a pending save journal blocks draft capture without changing the previous recovery copy', async () => {
  const { store, root, buffers, manifest, manifestBytes, file } = await fixture(); const copy = await store.captureDrafts(buffers, null); const content = await readFile(file);
  const entries = [];
  for (const source of manifest.sources) { const before = await readFile(join(root, source.path)); entries.push({ id: source.id, path: source.path, before, after: Buffer.from('10 REM NEW\n') }); }
  await new SaveJournal(root, manifest, hash(manifestBytes)).prepare(entries);
  await assert.rejects(store.captureDrafts(buffers, copy.revision), /Sauvegarde interrompue/); assert.deepEqual(await readFile(file), content);
});
