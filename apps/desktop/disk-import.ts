import { Worker } from 'node:worker_threads';
import { lstat, readFile, realpath, mkdir, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { newProject, parseProject } from '../../packages/workspace/src/project.ts';
import { selectImportSources, type DiskInspection, type DiskImportPreview, type DiskImportRequest } from '../../packages/cpc-disk/src/import-disk.ts';
import { durableReplace } from './save-journal.ts';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function readDisk(path: string): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== 194816) throw new Error('Choisissez un DSK standard DATA de 194 816 octets ; Extended et autres géométries ne sont pas encore pris en charge.');
  const bytes = await readFile(path);
  if (bytes.length !== 194816) throw new Error('La disquette a changé pendant sa lecture.');
  return bytes;
}
async function inspect(bytes: Uint8Array): Promise<DiskInspection> {
  const worker = new Worker(new URL(import.meta.url.endsWith('.ts') ? './disk-import-worker.ts' : './disk-import-worker.js', import.meta.url), {
    workerData: new Uint8Array(bytes), execArgv: [], env: {}, resourceLimits: { maxOldGenerationSizeMb: 32, stackSizeMb: 4 },
  });
  try {
    return await new Promise<DiskInspection>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Délai d’analyse DSK dépassé.')), 5000);
      worker.once('message', (message: { result?: DiskInspection; error?: string }) => {
        clearTimeout(timer); if (message.error || !message.result) reject(new Error(message.error ?? 'Analyse invalide.')); else resolve(message.result);
      });
      worker.once('error', error => { clearTimeout(timer); reject(error); });
      worker.once('exit', () => { clearTimeout(timer); reject(new Error('Analyse DSK interrompue.')); });
    });
  } finally { await worker.terminate(); }
}

/** One main-owned snapshot; renderer only supplies IDs, never paths or bytes. */
export class DiskImportSession {
  readonly path: string;
  readonly preview: DiskImportPreview;
  private readonly disk: Uint8Array;
  private readonly inspection: DiskInspection;
  private constructor(path: string, disk: Uint8Array, inspection: DiskInspection, preview: DiskImportPreview) {
    this.path = path; this.disk = disk; this.inspection = inspection; this.preview = preview;
  }
  static async prepare(path: string): Promise<DiskImportSession> {
    const bytes = await readDisk(path), inspection = await inspect(bytes);
    const preview: DiskImportPreview = { id: randomUUID(), name: basename(path), sha256: digest(bytes), profile: inspection.profile,
      files: inspection.files.map(({ records: _records, ...file }) => file) };
    return new DiskImportSession(path, bytes, inspection, preview);
  }
  async create(parent: string, request: DiskImportRequest): Promise<string> {
    if (request?.id !== this.preview.id) throw new Error('Aperçu DSK périmé ; analysez de nouveau la disquette.');
    const sources = selectImportSources(this.inspection, request);
    if (digest(await readDisk(this.path)) !== this.preview.sha256) throw new Error('La disquette a changé depuis l’aperçu ; aucun projet créé.');
    if ((await lstat(parent)).isSymbolicLink()) throw new Error('Dossier parent réel requis.');
    const root = await realpath(parent);
    if (!(await lstat(root)).isDirectory()) throw new Error('Dossier parent requis.');
    const id = randomUUID(), destination = join(root, `CPC-import-${id}`), staging = join(root, `.microide-import-${id}`);
    const manifest = parseProject({ ...newProject(request.name.trim(), id), entryPoint: request.entryId,
      sources: sources.map(file => ({ id: file.id, path: `src/${file.id}.bas`, cpcName: file.name })) });
    await mkdir(staging, { mode: 0o700 });
    try {
      await mkdir(join(staging, 'src'));
      const originals = join(staging, '.microide', 'imports'); await mkdir(originals, { recursive: true });
      await durableReplace(join(originals, 'original.dsk'), this.disk);
      await mkdir(join(originals, 'records'));
      for (const file of this.inspection.files) await durableReplace(join(originals, 'records', `${file.id}.bin`), file.records);
      for (const file of sources) await durableReplace(join(staging, 'src', `${file.id}.bas`), Buffer.from(file.source!));
      const report = { schemaVersion: 1, converter: 'data-ascii-import-1', profile: this.preview.profile,
        originalName: this.preview.name, sha256: this.preview.sha256, originalPath: '.microide/imports/original.dsk',
        warning: 'Seuls les listings ASCII sélectionnés sont inclus dans le build. Les autres fichiers sont conservés à titre d’originaux ; leurs dépendances ne sont pas exécutables dans le projet reconstruit.',
        files: this.inspection.files.map(file => ({ id: file.id, name: file.name, kind: file.kind, reason: file.reason,
          recordBytes: file.recordBytes, sha256: digest(file.records), originalPath: `.microide/imports/records/${file.id}.bin`,
          sourcePath: request.sourceIds.includes(file.id) ? `src/${file.id}.bas` : null })) };
      await durableReplace(join(staging, 'import-report.json'), Buffer.from(JSON.stringify(report, null, 2) + '\n'));
      await durableReplace(join(staging, 'microide.project.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
      // New UUID destination, no merge with an existing project. Keep staging on failure for recovery.
      try { await lstat(destination); throw new Error('Destination déjà occupée.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await rename(staging, destination); return destination;
    } catch (error) {
      throw new Error(`Import non publié. Les fichiers préparés sont conservés dans ${staging}. ${error instanceof Error ? error.message : ''}`);
    }
  }
}
