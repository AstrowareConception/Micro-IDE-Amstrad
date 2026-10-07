import { BASIC_TEST_LIMITS, validBasicTestResult, type BasicTestCase, type BasicTestResult } from './basic-tests.ts';
export const BASIC_TEST_SUITE_LIMITS = { suites: 16, history: 10, libraryBytes: 32 * 1024, historyBytes: 2 * 1024 * 1024 } as const;
export interface BasicTestSuite { id: string; name: string; sourceIds: string[]; seconds: number }
export interface BasicTestSuiteFile { schemaVersion: 1; suites: BasicTestSuite[] }
export interface BasicTestReportSource { id: string; name: string; sha256: string; cases: BasicTestCase[] }
export interface BasicTestReport {
 schemaVersion: 1; id: string; createdAt: string; suiteId: string | null; suiteName: string | null;
 seconds: number; sources: BasicTestReportSource[]; results: BasicTestResult[];
}
export interface BasicTestLibrary { revision: string | null; suites: BasicTestSuite[] }
export interface BasicTestSuitesPort {
 load(sessionId: string): Promise<BasicTestLibrary | { error: string }>;
 save(sessionId: string, revision: string | null, suites: BasicTestSuite[]): Promise<BasicTestLibrary | { error: string }>;
 history(sessionId: string): Promise<BasicTestReport[] | { error: string }>;
 record(sessionId: string, report: BasicTestReport): Promise<BasicTestReport[] | { error: string }>;
}
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const HASH = /^[a-f0-9]{64}$/;
function object(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objet de tests requis.');
 const item = value as Record<string, unknown>;
 if (required.some(key => !Object.hasOwn(item, key)) || Object.keys(item).some(key => ![...required, ...optional].includes(key))) throw new Error('Propriété de tests absente ou inconnue.');
 return item;
}
function text(value: unknown, max: number): string {
 if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Nom de tests invalide.');
 return value;
}
function id(value: unknown): string { if (typeof value !== 'string' || !ID.test(value)) throw new Error('Identifiant de tests invalide.'); return value; }
function budget(value: unknown): number { if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > BASIC_TEST_LIMITS.seconds) throw new Error('Budget de test : entier de 1 à 15 secondes requis.'); return value as number; }
export function parseBasicTestSuites(value: unknown): BasicTestSuiteFile {
 const file = object(value, ['schemaVersion', 'suites']);
 if (file.schemaVersion !== 1 || !Array.isArray(file.suites) || file.suites.length > BASIC_TEST_SUITE_LIMITS.suites) throw new Error('16 suites maximum ; version 1 requise.');
 const suites = file.suites.map(raw => {
  const suite = object(raw, ['id', 'name', 'sourceIds', 'seconds']);
  if (!Array.isArray(suite.sourceIds) || !suite.sourceIds.length || suite.sourceIds.length > BASIC_TEST_LIMITS.sources) throw new Error('Une suite contient 1 à 8 listings.');
  const sourceIds = suite.sourceIds.map(id);
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error('Listing dupliqué dans la suite.');
  return { id: id(suite.id), name: text(suite.name, 100), sourceIds, seconds: budget(suite.seconds) };
 });
 if (new Set(suites.map(suite => suite.id)).size !== suites.length) throw new Error('Identifiant de suite dupliqué.');
 return { schemaVersion: 1, suites };
}
export function parseBasicTestReport(value: unknown): BasicTestReport {
 const report = object(value, ['schemaVersion', 'id', 'createdAt', 'suiteId', 'suiteName', 'seconds', 'sources', 'results']);
 if (report.schemaVersion !== 1 || typeof report.createdAt !== 'string' || !Number.isFinite(Date.parse(report.createdAt)) || new Date(report.createdAt).toISOString() !== report.createdAt) throw new Error('Version ou date du rapport invalide.');
 const suiteId = report.suiteId === null ? null : id(report.suiteId), suiteName = report.suiteName === null ? null : text(report.suiteName, 100);
 if ((suiteId === null) !== (suiteName === null)) throw new Error('Identité de suite incomplète.');
 if (!Array.isArray(report.sources) || report.sources.length < 1 || report.sources.length > BASIC_TEST_LIMITS.sources || !Array.isArray(report.results) || report.results.length !== report.sources.length) throw new Error('Rapport final complet de 1 à 8 listings requis.');
 const sources: BasicTestReportSource[] = report.sources.map(raw => {
  const source = object(raw, ['id', 'name', 'sha256', 'cases']);
  if (typeof source.sha256 !== 'string' || !HASH.test(source.sha256) || !Array.isArray(source.cases) || !source.cases.length || source.cases.length > BASIC_TEST_LIMITS.cases) throw new Error('Provenance des tests invalide.');
  const cases = source.cases.map(raw => {
   const item = object(raw, ['slot', 'name', 'line']);
   if (!Number.isInteger(item.slot) || Number(item.slot) < 1 || Number(item.slot) > 32 || !Number.isInteger(item.line) || Number(item.line) < 1 || Number(item.line) > 16384) throw new Error('Déclaration de test invalide.');
   return { slot: item.slot as number, line: item.line as number, name: text(item.name, 120) };
  });
  if (new Set(cases.map(item => item.slot)).size !== cases.length) throw new Error('Assertion dupliquée.');
  return { id: id(source.id), name: text(source.name, 240), sha256: source.sha256, cases };
 });
 if (new Set(sources.map(source => source.id)).size !== sources.length) throw new Error('Source dupliquée dans le rapport.');
 const results = report.results.map((raw, index) => {
  const source = sources[index]!;
  const item = object(raw, ['sourceId', 'name', 'outcome', 'message', 'cases', 'emulatedSeconds'], ['diskSha256', 'sourceSha256', 'firmware']);
  if (Array.isArray(item.cases)) for (const test of item.cases) object(test, ['slot', 'name', 'line', 'outcome', 'observed']);
  if (item.firmware !== undefined) object(item.firmware, ['os', 'basic', 'amsdos']);
  const checked = item.outcome === 'cancelled' ? { ...item, outcome: 'blocked' } : item;
  if (!validBasicTestResult(checked, { source: { id: source.id, name: source.name, source: '' }, cases: source.cases }) || item.sourceSha256 !== undefined && item.sourceSha256 !== source.sha256) throw new Error('Résultat ou empreinte de source incohérents.');
  return structuredClone(item) as unknown as BasicTestResult;
 });
 return { schemaVersion: 1, id: id(report.id), createdAt: report.createdAt, suiteId, suiteName, seconds: budget(report.seconds), sources, results };
}
