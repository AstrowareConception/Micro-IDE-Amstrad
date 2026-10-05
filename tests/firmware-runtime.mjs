// Explicit test input only; never downloads or distributes ROMs.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import createCpc from '../out/cpc.mjs';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
const root = process.env.CPC_TEST_ROM_DIR;
if (!root) throw new Error('CPC_TEST_ROM_DIR requis : trois ROM CPC 6128 de référence, hors dépôt.');
export const RUN_SOURCE = '10 MODE 1:PRINT "EXECUTION CPC OK"\n20 POKE &8000,165\n30 END\n';
const expected = { os: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf', basic: '58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977', amsdos: 'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cpc = await createCpc({ wasmBinary: await readFile('out/cpc.wasm') }); const allocated = [];
const put = bytes => { const p = cpc._malloc(bytes.length); assert.ok(p); allocated.push(p); cpc.HEAPU8.set(bytes, p); return p; };
function indices(height) { const width = cpc._cpc_bridge_width(), stride = cpc._cpc_bridge_stride(), pointer = cpc._cpc_bridge_frame(), result = Buffer.alloc(width * height); for (let y = 0; y < height; y++) result.set(cpc.HEAPU8.subarray(pointer + y * stride, pointer + y * stride + width), y * width); return result; }
try {
  const pointers = {};
  for (const role of ['os', 'basic', 'amsdos']) { const rom = await readFile(join(root, `cpc6128_${role}.bin`)); assert.equal(rom.length, 16384); assert.equal(hash(rom), expected[role]); pointers[role] = put(rom); }
  assert.equal(cpc._cpc_bridge_init(pointers.os, 16384, pointers.basic, 16384, pointers.amsdos, 16384), 0);
  for (let i = 0; i < 250; i++) cpc._cpc_bridge_step(20000);
  assert.equal(hash(indices(108)), '463daf9b810f7bc36fb0c570a970269051bd023c91c6db7935ea21c0add3b607');
  const disk = buildListingDisk(RUN_SOURCE); assert.equal(cpc._cpc_bridge_mount(put(disk), disk.length), 0);
  for (const key of 'RUN"MAIN.BAS"\r') { cpc._cpc_bridge_key(key.charCodeAt(0), 1); for (let i = 0; i < 6; i++) cpc._cpc_bridge_step(10000); cpc._cpc_bridge_key(key.charCodeAt(0), 0); for (let i = 0; i < 6; i++) cpc._cpc_bridge_step(10000); }
  for (let i = 0; i < 400; i++) cpc._cpc_bridge_step(20000);
  assert.equal(cpc._cpc_bridge_peek(0x8000), 165, 'RUN must execute the POKE instruction through AMSDOS/BASIC');
  const width = cpc._cpc_bridge_width(), height = 52, palette = cpc._cpc_bridge_palette(), idx = indices(height), pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < idx.length; i++) { pixels.set(cpc.HEAPU8.subarray(palette + idx[i] * 4, palette + idx[i] * 4 + 3), i * 4); pixels[i * 4 + 3] = 255; }
  const report = { bootBasic11: true, diskRun: true, poke8000: 165, firmware: expected, outputFramePrefix: hash(pixels), independentEmulator: false, physicalCpc: false };
  await writeFile('out/firmware-runtime.json', JSON.stringify(report, null, 2)); console.log('Real CPC firmware: BASIC 1.1 Ready fingerprint and disk RUN/POKE 165 passed.', JSON.stringify(report));
} finally { cpc._cpc_bridge_dispose(); for (const p of allocated) cpc._free(p); }
