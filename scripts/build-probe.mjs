import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { encodeBasicAscii } from '../packages/cpc-disk/src/basic-ascii.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { createDataDisk, readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';
const source = await readFile(new URL('../examples/j0-probe/src/probe.bas', import.meta.url), 'utf8');
const disk = createDataDisk([
  { name: 'PROBE.BAS', bytes: encodeBasicAscii(source) },
  { name: 'CHECK.BIN', bytes: encodeAmsdosBinary('CHECK.BIN', new Uint8Array([42, 43, 44, 45]), 0x9000) },
]);
readDataDisk(disk);
await mkdir(new URL('../out/', import.meta.url), { recursive: true });
await writeFile(new URL('../out/probe.dsk', import.meta.url), disk);
console.log('out/probe.dsk: structurally validated; RUN"PROBE.BAS" still requires firmware and machine trials.');

if (process.argv[2]) {
  const written = readDataDisk(await readFile(process.argv[2])).find(f => f.name === 'RESULT.TXT');
  if (!written || new TextDecoder().decode(decodeAsciiRecords(written.records)) !== 'J0 DISK WRITE\r\n\x1a') {
    throw new Error('Session disk RESULT.TXT does not match expected ASCII bytes');
  }
  console.log('Exported RESULT.TXT matches; independent emulator trial must still be recorded.');
}
