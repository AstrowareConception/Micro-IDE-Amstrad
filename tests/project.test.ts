import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newProject, parseProject, addProjectSource, buildProjectDisk } from '../packages/workspace/src/project.ts';
import { readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';

const UUID = '647f023d-1272-4b66-8c47-b064b8de9512';
const project = () => newProject('Hello CPC', UUID);
const folder = () => mkdtemp(join(tmpdir(), 'microide-project-'));

test('save all persists a complete snapshot, preserves clean CRLF bytes and manifest, and refreshes hashes', async () => {
  const root = await folder(); const { store } = await ProjectStore.create(root, 'Batch'); await store.add('UTIL');
  await writeFile(join(root, 'src/util.bas'), '10 REM CLEAN\r\n20 RETURN\r\n');
  const reopened = await ProjectStore.open(root); const manifest = await readFile(join(root, 'microide.project.json'));
  const buffers = reopened.snapshot.files.map(item => ({ id: item.id, source: item.id === 'main' ? '10 PRINT "BATCH"\n20 END\n' : item.source }));
  const result = await reopened.store.saveAll(buffers); assert.equal(result.changedCount, 1); assert.deepEqual(result.savedIds, ['main', 'util']);
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), '10 REM CLEAN\r\n20 RETURN\r\n');
  assert.deepEqual(await readFile(join(root, 'microide.project.json')), manifest);
  assert.equal((await reopened.store.saveAll(buffers)).changedCount, 0);
  await reopened.store.save('main', '10 REM NEXT\n');
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM NEXT\n');
});
test('save all refuses a late source or manifest conflict before touching an earlier dirty source', async () => {
  const root = await folder(); const { store } = await ProjectStore.create(root, 'Batch'); await store.add('UTIL');
  const original = await readFile(join(root, 'src/main.bas')); const manifest = await readFile(join(root, 'microide.project.json'));
  const buffers = [{ id: 'main', source: '10 REM DIRTY MAIN\n' }, { id: 'util', source: '10 REM DIRTY UTIL\n' }];
  await writeFile(join(root, 'src/util.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.saveAll(buffers), /Aucune source enregistrée/);
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), original);
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), '10 REM EXTERNAL\n');
  await writeFile(join(root, 'microide.project.json'), Buffer.concat([manifest, Buffer.from(' ')]));
  await assert.rejects(store.saveAll(buffers), /manifeste/);
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), original);
});
test('save all rejects incomplete, duplicate, unknown and oversized snapshots with no writes', async () => {
  const root = await folder(); const { store } = await ProjectStore.create(root, 'Batch'); await store.add('UTIL');
  const original = await readFile(join(root, 'src/main.bas'));
  for (const invalid of [[{ id: 'main', source: '10 END' }], [{ id: 'main', source: 'X' }, { id: 'main', source: 'Y' }], [{ id: 'main', source: 'X' }, { id: 'unknown', source: 'Y' }], [{ id: 'main', source: 'X' }, { id: 'util', source: '\0' }], [{ id: 'main', source: 'X' }, { id: 'util', source: 'é'.repeat(1024 * 1024) }]]) {
    await assert.rejects(store.saveAll(invalid)); assert.deepEqual(await readFile(join(root, 'src/main.bas')), original);
  }
});

