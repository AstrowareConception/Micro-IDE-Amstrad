import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, unlink, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
import { SaveJournal } from '../apps/desktop/save-journal.ts';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-external-')); await mkdir(join(root, 'src'));
  const manifest = addProjectSource(newProject('External review', randomUUID()), 'UTIL');
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n'); await writeFile(join(root, 'microide.project.json'), manifestBytes);
  for (const file of manifest.sources) await writeFile(join(root, file.path), '10 REM ORIGINAL\r\n20 END\r\n');
  const { store, snapshot } = await ProjectStore.open(root); return { root, manifest, manifestBytes, store, snapshot };
}
test('external inspection detects same-length changes and adoption is read-only, permits an explicit later save', async () => {
  const { root, store, snapshot, manifestBytes } = await fixture(); assert.deepEqual(await store.externalStatus(), []);
  const external = '10 REM EXTERNAL\r\n20 END\r\n'; await writeFile(join(root, 'src/main.bas'), external);
  const changes = await store.externalStatus(); assert.equal(changes.length, 1);
  const version = await store.externalVersion('main', changes[0]!.revision!); assert.equal(version.source, external.replace(/\r\n/g, '\n'));
  await assert.rejects(store.save('main', snapshot.files[0]!.source), /changé/);
  await store.acceptExternal('main', version.revision, version.baseRevision); assert.deepEqual(await store.externalStatus(), []);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), external); assert.deepEqual(await readFile(join(root, 'microide.project.json')), manifestBytes);
  await store.save('main', snapshot.files[0]!.source); assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), snapshot.files[0]!.source);
});
test('disk/base revisions refuse stale comparison and repeated acceptance after another adoption', async () => {
  const { root, store } = await fixture(); await writeFile(join(root, 'src/main.bas'), '10 REM A\n');
  const change = (await store.externalStatus())[0]!; const preview = await store.externalVersion('main', change.revision!);
  await writeFile(join(root, 'src/main.bas'), '10 REM B\n');
  await assert.rejects(store.externalVersion('main', preview.revision), /périmée/); await assert.rejects(store.acceptExternal('main', preview.revision, preview.baseRevision), /périmée/);
  await writeFile(join(root, 'src/main.bas'), '10 REM A\n'); await store.acceptExternal('main', preview.revision, preview.baseRevision);
  await assert.rejects(store.acceptExternal('main', preview.revision, preview.baseRevision), /Base.*périmée/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM A\n');
});
test('rename/delete and recreation are reported without repairing files or changing another source baseline', async () => {
  const { root, store } = await fixture(); await rename(join(root, 'src/main.bas'), join(root, 'src/moved.bas'));
  assert.match((await store.externalStatus())[0]!.issue!, /absente/);
  await writeFile(join(root, 'src/util.bas'), '10 REM UTIL EXTERNAL\n'); const util = (await store.externalStatus()).find(item => item.id === 'util')!;
  const version = await store.externalVersion('util', util.revision!); await store.acceptExternal('util', version.revision, version.baseRevision);
  assert.match((await store.externalStatus())[0]!.issue!, /absente/); await assert.rejects(store.save('util', '10 END\n'), /ENOENT/);
  await writeFile(join(root, 'src/main.bas'), '10 REM RECREATED\n'); assert.ok((await store.externalStatus())[0]!.revision);
});
test('invalid text, oversized files, symlink and changed manifest refuse adoption while preserving disk data', async () => {
  const { root, store, manifestBytes } = await fixture(); const path = join(root, 'src/main.bas');
  for (const content of [Buffer.from([0xff]), Buffer.from('\uFEFF10 END\n'), Buffer.from('10\0END'), Buffer.alloc(1024 * 1024 + 1)]) {
    await writeFile(path, content); assert.match((await store.externalStatus())[0]!.issue!, /illisible/);
    await assert.rejects(store.acceptExternal('main', 'a'.repeat(64), 'b'.repeat(64))); assert.deepEqual(await readFile(path), content);
  }
  await unlink(path); await symlink(join(root, 'src/util.bas'), path); assert.match((await store.externalStatus())[0]!.issue!, /Lien/);
  await assert.rejects(store.externalVersion('../util', 'a'.repeat(64)), /déclarée/);
  await writeFile(join(root, 'microide.project.json'), Buffer.concat([manifestBytes, Buffer.from(' ')])); await assert.rejects(store.externalStatus(), /manifeste/);
});
test('external review is blocked by an unresolved save journal and adoption leaves draft copies intact', async () => {
  const { root, store, snapshot } = await fixture();
  const status = await store.captureDrafts(snapshot.files.map(file => ({ id: file.id, source: file.source + '30 REM DRAFT\n' })), null);
  const copy = await readFile(join(root, '.microide/drafts/current.json'));
  await writeFile(join(root, 'src/main.bas'), '10 REM EXTERNAL\n'); const change = (await store.externalStatus())[0]!;
  const version = await store.externalVersion('main', change.revision!); await store.acceptExternal('main', version.revision, version.baseRevision);
  assert.deepEqual(await readFile(join(root, '.microide/drafts/current.json')), copy); await assert.rejects(store.readDrafts(status.revision!), /Conflit externe/);
  const journal = new SaveJournal(root, store.manifest, createHash('sha256').update(await readFile(join(root, 'microide.project.json'))).digest('hex'));
  await journal.prepare(await Promise.all(store.manifest.sources.map(async item => ({ id: item.id, path: item.path, before: await readFile(join(root, item.path)), after: Buffer.from('10 END\n') }))));
  await assert.rejects(store.externalVersion('main', version.revision), /reprise|interrompu|journal/i);
});
test('aggregate source budget prevents inspection/adoption beyond 8 MiB', async () => {
  const { root, manifest } = await fixture(); let expanded = manifest;
  for (let index = 0; index < 7; index++) expanded = addProjectSource(expanded, `A${index}`);
  await writeFile(join(root, 'microide.project.json'), JSON.stringify(expanded, null, 2) + '\n');
  for (const file of expanded.sources) await writeFile(join(root, file.path), '10 END\n');
  const { store } = await ProjectStore.open(root);
  for (const file of expanded.sources) await writeFile(join(root, file.path), ' '.repeat(1024 * 1024));
  await assert.rejects(store.externalStatus(), /8 Mio/);
  await assert.rejects(store.acceptExternal('main', 'a'.repeat(64), 'b'.repeat(64)), /8 Mio/);
});
