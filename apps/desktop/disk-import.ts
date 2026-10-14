import { Worker } from 'node:worker_threads';
import { lstat, readFile, realpath, mkdir, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { newProject, parseProject } from '../../packages/workspace/src/project.ts';
import { inspectCpcFile, selectImportSources, importCapacity, type DiskInspection, type DiskImportPreview, type DiskImportRequest } from '../../packages/cpc-disk/src/import-disk.ts';
import { z80Listing } from '../../packages/z80/src/disassemble.ts';
import { durableReplace } from './save-journal.ts';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function readDisk(path: string): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 1024 * 1024) throw new Error('Choisissez un DSK ordinaire de 1 Mio maximum.');
  const bytes = await readFile(path);
  if (bytes.length !== stat.size) throw new Error('La disquette a changé pendant sa lecture.');
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
    const preview: DiskImportPreview = { id: randomUUID(), name: basename(path), sha256: digest(bytes), profile: inspection.profile, ...(inspection.warnings ? { warnings: inspection.warnings } : {}),
      files: inspection.files.map(({ records: _records, ...file }) => file) };
    return new DiskImportSession(path, bytes, inspection, preview);
  }
  static async prepareFile(path:string):Promise<DiskImportSession> {
    const bytes=await readDisk(path);
    if(bytes.length>65536+128) throw new Error('Fichier CPC limité à 65 664 octets.');
    const name=basename(path).toUpperCase();
    if(!/^[A-Z0-9_&]{1,8}(?:\.[A-Z0-9_&]{1,3})?$/.test(name)) throw new Error('Nom CPC 8.3 requis pour conserver le nom sans ambiguïté.');
    const file=inspectCpcFile(name,bytes), inspection:DiskInspection={profile:'cpc-file',files:[file]};
    const {records:_,...view}=file;
    return new DiskImportSession(path,bytes,inspection,{id:randomUUID(),name:basename(path),sha256:digest(bytes),profile:'cpc-file',files:[view]});
  }
  getFile(id:string, fileId:string) {
    if(id!==this.preview.id)throw new Error('Aperçu périmé.');
    const file=this.inspection.files.find(file=>file.id===fileId);
    if(!file)throw new Error('Fichier absent.');
    return file;
  }
  disassemble(request:{id:string;fileId:string;offset:number;length:number;origin:number}):string {
    const file=this.getFile(request.id,request.fileId);
    const bytes=file.payloadBytes===undefined?file.records:file.records.subarray(128,128+file.payloadBytes);
    if(!Number.isInteger(request.offset)||request.offset<0||!Number.isInteger(request.length)||request.length<1||request.offset+request.length>bytes.length)throw new Error('Plage hors fichier.');
    return '; Fichier '+file.name+' — SHA-256 '+digest(file.records)+'\n'+z80Listing(bytes.slice(request.offset,request.offset+request.length),request.origin,request.offset+(file.payloadBytes===undefined?0:128));
  }
  async create(parent: string, request: DiskImportRequest): Promise<string> {
    if (request?.id !== this.preview.id) throw new Error('Aperçu DSK périmé ; analysez de nouveau la disquette.');
    const sources = selectImportSources(this.inspection, request);
    if (digest(await readDisk(this.path)) !== this.preview.sha256) throw new Error('La disquette a changé depuis l’aperçu ; aucun projet créé.');
    if ((await lstat(parent)).isSymbolicLink()) throw new Error('Dossier parent réel requis.');
    const root = await realpath(parent);
    if (!(await lstat(root)).isDirectory()) throw new Error('Dossier parent requis.');
    const id = randomUUID(), destination = join(root, `CPC-import-${id}`), staging = join(root, `.microide-import-${id}`);
    const assets = this.inspection.files.filter(file => !request.sourceIds.includes(file.id));
    const manifest = parseProject({ ...newProject(request.name.trim(), id), ...(request.kind === 'binary' ? { kind: 'binary' as const } : {}), entryPoint: request.entryId,
      assets: assets.map(file => ({ id: file.id, path: `assets/${file.id}.bin`, cpcName: file.name, sha256: digest(file.records), byteLength: file.records.length })),
      sources: sources.map(file => ({ id: file.id, path: `src/${file.id}.bas`, cpcName: file.name })) });
    await mkdir(staging, { mode: 0o700 });
    try {
      await mkdir(join(staging, 'src'));
      await mkdir(join(staging, 'assets'));
      for (const file of assets) await durableReplace(join(staging, 'assets', `${file.id}.bin`), file.records);
      const originals = join(staging, '.microide', 'imports'); await mkdir(originals, { recursive: true });
      await durableReplace(join(originals, this.preview.profile==='cpc-file'?'original.bin':'original.dsk'), this.disk);
      await mkdir(join(originals, 'records'));
      for (const file of this.inspection.files) await durableReplace(join(originals, 'records', `${file.id}.bin`), file.records);
      for (const file of sources) await durableReplace(join(staging, 'src', `${file.id}.bas`), Buffer.from(file.source!));
      const report = { schemaVersion: 1, converter: 'basic-resources-import-3', profile: this.preview.profile,
        warnings: this.inspection.warnings ?? [], capacity: importCapacity(this.preview.files, request.sourceIds), originalName: this.preview.name, sha256: this.preview.sha256, originalPath: `.microide/imports/original.${this.preview.profile==='cpc-file'?'bin':'dsk'}`,
        warning: 'Les sources sélectionnées sont reconstruites ; tous les autres fichiers sont inclus comme ressources brutes inchangées. Les secteurs spéciaux et protections disque ne sont pas reproduits.',
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
