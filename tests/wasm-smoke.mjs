import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createCpc from '../out/cpc.mjs';
const cpc = await createCpc({ wasmBinary: await readFile(new URL('../out/cpc.wasm', import.meta.url)) });
const rom = cpc._malloc(16384);
const diskBytes = await readFile(new URL('../out/hello.dsk', import.meta.url));
const disk = cpc._malloc(diskBytes.length);
const output = cpc._malloc(diskBytes.length);
const audio = cpc._malloc(4096 * 4);
try {
  assert.ok(rom && disk && output && audio);
  cpc.HEAPU8.fill(0, rom, rom + 16384); cpc.HEAPU8[rom] = 0xc3; // original JP 0 test ROM
  cpc.HEAPU8.set(diskBytes, disk);
  assert.equal(cpc._cpc_bridge_init(rom, 16383, rom, 16384, rom, 16384), -1);
  assert.equal(cpc._cpc_bridge_init(rom, 16384, rom, 16384, rom, 16384), 0);
  assert.equal(cpc._cpc_bridge_mount(disk, diskBytes.length), 0);
  assert.equal(cpc._cpc_bridge_export(output, diskBytes.length), diskBytes.length);
  assert.deepEqual(cpc.HEAPU8.slice(output, output + diskBytes.length), new Uint8Array(diskBytes));
  assert.equal(cpc._cpc_bridge_mount(disk, 255), -3);
  assert.equal(cpc._cpc_bridge_step(20001), -1);
  for (let i = 0; i < 20; i++) assert.equal(cpc._cpc_bridge_step(20000), 0);
  assert.ok(cpc._cpc_bridge_frame() && cpc._cpc_bridge_palette());
  assert.ok(cpc._cpc_bridge_audio(audio, 4096) > 0);
  const ticks = cpc._cpc_bridge_ticks();
  assert.equal(cpc._cpc_bridge_pause(1), 0);
  assert.equal(cpc._cpc_bridge_step(20000), 0);
  assert.equal(cpc._cpc_bridge_ticks(), ticks);
  assert.ok(cpc._cpc_bridge_register(0) >= 0);
  assert.equal(cpc._cpc_bridge_read_ram(65535, output, 1), 1);
  assert.equal(cpc._cpc_bridge_read_ram(65535, output, 2), -1);
  assert.equal(cpc._cpc_bridge_register(15), -1);
  assert.equal(cpc._cpc_bridge_pause(0), 0);
  assert.equal(cpc._cpc_bridge_register(0), -2);
  assert.equal(cpc._cpc_bridge_debug_arm(0, -1, 400000), 0);
  assert.equal(cpc._cpc_bridge_step(20000), 0);
  assert.equal(cpc._cpc_bridge_debug_reason(), 1);
  assert.ok(cpc._cpc_bridge_ticks() > ticks && cpc._cpc_bridge_ticks() - ticks < 80000);
  const stopped = cpc._cpc_bridge_ticks();
  assert.equal(cpc._cpc_bridge_pause(0), 0);
  assert.equal(cpc._cpc_bridge_debug_arm(1, -1, 23), 0);
  assert.equal(cpc._cpc_bridge_step(20000), 0);
  assert.equal(cpc._cpc_bridge_debug_reason(), 2);
  assert.equal(cpc._cpc_bridge_ticks() - stopped, 23);
  assert.equal(cpc._cpc_bridge_debug_cancel(), 0);
  assert.equal(cpc._cpc_bridge_reset(), 0);
  assert.equal(cpc._cpc_bridge_export(output, diskBytes.length), diskBytes.length);
  console.log(JSON.stringify({ status: 'passed', runtime: 'wasm-node', syntheticRom: 'JP 0',
    ticksBeforePause: ticks, cpcBootTested: false, basicRunTested: false }));
} finally {
  cpc._cpc_bridge_dispose(); for (const pointer of [rom, disk, output, audio]) cpc._free(pointer);
}
