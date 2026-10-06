import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRamAddress, validInspection, ramRows, CPC_REGISTER_NAMES } from '../packages/emulator/src/inspection.ts';
test('hexadecimal RAM addresses, transport bounds and final byte cannot wrap', () => {
  for (const text of ['ffff', '&FFFF', '0xFFFF', ' FFFF ']) assert.equal(parseRamAddress(text), 65535);
  for (const text of ['', '-1', '10000', '0x', '&GG', '123 4']) assert.equal(parseRamAddress(text), undefined);
  const snapshot = { address: 65535, bytes: new Uint8Array([65]), registers: CPC_REGISTER_NAMES.map(() => 0), ticks: 42 };
  assert.ok(validInspection(snapshot));
  assert.deepEqual(ramRows(snapshot), [{ address: 'FFFF', hex: '41', text: 'A' }]);
  for (const patch of [{ bytes: new Uint8Array(2) }, { bytes: new Uint8Array(0) }, { bytes: new Uint8Array(65) }, { registers: [-1] }, { registers: new Array(15).fill(NaN) }, { ticks: Infinity }, { address: -1 }]) assert.equal(validInspection({ ...snapshot, ...patch }), false);
  assert.equal(validInspection(null), false);
  assert.deepEqual(ramRows({ ...snapshot, address: 0x8000, bytes: new Uint8Array([0, 32, 126, 127, 255]) })[0], { address: '8000', hex: '00 20 7E 7F FF', text: '· ~··' });
});
