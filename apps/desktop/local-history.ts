import { lstat, realpath, readFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { validateSourcePath } from '../../packages/workspace/src/project.ts';
import type { HistorySnapshot, HistoryVersion } from '../../packages/workspace/src/history.ts';
import { durableReplace, syncDirectory } from './save-journal.ts';

const MIB = 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface Entry { id: string; path: string; sha256: string; content: string }
interface RecordV1 { version: 1; id: string; projectId: string; createdAt: string; reason: HistorySnapshot['reason']; files: Entry[] }
interface Loaded { record: RecordV1; revision: string; size: number }
export interface HistorySource { id: string; path: string; content: Uint8Array }
function keys(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) throw new Error('Historique local invalide ; données conservées.');
  return value as Record<string, unknown>;
}
function decode(entry: Entry): Buffer {
  if (typeof entry.content !== 'string' || entry.content.length > 1398104 || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Version historique invalide.');
  const bytes = Buffer.from(entry.content, 'base64');
  if (bytes.length > MIB || bytes.toString('base64') !== entry.content || hash(bytes) !== entry.sha256) throw new Error('Empreinte historique invalide ; données conservées.');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (source.includes('\0') || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Historique UTF-8 sans BOM/NUL requis.');
  return bytes;
}
function parse(value: unknown, projectId: string): RecordV1 {
  const item = keys(value, ['version', 'id', 'projectId', 'createdAt', 'reason', 'files']);
  if (item.version !== 1 || typeof item.id !== 'string' || !UUID.test(item.id) || item.projectId !== projectId || typeof item.createdAt !== 'string' || item.createdAt.length !== 24 || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || !['before-save', 'after-save'].includes(item.reason as string) || !Array.isArray(item.files) || !item.files.length || item.files.length > 64) throw new Error('Version ou projet historique inconnu ; données conservées.');
  let total = 0;
  for (const raw of item.files) {
    const entry = keys(raw, ['id', 'path', 'sha256', 'content']);
    if (typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id) || typeof entry.path !== 'string') throw new Error('Identité historique invalide.');
    validateSourcePath(entry.path); total += decode(entry as unknown as Entry).length;
    if (total > 8 * MIB) throw new Error('Snapshot historique limité à 8 Mio.');
  }
  const entries = item.files as Entry[];
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.map(entry => entry.path.toLowerCase())).size !== entries.length) throw new Error('Sources historiques dupliquées.');
  return item as unknown as RecordV1;
}
/** Bounded host adapter. Unknown/corrupt files block writes, and are never purged. */
export class LocalHistory {
  private readonly root: string;
  private readonly projectId: string;
  constructor(root: string, projectId: string) { this.root = root; this.projectId = projectId; }
  private async directory(create = false): Promise<string | undefined> {
    let path = this.root;
    for (const segment of ['.microide', 'history']) {
      const parent = path; path = join(path, segment);
      try { await lstat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!create) return undefined;
        await mkdir(path, { mode: 0o700 }); await syncDirectory(parent);
      }
      const stat = await lstat(path), location = relative(this.root, await realpath(path));
      if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire historique ordinaire requis ; lien refusé.');
    }
    return path;
  }
  private async read(path: string): Promise<Loaded> {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 12 * MIB) throw new Error('Snapshot historique ordinaire de 12 Mio maximum requis.');
    const bytes = await readFile(path); if (bytes.length > 12 * MIB) throw new Error('Snapshot historique trop volumineux.');
    const record = parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), this.projectId);
    if (path !== join(await this.directory() ?? '', `${record.id}.json`)) throw new Error('Identité du fichier historique invalide.');
    return { record, revision: hash(bytes), size: bytes.length };
  }
  private async all(): Promise<Loaded[]> {
    const folder = await this.directory(); if (!folder) return [];
    const names = await readdir(folder);
    if (names.length > 40) throw new Error('Trop de fichiers historiques ; données conservées.');
    const records: Loaded[] = []; let total = 0;
    for (const name of names) {
      if (/^\.microide-[a-f0-9-]+\.tmp$/.test(name)) continue;
      if (!UUID.test(name.replace(/\.json$/, '')) || !name.endsWith('.json')) throw new Error('Fichier historique inconnu ; aucune purge.');
      const record = await this.read(join(folder, name)); total += record.size;
      if (total > 128 * MIB || records.length >= 32) throw new Error('Budget historique de lecture dépassé ; données conservées.');
      records.push(record);
    }
    return records.sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt) || b.record.id.localeCompare(a.record.id));
  }
  private summary(item: Loaded): HistorySnapshot {
    return { id: item.record.id, revision: item.revision, createdAt: item.record.createdAt, reason: item.record.reason,
      files: item.record.files.map(entry => ({ id: entry.id, path: entry.path, sha256: entry.sha256, bytes: decode(entry).length })) };
  }
  async list(): Promise<HistorySnapshot[]> { return (await this.all()).map(item => this.summary(item)); }
  async version(id: string, sourceId: string, revision: string): Promise<HistoryVersion> {
    if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(revision)) throw new Error('Référence historique invalide.');
    const folder = await this.directory(); if (!folder) throw new Error('Version historique absente.');
    const item = await this.read(join(folder, `${id}.json`));
    if (item.revision !== revision) throw new Error('Version historique périmée ; actualisez la liste.');
    const entry = item.record.files.find(file => file.id === sourceId); if (!entry) throw new Error('Source absente de cette version.');
    return { snapshotId: id, revision, sourceId, path: entry.path, sha256: entry.sha256, source: new TextDecoder('utf-8', { fatal: true }).decode(decode(entry)).replace(/\r\n?/g, '\n') };
  }
  async capture(sources: HistorySource[], reason: HistorySnapshot['reason']): Promise<void> {
    const previous = await this.all();
    const createdAt = new Date(Math.max(Date.now(), previous[0] ? Date.parse(previous[0].record.createdAt) + 1 : 0)).toISOString();
    const record = parse({ version: 1, id: randomUUID(), projectId: this.projectId, createdAt, reason,
      files: sources.map(source => ({ id: source.id, path: source.path, sha256: hash(source.content), content: Buffer.from(source.content).toString('base64') })) }, this.projectId);
    const signature = (item: RecordV1) => JSON.stringify(item.files.map(({ id, path, sha256 }) => ({ id, path, sha256 })));
    if (previous[0] && signature(previous[0].record) === signature(record)) return;
    const folder = (await this.directory(true))!;
    const content = Buffer.from(JSON.stringify(record));
    await durableReplace(join(folder, `${record.id}.json`), content);
    // Publish first; a crash during retention keeps at least the new checkpoint.
    let size = content.length, count = 1;
    for (const old of previous) {
      if (count < 20 && size + old.size <= 64 * MIB) { count++; size += old.size; continue; }
      const path = join(folder, `${old.record.id}.json`);
      if ((await this.read(path)).revision !== old.revision) throw new Error('Historique modifié pendant la rétention ; aucune suppression de cette version.');
      await unlink(path);
    }
    await syncDirectory(folder);
  }
}
