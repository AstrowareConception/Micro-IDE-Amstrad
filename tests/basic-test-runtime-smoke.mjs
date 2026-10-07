// Explicit test input only: never distribute the supplied ROMs or embed them in reports.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import createCpc from '../out/cpc.mjs';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { BASIC_TEST_EXAMPLE, basicTestPlan, validBasicTestResult } from '../packages/emulator/src/basic-tests.ts';
import { BASIC_TEST_FIRMWARE, basicTestHash, executeBasicTests } from '../packages/emulator/src/basic-test-runtime.ts';
const root = process.env.CPC_TEST_ROM_DIR;
if (!root) throw new Error('CPC_TEST_ROM_DIR requis : jeu 6128 anglais identifié hors dépôt.');
const roms = Object.fromEntries(await Promise.all(['os', 'basic', 'amsdos'].map(async role => [role, new Uint8Array(await readFile(join(root, `cpc6128_${role}.bin`)))])));
const wasmBinary = await readFile('out/cpc.wasm');
const results = [];
async function recipe(name, source, outcome, seconds = 3) {
 const disk = buildListingDisk(source), image = { disk, entry: 'MAIN.BAS', label: name, sha256: await basicTestHash(disk), roms, firmware: BASIC_TEST_FIRMWARE };
 const before = disk.slice(), cpc = await createCpc({ wasmBinary });
 const result = await executeBasicTests(cpc, image, basicTestPlan({ id: name, name, source }), seconds, async () => {});
 assert.ok(validBasicTestResult(result, basicTestPlan({ id: name, name, source })), `${name}: invalid result`);
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
for (const name of ['score', 'collision']) {
 const source = await readFile(`examples/basic-test-suite/src/tests-${name}.bas`, 'utf8');
 const example = await recipe(`suite-example-${name}`, source, 'passed');
 assert.equal(example.cases.length, 2);
}
const scenario = await readFile('examples/basic-test-suite/src/tests-scenario.bas', 'utf8');
const scenarioPass = await recipe('scenario-pass', scenario, 'passed', 8);
assert.deepEqual(scenarioPass.observations.map(item => item.outcome), ['passed', 'passed']);
const scenarioRepeat = await recipe('scenario-repeat', scenario, 'passed', 8);
assert.deepEqual(scenarioRepeat.observations, scenarioPass.observations); assert.equal(scenarioRepeat.emulatedSeconds, scenarioPass.emulatedSeconds);
const wrongFile = await recipe('scenario-wrong-file', scenario.replace('@CPCFILE RESULT.TXT "42', '@CPCFILE RESULT.TXT "43'), 'failed', 8);
assert.equal(wrongFile.cases[0].outcome, 'passed'); assert.equal(wrongFile.observations[0].outcome, 'failed');
const wrongScreen = await recipe('scenario-wrong-screen', scenario.replace(/(@CPCSCREEN bord 0 0 8 8 )[a-f0-9]{64}/, '$1' + '0'.repeat(64)), 'failed', 8);
assert.equal(wrongScreen.observations[1].outcome, 'failed'); assert.equal(wrongScreen.observations[0].outcome, 'passed');
await recipe('scenario-no-input', scenario.replace('40 REM @CPCINPUT 3000 "21\\r"', '40 REM no input'), 'timeout', 4);
const early = await recipe('scenario-premature-end', BASIC_TEST_EXAMPLE + '1020 REM @CPCINPUT 3000 "x"\n', 'blocked', 5);
assert.match(early.message, /avant la fin des saisies/);
await writeFile('out/basic-test-runtime.json', JSON.stringify({ results, independentEmulator: false, physicalCpc: false }, null, 2));
