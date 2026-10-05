import test from 'node:test';
import assert from 'node:assert/strict';
import { runDisk, runCommand } from '../packages/emulator/src/run.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';
test('run builds the unsaved current listing as a real DATA disk with MAIN.BAS', () => {
  const source = '10 PRINT "UNSAVED"\n20 END\n'; const result = runDisk({ source }); assert.equal(result.entry, 'MAIN.BAS');
  const [file] = readDataDisk(result.disk); assert.equal(file!.name, 'MAIN.BAS'); assert.match(new TextDecoder().decode(decodeAsciiRecords(file!.records)), /UNSAVED/); assert.equal(source, '10 PRINT "UNSAVED"\n20 END\n');
});
test('run builds all project buffers and uses the declared entry without concatenating independent programs', () => {
  const manifest = newProject('Exécution', '00000000-0000-4000-8000-000000000000'); manifest.sources.push({ id: 'other', path: 'src/other.bas', cpcName: 'OTHER.BAS' }); manifest.entryPoint = 'other';
  const sources = [{ id: 'main', source: '10 REM BUFFER MAIN\n20 END' }, { id: 'other', source: '10 PRINT "ENTRY BUFFER"\n20 END' }];
  const snapshot = structuredClone({ manifest, sources }); const result = runDisk({ sessionId: 'session', sources }, manifest);
  assert.equal(result.entry, 'OTHER.BAS'); const files = readDataDisk(result.disk); assert.equal(files.length, 2); assert.match(new TextDecoder().decode(decodeAsciiRecords(files.find(f => f.name === 'OTHER.BAS')!.records)), /ENTRY BUFFER/); assert.deepEqual({ manifest, sources }, snapshot);
});
test('run rejects incomplete/duplicate/unknown project buffers and malformed source properties', () => {
  const manifest = newProject('Exécution', '00000000-0000-4000-8000-000000000000');
  for (const sources of [[], [{ id: 'unknown', source: '10 END' }], [{ id: 'main', source: '10 END' }, { id: 'main', source: '20 END' }], [{ id: 'main', source: '10 END', extra: true }]]) assert.throws(() => runDisk({ sessionId: 's', sources }, manifest));
  for (const input of [null, [], { source: 1 }, { source: '10 END', path: '/tmp/file' }, { sources: [] }, { source: 'x'.repeat(1024 * 1024 + 1) }]) assert.throws(() => runDisk(input));
});
test('run refuses unencodable BASIC and oversized disk before exposing a machine session', () => {
  assert.throws(() => runDisk({ source: Array.from({ length: 2000 }, (_, i) => `${i + 1} REM ${'x'.repeat(100)}`).join('\n') }));
  for (const source of ['10 END\0', '10 PRINT "€"', '10 PRINT "x"\n10 END']) assert.throws(() => runDisk({ source }));
});
test('RUN commands accept only bounded CPC BASIC names and have one Enter with no injection', () => {
  assert.equal(runCommand('MAIN.BAS'), 'RUN"MAIN.BAS"\r'); assert.equal(runCommand('OTHER.BAS'), 'RUN"OTHER.BAS"\r');
  for (const entry of ['x.bas', 'MAIN.BAS"\rNEW', '../MAIN.BAS', 'TOO-LONG9.BAS', 'MAIN.TXT']) assert.throws(() => runCommand(entry));
});
