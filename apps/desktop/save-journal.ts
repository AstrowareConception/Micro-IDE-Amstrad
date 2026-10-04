import { open, lstat, readFile, mkdir, rename, unlink, realpath, readdir } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateSourcePath, type ProjectManifest } from '../../packages/workspace/src/project.ts';
import type { SaveEntry } from '../../packages/workspace/src/save-batch.ts';

const LIMIT = 1024 * 1024;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface JournalEntry { id: string; path: string; before: string; after: string; beforeHash: string; afterHash: string }
interface JournalRecord { version: 1; id: string; projectId: string; manifestHash: string; createdAt: string; phase: 'pending' | 'committed' | 'rolled-back'; entries: JournalEntry[] }
export interface RecoverySummary { id: string; revision: string; createdAt: string; files: string[] }
export type RecoveryChoice = 'finish' | 'restore';
function keys(value: unknown, expected: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) throw new Error('Journal de sauvegarde invalide ; fichier conservé.');
  return value as Record<string, unknown>;
}
function decode(value: unknown, expectedHash: unknown): Buffer {
  if (typeof value !== 'string' || value.length > 1398104 || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('Version de source du journal invalide.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > LIMIT || bytes.toString('base64') !== value || digest(bytes) !== expectedHash) throw new Error('Empreinte ou taille du journal invalide ; fichier conservé.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0') || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Journal UTF-8 sans BOM/NUL requis.');
  return bytes;
}
function parse(value: unknown): JournalRecord {
  const item = keys(value, ['version', 'id', 'projectId', 'manifestHash', 'createdAt', 'phase', 'entries']);
  if (item.version !== 1 || typeof item.id !== 'string' || !UUID.test(item.id) || typeof item.projectId !== 'string' || !UUID.test(item.projectId) || typeof item.manifestHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.manifestHash) || typeof item.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.createdAt) || !Number.isFinite(Date.parse(item.createdAt)) || !['pending', 'committed', 'rolled-back'].includes(item.phase as string) || !Array.isArray(item.entries) || item.entries.length < 1 || item.entries.length > 64) throw new Error('Version ou en-tête de journal non pris en charge ; fichier conservé.');
  let beforeTotal = 0, afterTotal = 0;
  for (const raw of item.entries) {
    const entry = keys(raw, ['id', 'path', 'before', 'after', 'beforeHash', 'afterHash']);
    if (typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id) || typeof entry.path !== 'string') throw new Error('Identifiant du journal invalide.');
    validateSourcePath(entry.path);
    beforeTotal += decode(entry.before, entry.beforeHash).length; afterTotal += decode(entry.after, entry.afterHash).length;
    if (beforeTotal > 8 * LIMIT || afterTotal > 8 * LIMIT) throw new Error('Journal limité à 8 Mio par ensemble de sources.');
  }
  const entries = item.entries as JournalEntry[];
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.map(entry => entry.path.toLowerCase())).size !== entries.length) throw new Error('Journal dupliqué.');
  return item as unknown as JournalRecord;
}
export async function syncDirectory(path: string): Promise<void> {
  if (process.platform === 'win32') return; // Windows persistence remains unqualified.
  const handle = await open(path, 'r'); try { await handle.sync(); } finally { await handle.close(); }
}
/** Exclusive temp + fsync + rename + directory sync. A sync error may occur after rename. */
export async function durableReplace(path: string, content: Uint8Array, syncParent = true): Promise<void> {
  const temporary = join(dirname(path), `.microide-${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, path); if (syncParent) await syncDirectory(dirname(path));
  } finally { await unlink(temporary).catch(() => undefined); }
}
/** Host-owned, bounded journal for one save-all transaction; not local history. */
export class SaveJournal {
  private readonly root: string;
  private readonly manifest: ProjectManifest;
  private readonly manifestHash: string;
  private expectedRecord: string | undefined;
  constructor(root: string, manifest: ProjectManifest, manifestHash: string) { this.root = root; this.manifest = manifest; this.manifestHash = manifestHash; }
  private async directory(create = false): Promise<string | undefined> {
    let path = this.root;
    for (const segment of ['.microide', 'save']) {
      const parent = path; path = join(path, segment);
      try { await lstat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!create) return undefined;
        await mkdir(path, { mode: 0o700 }); await syncDirectory(parent);
      }
      const stat = await lstat(path), canonical = await realpath(path), location = relative(this.root, canonical);
      if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire de journal symbolique ou hors projet refusé.');
    }
    return path;
  }
  private async read(): Promise<JournalRecord | undefined> {
    const folder = await this.directory(); if (!folder) return undefined;
    const path = join(folder, 'pending.json');
    let stat;
    try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 24 * LIMIT) throw new Error('Journal ordinaire de 24 Mio maximum requis ; fichier conservé.');
    const content = await readFile(path); if (content.length > 24 * LIMIT) throw new Error('Journal trop volumineux.');
    return parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)));
  }
  private async assertManifest(record: JournalRecord): Promise<void> {
    const path = join(this.root, 'microide.project.json'), stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT || record.projectId !== this.manifest.projectId || record.manifestHash !== this.manifestHash || digest(await readFile(path)) !== record.manifestHash || record.entries.length !== this.manifest.sources.length || record.entries.some(entry => !this.manifest.sources.some(source => source.id === entry.id && source.path === entry.path))) throw new Error('Conflit de manifeste pendant la récupération ; journal conservé.');
  }
  private async sourcePath(entry: JournalEntry): Promise<string> {
    let path = this.root;
    const segments = entry.path.split('/');
    for (let i = 0; i < segments.length; i++) {
      path = join(path, segments[i]!); const stat = await lstat(path);
      if (stat.isSymbolicLink() || (i < segments.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.size > LIMIT)) throw new Error('Source de récupération ordinaire requise ; lien refusé.');
    }
    const canonical = await realpath(path), location = relative(this.root, canonical);
    if (location.startsWith('..') || isAbsolute(location)) throw new Error('Source hors projet refusée.');
    return canonical;
  }
  private async sourceHash(entry: JournalEntry): Promise<string> {
    const bytes = await readFile(await this.sourcePath(entry)); if (bytes.length > LIMIT) throw new Error('Source trop volumineuse.'); return digest(bytes);
  }
  private async preflight(record: JournalRecord): Promise<void> {
    await this.assertManifest(record);
    for (const entry of record.entries) {
      const current = await this.sourceHash(entry);
      if (current !== entry.beforeHash && current !== entry.afterHash) throw new Error(`Conflit externe : ${entry.path}. Récupération refusée ; versions conservées.`);
    }
  }
  async status(): Promise<RecoverySummary | undefined> {
    const record = await this.read(); if (!record || record.phase !== 'pending') return undefined;
    await this.preflight(record);
    return { id: record.id, revision: digest(Buffer.from(JSON.stringify(record))), createdAt: record.createdAt, files: record.entries.filter(entry => entry.beforeHash !== entry.afterHash).map(entry => entry.path) };
  }
  async assertResolved(): Promise<void> {
    const record = await this.read(); if (record?.phase === 'pending') throw new Error('Sauvegarde interrompue : rouvrir le projet pour choisir la récupération.');
  }
  async prepare(entries: (SaveEntry & { path: string })[]): Promise<string> {
    await this.assertResolved();
    const record = parse({ version: 1, id: randomUUID(), projectId: this.manifest.projectId, manifestHash: this.manifestHash, createdAt: new Date().toISOString(), phase: 'pending', entries: entries.map(entry => ({ id: entry.id, path: entry.path, before: Buffer.from(entry.before).toString('base64'), after: Buffer.from(entry.after).toString('base64'), beforeHash: digest(entry.before), afterHash: digest(entry.after) })) });
    await this.assertManifest(record);
    for (const entry of record.entries) if (await this.sourceHash(entry) !== entry.beforeHash) throw new Error(`Conflit avant journal : ${entry.path}.`);
    const folder = (await this.directory(true))!;
    // Interrupted temporary files are retained, never interpreted as transactions.
    if ((await readdir(folder)).length > 8) throw new Error('Trop de fichiers de journal conservés ; examiner les temporaires avant une nouvelle sauvegarde.');
    await durableReplace(join(folder, 'pending.json'), Buffer.from(JSON.stringify(record)));
    this.expectedRecord = digest(Buffer.from(JSON.stringify(record)));
    return record.id;
  }
  async mark(id: string, phase: 'committed' | 'rolled-back'): Promise<void> {
    const record = await this.read(); if (!record || record.id !== id || record.phase !== 'pending' || digest(Buffer.from(JSON.stringify(record))) !== this.expectedRecord) throw new Error('Journal de sauvegarde périmé ; récupération requise.');
    await durableReplace(join((await this.directory())!, 'pending.json'), Buffer.from(JSON.stringify({ ...record, phase })));
  }
  async flushSources(): Promise<void> {
    const record = await this.read(); if (!record || record.phase !== 'pending' || digest(Buffer.from(JSON.stringify(record))) !== this.expectedRecord) throw new Error('Journal de sauvegarde requis ou périmé.');
    const parents = new Set<string>();
    for (const entry of record.entries) parents.add(dirname(await this.sourcePath(entry)));
    for (const parent of parents) await syncDirectory(parent);
  }
  async recover(id: string, choice: RecoveryChoice, revision?: string): Promise<void> {
    if (choice !== 'finish' && choice !== 'restore') throw new Error('Choix de récupération invalide.');
    const record = await this.read(); if (!record || record.id !== id || record.phase !== 'pending') throw new Error('Récupération périmée.');
    const currentRevision = digest(Buffer.from(JSON.stringify(record)));
    if ((revision !== undefined && revision !== currentRevision) || (this.expectedRecord !== undefined && this.expectedRecord !== currentRevision)) throw new Error('Journal de récupération périmé ; aucun fichier remplacé.');
    this.expectedRecord = currentRevision;
    await this.preflight(record);
    for (const entry of record.entries) {
      await this.assertManifest(record);
      const current = await this.sourceHash(entry);
      if (current !== entry.beforeHash && current !== entry.afterHash) throw new Error(`Conflit externe : ${entry.path}. Journal conservé.`);
      const expected = choice === 'finish' ? entry.afterHash : entry.beforeHash;
      if (current !== expected) await durableReplace(await this.sourcePath(entry), decode(choice === 'finish' ? entry.after : entry.before, expected));
    }
    await this.assertManifest(record);
    for (const entry of record.entries) if (await this.sourceHash(entry) !== (choice === 'finish' ? entry.afterHash : entry.beforeHash)) throw new Error('Récupération interrompue ou conflit ; journal conservé.');
    await this.mark(id, choice === 'finish' ? 'committed' : 'rolled-back');
  }
}
