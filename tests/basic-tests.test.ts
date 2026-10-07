import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASIC_TEST_EXAMPLE, BASIC_TEST_SIGNATURE, basicTestPlan, completedBasicTests, basicTestsMarkdown, validBasicTestResult } from '../packages/emulator/src/basic-tests.ts';
import { executeBasicTests, type BasicTestCpc } from '../packages/emulator/src/basic-test-runtime.ts';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
const source = { id: 'test', name: 'tests-score.bas', source: BASIC_TEST_EXAMPLE };
test('BASIC test declarations are whole numbered REM lines, with immutable snapshots', () => {
 const plan = basicTestPlan(source); assert.deepEqual(plan.cases.map(test => test.slot), [1, 2]);
 assert.notEqual(plan.source, source); assert.equal(plan.cases[0]!.line, 2);
 assert.throws(() => basicTestPlan({ ...source, source: '10 PRINT "REM @CPCTEST 1 fake"\n20 REM ordinary\n30 A=1:REM @CPCTEST 2 hidden' }), /Aucun test/);
 assert.equal(basicTestPlan({ ...source, source: '10 rem @cpctest 32 Last\r\n' }).cases[0]!.slot, 32);
 assert.equal(buildListingDisk(BASIC_TEST_EXAMPLE).length, 194816);
});
test('BASIC test declarations reject bad slots, duplicates, names and source quotas', () => {
 for (const text of ['10 REM @CPCTEST 0 invalid', '10 REM @CPCTEST 33 invalid', '10 REM @CPCTEST 01 invalid', '10 REM @CPCTEST 1', `10 REM @CPCTEST 1 ${'a'.repeat(121)}`, '10 REM @CPCTEST 1 name\x00']) assert.throws(() => basicTestPlan({ ...source, source: text }), /invalide/);
 assert.throws(() => basicTestPlan({ ...source, source: '10 REM @CPCTEST 1 one\n20 REM @CPCTEST 1 two' }), /plusieurs/);
 assert.throws(() => basicTestPlan({ ...source, source: 'é'.repeat(8193) }), /16 Kio/);
});
test('BASIC results require the whole completion signature before interpreting assertions', () => {
 const plan = basicTestPlan(source), bytes = new Uint8Array(36); bytes[4] = bytes[5] = 1;
 assert.equal(completedBasicTests(plan, bytes), undefined);
 bytes.set(BASIC_TEST_SIGNATURE); bytes[3] = 0; assert.equal(completedBasicTests(plan, bytes), undefined);
 bytes[3] = 165; assert.equal(completedBasicTests(plan, bytes)!.outcome, 'passed');
 bytes[5] = 2; assert.equal(completedBasicTests(plan, bytes)!.outcome, 'failed');
 assert.deepEqual(completedBasicTests(plan, bytes)!.cases.map(test => test.outcome), ['passed', 'failed']);
});
test('Missing or invalid assertion bytes cannot be reported as success', () => {
 const bytes = new Uint8Array(36); bytes.set(BASIC_TEST_SIGNATURE); bytes[4] = 1;
 const plan = basicTestPlan(source); assert.equal(completedBasicTests(plan, bytes)!.outcome, 'incomplete');
 bytes[5] = 255; assert.equal(completedBasicTests(plan, bytes)!.outcome, 'incomplete');
 assert.equal(completedBasicTests(plan, bytes)!.cases[1]!.observed, 255);
 assert.throws(() => completedBasicTests(plan, new Uint8Array(35)), /invalide/);
});
test('Slot 32 is read from the last reserved byte, not another slot', () => {
 const plan = basicTestPlan({ ...source, source: '10 REM @CPCTEST 32 Last' });
 const bytes = new Uint8Array(36); bytes.set(BASIC_TEST_SIGNATURE); bytes[35] = 2;
 assert.equal(completedBasicTests(plan, bytes)!.outcome, 'failed');
});
test('Worker result validation rejects incomplete, mismatched or contradictory success messages', () => {
 const plan = basicTestPlan(source), mailbox = new Uint8Array(36); mailbox.set(BASIC_TEST_SIGNATURE); mailbox[4] = mailbox[5] = 1;
 const result = { sourceId: source.id, name: source.name, ...completedBasicTests(plan, mailbox)!, emulatedSeconds: 8, sourceSha256: 'a'.repeat(64), diskSha256: 'b'.repeat(64) };
 assert.equal(validBasicTestResult(result, plan), true);
 for (const changed of [{ cases: [] }, { sourceId: 'other' }, { outcome: 'failed' }, { sourceSha256: 'bad' }, { emulatedSeconds: NaN }, { cases: [null, null] }]) assert.equal(validBasicTestResult({ ...result, ...changed }, plan), false);
 assert.equal(validBasicTestResult({ ...result, cases: [{ ...result.cases[0], name: 'wrong' }, result.cases[1]] }, plan), false);
 assert.equal(validBasicTestResult({ sourceId: source.id, name: source.name, outcome: 'blocked', message: 'no ROM', cases: [], emulatedSeconds: 0 }, plan), true);
});
test('Markdown reports contain verdict and provenance, never the source code', () => {
 const report = basicTestsMarkdown([{ sourceId: source.id, name: '*test*\n# heading', outcome: 'timeout', message: 'no <signature>', cases: [], emulatedSeconds: 3, sourceSha256: 'a'.repeat(64), diskSha256: 'b'.repeat(64) }]);
 assert.ok(report.includes('timeout')); assert.ok(report.includes('3.000')); assert.ok(report.includes('a'.repeat(64)));
 assert.ok(report.includes('\\*test\\*')); assert.ok(!report.includes('score=100')); assert.ok(!report.includes('<signature>'));
});
test('Runtime refuses unknown firmware and invalid budgets without starting the CPU, disposing the adapter', async () => {
 let initialized = 0, disposed = 0;
 const cpc: BasicTestCpc = {
  HEAPU8: new Uint8Array(65536), _malloc: () => 1024, _free: () => {},
  _cpc_bridge_init: () => { initialized++; return 0; }, _cpc_bridge_mount: () => 0, _cpc_bridge_step: () => 0,
  _cpc_bridge_pause: () => 0, _cpc_bridge_key: () => 0, _cpc_bridge_release_keys: () => {}, _cpc_bridge_dispose: () => { disposed++; },
  _cpc_bridge_export: () => 194816, _cpc_bridge_palette: () => 1, _cpc_bridge_height: () => 272,
  _cpc_bridge_register: () => 0, _cpc_bridge_read_ram: () => 36, _cpc_bridge_width: () => 768, _cpc_bridge_stride: () => 768, _cpc_bridge_frame: () => 1, _cpc_bridge_ticks: () => 0,
 };
 const image = { disk: buildListingDisk(source.source), entry: 'MAIN.BAS', label: 'Test', sha256: 'a'.repeat(64), firmware: { os: '', basic: '', amsdos: '' }, roms: { os: new Uint8Array(16384), basic: new Uint8Array(16384), amsdos: new Uint8Array(16384) } };
 const result = await executeBasicTests(cpc, image, basicTestPlan(source), 1, async () => {});
 assert.equal(result.outcome, 'blocked'); assert.match(result.message, /ROM/); assert.equal(initialized, 0); assert.equal(disposed, 1);
 for (const seconds of [0, 16, NaN, 1.5]) assert.equal((await executeBasicTests(cpc, image, basicTestPlan(source), seconds, async () => {})).outcome, 'blocked');
 assert.equal(initialized, 0); assert.equal(disposed, 5);
});
