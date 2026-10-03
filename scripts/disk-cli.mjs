import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { encodeBasicAscii } from '../packages/cpc-disk/src/basic-ascii.ts';
import { createDataDisk, readDataDisk, decodeAsciiRecords, DATA_PROFILE } from '../packages/cpc-disk/src/data-disk.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const [command, input, output, name = 'MAIN.BAS'] = process.argv.slice(2);
  if (command === 'build' && input && output) {
    const source = await readFile(input);
    const encoded = encodeBasicAscii(new TextDecoder('utf-8', { fatal: true }).decode(source));
    const disk = createDataDisk([{ name, bytes: encoded }]);
    const files = readDataDisk(disk);
    if (hash(decodeAsciiRecords(files[0].records)) !== hash(encoded)) throw new Error('Readback mismatch');
    await mkdir(dirname(resolve(output)), { recursive: true });
    const temporary = resolve(output) + '.tmp-' + process.pid;
    try {
      await writeFile(temporary, disk, { flag: 'wx' });
      readDataDisk(await readFile(temporary));
      await rename(temporary, resolve(output));
    } finally { await rm(temporary, { force: true }); }
    console.log(JSON.stringify({ status: 'structurally-validated', writer: DATA_PROFILE.writerVersion,
      inputSha256: hash(source), cpcSha256: hash(encoded), diskSha256: hash(disk),
      bytes: disk.length, filename: name, emulatorTested: false }, null, 2));
  } else if (command === 'inspect' && input && !output) {
    const disk = await readFile(input);
    console.log(JSON.stringify({ sha256: hash(disk), files: readDataDisk(disk).map(file => ({
      name: file.name, recordBytes: file.records.length, extents: file.extents, blocks: file.blocks,
      recordSha256: hash(file.records),
    })) }, null, 2));
  } else throw new Error('Usage: node scripts/disk-cli.mjs build SOURCE OUTPUT [CPCNAME] | inspect DISK');
} catch (error) { console.error(error.message); process.exitCode = 1; }
