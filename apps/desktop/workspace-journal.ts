import { lstat, readFile, readdir, mkdir, realpath, unlink } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseProject, type ProjectManifest } from '../../packages/workspace/src/project.ts';
import { durableReplace, syncDirectory, type RecoverySummary, type RecoveryChoice } from './save-journal.ts';
import type { SourceMutationResult } from '../../packages/workspace/src/source-operations.ts';
import { LocalHistory } from './local-history.ts';
const MIB = 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface Version { content: string; hash: string }
export interface AgentJournalSource { id: string; path: string; before: Uint8Array | null; after: Uint8Array | null }
interface RecordV1 {
  version: 1; id: string; projectId: string; createdAt: string; phase: 'pending' | 'committed' | 'restored';
  before: Version; after: Version; draft?: { id: string; path: string; version: Version }; files: { id: string; path: string; before: Version | null; after: Version | null }[];
}
const pack = (bytes: Uint8Array): Version => ({ content: Buffer.from(bytes).toString('base64'), hash: hash(bytes) });
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Journal de projet invalide ; versions conservées.');
  return value as Record<string, unknown>;
}
function decode(value: unknown, limit: number): Buffer {
  const item = object(value, ['content', 'hash']);
  if (typeof item.content !== 'string' || item.content.length > Math.ceil(limit / 3) * 4 || typeof item.hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash)) throw new Error('Version de source invalide.');
  const bytes = Buffer.from(item.content, 'base64');
  if (bytes.length > limit || bytes.toString('base64') !== item.content || hash(bytes) !== item.hash) throw new Error('Empreinte de source invalide.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0') || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Versions de source UTF-8 sans BOM/NUL requises.');
  return bytes;
}
function manifest(version: Version): ProjectManifest { return parseProject(JSON.parse(decode(version, MIB).toString('utf8'))); }
type JournalKind = 'agent' | 'source';
const limits = (kind: JournalKind) => kind === 'agent' ? { file: 65536, total: 256 * 1024, record: 4 * MIB } : { file: MIB, total: 8 * MIB, record: 28 * MIB };
function parse(value: unknown, kind: JournalKind): RecordV1 {
  const hasDraft = kind === 'source' && !!value && typeof value === 'object' && Object.hasOwn(value, 'draft');
  const item = object(value, ['version', 'id', 'projectId', 'createdAt', 'phase', 'before', 'after', 'files', ...(hasDraft ? ['draft'] : [])]);
  const bounds = limits(kind);
  if (item.version !== 1 || typeof item.id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(item.id) || typeof item.createdAt !== 'string' || item.createdAt.length !== 24 || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || !['pending', 'committed', 'restored'].includes(item.phase as string) || !Array.isArray(item.files) || !item.files.length || item.files.length > 128) throw new Error('Journal de projet inconnu ; données conservées.');
  const before = manifest(item.before as Version), after = manifest(item.after as Version);
  const identity = ({ sources: _sources, entryPoint: _entry, ...rest }: ProjectManifest) => JSON.stringify(rest);
  if (before.projectId !== item.projectId || after.projectId !== item.projectId || identity(before) !== identity(after)) throw new Error('Identité/documents du journal de projet différents.');
  let beforeTotal = 0, afterTotal = 0;
  for (const raw of item.files) {
    const file = object(raw, ['id', 'path', 'before', 'after']);
    const old = before.sources.find(source => source.id === file.id && (kind === 'agent' || source.path === file.path)), next = after.sources.find(source => source.id === file.id && (kind === 'agent' || source.path === file.path));
    if (!old && !next || old && old.path !== file.path || next && next.path !== file.path || kind === 'agent' && (old && next && old.cpcName !== next.cpcName || !old && next!.path !== `src/${next!.id}.bas`) || (file.before === null) !== !old || (file.after === null) !== !next) throw new Error('Source du journal de projet incohérente.');
    if (file.before !== null) beforeTotal += decode(file.before, bounds.file).length;
    if (file.after !== null) afterTotal += decode(file.after, bounds.file).length;
    if (beforeTotal > bounds.total || afterTotal > bounds.total) throw new Error(kind === 'agent' ? 'Journal de projet limité à 256 Kio par ensemble.' : 'Journal de sources limité à 8 Mio par ensemble.');
  }
  const files = item.files as RecordV1['files'];
  if (kind === 'agent' && new Set(files.map(file => file.id)).size !== files.length || new Set(files.map(file => file.path.toLowerCase())).size !== files.length || [...before.sources, ...after.sources].some(source => !files.some(file => file.id === source.id && file.path === source.path))) throw new Error('Journal de projet incomplet ou dupliqué.');
  if (kind === 'source') {
    const removed = before.sources.filter(source => !after.sources.some(next => next.id === source.id));
    const changed = before.sources.filter(source => after.sources.some(next => next.id === source.id && JSON.stringify(next) !== JSON.stringify(source)));
    if (after.sources.some(source => !before.sources.some(old => old.id === source.id)) || removed.length + changed.length !== 1 || (!removed.length && before.entryPoint !== after.entryPoint)) throw new Error('Une seule source doit être renommée, déplacée ou supprimée.');
    for (const source of before.sources) {
      const old = files.find(file => file.id === source.id && file.path === source.path);
      const next = files.find(file => file.id === source.id && file.after !== null);
      if (next && old?.before?.hash !== next.after?.hash) throw new Error('Une organisation de sources ne modifie pas leur contenu.');
    }
  }
  if (hasDraft) {
    const draft = object(item.draft, ['id', 'path', 'version']);
    if (!before.sources.some(source => source.id === draft.id && source.path === draft.path) || after.sources.some(source => source.id === draft.id)) throw new Error('Brouillon de suppression non déclaré.');
    decode(draft.version, MIB);
  }
  return item as unknown as RecordV1;
}
/** One durable mutation checkpoint, no prompt/key/remote response persisted here. */
export class WorkspaceJournal {
  private readonly root: string;
  private readonly kind: JournalKind;
  constructor(root: string, kind: JournalKind) { this.root = root; this.kind = kind; }
  private get bounds() { return limits(this.kind); }
  private async directory(create = false): Promise<string | undefined> {
    let path = this.root;
    for (const segment of ['.microide', `${this.kind}-journal`]) {
      const parent = path; path = join(path, segment);
      try { await lstat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!create) return undefined; await mkdir(path, { mode: 0o700 }); await syncDirectory(parent);
      }
      const stat = await lstat(path), location = relative(this.root, await realpath(path));
      if (!stat.isDirectory() || stat.isSymbolicLink() || location.startsWith('..') || isAbsolute(location)) throw new Error('Répertoire de journal de projet ordinaire requis.');
    }
    return path;
  }
  private async path(source: string): Promise<string> {
    let path = this.root; const parts = source.split('/');
    for (let index = 0; index < parts.length - 1; index++) {
      if (this.kind === 'source') await this.checkName(path, parts[index]!);
      path = join(path, parts[index]!); const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Parent de source ordinaire requis.');
    }
    const location = relative(this.root, await realpath(path));
    if (location.startsWith('..') || isAbsolute(location)) throw new Error('Source hors projet refusée.');
    if (this.kind === 'source') await this.checkName(path, parts.at(-1)!);
    return join(path, parts.at(-1)!);
  }
  private async checkName(parent: string, name: string): Promise<void> {
    const names = await readdir(parent);
    if (names.length > 4096 || names.some(item => item !== name && item.toLowerCase() === name.toLowerCase())) throw new Error('Collision de casse ou dossier trop volumineux.');
  }
  private async bytes(path: string, limit: number): Promise<Buffer | null> {
    let stat; try { stat = await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit) throw new Error('Fichier ordinaire et borné requis.');
    const bytes = await readFile(path); if (bytes.length > limit) throw new Error('Fichier trop volumineux.'); return bytes;
  }
  private async read(): Promise<{ record: RecordV1; revision: string } | undefined> {
    const folder = await this.directory(); if (!folder) return undefined;
    const bytes = await this.bytes(join(folder, 'current.json'), this.bounds.record); if (!bytes) return undefined;
    return { record: parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), this.kind), revision: hash(bytes) };
  }
  async assertResolved(): Promise<void> { if ((await this.read())?.record.phase === 'pending') throw new Error(`Mutation ${this.kind === 'agent' ? 'agent' : 'de sources'} interrompue : rouvrir le projet pour récupérer.`); }
  private async preflight(record: RecordV1, only?: 'before' | 'after'): Promise<void> {
    const actualManifest = await this.bytes(await this.path('microide.project.json'), MIB);
    const digest = actualManifest && hash(actualManifest);
    if (only ? digest !== record[only].hash : digest !== record.before.hash && digest !== record.after.hash) throw new Error('Conflit de manifeste ; versions conservées.');
    for (const file of record.files) {
      const bytes = await this.bytes(await this.path(file.path), this.bounds.file), digest = bytes === null ? null : hash(bytes);
      if (only ? digest !== (file[only]?.hash ?? null) : digest !== (file.before?.hash ?? null) && digest !== (file.after?.hash ?? null)) throw new Error(`Conflit externe : ${file.path}. Journal de projet conservé.`);
    }
  }
  async status(): Promise<RecoverySummary | undefined> {
    const item = await this.read(); if (!item || item.record.phase !== 'pending') return undefined;
    await this.preflight(item.record);
    return { id: item.record.id, revision: item.revision, createdAt: item.record.createdAt, files: [...item.record.files.filter(file => file.before?.hash !== file.after?.hash).map(file => file.path), ...(item.record.before.hash !== item.record.after.hash ? ['microide.project.json'] : [])] };
  }
  async inspect(before: Uint8Array, after: Uint8Array, files: AgentJournalSource[]): Promise<void> {
    await this.assertResolved();
    const record = parse({ version: 1, id: randomUUID(), projectId: parseProject(JSON.parse(Buffer.from(before).toString('utf8'))).projectId, createdAt: new Date().toISOString(), phase: 'pending', before: pack(before), after: pack(after), files: files.map(file => ({ id: file.id, path: file.path, before: file.before === null ? null : pack(file.before), after: file.after === null ? null : pack(file.after) })) }, this.kind);
    await this.preflight(record, 'before');
  }
  async prepare(before: Uint8Array, after: Uint8Array, files: AgentJournalSource[], draft?: { id: string; path: string; source: string }): Promise<RecoverySummary> {
    await this.assertResolved(); const previous = await this.read();
    const record = parse({ version: 1, id: randomUUID(), projectId: parseProject(JSON.parse(Buffer.from(before).toString('utf8'))).projectId, createdAt: new Date().toISOString(), phase: 'pending', before: pack(before), after: pack(after), files: files.map(file => ({ id: file.id, path: file.path, before: file.before === null ? null : pack(file.before), after: file.after === null ? null : pack(file.after) })), ...(draft ? { draft: { id: draft.id, path: draft.path, version: pack(Buffer.from(draft.source)) } } : {}) }, this.kind);
    await this.preflight(record, 'before');
    const folder = (await this.directory(true))!;
    const names = await readdir(folder);
    if (names.length > 9 || names.some(name => name !== 'current.json' && !/^\.microide-[a-f0-9-]+\.tmp$/.test(name))) throw new Error('Fichiers inconnus/trop nombreux ; données conservées.');
    if ((await this.read())?.revision !== previous?.revision) throw new Error('Journal de projet périmé.');
    await durableReplace(join(folder, 'current.json'), Buffer.from(JSON.stringify(record)));
    return (await this.status())!;
  }
  protected async undoStatus(): Promise<{ revision: string; createdAt: string; files: string[] } | undefined> {
    const item = await this.read(); if (!item || item.record.phase !== 'committed') return undefined;
    try { await this.preflight(item.record, 'after'); } catch { return undefined; }
    return { revision: item.revision, createdAt: item.record.createdAt, files: item.record.files.filter(file => file.before?.hash !== file.after?.hash).map(file => file.path) };
  }
  protected async readDraft(projectId: string): Promise<{ id: string; path: string; source: string } | undefined> {
    const item = await this.read(); if (!item?.record.draft) return undefined;
    if (item.record.projectId !== projectId) throw new Error('Copie de brouillon appartenant à un autre projet.');
    const draft = item.record.draft;
    return { id: draft.id, path: draft.path, source: decode(draft.version, MIB).toString('utf8').replace(/\r\n?/g, '\n') };
  }
  protected async undoLast(revision: string): Promise<{ result: SourceMutationResult; manifestHash: string; hashes: { id: string; hash: string }[] }> {
    const item = await this.read();
    if (!item || item.record.phase !== 'committed' || item.revision !== revision) throw new Error('Dernière mutation périmée ; restauration refusée.');
    await this.preflight(item.record, 'after');
    if ((await this.read())?.revision !== revision) throw new Error('Dernière mutation modifiée pendant la préparation.');
    const pending = Buffer.from(JSON.stringify({ ...item.record, phase: 'pending' }));
    await durableReplace(join((await this.directory())!, 'current.json'), pending);
    await this.recover(item.record.id, 'restore', hash(pending));
    const draft = item.record.draft;
    const before = manifest(item.record.before);
    const versions = before.sources.map(source => ({ source, version: item.record.files.find(file => file.id === source.id && file.path === source.path)!.before! }));
    return { manifestHash: item.record.before.hash, hashes: versions.map(({ source, version }) => ({ id: source.id, hash: version.hash })), result: { manifest: before, files: versions.map(({ source, version }) => ({ ...source, source: decode(version, this.bounds.file).toString('utf8').replace(/\r\n?/g, '\n') })), ...(draft ? { restoredDraft: { id: draft.id, source: decode(draft.version, MIB).toString('utf8').replace(/\r\n?/g, '\n') } } : {}) } };
  }
  async recover(id: string, choice: RecoveryChoice, revision: string): Promise<void> {
    if (choice !== 'finish' && choice !== 'restore') throw new Error('Choix de reprise invalide.');
    const check = async () => {
      const item = await this.read(); if (!item || item.record.id !== id || item.record.phase !== 'pending' || item.revision !== revision) throw new Error('Journal de projet périmé ; récupération refusée.');
      await this.preflight(item.record); return item.record;
    };
    const record = await check(), side = choice === 'finish' ? 'after' : 'before';
    const history = new LocalHistory(this.root, record.projectId);
    // Retain both sides before any recovery write; removed/created sources remain in snapshots.
    await history.capture(record.files.filter(file => file.before !== null).map(file => ({ id: file.id, path: file.path, content: decode(file.before, this.bounds.file) })), this.kind === 'agent' ? 'before-agent' : 'before-source');
    await history.capture(record.files.filter(file => file.after !== null).map(file => ({ id: file.id, path: file.path, content: decode(file.after, this.bounds.file) })), this.kind === 'agent' ? 'after-agent' : 'after-source');
    if (record.draft) await history.capture([{ id: record.draft.id, path: record.draft.path, content: decode(record.draft.version, MIB) }], 'source-draft');
    for (const file of record.files) {
      await check(); const path = await this.path(file.path), version = file[side];
      const actual = await this.bytes(path, this.bounds.file);
      if ((actual === null ? null : hash(actual)) === (version?.hash ?? null)) continue;
      if (version === null) { await unlink(path); await syncDirectory(dirname(path)); }
      else await durableReplace(path, decode(version, this.bounds.file));
    }
    await check();
    const manifestPath = await this.path('microide.project.json');
    if (hash((await this.bytes(manifestPath, MIB))!) !== record[side].hash) await durableReplace(manifestPath, decode(record[side], MIB));
    await check();
    for (const file of record.files) {
      const actual = await this.bytes(await this.path(file.path), this.bounds.file);
      if ((actual === null ? null : hash(actual)) !== (file[side]?.hash ?? null)) throw new Error('Conflit final de sources ; journal conservé.');
    }
    if (hash((await this.bytes(manifestPath, MIB))!) !== record[side].hash) throw new Error('Conflit final de manifeste.');
    await check(); await durableReplace(join((await this.directory())!, 'current.json'), Buffer.from(JSON.stringify({ ...record, phase: choice === 'finish' ? 'committed' : 'restored' })));
  }
}
