import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rename, symlink, link } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { AgentJournal } from '../apps/desktop/agent-journal.ts';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-agent-journal-')); await mkdir(join(root, 'src'));
  const beforeManifest = Buffer.from(JSON.stringify(newProject('Agent durable', randomUUID()), null, 2) + '\n');
  const before = Buffer.from('10 REM ORIGINAL\r\n20 END\r\n'); await writeFile(join(root, 'microide.project.json'), beforeManifest); await writeFile(join(root, 'src/main.bas'), before);
  const next = addProjectSource(JSON.parse(beforeManifest.toString()), 'NEW'); const afterManifest = Buffer.from(JSON.stringify(next, null, 2) + '\n');
  const files = [{ id: 'main', path: 'src/main.bas', before, after: Buffer.from('10 REM AGENT MAIN\n20 END\n') }, { id: 'new', path: 'src/new.bas', before: null, after: Buffer.from('10 REM AGENT NEW\n20 RETURN\n') }];
  return { root, before, beforeManifest, afterManifest, files, journal: new AgentJournal(root), record: join(root, '.microide/agent-journal/current.json') };
}
async function crash(root: string, stop: string) {
  const child = spawn(process.execPath, ['tests/agent-crash-fixture.ts', root, stop], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); let errors = '';
  child.stderr?.on('data', bytes => { errors += bytes; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture timeout: ' + errors)), 10000);
      child.once('message', () => { clearTimeout(timer); resolve(); }); child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture exited ${code}: ${errors}`)); });
    });
    const exit = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill('SIGKILL'); await exit;
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
}
test('production agent mutation SIGKILL at prepare/source/create/manifest can finish or restore exact bytes', async () => {
  for (const stop of ['prepared', 'main', 'new', 'manifest']) for (const choice of ['finish', 'restore'] as const) {
    const item = await fixture(); await crash(item.root, stop); await assert.rejects(ProjectStore.open(item.root), /Mutation agent interrompue/);
    const summary = (await ProjectStore.agentRecoveryStatus(item.root))!; assert.ok(summary);
    await ProjectStore.recoverAgent(item.root, summary.id, choice, summary.revision!);
    assert.deepEqual(await readFile(join(item.root, 'microide.project.json')), choice === 'finish' ? item.afterManifest : item.beforeManifest);
    assert.deepEqual(await readFile(join(item.root, 'src/main.bas')), choice === 'finish' ? item.files[0]!.after : item.before);
    if (choice === 'finish') assert.deepEqual(await readFile(join(item.root, 'src/new.bas')), item.files[1]!.after); else await assert.rejects(readFile(join(item.root, 'src/new.bas')), { code: 'ENOENT' });
    const reopened = await ProjectStore.open(item.root); assert.equal(reopened.snapshot.files.length, choice === 'finish' ? 2 : 1);
    assert.equal(await ProjectStore.agentRecoveryStatus(item.root), undefined); const history = await reopened.store.historyList(); assert.ok(history.some(item => item.reason === 'before-agent')); assert.ok(history.some(item => item.reason === 'after-agent'));
  }
});
test('production mission restoration interrupted after deletion is recoverable in both directions', async () => {
  for (const choice of ['finish', 'restore'] as const) {
    const item = await fixture(); await crash(item.root, 'removed'); const summary = (await ProjectStore.agentRecoveryStatus(item.root))!;
    await ProjectStore.recoverAgent(item.root, summary.id, choice, summary.revision!);
    assert.deepEqual(await readFile(join(item.root, 'microide.project.json')), choice === 'finish' ? item.beforeManifest : item.afterManifest);
    if (choice === 'finish') await assert.rejects(readFile(join(item.root, 'src/new.bas')), { code: 'ENOENT' }); else assert.deepEqual(await readFile(join(item.root, 'src/new.bas')), item.files[1]!.after);
  }
});
test('SIGKILL after committed marker opens normally without an extra recovery choice', async () => {
  const item = await fixture(); await crash(item.root, 'committed'); assert.equal(await ProjectStore.agentRecoveryStatus(item.root), undefined);
  assert.equal((await ProjectStore.open(item.root)).snapshot.files.length, 2);
});
test('unknown source/manifest conflicts and occupied new destination preserve every earlier source and checkpoint', async () => {
  const item = await fixture(); const summary = await item.journal.prepare(item.beforeManifest, item.afterManifest, item.files); const original = await readFile(item.record);
  await writeFile(join(item.root, 'src/new.bas'), 'EXTERNAL NEW'); await assert.rejects(item.journal.recover(summary.id, 'finish', summary.revision!), /Conflit externe/);
  assert.deepEqual(await readFile(join(item.root, 'src/main.bas')), item.before); assert.deepEqual(await readFile(item.record), original);
  await writeFile(join(item.root, 'microide.project.json'), Buffer.concat([item.beforeManifest, Buffer.from(' ')])); await assert.rejects(item.journal.status(), /manifeste/);
  assert.equal(await readFile(join(item.root, 'src/new.bas'), 'utf8'), 'EXTERNAL NEW');
});
test('record revisions, corrupt/future records, unknown metadata and links refuse mutation without purge', async () => {
  const item = await fixture(); const summary = await item.journal.prepare(item.beforeManifest, item.afterManifest, item.files); const original = await readFile(item.record);
  await writeFile(item.record, original.toString() + ' '); await assert.rejects(item.journal.recover(summary.id, 'restore', summary.revision!), /périmé/);
  const parsed = JSON.parse(original.toString());
  for (const record of [{ ...parsed, version: 99 }, { ...parsed, unknown: true }, { ...parsed, files: parsed.files.slice(0, 1) }, { ...parsed, projectId: randomUUID() }, { ...parsed, after: { ...parsed.after, hash: 'a'.repeat(64) } }]) {
    await writeFile(item.record, JSON.stringify(record)); await assert.rejects(item.journal.status()); await assert.rejects(item.journal.prepare(item.beforeManifest, item.afterManifest, item.files));
    assert.equal(await readFile(item.record, 'utf8'), JSON.stringify(record));
  }
  const linked = await fixture(); await mkdir(join(linked.root, '.microide')); await symlink(item.root, join(linked.root, '.microide/agent-journal')); await assert.rejects(linked.journal.status(), /ordinaire/);
  await writeFile(item.record, original); await link(item.record, join(item.root, 'hardlink.json')); await assert.rejects(item.journal.status(), /ordinaire/);
});
test('checkpoint survives project relocation and unfinished temporary files stay intact', async () => {
  const item = await fixture(); const summary = await item.journal.prepare(item.beforeManifest, item.afterManifest, item.files);
  const temporary = join(item.root, '.microide/agent-journal/.microide-deadbeef.tmp'); await writeFile(temporary, 'unfinished');
  const parent = await mkdtemp(join(tmpdir(), 'cpceleste-agent-moved-')), moved = join(parent, 'project'); await rename(item.root, moved);
  const journal = new AgentJournal(moved); await journal.recover(summary.id, 'restore', summary.revision!);
  assert.equal(await readFile(join(moved, '.microide/agent-journal/.microide-deadbeef.tmp'), 'utf8'), 'unfinished'); assert.equal((await ProjectStore.open(moved)).snapshot.files.length, 1);
  await writeFile(join(moved, '.microide/agent-journal/unknown'), 'keep'); await assert.rejects(journal.prepare(item.beforeManifest, item.afterManifest, item.files), /inconnus/);
  assert.equal((await readdir(join(moved, '.microide/agent-journal'))).includes('unknown'), true);
});
test('pending mutation blocks normal project operations; invalid/oversize candidates publish no checkpoint', async () => {
  const item = await fixture(); const { store, snapshot } = await ProjectStore.open(item.root);
  const state = await store.agentState(snapshot.files.map(file => ({ id: file.id, source: file.source })));
  const invalid = structuredClone(state); invalid.files[0]!.saved = 'X'.repeat(65537);
  await assert.rejects(store.applyAgentState(invalid), /64 Kio/); await assert.rejects(readFile(item.record), { code: 'ENOENT' });
  invalid.files[0]!.saved = '\uFEFF10 END'; await assert.rejects(store.applyAgentState(invalid), /invalide/);
  await item.journal.prepare(item.beforeManifest, item.afterManifest, item.files);
  await assert.rejects(store.save('main', '10 END\n'), /Mutation agent interrompue/);
  await assert.rejects(store.agentState([{ id: 'main', source: '10 END\n' }]), /Mutation agent interrompue/);
  assert.deepEqual(await readFile(join(item.root, 'src/main.bas')), item.before);
});
