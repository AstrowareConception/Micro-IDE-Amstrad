import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { historicalExtended } from './historical-disk-fixture.ts';
import { createDataDisk, readDataDisk, validateCpcName } from '../packages/cpc-disk/src/data-disk.ts';
import { inspectDataDisk, importCapacity } from '../packages/cpc-disk/src/import-disk.ts';
import { encodeBasicFile } from '../packages/cpc-disk/src/basic-codec.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';
import { runCommand } from '../packages/emulator/src/run.ts';
const source = '10 PRINT "ARCHIVE"\n20 END\n';
const standard = () => createDataDisk([{ name: 'A&B.BAS', bytes: encodeBasicFile('A&B.BAS', source) }, { name: 'A&B.BIN', bytes: new Uint8Array([0xff, 0x1a, 0, 0xc9]) }]);

test('historical Extended DATA/SYSTEM extracts ordinary files despite EN and extra sectors in any position', () => {
  for (const system of [false, true]) {
    const disk = historicalExtended(standard(), [0, 5, 39], system), before = disk.slice();
    const result = inspectDataDisk(disk);
    assert.deepEqual(result.files, inspectDataDisk(standard()).files);
    assert.match(result.profile, system ? /system/ : /data/);
    assert.match(result.warnings![0]!, /363 secteur/);
    assert.match(result.warnings![1]!, /pistes 0, 5, 39/);
    assert.deepEqual(disk, before);
  }
  const disk = standard(); disk[256 + 24 + 4] = 0x80;
  assert.deepEqual(inspectDataDisk(disk).files, inspectDataDisk(standard()).files);
});

test('EN tolerance never accepts other FDC flags, weak data, duplicate IDs, missing sectors or truncated extras', () => {
  for (const bit of [1, 2, 4, 8, 16, 32, 64]) {
    const disk = historicalExtended(standard(), [0]); disk[256 + 24 + 8 + 4] = 0x80 | bit;
    assert.throws(() => inspectDataDisk(disk), /piste 0, secteur &C1.*Statut FDC/);
  }
  for (const bit of [1, 2, 4, 8, 16, 32, 64, 128]) {
    const disk = historicalExtended(standard(), [0]); disk[256 + 24 + 8 + 5] = bit;
    assert.throws(() => inspectDataDisk(disk), /Statut FDC/);
  }
  for (const mutate of [
    (b: Uint8Array) => { b[256 + 24 + 4] = 0xa0; }, // Bad extra cannot be silently discarded.
    (b: Uint8Array) => { b[256 + 24 + 7] = 4; },
    (b: Uint8Array) => { b[256 + 24 + 3] = 2; },
    (b: Uint8Array) => { b[256 + 24 + 2] = 0xcb; },
    (b: Uint8Array) => { b[256 + 24 + 16 + 2] = 0xc1; },
    (b: Uint8Array) => { b[256 + 24 + 8] = 1; },
    (b: Uint8Array) => { b[256 + 24 + 8 + 7] = 4; },
    (b: Uint8Array) => { b[256 + 24 + 8 + 2] = 0x41; },
    (b: Uint8Array) => { b[256 + 21] = 29; },
    (b: Uint8Array) => { b[52] = 19; },
    (b: Uint8Array) => { b[256 + 256 + 256 + 16] = 255; }, // Bad directory allocation.
  ]) { const disk = historicalExtended(standard(), [0]); mutate(disk); assert.throws(() => inspectDataDisk(disk)); }
  const disk = historicalExtended(standard(), [39]);
  assert.throws(() => inspectDataDisk(disk.subarray(0, disk.length - 1)));
});

test('ampersand names survive worker, project reopen, build, launch command and standalone recovery', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'historical-import-')), path = join(dir, 'archive.dsk');
  const disk = historicalExtended(standard()); await writeFile(path, disk);
  const session = await DiskImportSession.prepare(path), entry = session.preview.files.find(f => f.source)!;
  const root = await session.create(dir, { id: session.preview.id, name: 'Archive', sourceIds: [entry.id], entryId: entry.id });
  const { store, snapshot } = await ProjectStore.open(root);
  assert.equal(snapshot.files[0]!.cpcName, 'A&B.BAS');
  assert.equal(runCommand('A&B.BAS'), 'RUN"A&B.BAS"\r');
  const files = readDataDisk(buildProjectDisk(store.manifest, snapshot.files, await store.readAssets()));
  assert.deepEqual(files.find(f => f.name === 'A&B.BIN')!.records, inspectDataDisk(standard()).files.find(f => f.name === 'A&B.BIN')!.records);
  assert.deepEqual(await readFile(path), Buffer.from(disk));
  assert.deepEqual(await readFile(join(root, '.microide/imports/original.dsk')), Buffer.from(disk));
  const report = JSON.parse(await readFile(join(root, 'import-report.json'), 'utf8'));
  assert.deepEqual(report.warnings, session.preview.warnings); assert.equal(report.capacity.fits, true);
  const single = join(dir, 'A&B.BAS'); await writeFile(single, encodeBasicFile('A&B.BAS', source));
  assert.equal((await DiskImportSession.prepareFile(single)).preview.files[0]!.source, source);
  for (const name of ['../A.BAS', 'A/B.BAS', 'A\\B.BAS', 'A".BAS', 'A*.BAS', 'A?.BAS', 'A:B.BAS', 'A\r.BAS']) {
    assert.throws(() => validateCpcName(name)); assert.throws(() => runCommand(name));
  }
});

test('capacity anticipates tokenized-to-ASCII expansion without preventing source recovery', () => {
  const files = [{ id: 'main', name: 'A&B.BAS', recordBytes: 1024, kind: 'basic-tokenized' as const, reason: '', source: '10 REM ' + 'A'.repeat(2048) + '\n' },
    { id: 'data', name: 'DATA.BIN', recordBytes: 177 * 1024, kind: 'binary' as const, reason: '' }];
  assert.equal(importCapacity(files, []).fits, true);
  assert.equal(importCapacity(files, ['main']).blocks, 180);
  assert.equal(importCapacity(files, ['main']).fits, false);
  assert.equal(importCapacity(Array.from({ length: 65 }, (_, i) => ({ ...files[1]!, id: String(i), recordBytes: 0 })), []).fits, false);
});
