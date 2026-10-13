import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rename, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectDataDisk, selectImportSources } from '../packages/cpc-disk/src/import-disk.ts';
import { createDataDisk, readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeBasicAscii } from '../packages/cpc-disk/src/basic-ascii.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';
import { runCommand } from '../packages/emulator/src/run.ts';

const source = '10 PRINT "OLD CPC"\n20 END\n';
function header(type: number) {
  const bytes = encodeAmsdosBinary('FILE.BIN', new Uint8Array([0x76, 0xc9]), 0x8000);
  bytes[18] = type; const sum = bytes.subarray(0, 67).reduce((sum, byte) => sum + byte, 0);
  bytes[67] = sum & 255; bytes[68] = sum >>> 8; return bytes;
}
function fixture() { return createDataDisk([
  { name: 'MENU.BAS', bytes: encodeBasicAscii(source) },
  { name: 'OLD.BIN', bytes: encodeBasicAscii('10 PRINT "A BASIC UNDER BIN"\n') },
  { name: 'TOKEN.BAS', bytes: header(0) }, { name: 'SECRET.BAS', bytes: header(1) },
  { name: 'IMAGE.SCR', bytes: header(2) }, { name: 'UNKNOWN', bytes: new Uint8Array([0, 1, 0x1a, 0xff]) },
]); }
const folder = () => mkdtemp(join(tmpdir(), 'cpceleste-dsk-import-'));

