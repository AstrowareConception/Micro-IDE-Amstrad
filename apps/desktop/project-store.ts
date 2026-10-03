import { lstat, realpath, readFile, writeFile, rename, unlink, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseProject, newProject, addProjectSource, type ProjectManifest, type ProjectSnapshot } from '../../packages/workspace/src/project.ts';
import type { AgentWorkspaceState } from '../../packages/agent/src/types.ts';

const MANIFEST = 'microide.project.json';
const LIMIT = 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function bytes(path: string): Promise<Buffer> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > LIMIT) throw new Error('Fichier ordinaire de 1 Mio maximum requis.');
  const content = await readFile(path);
  if (content.length > LIMIT) throw new Error('Fichier trop volumineux.');
  return content;
}
function text(content: Uint8Array): string {
  if (content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) throw new Error('Source UTF-8 sans BOM requise.');
  const value = new TextDecoder('utf-8', { fatal: true }).decode(content);
  if (value.includes('\0')) throw new Error('Texte UTF-8 requis, pas un fichier tokenisé.');
  return value.replace(/\r\n?/g, '\n');
}
async function atomic(path: string, content: Uint8Array): Promise<void> {
  const temporary = join(dirname(path), `.microide-${randomUUID()}.tmp`);
  try { await writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => undefined); }
}
/** Host adapter: no renderer-supplied root, absolute path or arbitrary manifest mutation. */
export class ProjectStore {
  readonly root: string;
  readonly sessionId = randomUUID();
  manifest: ProjectManifest;
  private manifestHash: string;
  private hashes = new Map<string, string>();
  private faulted = false;
  private constructor(root: string, manifest: ProjectManifest, digest: string) { this.root = root; this.manifest = manifest; this.manifestHash = digest; }
  static async open(folder: string): Promise<{ store: ProjectStore; snapshot: ProjectSnapshot }> {
    const root = await realpath(folder);
    if (!(await lstat(root)).isDirectory()) throw new Error('Dossier de projet requis.');
    const content = await bytes(join(root, MANIFEST));
    const manifest = parseProject(JSON.parse(text(content)));
    const store = new ProjectStore(root, manifest, hash(content));
    const files = [];
    let total = 0;
    for (const source of manifest.sources) {
      const content = await bytes(await store.path(source.path)); total += content.length;
      if (total > 8 * LIMIT) throw new Error('Le projet dépasse le budget de 8 Mio de sources.');
      store.hashes.set(source.id, hash(content)); files.push({ ...source, source: text(content) });
    }
    return { store, snapshot: { sessionId: store.sessionId, manifest, files } };
  }
  static async create(folder: string, name: string): Promise<{ store: ProjectStore; snapshot: ProjectSnapshot }> {
    const manifest = newProject(name, randomUUID());
    const root = await realpath(folder);
    if ((await readdir(root)).length) throw new Error('Choisissez un dossier vide ; aucun fichier existant n’a été écrasé.');
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/main.bas'), '10 REM MICRO IDE AMSTRAD\n20 END\n', { flag: 'wx' });
    // The manifest is published last. A failed creation is never reported as a valid project.
    await writeFile(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return ProjectStore.open(root);
  }
  private async path(sourcePath: string): Promise<string> {
    let path = this.root;
    const segments = sourcePath.split('/');
    for (let i = 0; i < segments.length; i++) {
      path = join(path, segments[i]!);
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || (i < segments.length - 1 && !stat.isDirectory())) throw new Error('Lien symbolique ou jonction refusé dans le projet.');
    }
    const canonical = await realpath(path); const location = relative(this.root, canonical);
    if (location.startsWith('..') || isAbsolute(location)) throw new Error('Chemin sortant du projet refusé.');
    return canonical;
  }
  private async checkManifest(): Promise<void> {
    if (this.faulted) throw new Error('Projet bloqué après échec de restauration ; conserver le checkpoint et rouvrir après examen.');
    if (hash(await bytes(join(this.root, MANIFEST))) !== this.manifestHash) throw new Error('Le manifeste a changé sur disque. Rouvrez le projet ; aucune modification écrasée.');
  }
  assertSession(id: unknown): void { if (id !== this.sessionId) throw new Error('Session de projet périmée.'); }
  async assertCurrent(): Promise<void> { await this.checkManifest(); }
  async agentState(buffers: { id: string; source: string }[]): Promise<AgentWorkspaceState> {
    await this.checkManifest();
    if (buffers.length !== this.manifest.sources.length || new Set(buffers.map(file => file.id)).size !== buffers.length) throw new Error('Snapshot incomplet ou dupliqué.');
    const files = [];
    for (const item of this.manifest.sources) {
      const content = await bytes(await this.path(item.path));
      if (hash(content) !== this.hashes.get(item.id)) throw new Error(`${item.path} a changé sur disque.`);
      if (content.length > 65536) throw new Error('Sources disque limitées à 64 Kio pour cette tranche agent.');
      const buffer = buffers.find(file => file.id === item.id);
      if (!buffer || typeof buffer.source !== 'string' || Buffer.byteLength(buffer.source) > 65536 || buffer.source.includes('\0') || buffer.source.charCodeAt(0) === 0xfeff) throw new Error('Buffers agent UTF-8 sans BOM/NUL limités à 64 Kio par source.');
      files.push({ ...item, source: buffer.source.replace(/\r\n?/g, '\n'), saved: text(content) });
    }
    if (files.reduce((size, file) => size + Buffer.byteLength(file.source), 0) > 256 * 1024) throw new Error('Mission agent limitée à 256 Kio de buffers.');
    if (files.reduce((size, file) => size + Buffer.byteLength(file.saved), 0) > 256 * 1024) throw new Error('Mission agent limitée à 256 Kio de sources disque.');
    return { sessionId: this.sessionId, manifest: structuredClone(this.manifest), files };
  }
  /** Main-owned candidate only. Roll back a failed batch in-process; durable crash replay remains separate. */
  async applyAgentState(state: AgentWorkspaceState): Promise<void> {
    this.assertSession(state.sessionId); await this.checkManifest();
    const manifest = parseProject(state.manifest);
    if (manifest.projectId !== this.manifest.projectId || state.files.length !== manifest.sources.length || new Set(state.files.map(file => file.id)).size !== state.files.length) throw new Error('Snapshot agent invalide.');
    const before = new Map<string, { path: string; content: Buffer }>();
    for (const item of this.manifest.sources) {
      const path = await this.path(item.path), content = await bytes(path);
      if (hash(content) !== this.hashes.get(item.id)) throw new Error(`${item.path} a changé sur disque.`);
      before.set(item.id, { path, content });
    }
    const manifestBefore = await bytes(join(this.root, MANIFEST));
    const written = new Map<string, { path: string; digest: string }>();
    const removed = new Set<string>(); let manifestWritten = false;
    await this.path('src');
    try {
      for (const item of manifest.sources) {
        const file = state.files.find(file => file.id === item.id);
        if (!file || file.path !== item.path || file.cpcName !== item.cpcName || typeof file.saved !== 'string' || Buffer.byteLength(file.saved) > 65536 || file.saved.includes('\0') || file.saved.charCodeAt(0) === 0xfeff) throw new Error('Source agent invalide.');
        const oldItem = this.manifest.sources.find(source => source.id === item.id);
        if (oldItem && (oldItem.path !== item.path || oldItem.cpcName !== item.cpcName)) throw new Error('Renommage agent non disponible.');
        const content = Buffer.from(file.saved.replace(/\r\n?/g, '\n'));
        const old = before.get(item.id);
        if (old && text(old.content) === file.saved) continue; // Preserve untouched bytes, including CRLF.
        const path = old?.path ?? join(this.root, item.path);
        if (!old && item.path !== `src/${item.id}.bas`) throw new Error('Création agent limitée aux sources plates.');
        if (old) await atomic(path, content);
        else await writeFile(path, content, { flag: 'wx', mode: 0o600 });
        written.set(item.id, { path, digest: hash(content) });
      }
      if (JSON.stringify(manifest) !== JSON.stringify(this.manifest)) {
        await atomic(join(this.root, MANIFEST), Buffer.from(JSON.stringify(manifest, null, 2) + '\n')); manifestWritten = true;
      }
      for (const [id, item] of before) if (!manifest.sources.some(source => source.id === id)) { await unlink(item.path); removed.add(id); }
    } catch (error) {
      try {
        for (const [id, item] of written) {
          if (hash(await bytes(item.path)) !== item.digest) throw new Error('Conflit externe pendant rollback.');
          const old = before.get(id); if (old) await atomic(item.path, old.content); else await unlink(item.path);
        }
        for (const id of removed) { const old = before.get(id)!; await writeFile(old.path, old.content, { flag: 'wx', mode: 0o600 }); }
        if (manifestWritten) await atomic(join(this.root, MANIFEST), manifestBefore);
      } catch { this.faulted = true; throw new Error('Échec partiel et rollback incomplet : projet bloqué. Conserver le checkpoint local avant toute reprise.'); }
      throw error;
    }
    this.manifest = manifest; this.manifestHash = hash(manifestWritten ? Buffer.from(JSON.stringify(manifest, null, 2) + '\n') : manifestBefore);
    this.hashes.clear();
    for (const item of manifest.sources) this.hashes.set(item.id, written.get(item.id)?.digest ?? hash(before.get(item.id)!.content));
  }
  async save(id: string, source: string): Promise<void> {
    await this.checkManifest();
    const item = this.manifest.sources.find(item => item.id === id);
    if (!item) throw new Error('Source non déclarée.');
    const path = await this.path(item.path);
    if (hash(await bytes(path)) !== this.hashes.get(id)) throw new Error(`${item.path} a changé sur disque. Rouvrez le projet ; aucune modification écrasée.`);
    const content = Buffer.from(source.replace(/\r\n?/g, '\n'), 'utf8');
    if (content.length > LIMIT || content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf || source.includes('\0')) throw new Error('Source UTF-8 sans BOM de 1 Mio maximum requise.');
    await atomic(path, content); this.hashes.set(id, hash(content));
  }
  async add(name: string): Promise<ProjectSnapshot> {
    await this.checkManifest();
    const manifest = addProjectSource(this.manifest, name);
    const item = manifest.sources.at(-1)!;
    await this.path('src');
    const path = join(this.root, item.path);
    await writeFile(path, `10 REM ${item.cpcName}\n20 END\n`, { flag: 'wx' });
    try { await this.checkManifest(); await this.writeManifest(manifest); }
    catch (error) { throw new Error(`Source créée mais non déclarée : ${item.path}. Fichier conservé ; rouvrez le projet. ${String(error)}`); }
    // Return only the new source. Existing dirty buffers must not be replaced by disk content.
    const content = await bytes(path); this.hashes.set(item.id, hash(content));
    return { sessionId: this.sessionId, manifest, files: [{ ...item, source: text(content) }] };
  }
  async setEntry(id: string): Promise<ProjectManifest> {
    await this.checkManifest();
    const manifest = parseProject({ ...this.manifest, entryPoint: id });
    await this.writeManifest(manifest); return manifest;
  }
  private async writeManifest(manifest: ProjectManifest): Promise<void> {
    const content = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    await atomic(join(this.root, MANIFEST), content); this.manifest = manifest; this.manifestHash = hash(content);
  }
  async assertExportDestination(path: string): Promise<void> {
    // Canonicalize the parent so a directory alias cannot redirect export into the project.
    const parent = await realpath(dirname(path)); const location = relative(this.root, join(parent, path.split(/[\\/]/).at(-1)!));
    if (!location.startsWith('..') && !isAbsolute(location)) throw new Error('Exportez le DSK hors du dossier projet pour protéger ses fichiers.');
  }
}
