import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseBasicScenario, validateScenarioBudget, scenarioDisk, scenarioFileBytes, validScenarioObservations, validScenarioCaptures } from '../packages/emulator/src/basic-test-scenario.ts';
import { basicTestPlan, validBasicTestResult, basicTestsMarkdown, BASIC_TEST_EXAMPLE } from '../packages/emulator/src/basic-tests.ts';
import { parseBasicTestReport } from '../packages/emulator/src/basic-test-suites.ts';
import { createDataDisk, readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
test('scenario directives are whole numbered REM lines and obey keyboard/data/screen bounds', () => {
 assert.equal(parseBasicScenario('10 PRINT "REM @CPCINPUT"\n20 A=1:REM @CPCFILE X.TXT "x"'), undefined);
 const parsed = parseBasicScenario('10 rem @cpcinput 500 "21\\r"\n20 REM @CPCFIXTURE SEED.TXT "21\\r\\n"\n30 REM @CPCFILE RESULT.TXT "42\\r\\n"\n40 REM @CPCSCREEN bord 0 0 8 8 ' + 'a'.repeat(64))!;
 assert.deepEqual(parsed.inputs, [{ atMs: 500, text: '21\r' }]); assert.equal(parsed.checks[1]!.kind, 'screen');
 validateScenarioBudget(parsed, 1); assert.throws(() => validateScenarioBudget(parsed, 0.5), /budget/);
 for (const bad of ['10 REM @CPCINPUT 1 "a"', '10 REM @CPCINPUT 0 "é"', '10 REM @CPCINPUT 0 "\\n"', '10 REM @CPCINPUT 0 ""', '10 REM @CPCINPUT 15000 "a"', '10 REM @CPCINPUT 0 "aa"\n20 REM @CPCINPUT 120 "b"',
  '10 REM @CPCFIXTURE MAIN.BAS "x"', '10 REM @CPCFIXTURE ../X "x"', '10 REM @CPCFIXTURE X.TXT "\\u001a"', '10 REM @CPCFILE X.TXT ["x"]', '10 REM @CPCFIXTURE X.TXT "x"\n20 REM @CPCFIXTURE X.TXT "y"',
  '10 REM @CPCSCREEN x 767 0 8 8 ' + 'a'.repeat(64), '10 REM @CPCSCREEN x 0 0 0 8 ' + 'a'.repeat(64), '10 REM @CPCSCREEN x 0 0 768 272 ' + 'a'.repeat(64), '10 REM @CPCFILE X.TXT "x"\n20 REM @CPCFILE X.TXT "y"']) assert.throws(() => parseBasicScenario(bad), bad);
 assert.throws(() => parseBasicScenario(Array.from({ length: 9 }, (_, i) => `${i * 10} REM @CPCINPUT ${i * 200} "a"`).join('\n')), /limité/);
});
test('fixtures are isolated copies and ASCII comparisons ignore only allocation padding after EOF', () => {
 const original = buildListingDisk(BASIC_TEST_EXAMPLE), before = original.slice();
 const disk = scenarioDisk(original, [{ name: 'SEED.TXT', text: '21\r\n' }]);
 assert.deepEqual(original, before); assert.equal(readDataDisk(original).length, 1); assert.equal(readDataDisk(disk).length, 2);
 assert.equal(new TextDecoder().decode(scenarioFileBytes(disk, 'SEED.TXT')), '21\r\n');
 assert.equal(scenarioFileBytes(disk, 'MISSING.TXT'), undefined);
 const binary = createDataDisk([{ name: 'X.TXT', bytes: new Uint8Array([0, 0x1a]) }]);
 assert.throws(() => scenarioFileBytes(binary, 'X.TXT'), /ASCII/);
 assert.throws(() => scenarioDisk(disk, [{ name: 'OTHER.TXT', text: 'x' }]), /autonome/);
});
test('observation results cannot turn a failed comparison into a passed BASIC run; report metadata round-trips without fixture contents', () => {
 const source = { id: 'main', name: 'test.bas', source: '10 REM @CPCTEST 1 Native\n20 REM @CPCFILE X.TXT "PRIVATE EXPECTED CONTENT"' }, plan = basicTestPlan(source);
 const observation = { kind: 'file' as const, name: 'X.TXT', line: 2, expectedSha256: hash('PRIVATE EXPECTED CONTENT'), actualSha256: hash('wrong'), outcome: 'failed' as const, message: 'Compared' };
 assert.ok(validScenarioObservations([observation], plan.scenario!.checks));
 assert.ok(!validScenarioObservations([{ ...observation, outcome: 'passed' }], plan.scenario!.checks));
 const result = { sourceId: source.id, name: source.name, outcome: 'failed' as const, message: 'One observation failed', emulatedSeconds: 5,
  sourceSha256: hash(source.source), diskSha256: 'b'.repeat(64), cases: [{ ...plan.cases[0]!, observed: 1, outcome: 'passed' as const }], observations: [observation] };
 assert.ok(validBasicTestResult(result, plan)); assert.ok(!validBasicTestResult({ ...result, outcome: 'passed' }, plan));
 assert.ok(!validBasicTestResult({ ...result, observations: [] }, plan)); assert.ok(!validBasicTestResult({ ...result, outcome: 'timeout', cases: [] }, plan));
 const report = { schemaVersion: 1, id: 'run', createdAt: '2026-10-07T21:00:00.000Z', suiteId: null, suiteName: null, seconds: 5,
  sources: [{ id: source.id, name: source.name, sha256: hash(source.source), cases: plan.cases, checks: plan.scenario!.checks.map(({ kind, name, line }) => ({ kind, name, line })) }], results: [result] };
 assert.deepEqual(parseBasicTestReport(report), report);
 assert.ok(!JSON.stringify(report).includes('PRIVATE EXPECTED CONTENT')); assert.ok(!basicTestsMarkdown([result]).includes('PRIVATE EXPECTED CONTENT'));
 assert.throws(() => parseBasicTestReport({ ...report, sources: [{ ...report.sources[0], checks: [] }] }));
});
test('documented scenario is a valid standalone BASIC listing with budget and isolated fixtures', async () => {
 const source = await readFile('examples/basic-test-suite/src/tests-scenario.bas', 'utf8');
 const plan = basicTestPlan({ id: 'scenario', name: 'test', source }); validateScenarioBudget(plan.scenario, 8);
 assert.equal(plan.scenario!.checks.length, 2); assert.equal(plan.scenario!.inputs[0]!.text, '21\r');
 assert.equal(scenarioDisk(buildListingDisk(source), plan.scenario!.fixtures).length, 194816);
});

test('screen preview transport is bounded to the declared region and never admitted into persistent report payloads', () => {
 const scenario = parseBasicScenario('10 REM @CPCSCREEN bord 0 0 8 8 ' + 'a'.repeat(64));
 const capture = { name: 'bord', line: 1, width: 8, height: 8, rgba: new Uint8Array(256) };
 assert.ok(validScenarioCaptures([capture], scenario));
 for (const bad of [{ ...capture, width: 1024 }, { ...capture, rgba: new Uint8Array(257) }, { ...capture, name: 'other' }, { ...capture, rgba: Array(256).fill(0) }]) assert.ok(!validScenarioCaptures([bad], scenario));
 assert.ok(!validScenarioCaptures([capture, capture], scenario));
 assert.ok(!validScenarioCaptures([capture], undefined));
 const observed = { kind: 'screen', name: 'bord', line: 1, expectedSha256: 'b'.repeat(64), actualSha256: 'b'.repeat(64), outcome: 'passed', message: 'Forged reference' };
 assert.ok(!validScenarioObservations([observed], scenario!.checks));
});
