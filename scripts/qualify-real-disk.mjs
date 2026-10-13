// Optional manual recipe; input disks, ROMs, projects and screenshots stay outside Git.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';
import { readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';

const [input, entryName, ...phases] = process.argv.slice(2);
if (!input || !entryName || !/^[A-Z0-9_]{1,8}(?:\.[A-Z0-9_]{1,3})?$/.test(entryName) ||
    phases.length < 2 || phases.length > 20 || phases.length % 2 ||
    phases.some((value, index) => index % 2 === 0 ? !/^\d+$/.test(value) || Number(value) > 120 :
      value.length > 80 || /[^\x20-\x7e\r]/.test(value)))
  throw Error('Usage: CPC_TEST_ROM_DIR=… node scripts/qualify-real-disk.mjs DISK ENTRY.BAS SECONDS KEYS [SECONDS KEYS…]');
const romDir = process.env.CPC_TEST_ROM_DIR;
if (!romDir) throw Error('CPC_TEST_ROM_DIR requis.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const firmware = {
  os: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf',
  basic: '58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977',
  amsdos: 'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d',
};
const roms = [];
for (const [role, hash] of Object.entries(firmware)) {
  const path = join(romDir, `cpc6128_${role}.bin`);
  assert.equal(sha(await readFile(path)), hash, `Firmware ${role}`); roms.push(path);
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 180000 });
  if (result.error || result.status !== 0) throw Error(result.error?.message ?? result.stdout + result.stderr);
  return result.stdout;
}
const original = await readFile(input), session = await DiskImportSession.prepare(input);
assert.equal(session.preview.sha256, sha(original), 'Input changed during inspection');
assert.equal(session.preview.profile, 'standard-data-40', 'Native observation limited to standard DATA');
const entry = session.preview.files.find(file => file.name === entryName);
assert.ok(entry, 'Declared entry required');
const binary = entry.source === undefined;
const parent = await mkdtemp(join(tmpdir(), 'cpc-real-import-'));
const root = await session.create(parent, { id: session.preview.id, name: 'Real disk observation', sourceIds: binary ? [] : [entry.id], entryId: entry.id, ...(binary ? { kind: 'binary' } : {}) });
const { store, snapshot } = await ProjectStore.open(root);
const rebuilt = buildProjectDisk(snapshot.manifest, snapshot.files, await store.readAssets());
// The native adapter accepts canonical headers only. Normalize labels on a diagnostic copy,
// after the importer has validated every track, sector and directory allocation.
const baseline = Buffer.from(original);
baseline.write('MV - CPCEMU Disk-File\r\nDisk-Info\r\n');
for (let track = 0; track < 40; track++) baseline.write('Track-Info\r\n', 256 + track * 4864);
const before = readDataDisk(baseline), after = readDataDisk(rebuilt);
assert.deepEqual(after.map(file => file.name), before.map(file => file.name));
for (const file of before.filter(file => binary || file.name !== entryName))
  assert.deepEqual(after.find(item => item.name === file.name).records, file.records, file.name);
assert.deepEqual(await readFile(input), original);
await mkdir('out', { recursive: true });
const output = await mkdtemp('out/real-disk-'), executable = join(output, 'observe');
run(process.env.CC || 'gcc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-I.cache/chips', 'tests/native_disk_recovery.c', '-lm', '-o', executable]);
await chmod(executable, 0o700);
const observations = {};
for (const [name, bytes] of [['baseline', baseline], ['rebuilt', rebuilt]]) {
  const disk = join(output, `${name}.dsk`);
  await writeFile(disk, bytes);
  observations[name] = run(executable, [...roms, disk, entryName, join(output, name), ...phases])
    .trim().split('\n').map(line => JSON.parse(line));
}
const report = { originalSha256: sha(original), rebuiltSha256: sha(rebuilt), firmware, entryName,
  resourceRecordsPreserved: before.length - (binary ? 0 : 1), originalUnchanged: true,
  phases, observations, project: root, screenshots: 'PPM: inspect visually; execution success is not asserted by this script.',
  independentEmulator: false };
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(output);
