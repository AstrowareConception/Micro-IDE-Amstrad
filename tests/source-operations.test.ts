import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, link, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { planSourceOperation } from '../packages/workspace/src/source-operations.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';
import { readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-sources-')); t.after(() => rm(root, { recursive: true, force: true }));
  const { store } = await ProjectStore.create(root, 'Sources'); await store.add('UTIL');
  await mkdir(join(root, 'src/levels'));
  const source = '10 REM EXACT CRLF\r\n20 END\r\n'; await writeFile(join(root, 'src/main.bas'), source);
  return { root, source, ...(await ProjectStore.open(root)) };
}
test('rename and nested move preserve source identity, exact bytes, entry and CPC disk names; latest action restores after reopen', async t => {
  const { store, root, source } = await fixture(t);
  const plan = await store.prepareSourceOperation({ action: 'rename', id: 'main', name: 'TITLE' });
  const result = await store.applySourceOperation(plan.id, '10 REM UNSAVED\n20 END\n');
  assert.equal(result.manifest.entryPoint, 'main'); assert.equal(result.manifest.sources[0]!.id, 'main');
  assert.equal(result.manifest.sources[0]!.cpcName, 'TITLE.BAS'); assert.equal(await readFile(join(root, 'src/title.bas'), 'utf8'), source);
  await assert.rejects(readFile(join(root, 'src/main.bas')), { code: 'ENOENT' });
  assert.ok(readDataDisk(buildProjectDisk(result.manifest, result.files)).some(file => file.name === 'TITLE.BAS'));
  const move = await store.prepareSourceOperation({ action: 'move', id: 'main', path: 'src/levels/title.bas' });
  await store.applySourceOperation(move.id, '10 END\n'); assert.equal(await readFile(join(root, 'src/levels/title.bas'), 'utf8'), source);
  const reopened = (await ProjectStore.open(root)).store, last = (await reopened.lastSourceOperation())!;
  const restored = await reopened.restoreSourceOperation(last.revision);
  assert.equal(restored.manifest.sources[0]!.path, 'src/title.bas'); assert.equal(await readFile(join(root, 'src/title.bas'), 'utf8'), source);
  assert.equal(await reopened.lastSourceOperation(), undefined);
});
test('dirty deletion preserves its draft privately and restores the source, former entry and unsaved buffer', async t => {
  const { store, root, source } = await fixture(t), draft = '10 REM DRAFT TO KEEP\n20 END\n';
  const plan = await store.prepareSourceOperation({ action: 'delete', id: 'main', entryPoint: 'util' });
  const result = await store.applySourceOperation(plan.id, draft, 'keep');
  assert.equal(result.manifest.entryPoint, 'util'); assert.equal(result.files.length, 1);
  await assert.rejects(readFile(join(root, 'src/main.bas')), { code: 'ENOENT' });
  const reopened = (await ProjectStore.open(root)).store, last = (await reopened.lastSourceOperation())!;
  const restored = await reopened.restoreSourceOperation(last.revision);
  assert.deepEqual(restored.restoredDraft, { id: 'main', source: draft }); assert.equal(restored.manifest.entryPoint, 'main');
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), source);
  assert.ok((await reopened.historyList()).some(snapshot => snapshot.reason === 'source-draft'));
});
test('explicit save then deletion archives and restores the saved draft without changing other sources', async t => {
  const { store, root } = await fixture(t); const other = await readFile(join(root, 'src/util.bas'));
  const plan = await store.prepareSourceOperation({ action: 'delete', id: 'main', entryPoint: 'util' });
  await store.applySourceOperation(plan.id, '10 REM SAVED BEFORE DELETE\n20 END\n', 'save');
  const last = (await store.lastSourceOperation())!, restored = await store.restoreSourceOperation(last.revision);
  assert.equal(restored.restoredDraft, undefined); assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM SAVED BEFORE DELETE\n20 END\n');
  assert.deepEqual(await readFile(join(root, 'src/util.bas')), other);
});
test('collisions, case aliases, invalid paths, missing folders, symlinks and hardlinks refuse before a journal is published', async t => {
  const { store, root, source } = await fixture(t);
  for (const request of [{ action: 'rename', id: 'main', name: 'UTIL' }, { action: 'move', id: 'main', path: '../outside.bas' }, { action: 'move', id: 'main', path: 'src/missing/main.bas' }, { action: 'rename', id: 'main', name: 'CON' }, { action: 'delete', id: 'main', entryPoint: 'absent' }, { action: 'rename', id: 'main', name: 'TITLE', unknown: true }]) await assert.rejects(store.prepareSourceOperation(request));
  await writeFile(join(root, 'src/TITLE.bas'), 'EXTERNAL');
  await assert.rejects(store.prepareSourceOperation({ action: 'rename', id: 'main', name: 'TITLE' }), /Collision/);
  await symlink(join(root, 'src/levels'), join(root, 'src/alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(store.prepareSourceOperation({ action: 'move', id: 'main', path: 'src/alias/main.bas' }));
  await link(join(root, 'src/main.bas'), join(root, 'copy.bas'));
  await assert.rejects(store.prepareSourceOperation({ action: 'rename', id: 'main', name: 'OTHER' }), /ordinaire/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), source);
  await assert.rejects(readFile(join(root, '.microide/source-journal/current.json')), { code: 'ENOENT' });
});
test('stale plans and restore revisions preserve external edits and the completed checkpoint', async t => {
  const { store, root, source } = await fixture(t);
  const plan = await store.prepareSourceOperation({ action: 'rename', id: 'main', name: 'TITLE' });
  await writeFile(join(root, 'src/util.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.applySourceOperation(plan.id, '10 END\n'), /Conflit externe/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), source);
  const refreshed = (await ProjectStore.open(root)).store, next = await refreshed.prepareSourceOperation({ action: 'rename', id: 'main', name: 'TITLE' });
  await refreshed.applySourceOperation(next.id, '10 END\n');
  const last = (await refreshed.lastSourceOperation())!, checkpoint = await readFile(join(root, '.microide/source-journal/current.json'));
  await assert.rejects(refreshed.restoreSourceOperation('0'.repeat(64)), /périmée/);
  await writeFile(join(root, 'src/title.bas'), '10 REM EXTERNAL TITLE\n');
  assert.equal(await refreshed.lastSourceOperation(), undefined); await assert.rejects(refreshed.restoreSourceOperation(last.revision), /Conflit externe/);
  assert.equal(await readFile(join(root, 'src/title.bas'), 'utf8'), '10 REM EXTERNAL TITLE\n'); assert.deepEqual(await readFile(join(root, '.microide/source-journal/current.json')), checkpoint);
});
test('human limits support 1 MiB sources while agent rename permissions remain restricted and last source deletion is refused', async t => {
  const { root, store } = await fixture(t); await store.save('main', 'X'.repeat(100000));
  const plan = await store.prepareSourceOperation({ action: 'rename', id: 'main', name: 'TITLE' }); await store.applySourceOperation(plan.id, 'X'.repeat(100000));
  assert.equal((await readFile(join(root, 'src/title.bas'))).length, 100000);
  const manifest = structuredClone(store.manifest); manifest.sources = [manifest.sources[0]!];
  assert.throws(() => planSourceOperation(manifest, { action: 'delete', id: 'main', entryPoint: 'main' }), /dernière source/);
  await assert.rejects(store.agentState([{ id: 'main', source: 'X'.repeat(100000) }, { id: 'util', source: '10 END\n' }]), /64 Kio/);
});
async function crash(root: string, stop: string, action = 'move') {
  const child = spawn(process.execPath, ['tests/source-crash-fixture.ts', root, stop, action], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); let errors = '';
  child.stderr?.on('data', bytes => { errors += bytes; });
  try {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Fixture timeout: ' + errors)), 15000); child.once('message', () => { clearTimeout(timer); resolve(); }); child.once('error', reject); child.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture exit ${code}: ${errors}`)); }); });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exited;
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
}
test('SIGKILL after journal, removal, destination and manifest supports finish/restore with exact bytes after relocation', async t => {
  for (const stop of ['prepared', 'removed', 'destination', 'manifest']) for (const choice of ['finish', 'restore'] as const) {
    const { root, source } = await fixture(t); await crash(root, stop);
    await assert.rejects(ProjectStore.open(root), /Mutation de sources interrompue/);
    const parent = await mkdtemp(join(tmpdir(), 'cpceleste-source-moved-')); t.after(() => rm(parent, { recursive: true, force: true }));
    const moved = join(parent, 'project'); await rename(root, moved);
    const summary = (await ProjectStore.sourceRecoveryStatus(moved))!; await ProjectStore.recoverSources(moved, summary.id, choice, summary.revision!);
    const { snapshot } = await ProjectStore.open(moved); assert.equal(snapshot.manifest.sources[0]!.path, choice === 'finish' ? 'src/levels/main.bas' : 'src/main.bas');
    assert.equal(await readFile(join(moved, snapshot.manifest.sources[0]!.path), 'utf8'), source);
  }
});
test('completed deletion and interrupted undo preserve draft/history and can recover either direction', async t => {
  for (const action of ['delete', 'undo-delete']) for (const choice of ['finish', 'restore'] as const) {
    const { root, source } = await fixture(t); await crash(root, action === 'delete' ? 'removed' : 'undo-pending', action);
    const summary = (await ProjectStore.sourceRecoveryStatus(root))!; await ProjectStore.recoverSources(root, summary.id, choice, summary.revision!);
    const { store, snapshot } = await ProjectStore.open(root); assert.equal(snapshot.files.length, choice === 'finish' ? 1 : 2);
    if (choice === 'restore') assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), source);
    assert.ok((await store.historyList()).some(snapshot => snapshot.reason === 'source-draft'));
  }
});

test('unknown/corrupt human records are retained, pending operations block writes, and late external conflicts preserve all versions', async t => {
  const { root, store, source } = await fixture(t); await crash(root, 'prepared');
  const path = join(root, '.microide/source-journal/current.json'), original = await readFile(path), parsed = JSON.parse(original.toString());
  await assert.rejects(store.save('main', '10 END\n'), /Mutation de sources interrompue/);
  for (const record of [{ ...parsed, version: 99 }, { ...parsed, unknown: true }, { ...parsed, files: parsed.files.slice(1) }, { ...parsed, after: { ...parsed.after, hash: '0'.repeat(64) } }]) {
    await writeFile(path, JSON.stringify(record)); await assert.rejects(ProjectStore.sourceRecoveryStatus(root)); assert.equal(await readFile(path, 'utf8'), JSON.stringify(record));
  }
  await writeFile(path, original); const summary = (await ProjectStore.sourceRecoveryStatus(root))!;
  await writeFile(join(root, 'src/util.bas'), '10 REM FOREIGN\n'); await assert.rejects(ProjectStore.recoverSources(root, summary.id, 'finish', summary.revision!), /Conflit externe/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), source); assert.deepEqual(await readFile(path), original);
});

test('archived deleted draft stays readable after another source is saved and the whole operation becomes stale', async t => {
  const { store } = await fixture(t), draft = '10 REM COPY THAT SURVIVES\n20 END\n';
  const plan = await store.prepareSourceOperation({ action: 'delete', id: 'main', entryPoint: 'util' }); await store.applySourceOperation(plan.id, draft);
  await store.save('util', '10 REM NEW UTIL\n20 END\n'); assert.equal(await store.lastSourceOperation(), undefined);
  assert.deepEqual(await store.sourceDraft(), { id: 'main', path: 'src/main.bas', source: draft });
});
