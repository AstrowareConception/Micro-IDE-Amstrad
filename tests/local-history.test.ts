import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rename, symlink, link, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { LocalHistory } from '../apps/desktop/local-history.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-history-')); await mkdir(join(root, 'src'));
  const manifest = addProjectSource(newProject('Historique original', randomUUID()), 'UTIL');
  await writeFile(join(root, 'microide.project.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const source of manifest.sources) await writeFile(join(root, source.path), `10 REM OLD ${source.id}\r\n20 END\r\n`);
  const { store } = await ProjectStore.open(root);
  return { root, store, manifest, history: new LocalHistory(root, manifest.projectId), folder: join(root, '.microide/history') };
}
test('active save is journaled, histories survive reopen/move, previews preserve disk and clean CRLF sources, no-op does not grow history', async () => {
  const { root, store, manifest, folder } = await fixture();
  assert.deepEqual(await store.historyList(), []); assert.equal((await readdir(root)).includes('.microide'), false);
  const utilBefore = await readFile(join(root, 'src/util.bas')), manifestBefore = await readFile(join(root, 'microide.project.json'));
  await store.save('main', '10 REM NEW MAIN\n20 END\n');
  const versions = await store.historyList(); assert.equal(versions.length, 2);
  assert.deepEqual(versions.map(version => version.reason), ['after-save', 'before-save']);
  const old = versions[1]!;
  const preview = await store.historyVersion(old.id, 'main', old.revision);
  assert.equal(preview.source, '10 REM OLD main\n20 END\n');
  assert.deepEqual(await readFile(join(root, 'src/util.bas')), utilBefore);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM NEW MAIN\n20 END\n');
  assert.deepEqual(await readFile(join(root, 'microide.project.json')), manifestBefore);
  assert.equal(JSON.parse(await readFile(join(root, '.microide/save/pending.json'), 'utf8')).phase, 'committed');
  const original = JSON.parse(await readFile(join(folder, `${old.id}.json`), 'utf8'));
  assert.equal(Buffer.from(original.files[0].content, 'base64').toString(), '10 REM OLD main\r\n20 END\r\n');
  await store.save('main', '10 REM NEW MAIN\n20 END\n'); assert.equal((await store.historyList()).length, 2);
  const parent = await mkdtemp(join(tmpdir(), 'cpceleste-moved-')); const moved = join(parent, 'project'); await rename(root, moved);
  const { store: reopened } = await ProjectStore.open(moved);
  assert.deepEqual(await reopened.historyList(), versions);
  assert.equal((await reopened.historyVersion(old.id, 'main', old.revision)).source, preview.source);
  assert.equal(manifest.projectId, reopened.manifest.projectId);
});
test('retention keeps the newest 20 snapshots in monotonic order and deduplicates identical content', async () => {
  const { history, folder } = await fixture();
  for (let i = 0; i < 25; i++) await history.capture([{ id: 'main', path: 'src/main.bas', content: Buffer.from(`10 REM ${i}\n`) }], 'before-save');
  const versions = await history.list(); assert.equal(versions.length, 20);
  assert.equal((await history.version(versions[0]!.id, 'main', versions[0]!.revision)).source, '10 REM 24\n');
  assert.equal((await history.version(versions[19]!.id, 'main', versions[19]!.revision)).source, '10 REM 5\n');
  for (let i = 1; i < versions.length; i++) assert.ok(versions[i - 1]!.createdAt > versions[i]!.createdAt);
  await history.capture([{ id: 'main', path: 'src/main.bas', content: Buffer.from('10 REM 24\n') }], 'after-save');
  assert.equal((await readdir(folder)).length, 20);
});
test('serialized history retention stays within 64 MiB for full 8 MiB source snapshots', async () => {
  const { history, folder } = await fixture();
  for (let i = 0; i < 7; i++) await history.capture(Array.from({ length: 8 }, (_, index) => ({ id: `src${index}`, path: `src/f${index}.bas`, content: Buffer.alloc(1024 * 1024, 65 + i) })), 'before-save');
  const names = await readdir(folder); let total = 0; for (const name of names) total += (await stat(join(folder, name))).size;
  assert.ok(total <= 64 * 1024 * 1024); assert.equal(names.length, 5);
  assert.ok((await history.list()).length > 0);
});
test('corruption, unknown version/project/path/hash and extra fields preserve history and block saves before any source write', async () => {
  const { root, store, history, folder } = await fixture(); await store.save('main', '10 REM VERSION\n');
  const version = (await history.list())[0]!, path = join(folder, `${version.id}.json`), original = await readFile(path);
  const mutations = [(item: Record<string, unknown>) => { item.version = 2; }, (item: Record<string, unknown>) => { item.projectId = randomUUID(); },
    (item: Record<string, unknown>) => { item.extra = true; },
    (item: Record<string, unknown>) => { (item.files as { path: string }[])[0]!.path = '../outside.bas'; },
    (item: Record<string, unknown>) => { (item.files as { sha256: string }[])[0]!.sha256 = '0'.repeat(64); }];
  const sourceBefore = await readFile(join(root, 'src/main.bas'));
  for (const mutate of mutations) {
    const item = JSON.parse(original.toString()); mutate(item); const corrupted = Buffer.from(JSON.stringify(item)); await writeFile(path, corrupted);
    await assert.rejects(history.list()); await assert.rejects(store.save('main', '10 REM DO NOT WRITE\n'));
    assert.deepEqual(await readFile(path), corrupted); assert.deepEqual(await readFile(join(root, 'src/main.bas')), sourceBefore);
  }
  await writeFile(path, original); await writeFile(join(folder, 'unknown.txt'), 'KEEP');
  await assert.rejects(store.save('main', '10 REM DO NOT WRITE\n'), /inconnu/);
  assert.equal(await readFile(join(folder, 'unknown.txt'), 'utf8'), 'KEEP');
});
test('historical revision, source scope, path remapping and disk conflicts are guarded at every preview read', async () => {
  const { root, store, history, folder } = await fixture(); await store.save('main', '10 REM VERSION\n');
  const version = (await history.list())[0]!, path = join(folder, `${version.id}.json`), original = await readFile(path);
  await assert.rejects(store.historyVersion('../other', 'main', version.revision), /invalide/);
  await assert.rejects(store.historyVersion(version.id, 'unknown', version.revision), /non déclarée/);
  const item = JSON.parse(original.toString()); item.reason = 'before-save'; await writeFile(path, JSON.stringify(item));
  await assert.rejects(store.historyVersion(version.id, 'main', version.revision), /périmée/);
  const changed = (await history.list()).find(entry => entry.id === version.id)!;
  item.files[0].path = 'src/another.bas'; await writeFile(path, JSON.stringify(item));
  const remapped = (await history.list()).find(entry => entry.id === version.id)!;
  await assert.rejects(store.historyVersion(version.id, 'main', remapped.revision), /Chemin historique/);
  await writeFile(path, original); await writeFile(join(root, 'src/main.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.historyVersion(version.id, 'main', version.revision), /Conflit externe/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM EXTERNAL\n'); assert.notEqual(changed.revision, version.revision);
});
test('metadata symlinks and snapshot hardlinks are rejected; interrupted temporary files are retained', async () => {
  const first = await fixture(); await mkdir(join(first.root, '.microide')); await symlink(first.root, first.folder);
  await assert.rejects(first.store.save('main', '10 REM NO\n'), /lien/);
  assert.equal(await readFile(join(first.root, 'src/main.bas'), 'utf8'), '10 REM OLD main\r\n20 END\r\n');
  const second = await fixture(); await second.store.save('main', '10 REM YES\n');
  const version = (await second.history.list())[0]!; const file = join(second.folder, `${version.id}.json`);
  await link(file, join(second.root, 'linked-history.json')); await assert.rejects(second.history.list(), /ordinaire/);
  const third = await fixture(); await mkdir(third.folder, { recursive: true }); const temporary = join(third.folder, `.microide-${randomUUID()}.tmp`);
  await writeFile(temporary, '{interrupted'); assert.deepEqual(await third.history.list(), []);
  await third.store.save('main', '10 REM VALID\n'); assert.equal(await readFile(temporary, 'utf8'), '{interrupted');
});
test('a conflict in an inactive source blocks the active save and creates no historical snapshot', async () => {
  const { root, store } = await fixture(); await writeFile(join(root, 'src/util.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.save('main', '10 REM NO\n'), /changé sur disque/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM OLD main\r\n20 END\r\n');
  assert.deepEqual(await store.historyList(), []);
});
