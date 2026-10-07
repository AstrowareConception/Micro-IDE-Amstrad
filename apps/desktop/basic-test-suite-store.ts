import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { durableReplace } from './save-journal.ts';
import { BASIC_TEST_SUITE_LIMITS, parseBasicTestSuites, parseBasicTestReport, type BasicTestLibrary, type BasicTestReport } from '../../packages/emulator/src/basic-test-suites.ts';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Fixed destinations only. No source, firmware or renderer-provided path is written. */
export class BasicTestSuiteStore {
 private readonly root: string;
 private readonly projectId: string;
 constructor(root: string, projectId: string) { this.root = root; this.projectId = projectId; }
 private async read(path: string, limit: number): Promise<Buffer | undefined> {
  let stat;
  try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit) throw new Error('Fichier de tests ordinaire requis ; lien ou taille excessive refusé.');
  const bytes = await readFile(path); if (bytes.length > limit) throw new Error('Fichier de tests trop volumineux.'); return bytes;
 }
 private decode(bytes: Buffer): unknown { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
 async load(): Promise<BasicTestLibrary> {
  const bytes = await this.read(join(this.root, 'microide.tests.json'), BASIC_TEST_SUITE_LIMITS.libraryBytes);
  return bytes ? { revision: hash(bytes), suites: parseBasicTestSuites(this.decode(bytes)).suites } : { revision: null, suites: [] };
 }
 async save(revision: unknown, suites: unknown, declaredIds: readonly string[]): Promise<BasicTestLibrary> {
  const file = parseBasicTestSuites({ schemaVersion: 1, suites });
  const previous = await this.load();
  if (revision !== previous.revision) throw new Error('Les suites ont changé sur disque. Actualisez avant d’enregistrer.');
  // Missing references in existing suites remain visible and removable; new ones are refused.
  for (const suite of file.suites) for (const sourceId of suite.sourceIds) {
   if (!declaredIds.includes(sourceId) && !previous.suites.find(item => item.id === suite.id)?.sourceIds.includes(sourceId)) throw new Error('Une source de la suite n’est pas déclarée dans ce projet.');
  }
  const bytes = Buffer.from(JSON.stringify(file, null, 2) + '\n');
  if (bytes.length > BASIC_TEST_SUITE_LIMITS.libraryBytes) throw new Error('Suites limitées à 32 Kio.');
  if ((await this.load()).revision !== revision) throw new Error('Les suites ont changé sur disque.');
  await durableReplace(join(this.root, 'microide.tests.json'), bytes);
  return { revision: hash(bytes), suites: file.suites };
 }
 private async historyPath(create = false): Promise<string | undefined> {
  let folder = this.root;
  for (const part of ['.microide', 'test-reports']) {
   folder = join(folder, part);
   try { await lstat(folder); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (!create) return undefined; await mkdir(folder, { mode: 0o700 });
   }
   const stat = await lstat(folder), location = relative(this.root, await realpath(folder));
   if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire d’historique de tests invalide ; liens refusés.');
  }
  return join(folder, 'history.json');
 }
 async history(): Promise<BasicTestReport[]> {
  const path = await this.historyPath(); if (!path) return [];
  const bytes = await this.read(path, BASIC_TEST_SUITE_LIMITS.historyBytes); if (!bytes) return [];
  const value = this.decode(bytes) as Record<string, unknown>;
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join() !== 'projectId,reports,schemaVersion' || value.schemaVersion !== 1 || value.projectId !== this.projectId || !Array.isArray(value.reports) || value.reports.length > BASIC_TEST_SUITE_LIMITS.history) throw new Error('Historique de tests invalide ; données conservées.');
  const reports = value.reports.map(parseBasicTestReport);
  if (new Set(reports.map(report => report.id)).size !== reports.length) throw new Error('Rapports dupliqués.');
  return reports;
 }
 async record(input: unknown): Promise<BasicTestReport[]> {
  const report = parseBasicTestReport(input), previous = await this.history();
  const existing = previous.find(item => item.id === report.id);
  if (existing) { if (JSON.stringify(existing) !== JSON.stringify(report)) throw new Error('Identifiant de rapport déjà utilisé.'); return previous; }
  const reports = [report, ...previous].slice(0, BASIC_TEST_SUITE_LIMITS.history);
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, projectId: this.projectId, reports }, null, 2) + '\n');
  if (bytes.length > BASIC_TEST_SUITE_LIMITS.historyBytes) throw new Error('Historique limité à 2 Mio ; le rapport reste exportable.');
  const path = (await this.historyPath(true))!;
  await this.read(path, BASIC_TEST_SUITE_LIMITS.historyBytes);
  await durableReplace(path, bytes);
  return reports;
 }
}