test('content detection ignores extension, preserves all records and distinguishes unsupported types', () => {
  const disk = fixture(), before = disk.slice(), view = inspectDataDisk(disk);
  assert.deepEqual(disk, before);
  assert.equal(view.files.find(file => file.name === 'MENU.BAS')?.source, source);
  assert.equal(view.files.find(file => file.name === 'OLD.BIN')?.kind, 'basic-ascii');
  for (const [name, kind] of [['TOKEN.BAS', 'basic-tokenized'], ['SECRET.BAS', 'basic-protected'], ['IMAGE.SCR', 'binary'], ['UNKNOWN', 'unknown']])
    assert.equal(view.files.find(file => file.name === name)?.kind, kind);
  for (const file of view.files) assert.deepEqual(file.records, readDataDisk(disk).find(raw => raw.name === file.name)!.records);
});
test('truncated/Extended/corrupt disks fail closed and ASCII EOF never truncates hidden content', () => {
  assert.throws(() => inspectDataDisk(fixture().subarray(0, 100)), /non pris en charge/);
  const extended = fixture(); extended[0] = 69; assert.throws(() => inspectDataDisk(extended));
  for (const bytes of [new TextEncoder().encode('10 END\x1aSECRET'), new Uint8Array([49,48,32,69,78,68,0,26]),
    new TextEncoder().encode('20 END\r\n10 END\x1a'), new TextEncoder().encode('HELLO\x1a'), new Uint8Array([49,48,32,255,26])]) {
    assert.equal(inspectDataDisk(createDataDisk([{ name: 'FAKE.BAS', bytes }])).files[0]!.kind, 'unknown');
  }
});
test('selection rejects duplicates, unsupported entries, missing entry and invalid names', () => {
  const view = inspectDataDisk(fixture()), ascii = view.files.find(file => file.kind === 'basic-ascii')!, binary = view.files.find(file => file.kind === 'binary')!;
  const request = { id: 'id', name: 'Imported', sourceIds: [ascii.id], entryId: ascii.id };
  assert.equal(selectImportSources(view, request).length, 1);
  for (const changed of [{ sourceIds: [] }, { sourceIds: [ascii.id, ascii.id] }, { entryId: binary.id }, { sourceIds: [binary.id], entryId: binary.id }, { name: '' }, { name: 'x'.repeat(101) }])
    assert.throws(() => selectImportSources(view, { ...request, ...changed }));
});
test('real worker/import creates a portable project, preserves BIN name and originals, supports edit/build/AI', async () => {
  const parent = await folder(), path = join(parent, 'old.dsk'), disk = fixture(); await writeFile(path, disk);
  const session = await DiskImportSession.prepare(path);
  const selected = session.preview.files.filter(file => file.kind === 'basic-ascii');
  assert.ok(!('records' in selected[0]!));
  const entry = selected.find(file => file.name === 'OLD.BIN')!;
  const root = await session.create(parent, { id: session.preview.id, name: 'Reprise', sourceIds: selected.map(file => file.id), entryId: entry.id });
  const opened = await ProjectStore.open(root); assert.equal(opened.snapshot.files.length, 2);
  assert.equal(opened.store.manifest.sources.find(file => file.id === entry.id)!.cpcName, 'OLD.BIN');
  assert.equal(runCommand('OLD.BIN'), 'RUN"OLD.BIN"\r');
  const updated = '10 PRINT "IMPROVED"\n20 END\n'; await opened.store.save(entry.id, updated);
  const reopened = await ProjectStore.open(root);
  const buffers = reopened.snapshot.files.map(file => ({ id: file.id, source: file.source }));
  const state = await reopened.store.agentState(buffers); assert.equal(state.files.find(file => file.id === entry.id)!.source, updated);
  const rebuilt = readDataDisk(buildProjectDisk(reopened.snapshot.manifest, buffers)); assert.equal(rebuilt.length, 2);
  assert.equal(new TextDecoder().decode(decodeAsciiRecords(rebuilt.find(file => file.name === 'OLD.BIN')!.records)), '10 PRINT "IMPROVED"\r\n20 END\r\n\x1a');
  assert.deepEqual(await readFile(path), Buffer.from(disk));
  assert.deepEqual(await readFile(join(root, '.microide/imports/original.dsk')), Buffer.from(disk));
  const report = JSON.parse(await readFile(join(root, 'import-report.json'), 'utf8'));
  assert.equal(report.files.length, 6); assert.equal(report.files.filter((file: { sourcePath: string | null }) => file.sourcePath !== null).length, 2);
  assert.ok(!JSON.stringify(report).includes(parent));
  for (const file of report.files) assert.deepEqual(await readFile(join(root, file.originalPath)), Buffer.from(readDataDisk(disk).find(raw => raw.name === file.name)!.records));
  const moved = root + '-moved'; await rename(root, moved); assert.equal((await ProjectStore.open(moved)).snapshot.files.length, 2);
});
test('stale source, forged preview and invalid selection cause no project writes', async () => {
  const parent = await folder(), path = join(parent, 'old.dsk'); await writeFile(path, fixture());
  const session = await DiskImportSession.prepare(path), source = session.preview.files.find(file => file.kind === 'basic-ascii')!;
  const request = { id: session.preview.id, name: 'Recovered', sourceIds: [source.id], entryId: source.id };
  await assert.rejects(session.create(parent, { ...request, id: 'forged' }), /périmé/);
  await assert.rejects(session.create(parent, { ...request, sourceIds: ['missing'] }));
  await writeFile(path, createDataDisk([{ name: 'NEW.BAS', bytes: encodeBasicAscii('10 END\n') }]));
  await assert.rejects(session.create(parent, request), /changé/);
  assert.deepEqual(await readdir(parent), ['old.dsk']);
});
test('import never overwrites a parent project and refuses symlink disk inputs', async () => {
  const parent = await folder(); await ProjectStore.create(parent, 'Existing');
  const original = await readFile(join(parent, 'microide.project.json'));
  const path = join(parent, 'old.dsk'); await writeFile(path, fixture());
  const session = await DiskImportSession.prepare(path), source = session.preview.files.find(file => file.kind === 'basic-ascii')!;
  const root = await session.create(parent, { id: session.preview.id, name: 'New', sourceIds: [source.id], entryId: source.id });
  assert.notEqual(root, parent); assert.deepEqual(await readFile(join(parent, 'microide.project.json')), original);
  if (process.platform !== 'win32') {
    await symlink(path, join(parent, 'link.dsk')); await assert.rejects(DiskImportSession.prepare(join(parent, 'link.dsk')), /standard DATA/);
  }
});
