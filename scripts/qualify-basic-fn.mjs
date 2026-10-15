// Supply the already qualified ROMs explicitly. Never include them in the report.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import createCpc from '../out/cpc.mjs';
import { basicFnCases, basicFnListing } from '../tests/fixtures/basic-fn-cases.ts';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { basicTestPlan, validBasicTestResult } from '../packages/emulator/src/basic-tests.ts';
import { BASIC_TEST_FIRMWARE, basicTestHash, executeBasicTests } from '../packages/emulator/src/basic-test-runtime.ts';

const root = process.env.CPC_TEST_ROM_DIR;
if (!root) throw new Error('CPC_TEST_ROM_DIR requis : ROM 6128 anglaises identifiées, hors dépôt.');
const roms = Object.fromEntries(await Promise.all(['os', 'basic', 'amsdos'].map(async role => [role, new Uint8Array(await readFile(join(root, `cpc6128_${role}.bin`)))])));
const wasmBinary = await readFile('out/cpc.wasm');
const report = {
 version: 1, firmware: BASIC_TEST_FIRMWARE,
 engine: { wasmSha256: await basicTestHash(wasmBinary), chipsLock: JSON.parse(await readFile('packages/emulator/chips.lock.json', 'utf8')) },
 fixturesSha256: await basicTestHash(await readFile('tests/fixtures/basic-fn-cases.ts')),
 independentEmulator: false, physicalCpc: false, results: [],
};
const example = await readFile('examples/symbols/functions.bas', 'utf8');
const exampleLines = example.trimEnd().split('\n');
// Replace only the comment/END wrapper, never silently omit executable lines.
assert.match(exampleLines[0], /^10 REM /);
assert.equal(exampleLines.at(-1), '70 END');
const exampleBody = exampleLines.slice(1, -1).join('\n');
assert.match(exampleBody, /^20 /);
const specimens = [...basicFnCases, { name: 'user-example', body: exampleBody.replace(/^20 /, '25 '), expected: 'result=104 AND x=99' }];
for (const specimen of specimens) {
 const source = basicFnListing(specimen), disk = buildListingDisk(source);
 const image = { disk, entry: 'MAIN.BAS', label: specimen.name, sha256: await basicTestHash(disk), roms, firmware: BASIC_TEST_FIRMWARE };
 const plan = basicTestPlan({ id: specimen.name, name: specimen.name, source });
 const cpc = await createCpc({ wasmBinary });
 const dispose = cpc._cpc_bridge_dispose;
 const observed = {};
 cpc._cpc_bridge_dispose = () => {
  observed.error = cpc._cpc_bridge_peek(0x8100);
  observed.errorLine = cpc._cpc_bridge_peek(0x8101) + 256 * cpc._cpc_bridge_peek(0x8102);
  dispose();
 };
 const result = await executeBasicTests(cpc, image, plan, 3, async () => {});
 assert.ok(validBasicTestResult(result, plan), `${specimen.name}: résultat invalide`);
 assert.equal(result.sourceSha256, await basicTestHash(new TextEncoder().encode(source)));
 assert.equal(cpc._cpc_bridge_step(20000), -2, 'Machine libérée après la recette');
 report.results.push({ name: specimen.name, expectedError: specimen.error ?? 0, expectedErrorLine: specimen.errorLine ?? 0, observed, result });
 console.log(`${specimen.name}: ${result.outcome}, ERR=${observed.error}, ERL=${observed.errorLine}`);
}
await writeFile('out/basic-fn-qualification.json', JSON.stringify(report, null, 2) + '\n');
assert.ok(report.results.every(item => item.result.outcome === 'passed'), 'Recette FN non qualifiée : voir out/basic-fn-qualification.json');
console.log(`DEF FN: ${report.results.length} recettes firmware réussies.`);
