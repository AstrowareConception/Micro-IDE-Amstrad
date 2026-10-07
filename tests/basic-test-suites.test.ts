import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseBasicTestSuites, parseBasicTestReport, type BasicTestReport } from '../packages/emulator/src/basic-test-suites.ts';
import { BasicTestSuiteStore } from '../apps/desktop/basic-test-suite-store.ts';
const suite = { id: 'rules', name: 'Règles du jeu', sourceIds: ['score', 'collision'], seconds: 3 };
function report(id = 'run-1'): BasicTestReport {
 const sha256 = createHash('sha256').update('10 REM @CPCTEST 1 Score\n20 END').digest('hex');
 const cases = [{ slot: 1, name: 'Score', line: 1 }];
 return { schemaVersion: 1, id, createdAt: '2026-10-07T12:00:00.000Z', suiteId: 'rules', suiteName: 'Règles du jeu', seconds: 3,
  sources: [{ id: 'score', name: 'src/score.bas', sha256, cases }],
  results: [{ sourceId: 'score', name: 'src/score.bas', outcome: 'passed', message: 'OK', emulatedSeconds: 6, sourceSha256: sha256, diskSha256: 'b'.repeat(64), cases: cases.map(item => ({ ...item, outcome: 'passed', observed: 1 })) }] };
}
async function fixture(t: { after(fn: () => Promise<void>): void }) {
 const root = await mkdtemp(join(tmpdir(), 'cpceleste-suites-')); t.after(() => rm(root, { recursive: true, force: true }));
 return { root, store: new BasicTestSuiteStore(root, 'project-1') };
}
test('suite contract bounds identities, versions, budgets and duplicate references', () => {
 const file = { schemaVersion: 1, suites: [suite] }; assert.deepEqual(parseBasicTestSuites(file), file);
 for (const invalid of [{ ...file, schemaVersion: 2 }, { ...file, destination: '../outside' }, { ...file, suites: [suite, suite] },
  ...[{ sourceIds: [] }, { sourceIds: ['score', 'score'] }, { seconds: 0 }, { seconds: 1.5 }, { seconds: 16 }, { id: '../x' }, { name: ' ' }].map(change => ({ ...file, suites: [{ ...suite, ...change }] }))]) assert.throws(() => parseBasicTestSuites(invalid));
});
test('suite save survives reopen, detects external edits and preserves unresolved old references for repair', async t => {
 const { root, store } = await fixture(t); assert.deepEqual(await store.load(), { revision: null, suites: [] });
 const first = await store.save(null, [suite], suite.sourceIds);
 assert.deepEqual(await new BasicTestSuiteStore(root, 'project-1').load(), first);
 await assert.rejects(store.save(null, [], suite.sourceIds), /changé/);
 await assert.rejects(store.save(first.revision, [{ ...suite, sourceIds: ['unknown'] }], suite.sourceIds), /déclarée/);
 const renamed = await store.save(first.revision, [{ ...suite, name: 'Après suppression de collision' }], ['score']);
 assert.deepEqual(renamed.suites[0]!.sourceIds, suite.sourceIds);
 const repaired = await store.save(renamed.revision, [{ ...suite, sourceIds: ['score'] }], ['score']);
 await writeFile(join(root, 'microide.tests.json'), '{"schemaVersion":2,"suites":[]}');
 await assert.rejects(store.save(repaired.revision, [], ['score']), /version 1/);
 assert.equal(await readFile(join(root, 'microide.tests.json'), 'utf8'), '{"schemaVersion":2,"suites":[]}');
});
test('reports reject forged outcomes, mismatched hashes, incomplete runs and raw source payloads', () => {
 assert.deepEqual(parseBasicTestReport(report()), report());
 for (const change of ['hash', 'outcome', 'cases', 'source', 'partial']) {
  const invalid = report();
  if (change === 'hash') invalid.results[0]!.sourceSha256 = 'c'.repeat(64);
  if (change === 'outcome') invalid.results[0]!.cases[0]!.observed = 2;
  if (change === 'cases') invalid.sources[0]!.cases[0]!.line = 2;
  if (change === 'source') Object.assign(invalid.sources[0]!, { source: 'secret listing' });
  if (change === 'partial') invalid.results = [];
  assert.throws(() => parseBasicTestReport(invalid));
 }
 const cancelled = report(); cancelled.results[0] = { sourceId: 'score', name: 'src/score.bas', outcome: 'cancelled', message: 'Annulé', emulatedSeconds: 0, cases: [] };
 assert.equal(parseBasicTestReport(cancelled).results[0]!.outcome, 'cancelled');
});
test('history retains ten complete reports, is idempotent and never stores source or changes suite file', async t => {
 const { root, store } = await fixture(t); assert.deepEqual(await store.history(), []);
 await store.save(null, [suite], suite.sourceIds); const before = await readFile(join(root, 'microide.tests.json'));
 for (let i = 0; i < 12; i++) await store.record(report(`run-${i}`));
 const reopened = new BasicTestSuiteStore(root, 'project-1');
 assert.deepEqual((await reopened.history()).map(item => item.id), Array.from({ length: 10 }, (_, i) => `run-${11 - i}`));
 assert.equal((await reopened.record(report('run-11'))).length, 10);
 await assert.rejects(reopened.record({ ...report('run-11'), seconds: 4 }), /déjà utilisé/);
 assert.deepEqual(await readFile(join(root, 'microide.tests.json')), before);
 assert.ok(!(await readFile(join(root, '.microide/test-reports/history.json'), 'utf8')).includes('20 END'));
 await assert.rejects(new BasicTestSuiteStore(root, 'different-project').history(), /invalide/);
});
test('suite and history stores refuse links and preserve corrupt or oversized existing files', async t => {
 const { root, store } = await fixture(t), external = join(root, 'external');
 await writeFile(external, JSON.stringify({ schemaVersion: 1, suites: [] }));
 await symlink(external, join(root, 'microide.tests.json')); await assert.rejects(store.load(), /lien/);
 await rm(join(root, 'microide.tests.json')); await link(external, join(root, 'microide.tests.json')); await assert.rejects(store.load(), /lien/);
 await rm(join(root, 'microide.tests.json')); await writeFile(join(root, 'microide.tests.json'), ' '.repeat(32769)); await assert.rejects(store.load(), /taille/);
 await mkdir(join(root, 'outside')); await symlink(join(root, 'outside'), join(root, '.microide'));
 await assert.rejects(store.record(report()), /liens/); await rm(join(root, '.microide'));
 await mkdir(join(root, '.microide/test-reports'), { recursive: true }); const path = join(root, '.microide/test-reports/history.json');
 await writeFile(path, '{bad'); await assert.rejects(store.record(report())); assert.equal(await readFile(path, 'utf8'), '{bad');
});
