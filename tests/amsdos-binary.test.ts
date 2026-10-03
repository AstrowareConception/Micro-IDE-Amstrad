import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAmsdosBinary, decodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { createDataDisk, readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';

test('16K screen payload retains exact length and memory addresses', () => {
  const bytes = Uint8Array.from({ length: 16384 }, (_, i) => i % 256);
  const encoded = encodeAmsdosBinary('SCREEN.SCR', bytes, 0xc000);
  const disk = createDataDisk([{ name: 'SCREEN.SCR', bytes: encoded }]);
  assert.deepEqual(decodeAmsdosBinary(readDataDisk(disk)[0]!.records), { bytes, loadAddress: 0xc000, entryAddress: 0 });
  assert.equal(encoded[18], 2); assert.equal(encoded[21], 0); assert.equal(encoded[22], 0xc0);
  assert.equal(encoded[19], 0); assert.equal(encoded[20], 0x40); assert.equal(encoded[23], 0xff);
  assert.equal(encoded[24], 0); assert.equal(encoded[25], 0x40); assert.equal(encoded[65], 0x40);
});
test('binary rejects invalid range, checksum, type and truncated data', () => {
  assert.throws(() => encodeAmsdosBinary('A.BIN', new Uint8Array(2), 65535));
  assert.throws(() => encodeAmsdosBinary('A.BIN', new Uint8Array(1), 1.5));
  const encoded = encodeAmsdosBinary('A.BIN', new Uint8Array([1, 2]), 0x9000, 0x9000);
  assert.equal(decodeAmsdosBinary(encoded).entryAddress, 0x9000);
  for (const size of [0, 127, 128, 129]) assert.throws(() => decodeAmsdosBinary(encoded.slice(0, size)));
  for (const offset of [18, 21, 24, 64, 67]) {
    const changed = encoded.slice(); changed[offset] = changed[offset]! ^ 1;
    assert.throws(() => decodeAmsdosBinary(changed));
  }
});
