// Native and WASM qualification share the same real disk and explicit firmware.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
const directory = process.env.CPC_TEST_ROM_DIR;
if (!directory) throw new Error('CPC_TEST_ROM_DIR requis ; aucune ROM téléchargée par cette recette.');
const hashes = { os: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf', basic: '58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977', amsdos: 'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d' };
const paths = [];
for (const [role, expected] of Object.entries(hashes)) {
  const path = join(directory, `cpc6128_${role}.bin`), bytes = await readFile(path);
  if (bytes.length !== 16384 || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Profil de qualification refusé : ROM ${role} différente.`);
  paths.push(path);
}
await mkdir('out', { recursive: true });
const source = '10 POKE &8000,0\n20 POKE &8000,11:POKE &8000,22\n30 GOSUB 100\n40 IF PEEK(&8000)=33 THEN 60\n50 POKE &8000,99\n60 POKE &8000,44\n70 END\n100 POKE &8000,33\n110 RETURN\n';
await writeFile('out/basic-debug-probe.dsk', buildListingDisk(source));
const executable = 'out/native-basic-debug';
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error([result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n'));
  return result.stdout;
}
run(process.env.CC || 'gcc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-g', '-O1', '-fsanitize=address,undefined', '-fno-omit-frame-pointer', '-I.cache/chips', 'tests/native_basic_debug.c', '-lm', '-o', executable]);
const native = JSON.parse(run(executable, [...paths, 'out/basic-debug-probe.dsk']));
const { default: createCpc } = await import('../out/cpc.mjs');
const cpc = await createCpc({ wasmBinary: await readFile('out/cpc.wasm') });
const allocated = [];
const put = bytes => { const p = cpc._malloc(bytes.length); assert.ok(p); allocated.push(p); cpc.HEAPU8.set(bytes, p); return p; };
const observations = [];
const word = address => cpc._cpc_bridge_peek(address) | cpc._cpc_bridge_peek(address + 1) << 8;
try {
  const [os, basic, amsdos] = await Promise.all(paths.map(path => readFile(path).then(put)));
  assert.equal(cpc._cpc_bridge_init(os, 16384, basic, 16384, amsdos, 16384), 0);
  for (let i = 0; i < 250; i++) cpc._cpc_bridge_step(20000);
  const disk = await readFile('out/basic-debug-probe.dsk'); assert.equal(cpc._cpc_bridge_mount(put(disk), disk.length), 0);
  for (const key of 'RUN"MAIN.BAS"') {
    cpc._cpc_bridge_key(key.charCodeAt(0), 1); for (let i = 0; i < 6; i++) cpc._cpc_bridge_step(10000);
    cpc._cpc_bridge_key(key.charCodeAt(0), 0); for (let i = 0; i < 6; i++) cpc._cpc_bridge_step(10000);
  }
  cpc._cpc_bridge_key(13, 1);
  let direct = 0;
  while (observations.length < native.observations.length) {
    assert.equal(cpc._cpc_bridge_pause(0), 0);
    assert.equal(cpc._cpc_bridge_debug_arm(0xde60, 0, 40000000), 0);
    for (let i = 0; i < 501 && !cpc._cpc_bridge_debug_reason(); i++) cpc._cpc_bridge_step(20000);
    assert.equal(cpc._cpc_bridge_debug_reason(), 1); assert.equal(cpc._cpc_bridge_register(12), 0);
    const linePointer = word(0xae1d); if (!linePointer) { assert.ok(++direct < 4); continue; }
    const ticks = cpc._cpc_bridge_ticks(); cpc._cpc_bridge_step(20000); assert.equal(cpc._cpc_bridge_ticks(), ticks);
    observations.push({ line: word(linePointer), linePointer, statementPointer: cpc._cpc_bridge_register(5), marker: cpc._cpc_bridge_peek(0x8000), ticks });
  }
  assert.deepEqual(observations, native.observations, 'Native and WASM must stop at identical line/token pointers and actual ticks.');
  assert.equal(cpc._cpc_bridge_pause(0), 0); for (let i = 0; i < 100; i++) cpc._cpc_bridge_step(20000);
  assert.equal(cpc._cpc_bridge_peek(0x8000), 44);
} finally { cpc._cpc_bridge_dispose(); for (const p of allocated) cpc._free(p); }
const report = { firmware: hashes, sourceSha256: createHash('sha256').update(source).digest('hex'), native, wasm: { observations, matchesNative: true } };
await writeFile('out/basic-debug-qualification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
