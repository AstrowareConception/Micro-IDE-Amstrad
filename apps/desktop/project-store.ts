import { lstat, realpath, readFile, writeFile, rename, unlink, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute, basename, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseProject, newProject, addProjectSource, DOCUMENT_TOTAL_LIMIT, DOCUMENT_COUNT_LIMIT, type ProjectManifest, type ProjectSnapshot, type DocumentSnapshot, type ImageDecoder, type PdfExtractor, type PdfTextPreview } from '../../packages/workspace/src/project.ts';
import { validatePdfText } from '../../packages/workspace/src/pdf.ts';
import { readDocumentBytes, decodeDocument } from './text-document.ts';
import type { AgentWorkspaceState } from '../../packages/agent/src/types.ts';
import { saveBatch, SaveBatchFailure } from '../../packages/workspace/src/save-batch.ts';
import { SaveJournal, durableReplace, type RecoveryChoice, type RecoverySummary } from './save-journal.ts';

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
  private readonly imageDecoder: ImageDecoder | undefined;
  private readonly pdfExtractor: PdfExtractor | undefined;
  private readonly pdfCache = new Map<string, PdfTextPreview>();
  private constructor(root: string, manifest: ProjectManifest, digest: string, imageDecoder?: ImageDecoder, pdfExtractor?: PdfExtractor) { this.root = root; this.manifest = manifest; this.manifestHash = digest; this.imageDecoder = imageDecoder; this.pdfExtractor = pdfExtractor; }
  static async open(folder: string, imageDecoder?: ImageDecoder, pdfExtractor?: PdfExtractor): Promise<{ store: ProjectStore; snapshot: ProjectSnapshot }> {
    const root = await realpath(folder);
    if (!(await lstat(root)).isDirectory()) throw new Error('Dossier de projet requis.');
    const content = await bytes(join(root, MANIFEST));
    const manifest = parseProject(JSON.parse(text(content)));
    const store = new ProjectStore(root, manifest, hash(content), imageDecoder, pdfExtractor);
    await new SaveJournal(root, manifest, hash(content)).assertResolved();
    const files = [];
    let total = 0;
    for (const source of manifest.sources) {
      const content = await bytes(await store.path(source.path)); total += content.length;
      if (total > 8 * LIMIT) throw new Error('Le projet dépasse le budget de 8 Mio de sources.');
      store.hashes.set(source.id, hash(content)); files.push({ ...source, source: text(content) });
    }
    await store.agentDocuments();
    return { store, snapshot: { sessionId: store.sessionId, manifest, files } };
  }
  private static async journal(folder: string): Promise<SaveJournal> {
    const root = await realpath(folder);
    if (!(await lstat(root)).isDirectory()) throw new Error('Dossier de projet requis.');
    const content = await bytes(join(root, MANIFEST));
    return new SaveJournal(root, parseProject(JSON.parse(text(content))), hash(content));
  }
  static async recoveryStatus(folder: string): Promise<RecoverySummary | undefined> { return (await ProjectStore.journal(folder)).status(); }
  static async recoverSave(folder: string, id: string, choice: RecoveryChoice, revision?: string): Promise<void> { await (await ProjectStore.journal(folder)).recover(id, choice, revision); }
  static async create(folder: string, name: string, imageDecoder?: ImageDecoder, pdfExtractor?: PdfExtractor): Promise<{ store: ProjectStore; snapshot: ProjectSnapshot }> {
    const manifest = newProject(name, randomUUID());
    const root = await realpath(folder);
    if ((await readdir(root)).length) throw new Error('Choisissez un dossier vide ; aucun fichier existant n’a été écrasé.');
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/main.bas'), '10 REM MICRO IDE AMSTRAD\n20 END\n', { flag: 'wx' });
    // The manifest is published last. A failed creation is never reported as a valid project.
    await writeFile(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return ProjectStore.open(root, imageDecoder, pdfExtractor);
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
    if (this.faulted) throw new Error('Projet bloqué après échec de restauration ; conserver les versions locales et rouvrir après examen.');
    if (hash(await bytes(join(this.root, MANIFEST))) !== this.manifestHash) throw new Error('Le manifeste a changé sur disque. Rouvrez le projet ; aucune modification écrasée.');
  }
  assertSession(id: unknown): void { if (id !== this.sessionId) throw new Error('Session de projet périmée.'); }
  async assertCurrent(): Promise<void> { await this.checkManifest(); }
  private async documentView(content: Uint8Array, mediaType: ProjectManifest['documents'][number]['mediaType']) {
    if (mediaType === 'application/pdf') {
      if (!this.pdfExtractor) throw new Error('unsupported-capability : extracteur PDF desktop requis.');
      const digest = hash(content), cached = this.pdfCache.get(digest);
      if (cached) return structuredClone(cached);
      const result = validatePdfText(await this.pdfExtractor(content));
      // Session-local, bounded cache; originals are still read and hashed on every access.
      if (this.pdfCache.size >= DOCUMENT_COUNT_LIMIT) this.pdfCache.delete(this.pdfCache.keys().next().value!);
      this.pdfCache.set(digest, structuredClone(result)); return result;
    }
    if (mediaType.startsWith('image/')) {
      if (!this.imageDecoder) throw new Error('unsupported-capability : décodeur image desktop requis.');
      return this.imageDecoder(content, mediaType);
    }
    return { text: decodeDocument(content) };
  }
  async readDocument(id: unknown): Promise<DocumentSnapshot> {
    await this.checkManifest();
    const item = this.manifest.documents.find(item => item.id === id);
    if (!item) throw new Error('scope-denied : document non déclaré.');
    const content = await readDocumentBytes(await this.path(item.path));
    if (hash(content) !== item.sha256) throw new Error(`stale-read : ${item.originalName} a changé sur disque ; original documentaire refusé.`);
    return { ...item, ...await this.documentView(content, item.mediaType), bytes: content.length };
  }
  async agentDocuments(): Promise<DocumentSnapshot[]> {
    const result: DocumentSnapshot[] = []; let total = 0;
    for (const item of this.manifest.documents) {
      const document = await this.readDocument(item.id); total += document.bytes;
      if (total > DOCUMENT_TOTAL_LIMIT) throw new Error('Documents limités à 4 Mio par projet dans cette alpha.');
      result.push(document);
    }
    return result;
  }
  async importDocument(selected: string): Promise<ProjectManifest> {
    await this.checkManifest();
    if (this.manifest.documents.length >= DOCUMENT_COUNT_LIMIT) throw new Error('10 documents maximum dans cette alpha.');
    const extension = extname(selected).toLowerCase();
    const mediaTypes: Record<string, ProjectManifest['documents'][number]['mediaType']> = { '.txt': 'text/plain', '.md': 'text/markdown', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };
    const mediaType = mediaTypes[extension];
    if (!mediaType) throw new Error('Choisissez un fichier TXT, MD, PNG, JPEG ou PDF.');
    const content = await readDocumentBytes(selected); await this.documentView(content, mediaType);
    const existing = await this.agentDocuments();
    if (existing.reduce((total, item) => total + item.bytes, content.length) > DOCUMENT_TOTAL_LIMIT) throw new Error('Documents limités à 4 Mio par projet dans cette alpha.');
    const id = `doc-${randomUUID()}`, path = `documents/${id}${extension}`;
    const manifest = parseProject({ ...this.manifest, documents: [...this.manifest.documents, {
      id, path, sha256: hash(content), mediaType, role: 'context', originalName: basename(selected),
    }] });
    await mkdir(join(this.root, 'documents')).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    await this.path('documents');
    const destination = join(this.root, path);
    await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
    try { await this.checkManifest(); await this.writeManifest(manifest); }
    catch (error) {
      // Remove only our verified unpublished copy. Never erase a concurrent external edit.
      if (hash(await readDocumentBytes(destination)) === hash(content)) await unlink(destination);
      throw error;
    }
    return manifest;
  }
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
    if (JSON.stringify(manifest.documents) !== JSON.stringify(this.manifest.documents)) throw new Error('stale-read : documents du projet modifiés depuis la mission ; restauration refusée.');
    await this.agentDocuments();
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
  async saveAll(buffers: { id: string; source: string }[]): Promise<{ name: string; savedIds: string[]; changedCount: number }> {
    await this.checkManifest();
    if (!Array.isArray(buffers) || buffers.length !== this.manifest.sources.length || new Set(buffers.map(item => item?.id)).size !== buffers.length)
      throw new Error('Snapshot de sauvegarde incomplet ou dupliqué.');
    const entries = []; let total = 0;
    for (const item of this.manifest.sources) {
      const buffer = buffers.find(buffer => buffer?.id === item.id);
      if (!buffer || typeof buffer.source !== 'string' || buffer.source.length > LIMIT || buffer.source.includes('\0') || buffer.source.charCodeAt(0) === 0xfeff)
        throw new Error('Sources de sauvegarde UTF-8 sans BOM/NUL de 1 Mio maximum requises.');
      const content = Buffer.from(buffer.source.replace(/\r\n?/g, '\n')); total += content.length;
      if (content.length > LIMIT || total > 8 * LIMIT) throw new Error('Sauvegarde limitée à 1 Mio/source et 8 Mio/projet.');
      const before = await bytes(await this.path(item.path));
      if (hash(before) !== this.hashes.get(item.id)) throw new Error(`${item.path} a changé sur disque. Aucune source enregistrée ; rouvrez le projet.`);
      // Preserve unchanged original bytes (including CRLF), and their timestamps.
      entries.push({ id: item.id, path: item.path, before, after: text(before) === buffer.source.replace(/\r\n?/g, '\n') ? before : content });
    }
    const sourcePath = (id: string) => this.manifest.sources.find(item => item.id === id)!.path;
    const journal = new SaveJournal(this.root, this.manifest, this.manifestHash);
    if (entries.every(entry => hash(entry.before) === hash(entry.after))) { await journal.assertResolved(); return { name: this.manifest.name, savedIds: entries.map(entry => entry.id), changedCount: 0 }; }
    let transaction: string;
    try { transaction = await journal.prepare(entries); }
    catch (error) { this.faulted = true; throw new Error(`Préparation du journal impossible ; sources non écrites. Rouvrez le projet. ${String(error)}`); }
    let changed: string[];
    try {
      changed = await saveBatch(entries, {
        assertCurrent: () => this.checkManifest(),
        read: async id => bytes(await this.path(sourcePath(id))),
        write: async (id, content) => durableReplace(await this.path(sourcePath(id)), content, false),
      });
      await journal.flushSources();
      await journal.mark(transaction, 'committed');
    } catch (error) {
      if (error instanceof SaveBatchFailure && !error.incomplete) {
        try { await journal.flushSources(); await journal.mark(transaction, 'rolled-back'); }
        catch { this.faulted = true; throw new Error('Journal conservé après erreur ; rouvrir le projet pour récupérer la sauvegarde.'); }
      } else {
        this.faulted = true;
        throw new Error(`Sauvegarde interrompue ; journal conservé. Rouvrez le projet pour récupérer. ${String(error)}`);
      }
      throw error;
    }
    for (const entry of entries) this.hashes.set(entry.id, hash(entry.after));
    return { name: this.manifest.name, savedIds: entries.map(item => item.id), changedCount: changed.length };
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
