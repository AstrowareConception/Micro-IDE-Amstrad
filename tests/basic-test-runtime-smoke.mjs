// Explicit test input only: never distribute the supplied ROMs or embed them in reports.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import createCpc from '../out/cpc.mjs';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { BASIC_TEST_EXAMPLE, basicTestPlan } from '../packages/emulator/src/basic-tests.ts';
import { BASIC_TEST_FIRMWARE, basicTestHash, executeBasicTests } from '../packages/emulator/src/basic-test-runtime.ts';
const root = process.env.CPC_TEST_ROM_DIR;
if (!root) throw new Error('CPC_TEST_ROM_DIR requis : jeu 6128 anglais identifié hors dépôt.');
const roms = Object.fromEntries(await Promise.all(['os', 'basic', 'amsdos'].map(async role => [role, new Uint8Array(await readFile(join(root, `cpc6128_${role}.bin`)))])));
const wasmBinary = await readFile('out/cpc.wasm');
const results = [];
async function recipe(name, source, outcome) {
 const disk = buildListingDisk(source), image = { disk, entry: 'MAIN.BAS', label: name, sha256: await basicTestHash(disk), roms, firmware: BASIC_TEST_FIRMWARE };
 const before = disk.slice(), cpc = await createCpc({ wasmBinary });
 const result = await executeBasicTests(cpc, image, basicTestPlan({ id: name, name, source }), 3, async () => {});
 assert.equal(result.outcome, outcome, `${name}: ${result.message}`); assert.deepEqual(image.disk, before, 'Immutable DSK input');
 assert.equal(result.sourceSha256, await basicTestHash(new TextEncoder().encode(source)));
 assert.equal(cpc._cpc_bridge_step(20000), -2, 'Machine disposed on completion');
 results.push(result); console.log(`${name}: ${result.outcome} (${result.emulatedSeconds.toFixed(3)} s)`); return result;
}
const passed = await recipe('score-passed', BASIC_TEST_EXAMPLE, 'passed'); assert.deepEqual(passed.cases.map(test => test.outcome), ['passed', 'passed']);
const failed = await recipe('score-failed', BASIC_TEST_EXAMPLE.replace('score=150 THEN', 'score=151 THEN'), 'failed'); assert.deepEqual(failed.cases.map(test => test.outcome), ['failed', 'passed']);
await recipe('missing-assertion', BASIC_TEST_EXAMPLE.replace('70 IF score=100 THEN POKE &8005,1 ELSE POKE &8005,2', '70 REM assertion deliberately omitted'), 'incomplete');
await recipe('infinite-loop', '10 REM @CPCTEST 1 Loop\n20 GOTO 20\n', 'timeout');
await recipe('basic-error', '10 REM @CPCTEST 1 Error\n20 ERROR 33\n', 'timeout');
await recipe('input-wait', '10 REM @CPCTEST 1 Input\n20 INPUT a$\n', 'timeout');
await writeFile('out/basic-test-runtime.json', JSON.stringify({ results, independentEmulator: false, physicalCpc: false }, null, 2));
