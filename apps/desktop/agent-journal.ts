import { lstat, readFile, readdir, mkdir, realpath, unlink } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseProject, type ProjectManifest } from '../../packages/workspace/src/project.ts';
import { durableReplace, syncDirectory, type RecoverySummary, type RecoveryChoice } from './save-journal.ts';
import { LocalHistory } from './local-history.ts';
const MIB = 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface Version { content: string; hash: string }
export interface AgentJournalSource { id: string; path: string; before: Uint8Array | null; after: Uint8Array | null }
interface RecordV1 {
  version: 1; id: string; projectId: string; createdAt: string; phase: 'pending' | 'committed' | 'restored';
  before: Version; after: Version; files: { id: string; path: string; before: Version | null; after: Version | null }[];
}
const pack = (bytes: Uint8Array): Version => ({ content: Buffer.from(bytes).toString('base64'), hash: hash(bytes) });
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Journal agent invalide ; versions conservées.');
  return value as Record<string, unknown>;
}
function decode(value: unknown, limit: number): Buffer {
  const item = object(value, ['content', 'hash']);
  if (typeof item.content !== 'string' || item.content.length > Math.ceil(limit / 3) * 4 || typeof item.hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash)) throw new Error('Version agent invalide.');
  const bytes = Buffer.from(item.content, 'base64');
  if (bytes.length > limit || bytes.toString('base64') !== item.content || hash(bytes) !== item.hash) throw new Error('Empreinte agent invalide.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0') || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Versions agent UTF-8 sans BOM/NUL requises.');
  return bytes;
}
function manifest(version: Version): ProjectManifest { return parseProject(JSON.parse(decode(version, MIB).toString('utf8'))); }
function parse(value: unknown): RecordV1 {
  const item = object(value, ['version', 'id', 'projectId', 'createdAt', 'phase', 'before', 'after', 'files']);
  if (item.version !== 1 || typeof item.id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(item.id) || typeof item.createdAt !== 'string' || item.createdAt.length !== 24 || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || !['pending', 'committed', 'restored'].includes(item.phase as string) || !Array.isArray(item.files) || !item.files.length || item.files.length > 128) throw new Error('Journal agent inconnu ; données conservées.');
  const before = manifest(item.before as Version), after = manifest(item.after as Version);
  const identity = ({ sources: _sources, entryPoint: _entry, ...rest }: ProjectManifest) => JSON.stringify(rest);
  if (before.projectId !== item.projectId || after.projectId !== item.projectId || identity(before) !== identity(after)) throw new Error('Identité/documents du journal agent différents.');
  let beforeTotal = 0, afterTotal = 0;
  for (const raw of item.files) {
    const file = object(raw, ['id', 'path', 'before', 'after']);
    const old = before.sources.find(source => source.id === file.id), next = after.sources.find(source => source.id === file.id);
    if (!old && !next || old && old.path !== file.path || next && next.path !== file.path || old && next && old.cpcName !== next.cpcName || !old && next!.path !== `src/${next!.id}.bas` || (file.before === null) !== !old || (file.after === null) !== !next) throw new Error('Source du journal agent incohérente.');
    if (file.before !== null) beforeTotal += decode(file.before, 65536).length;
    if (file.after !== null) afterTotal += decode(file.after, 65536).length;
    if (beforeTotal > 256 * 1024 || afterTotal > 256 * 1024) throw new Error('Journal agent limité à 256 Kio par ensemble.');
  }
  const files = item.files as RecordV1['files'];
  if (new Set(files.map(file => file.id)).size !== files.length || new Set(files.map(file => file.path.toLowerCase())).size !== files.length || [...before.sources, ...after.sources].some(source => !files.some(file => file.id === source.id && file.path === source.path))) throw new Error('Journal agent incomplet ou dupliqué.');
  return item as unknown as RecordV1;
}
/** One durable mutation checkpoint, no prompt/key/remote response persisted here. */
export class AgentJournal {
  private readonly root: string;
  constructor(root: string) { this.root = root; }
  private async directory(create = false): Promise<string | undefined> {
    let path = this.root;
    for (const segment of ['.microide', 'agent-journal']) {
      const parent = path; path = join(path, segment);
      try { await lstat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!create) return undefined; await mkdir(path, { mode: 0o700 }); await syncDirectory(parent);
      }
      const stat = await lstat(path), location = relative(this.root, await realpath(path));
      if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire de journal agent ordinaire requis.');
    }
    return path;
  }
  private async path(source: string): Promise<string> {
    let path = this.root; const parts = source.split('/');
    for (let index = 0; index < parts.length - 1; index++) {
      path = join(path, parts[index]!); const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Parent de source agent ordinaire requis.');
    }
    const location = relative(this.root, await realpath(path));
    if (location.startsWith('..') || isAbsolute(location)) throw new Error('Source agent hors projet refusée.');
    return join(path, parts.at(-1)!);
  }
  private async bytes(path: string, limit: number): Promise<Buffer | null> {
    let stat; try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit) throw new Error('Fichier agent ordinaire et borné requis.');
    const bytes = await readFile(path); if (bytes.length > limit) throw new Error('Fichier agent trop volumineux.'); return bytes;
  }
  private async read(): Promise<{ record: RecordV1; revision: string } | undefined> {
    const folder = await this.directory(); if (!folder) return undefined;
    const bytes = await this.bytes(join(folder, 'current.json'), 4 * MIB); if (!bytes) return undefined;
    return { record: parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))), revision: hash(bytes) };
  }
  async assertResolved(): Promise<void> { if ((await this.read())?.record.phase === 'pending') throw new Error('Mutation agent interrompue : rouvrir le projet pour récupérer.'); }
  private async preflight(record: RecordV1, beforeOnly = false): Promise<void> {
    const actualManifest = await this.bytes(await this.path('microide.project.json'), MIB);
    const digest = actualManifest && hash(actualManifest);
    if (digest !== record.before.hash && (beforeOnly || digest !== record.after.hash)) throw new Error('Conflit de manifeste agent ; versions conservées.');
    for (const file of record.files) {
      const bytes = await this.bytes(await this.path(file.path), 65536), digest = bytes === null ? null : hash(bytes);
      if (digest !== (file.before?.hash ?? null) && (beforeOnly || digest !== (file.after?.hash ?? null))) throw new Error(`Conflit externe : ${file.path}. Journal agent conservé.`);
    }
  }
  async status(): Promise<RecoverySummary | undefined> {
    const item = await this.read(); if (!item || item.record.phase !== 'pending') return undefined;
    await this.preflight(item.record);
    return { id: item.record.id, revision: item.revision, createdAt: item.record.createdAt, files: [...item.record.files.filter(file => file.before?.hash !== file.after?.hash).map(file => file.path), ...(item.record.before.hash !== item.record.after.hash ? ['microide.project.json'] : [])] };
  }
  async prepare(before: Uint8Array, after: Uint8Array, files: AgentJournalSource[]): Promise<RecoverySummary> {
    await this.assertResolved(); const previous = await this.read();
    const record = parse({ version: 1, id: randomUUID(), projectId: parseProject(JSON.parse(Buffer.from(before).toString('utf8'))).projectId, createdAt: new Date().toISOString(), phase: 'pending', before: pack(before), after: pack(after), files: files.map(file => ({ id: file.id, path: file.path, before: file.before === null ? null : pack(file.before), after: file.after === null ? null : pack(file.after) })) });
    await this.preflight(record, true);
    const folder = (await this.directory(true))!;
    const names = await readdir(folder);
    if (names.length > 9 || names.some(name => name !== 'current.json' && !/^\.microide-[a-f0-9-]+\.tmp$/.test(name))) throw new Error('Fichiers agent inconnus/trop nombreux ; données conservées.');
    if ((await this.read())?.revision !== previous?.revision) throw new Error('Journal agent périmé.');
    await durableReplace(join(folder, 'current.json'), Buffer.from(JSON.stringify(record)));
    return (await this.status())!;
  }
  async recover(id: string, choice: RecoveryChoice, revision: string): Promise<void> {
    if (choice !== 'finish' && choice !== 'restore') throw new Error('Choix agent invalide.');
    const check = async () => {
      const item = await this.read(); if (!item || item.record.id !== id || item.record.phase !== 'pending' || item.revision !== revision) throw new Error('Journal agent périmé ; récupération refusée.');
      await this.preflight(item.record); return item.record;
    };
    const record = await check(), side = choice === 'finish' ? 'after' : 'before';
    const history = new LocalHistory(this.root, record.projectId);
    // Retain both sides before any recovery write; removed/created sources remain in snapshots.
    await history.capture(record.files.filter(file => file.before !== null).map(file => ({ id: file.id, path: file.path, content: decode(file.before, 65536) })), 'before-agent');
    await history.capture(record.files.filter(file => file.after !== null).map(file => ({ id: file.id, path: file.path, content: decode(file.after, 65536) })), 'after-agent');
    for (const file of record.files) {
      await check(); const path = await this.path(file.path), version = file[side];
      const actual = await this.bytes(path, 65536);
      if ((actual === null ? null : hash(actual)) === (version?.hash ?? null)) continue;
      if (version === null) { await unlink(path); await syncDirectory(dirname(path)); }
      else await durableReplace(path, decode(version, 65536));
    }
    await check();
    const manifestPath = await this.path('microide.project.json');
    if (hash((await this.bytes(manifestPath, MIB))!) !== record[side].hash) await durableReplace(manifestPath, decode(record[side], MIB));
    await check();
    for (const file of record.files) {
      const actual = await this.bytes(await this.path(file.path), 65536);
      if ((actual === null ? null : hash(actual)) !== (file[side]?.hash ?? null)) throw new Error('Conflit final agent ; journal conservé.');
    }
    if (hash((await this.bytes(manifestPath, MIB))!) !== record[side].hash) throw new Error('Conflit final de manifeste agent.');
    await check(); await durableReplace(join((await this.directory())!, 'current.json'), Buffer.from(JSON.stringify({ ...record, phase: choice === 'finish' ? 'committed' : 'restored' })));
  }
}
