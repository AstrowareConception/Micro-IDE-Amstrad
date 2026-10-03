import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { encodeBasicAscii } from '../packages/cpc-disk/src/basic-ascii.ts';
import { createDataDisk, readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';

for (const length of [0, 1, 127, 128, 129, 1023, 1024, 1025, 16383, 16384, 16385, 32768, 182272]) {
  test(`DATA roundtrip and padding: ${length} bytes`, () => {
    const bytes = Uint8Array.from({ length }, (_, i) => i % 251);
    const disk = createDataDisk([{ name: 'DATA.BIN', bytes }]);
    assert.equal(disk.length, 194816);
    const file = readDataDisk(disk)[0]!;
    assert.deepEqual(file.records.subarray(0, length), bytes);
    assert.equal(file.records.length, Math.ceil(length / 128) * 128);
    assert.ok(file.records.subarray(length).every(v => v === 0x1a));
    assert.equal(file.blocks.length, Math.ceil(length / 1024));
    assert.equal(file.extents, Math.max(1, Math.ceil(length / 16384)));
  });
}
test('allocation is deterministic regardless of input order', () => {
  const a = { name: 'A.BAS', bytes: encodeBasicAscii('10 END\n') };
  const z = { name: 'Z.BAS', bytes: encodeBasicAscii('20 END\n') };
  assert.deepEqual(createDataDisk([a, z]), createDataDisk([z, a]));
  assert.deepEqual(readDataDisk(createDataDisk([z, a])).map(f => f.name), ['A.BAS', 'Z.BAS']);
});
test('filename and capacity constraints', () => {
  for (const name of ['main.bas', '../MAIN', 'TOOLONGXX.BAS', 'A.BASIC', 'A."', 'A B.BAS']) {
    assert.throws(() => createDataDisk([{ name, bytes: new Uint8Array() }]));
  }
  assert.throws(() => createDataDisk([{ name: 'A', bytes: new Uint8Array(182273) }]));
  assert.throws(() => createDataDisk(Array.from({ length: 65 }, (_, i) => ({ name: 'F' + i, bytes: new Uint8Array() }))));
  assert.throws(() => createDataDisk([{ name: 'A', bytes: new Uint8Array() }, { name: 'A', bytes: new Uint8Array() }]));
});
test('malformed containers and directory entries fail closed', () => {
  const original = createDataDisk([{ name: 'MAIN.BAS', bytes: encodeBasicAscii('10 END\n') }]);
  for (const size of [0, 255, 256, 194815, 194817]) assert.throws(() => readDataDisk(new Uint8Array(size)));
  for (const [offset, value] of [[0, 0], [0x30, 41], [0x31, 2], [0x32, 1], [256, 0],
    [272, 1], [277, 12], [282, 0xc0], [283, 7], [284, 1], [290, 0xc1],
    [512 + 15, 129], [512 + 16, 1], [512 + 12, 2], [512 + 17, 3]]) {
    const disk = original.slice(); disk[offset!] = value!; assert.throws(() => readDataDisk(disk), String(offset));
  }
});
test('reader resolves sector IDs rather than physical order', () => {
  const disk = createDataDisk([{ name: 'A', bytes: new Uint8Array(2000).fill(42) }]);
  for (const [a, b, size] of [[280, 288, 8], [512, 1024, 512]] as const) {
    const saved = disk.slice(a, a + size);
    disk.copyWithin(a, b, b + size); disk.set(saved, b);
  }
  assert.equal(readDataDisk(disk)[0]!.records[0], 42);
});
test('hello listing golden disk and logical EOF', () => {
  const source = readFileSync(new URL('../examples/hello-cpc/src/main.bas', import.meta.url), 'utf8');
  const bytes = encodeBasicAscii(source);
  assert.equal(bytes.at(-1), 0x1a);
  assert.equal(new TextDecoder().decode(bytes).includes('\r\n'), true);
  const disk = createDataDisk([{ name: 'MAIN.BAS', bytes }]);
  assert.deepEqual(decodeAsciiRecords(readDataDisk(disk)[0]!.records), bytes);
  const expected = JSON.parse(readFileSync(new URL('./fixtures/hello-golden.json', import.meta.url), 'utf8')) as { diskSha256: string };
  assert.equal(createHash('sha256').update(disk).digest('hex'), expected.diskSha256);
});
test('ASCII validation does not pretend to validate BASIC syntax', () => {
  assert.deepEqual(encodeBasicAscii('10 END'), new TextEncoder().encode('10 END\r\n\x1a'));
  for (const source of ['', '\ufeff10 END\n', '10 END\r\n', '10 PRINT "é"\n', 'PRINT 1\n',
    '20 END\n10 END\n', '10 END\n10 END\n', '65536 END\n', '0 END\n', '10 END\n\n', '10 END\x1a']) {
    assert.throws(() => encodeBasicAscii(source));
  }
  assert.doesNotThrow(() => encodeBasicAscii('10 THISISNOTBASIC\n'));
  assert.throws(() => decodeAsciiRecords(new Uint8Array([1, 2])));
});
