import { lstat, realpath, mkdir, readFile, readdir } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { validateSourcePath } from '../../packages/workspace/src/project.ts';
import type { DraftSummary, DraftRecovery } from '../../packages/workspace/src/drafts.ts';
import { durableReplace, syncDirectory } from './save-journal.ts';

const MIB = 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
interface Entry { id: string; path: string; base: string; baseHash: string; draft: string; draftHash: string }
interface RecordV1 { version: 1; id: string; projectId: string; manifestHash: string; createdAt: string; files: Entry[] }
export interface DraftInput { id: string; path: string; base: Uint8Array; source: string }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Copie de brouillons invalide ; données conservées.');
  return value as Record<string, unknown>;
}
function decode(value: unknown, expected: unknown): Buffer {
  if (typeof value !== 'string' || value.length > 1398104 || typeof expected !== 'string' || !HASH.test(expected)) throw new Error('Version de brouillon invalide.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > MIB || bytes.toString('base64') !== value || hash(bytes) !== expected) throw new Error('Empreinte de brouillon invalide ; copie conservée.');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (source.includes('\0') || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Brouillon UTF-8 sans BOM/NUL requis.');
  return bytes;
}
const text = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
function parse(value: unknown, projectId: string): RecordV1 {
  const item = object(value, ['version', 'id', 'projectId', 'manifestHash', 'createdAt', 'files']);
  if (item.version !== 1 || typeof item.id !== 'string' || !UUID.test(item.id) || item.projectId !== projectId || typeof item.manifestHash !== 'string' || !HASH.test(item.manifestHash) || typeof item.createdAt !== 'string' || item.createdAt.length !== 24 || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || !Array.isArray(item.files) || item.files.length > 64) throw new Error('Version ou projet de brouillons inconnu ; copie conservée.');
  let before = 0, after = 0;
  for (const raw of item.files) {
    const entry = object(raw, ['id', 'path', 'base', 'baseHash', 'draft', 'draftHash']);
    if (typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id) || typeof entry.path !== 'string') throw new Error('Identité de brouillon invalide.');
    validateSourcePath(entry.path);
    before += decode(entry.base, entry.baseHash).length; after += decode(entry.draft, entry.draftHash).length;
    if (before > 8 * MIB || after > 8 * MIB) throw new Error('Copie limitée à 8 Mio par ensemble de sources.');
  }
  const entries = item.files as Entry[];
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.map(entry => entry.path.toLowerCase())).size !== entries.length) throw new Error('Brouillons dupliqués.');
  return item as unknown as RecordV1;
}
/** One revision-guarded recovery copy. Sources are never written by this adapter. */
export class DraftStore {
  private readonly root: string;
  private readonly projectId: string;
  constructor(root: string, projectId: string) { this.root = root; this.projectId = projectId; }
  private async directory(create = false): Promise<string | undefined> {
    let path = this.root;
    for (const segment of ['.microide', 'drafts']) {
      const parent = path; path = join(path, segment);
      try { await lstat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!create) return undefined;
        await mkdir(path, { mode: 0o700 }); await syncDirectory(parent);
      }
      const stat = await lstat(path), location = relative(this.root, await realpath(path));
      if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire de brouillons ordinaire requis ; lien refusé.');
    }
    return path;
  }
  private async load(): Promise<{ record: RecordV1; revision: string } | undefined> {
    const folder = await this.directory(); if (!folder) return undefined;
    const path = join(folder, 'current.json'); let stat;
    try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 24 * MIB) throw new Error('Copie de brouillons ordinaire de 24 Mio maximum requise.');
    const bytes = await readFile(path); if (bytes.length > 24 * MIB) throw new Error('Copie de brouillons trop volumineuse.');
    return { record: parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), this.projectId), revision: hash(bytes) };
  }
  private summary(item: { record: RecordV1; revision: string } | undefined): DraftSummary {
    if (!item) return { revision: null, snapshot: null };
    return { revision: item.revision, snapshot: item.record.files.length ? { id: item.record.id, createdAt: item.record.createdAt,
      files: item.record.files.map(entry => ({ id: entry.id, path: entry.path, bytes: decode(entry.draft, entry.draftHash).length })) } : null };
  }
  async status(): Promise<DraftSummary> { return this.summary(await this.load()); }
  private async expected(revision: string | null) {
    if (revision !== null && (typeof revision !== 'string' || !HASH.test(revision))) throw new Error('Révision de brouillons invalide.');
    const item = await this.load(); if ((item?.revision ?? null) !== revision) throw new Error('Copie de brouillons périmée ; relisez avant toute modification.');
    return item;
  }
  async capture(manifestHash: string, inputs: DraftInput[], revision: string | null): Promise<DraftSummary> {
    const previous = await this.expected(revision);
    let total = 0;
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 64) throw new Error('1 à 64 sources de brouillons requises.');
    const files = inputs.map(input => {
      if (typeof input.source !== 'string' || input.source.length > MIB) throw new Error('Brouillon de 1 Mio maximum requis.');
      const draft = Buffer.from(input.source.replace(/\r\n?/g, '\n')); total += draft.length;
      if (draft.length > MIB || total > 8 * MIB) throw new Error('Budget de brouillons dépassé.');
      return { id: input.id, path: input.path, base: Buffer.from(input.base).toString('base64'), baseHash: hash(input.base), draft: draft.toString('base64'), draftHash: hash(draft) };
    });
    const checked = parse({ version: 1, id: randomUUID(), projectId: this.projectId, manifestHash, createdAt: new Date().toISOString(), files }, this.projectId);
    // Validate clean sources too; only modified buffers enter the recovery copy.
    checked.files = checked.files.filter(entry => text(decode(entry.base, entry.baseHash)) !== text(decode(entry.draft, entry.draftHash)));
    if (previous && previous.record.manifestHash === manifestHash && JSON.stringify(previous.record.files) === JSON.stringify(checked.files)) return this.summary(previous);
    return this.publish(checked, revision);
  }
  private async publish(record: RecordV1, revision: string | null): Promise<DraftSummary> {
    const folder = (await this.directory(true))!;
    const names = await readdir(folder);
    if (names.filter(name => name !== 'current.json').length > 8 || names.some(name => name !== 'current.json' && !/^\.microide-[a-f0-9-]+\.tmp$/.test(name))) throw new Error('Fichiers de brouillons inconnus ou trop nombreux ; copie conservée.');
    await this.expected(revision);
    const bytes = Buffer.from(JSON.stringify(record)); await durableReplace(join(folder, 'current.json'), bytes);
    return this.summary({ record, revision: hash(bytes) });
  }
  async read(revision: string): Promise<{ recovery: DraftRecovery; manifestHash: string; bases: { id: string; path: string; hash: string }[] }> {
    const item = await this.expected(revision); if (!item || !item.record.files.length) throw new Error('Aucun brouillon récupérable.');
    return { manifestHash: item.record.manifestHash, bases: item.record.files.map(entry => ({ id: entry.id, path: entry.path, hash: entry.baseHash })),
      recovery: { revision: item.revision, files: item.record.files.map(entry => ({ id: entry.id, path: entry.path,
        base: text(decode(entry.base, entry.baseHash)), source: text(decode(entry.draft, entry.draftHash)) })) } };
  }
  async forget(revision: string): Promise<DraftSummary> {
    const item = await this.expected(revision); if (!item) throw new Error('Copie absente.');
    return this.publish({ ...item.record, id: randomUUID(), createdAt: new Date().toISOString(), files: [] }, revision);
  }
}