test('project contract preserves identity and refuses unsupported data rather than dropping it', () => {
  const value = project();
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(value))), value);
  for (const changed of [{ ...value, schemaVersion: 2 }, { ...value, extra: true }, { ...value, documents: [{}] },
    { ...value, assets: [{}] }, { ...value, build: { ...value.build, textEncoding: 'cpc-qualified' } }, { ...value, entryPoint: 'absent' }])
    assert.throws(() => parseProject(changed));
});
test('paths and names reject traversal, Windows aliases and case-insensitive collisions', () => {
  const value = project();
  for (const path of ['../main.bas', '/src/main.bas', 'src/../main.bas', 'src/a\\main.bas', 'src/CON.bas', 'src/folder./main.bas', 'src/NUL/main.bas'])
    assert.throws(() => parseProject({ ...value, sources: [{ ...value.sources[0], path }] }));
  for (const source of [{ id: 'MAIN', path: 'src/other.bas', cpcName: 'OTHER.BAS' },
    { id: 'other', path: 'src/MAIN.bas', cpcName: 'OTHER.BAS' }, { id: 'other', path: 'src/other.bas', cpcName: 'MAIN.BAS' }])
    assert.throws(() => parseProject({ ...value, sources: [...value.sources, source] }));
  assert.throws(() => addProjectSource(value, 'main'));
  assert.throws(() => addProjectSource(value, 'CON'));
});
test('project DSK contains independent listings, is deterministic and rejects incomplete snapshots', () => {
  const value = addProjectSource(project(), 'UTIL');
  const buffers = [{ id: 'main', source: '10 PRINT "MAIN"\n20 END\n' }, { id: 'util', source: '10 PRINT "UTIL"\n20 END\n' }];
  const disk = buildProjectDisk(value, buffers);
  assert.deepEqual(disk, buildProjectDisk(value, [...buffers].reverse()));
  const files = readDataDisk(disk); assert.deepEqual(files.map(file => file.name), ['MAIN.BAS', 'UTIL.BAS']);
  assert.equal(new TextDecoder().decode(decodeAsciiRecords(files[1]!.records)), '10 PRINT "UTIL"\r\n20 END\r\n\x1a');
  assert.throws(() => buildProjectDisk(value, buffers.slice(0, 1)), /incomplet/);
  assert.throws(() => buildProjectDisk(value, [buffers[0]!, buffers[0]!]), /dupliqué/);
  assert.throws(() => buildProjectDisk(value, [buffers[0]!, { id: 'unknown', source: '10 END' }]), /absent/);
  assert.throws(() => buildProjectDisk(value, [buffers[0]!, { id: 'util', source: '10 GOTO 999' }]), /src\/util.bas/);
});
test('create, add, save and entry survive relocating the folder; add returns only its new buffer', async () => {
  const root = await folder(); const { store, snapshot } = await ProjectStore.create(root, 'Portable');
  assert.equal(snapshot.files.length, 1); store.assertSession(snapshot.sessionId);
  assert.throws(() => store.assertSession('old'), /périmée/);
  const added = await store.add('UTIL'); assert.equal(added.files.length, 1); assert.equal(added.files[0]!.id, 'util');
  await store.save('main', '10 REM SAVED\r\n20 END\r\n');
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM SAVED\n20 END\n');
  await store.setEntry('util');
  const moved = root + '-moved'; await rename(root, moved);
  const reopened = await ProjectStore.open(moved);
  assert.equal(reopened.snapshot.manifest.projectId, snapshot.manifest.projectId);
  assert.equal(reopened.snapshot.manifest.entryPoint, 'util'); assert.equal(reopened.snapshot.files.length, 2);
  assert.notEqual(reopened.snapshot.sessionId, snapshot.sessionId);
});
test('source and manifest conflicts refuse overwrite; unknown IDs and occupied folders fail closed', async () => {
  const root = await folder(); const { store } = await ProjectStore.create(root, 'Conflicts');
  await assert.rejects(ProjectStore.create(root, 'Again'), /vide/);
  await assert.rejects(store.save('outside', '10 END'), /non déclarée/);
  await writeFile(join(root, 'src/main.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(store.save('main', '10 END'), /changé sur disque/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM EXTERNAL\n');
  const manifest = await readFile(join(root, 'microide.project.json'), 'utf8');
  await writeFile(join(root, 'microide.project.json'), manifest + ' ');
  await assert.rejects(store.add('OTHER'), /manifeste a changé/);
  await assert.rejects(store.setEntry('main'), /manifeste a changé/);
  await assert.rejects(store.assertCurrent(), /manifeste a changé/);
});
test('unregistered existing files are not overwritten; export cannot target project content', async () => {
  const root = await folder(); const { store } = await ProjectStore.create(root, 'Protected');
  await writeFile(join(root, 'src/util.bas'), '10 REM KEEP\n');
  await assert.rejects(store.add('UTIL'), /EEXIST/);
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), '10 REM KEEP\n');
  await assert.rejects(store.assertExportDestination(join(root, 'src/main.bas')), /hors du dossier/);
  await store.assertExportDestination(join(await folder(), 'ok.dsk'));
});
test('source and directory symlinks, invalid UTF-8, BOM and oversized files are refused', async () => {
  const outside = await folder(); await writeFile(join(outside, 'main.bas'), '10 END\n');
  for (const directory of [false, true]) {
    const root = await folder(); await writeFile(join(root, 'microide.project.json'), JSON.stringify(project()));
    if (directory) await symlink(outside, join(root, 'src'), 'junction');
    else { await mkdir(join(root, 'src')); await symlink(join(outside, 'main.bas'), join(root, 'src/main.bas')); }
    await assert.rejects(ProjectStore.open(root), /symbolique|jonction/);
  }
  for (const content of [Buffer.from([0xff]), Buffer.from([0xef, 0xbb, 0xbf, 0x31]), Buffer.from('10 END\0'), Buffer.alloc(1024 * 1024 + 1)]) {
    const root = await folder(); await ProjectStore.create(root, 'Invalid');
    await writeFile(join(root, 'src/main.bas'), content); await assert.rejects(ProjectStore.open(root));
  }
});
