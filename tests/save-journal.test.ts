import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
import { SaveJournal, durableReplace } from '../apps/desktop/save-journal.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-journal-')); await mkdir(join(root, 'src'));
  const manifest = addProjectSource(newProject('Journal original', randomUUID()), 'UTIL');
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(root, 'microide.project.json'), manifestBytes);
  const entries = manifest.sources.map(item => ({ id: item.id, path: item.path, before: Buffer.from(`10 REM OLD ${item.id}\r\n20 END\r\n`), after: Buffer.from(`10 REM NEW ${item.id}\n20 END\n`) }));
  for (const entry of entries) await writeFile(join(root, entry.path), entry.before);
  return { root, entries, manifest, journal: new SaveJournal(root, manifest, hash(manifestBytes)), recordPath: join(root, '.microide/save/pending.json') };
}
async function crash(root: string, stop: number) {
  const child = spawn(process.execPath, ['tests/journal-crash-fixture.ts', root, String(stop)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let errors = ''; child.stderr?.on('data', bytes => { errors += bytes; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Crash fixture timeout: ' + errors)), 10000);
      child.once('message', () => { clearTimeout(timer); resolve(); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture exited ${code}: ${errors}`)); });
    });
    const exit = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exit;
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
}
test('SIGKILL after journal, first source and last source: fresh processes can finish or restore exact original CRLF', async () => {
  for (const stop of [0, 1, 2]) for (const choice of ['finish', 'restore'] as const) {
    const { root, entries } = await fixture(); await crash(root, stop);
    await assert.rejects(ProjectStore.open(root), /Sauvegarde interrompue/);
    const summary = await ProjectStore.recoveryStatus(root); assert.ok(summary); assert.equal(summary.files.length, 2);
    await ProjectStore.recoverSave(root, summary.id, choice);
    for (const entry of entries) assert.deepEqual(await readFile(join(root, entry.path)), choice === 'finish' ? entry.after : entry.before);
    assert.equal(await ProjectStore.recoveryStatus(root), undefined);
    assert.equal((await ProjectStore.open(root)).snapshot.files.length, 2);
  }
});
test('recovery preflight rejects a later external file before changing an earlier mixed file and keeps journal', async () => {
  const { root, entries, journal, recordPath } = await fixture(); const id = await journal.prepare(entries);
  await durableReplace(join(root, entries[0]!.path), entries[0]!.after);
  await writeFile(join(root, entries[1]!.path), '10 REM EXTERNAL\n'); const originalJournal = await readFile(recordPath);
  await assert.rejects(journal.recover(id, 'restore'), /Conflit externe/);
  assert.deepEqual(await readFile(join(root, entries[0]!.path)), entries[0]!.after);
  assert.equal(await readFile(join(root, entries[1]!.path), 'utf8'), '10 REM EXTERNAL\n');
  assert.deepEqual(await readFile(recordPath), originalJournal);
});
test('manifest changes and source links refuse recovery without touching the snapshot', async () => {
  const { root, entries, journal } = await fixture(); const id = await journal.prepare(entries);
  const path = join(root, 'microide.project.json'), manifest = await readFile(path);
  await writeFile(path, Buffer.concat([manifest, Buffer.from(' ')]));
  await assert.rejects(journal.recover(id, 'finish'), /Conflit de manifeste/);
  await writeFile(path, manifest);
  const source = join(root, entries[1]!.path); await rename(source, source + '.original'); await symlink(source + '.original', source);
  await assert.rejects(journal.recover(id, 'finish'), /lien refusé/);
  assert.deepEqual(await readFile(join(root, entries[0]!.path)), entries[0]!.before);
});
test('unknown version, corrupt base64/hash, unknown path and metadata links are preserved and rejected', async () => {
  const { root, entries, journal, recordPath } = await fixture(); await journal.prepare(entries);
  const valid: { version: number; entries: { before: string; beforeHash: string; path: string }[] } = JSON.parse(await readFile(recordPath, 'utf8'));
  for (const mutate of [(item: typeof valid) => { item.version = 2; }, (item: typeof valid) => { item.entries[0]!.before = 'bad'; }, (item: typeof valid) => { item.entries[0]!.path = '../outside.bas'; }, (item: typeof valid) => { item.entries[0]!.beforeHash = 'a'.repeat(64); }]) {
    const altered = structuredClone(valid); mutate(altered); const bytes = JSON.stringify(altered); await writeFile(recordPath, bytes);
    await assert.rejects(ProjectStore.open(root)); assert.equal(await readFile(recordPath, 'utf8'), bytes);
    assert.deepEqual(await readFile(join(root, entries[0]!.path)), entries[0]!.before);
  }
  await rename(join(root, '.microide/save'), join(root, '.microide/save-original'));
  await symlink(join(root, '.microide/save-original'), join(root, '.microide/save'), 'dir');
  await assert.rejects(ProjectStore.open(root), /journal symbolique/);
});
test('successful save-all records committed phase; no-op retains it and later manifest edits remain possible', async () => {
  const { root, entries, recordPath } = await fixture(); const { store } = await ProjectStore.open(root);
  const buffers = entries.map(entry => ({ id: entry.id, source: entry.after.toString('utf8') }));
  await store.saveAll(buffers); const committed = await readFile(recordPath);
  assert.equal(JSON.parse(committed.toString()).phase, 'committed');
  assert.equal((await store.saveAll(buffers)).changedCount, 0); assert.deepEqual(await readFile(recordPath), committed);
  await store.setEntry('util'); await store.add('MORE');
  assert.equal((await ProjectStore.open(root)).snapshot.files.length, 3);
});
test('a pending journal survives moving a project and repeated recovery is revision guarded', async () => {
  const { root, entries, journal } = await fixture(); const id = await journal.prepare(entries);
  const moved = root + '-moved'; await rename(root, moved);
  assert.equal((await ProjectStore.recoveryStatus(moved))!.id, id);
  await ProjectStore.recoverSave(moved, id, 'restore');
  await assert.rejects(ProjectStore.recoverSave(moved, id, 'finish'), /périmée/);
  assert.deepEqual(await readFile(join(moved, entries[0]!.path)), entries[0]!.before);
});
test('unpublished temporary journal files do not trigger recovery and are never erased', async () => {
  const { root, entries } = await fixture(); await mkdir(join(root, '.microide/save'), { recursive: true });
  const path = join(root, '.microide/save/.microide-original-fixture.tmp'); await writeFile(path, 'TRUNCATED ORIGINAL FIXTURE');
  assert.equal(await ProjectStore.recoveryStatus(root), undefined);
  assert.equal((await ProjectStore.open(root)).snapshot.files.length, 2);
  assert.equal(await readFile(path, 'utf8'), 'TRUNCATED ORIGINAL FIXTURE');
  assert.deepEqual(await readFile(join(root, entries[0]!.path)), entries[0]!.before);
});
test('a modified journal with the same transaction ID invalidates an earlier recovery choice', async () => {
  const { root, entries, journal, recordPath } = await fixture(); const id = await journal.prepare(entries);
  const summary = (await ProjectStore.recoveryStatus(root))!;
  const record = JSON.parse(await readFile(recordPath, 'utf8')); record.createdAt = '2026-10-03T00:00:00.000Z';
  await writeFile(recordPath, JSON.stringify(record));
  await assert.rejects(ProjectStore.recoverSave(root, id, 'finish', summary.revision), /périmé/);
  await assert.rejects(journal.recover(id, 'restore'), /périmé/);
  assert.deepEqual(await readFile(join(root, entries[0]!.path)), entries[0]!.before);
});
