import { validateCpcName } from './data-disk.ts';

export function encodeAmsdosBinary(name: string, payload: Uint8Array, loadAddress: number, entryAddress = 0): Uint8Array {
  validateCpcName(name);
  if (!Number.isInteger(loadAddress) || loadAddress < 0 || loadAddress > 65535 ||
      !Number.isInteger(entryAddress) || entryAddress < 0 || entryAddress > 65535 ||
      payload.length > 65535 || loadAddress + payload.length > 65536) throw new Error('Invalid binary memory range');
  const bytes = new Uint8Array(128 + payload.length);
  const [stem = '', ext = ''] = name.split('.');
  bytes.set(new TextEncoder().encode(stem.padEnd(8, ' ') + ext.padEnd(3, ' ')), 1);
  bytes[18] = 2;
  const view = new DataView(bytes.buffer);
  view.setUint16(21, loadAddress, true);
  view.setUint16(24, payload.length, true);
  view.setUint16(26, entryAddress, true);
  bytes[64] = payload.length & 255; bytes[65] = payload.length >>> 8; bytes[66] = 0;
  view.setUint16(67, bytes.subarray(0, 67).reduce((sum, value) => sum + value, 0), true);
  bytes.set(payload, 128);
  return bytes;
}

/** Must be requested explicitly: a checksum alone does not prove a binary type. */
export function decodeAmsdosBinary(records: Uint8Array): { bytes: Uint8Array; loadAddress: number; entryAddress: number } {
  if (records.length < 128) throw new Error('Truncated AMSDOS header');
  const view = new DataView(records.buffer, records.byteOffset, records.byteLength);
  const checksum = records.subarray(0, 67).reduce((sum, value) => sum + value, 0);
  const length = records[64]! + records[65]! * 256 + records[66]! * 65536;
  const loadAddress = view.getUint16(21, true);
  if (records[18] !== 2 || view.getUint16(67, true) !== checksum || length !== view.getUint16(24, true) ||
      length > 65535 || loadAddress + length > 65536 || 128 + length > records.length) throw new Error('Invalid AMSDOS binary');
  return { bytes: records.slice(128, 128 + length), loadAddress, entryAddress: view.getUint16(26, true) };
}
