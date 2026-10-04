import { encodeListing } from '../../basic-language/src/build.ts';
import { createDataDisk, readDataDisk } from '../../cpc-disk/src/data-disk.ts';

export interface ProjectSource { id: string; path: string; cpcName: string }
export interface ProjectDocument {
  id: string; path: string; sha256: string; mediaType: 'text/plain' | 'text/markdown' | 'image/png' | 'image/jpeg' | 'application/pdf';
  role: 'context' | 'inspiration' | 'asset-source'; originalName: string;
}
export interface DocumentText extends ProjectDocument { text: string; bytes: number }
export interface ImagePreview { dataUrl: string; width: number; height: number; previewWidth: number; previewHeight: number }
export interface DocumentImage extends ProjectDocument, ImagePreview { bytes: number }
export interface PdfPageText { page: number; text: string }
export interface PdfTextPreview { pages: PdfPageText[]; pageCount: number; extraction: 'pdfjs-text-v1' }
export interface DocumentPdf extends ProjectDocument, PdfTextPreview { bytes: number }
export type DocumentSnapshot = DocumentText | DocumentImage | DocumentPdf;
export type ImageDecoder = (bytes: Uint8Array, mediaType: ProjectDocument['mediaType']) => Promise<ImagePreview>;
export type PdfExtractor = (bytes: Uint8Array) => Promise<PdfTextPreview>;
export const DOCUMENT_LIMIT = 1024 * 1024;
export const DOCUMENT_TOTAL_LIMIT = 4 * DOCUMENT_LIMIT;
export const DOCUMENT_COUNT_LIMIT = 10;
export interface ProjectManifest {
  schemaVersion: 1; projectId: string; name: string;
  target: { machineProfileId: 'cpc6128-classic-v1'; dialect: 'locomotive-1.1'; expectedFirmwareSetId?: string };
  entryPoint: string; sources: ProjectSource[]; assets: []; documents: ProjectDocument[];
  build: { listingFormat: 'ascii'; diskFormat: 'standard-dsk'; filesystem: 'amsdos-data'; textEncoding: 'ascii-strict'; lineEnding: 'crlf'; asciiEof: 'ctrl-z'; fileOrder: 'cpc-name' };
}
export interface SourceSnapshot extends ProjectSource { source: string }
export interface ProjectSnapshot { sessionId: string; manifest: ProjectManifest; files: SourceSnapshot[] }
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = /^(?:[A-Za-z0-9_][A-Za-z0-9_. -]*\/)*[A-Za-z0-9_][A-Za-z0-9_. -]*$/;
function object(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objet de manifeste requis.');
  const result = value as Record<string, unknown>;
  if (required.some(key => !Object.hasOwn(result, key)) || Object.keys(result).some(key => ![...required, ...optional].includes(key)))
    throw new Error('Propriété absente ou inconnue dans le manifeste.');
  return result;
}
function string(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('Valeur de manifeste invalide.');
  return value;
}
export function validateSourcePath(path: string): void {
  if (path.length > 240 || !PATH.test(path) || !path.startsWith('src/') || !path.toLowerCase().endsWith('.bas')) throw new Error('Chemin BASIC relatif sous src/ requis.');
  for (const segment of path.split('/')) {
    if (/[. ]$/.test(segment) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment)) throw new Error('Nom non portable sur Windows.');
  }
}
/** Supported v1 subset. Binary assets, WebP and other encodings are refused. */
export function parseProject(value: unknown): ProjectManifest {
  const root = object(value, ['schemaVersion', 'projectId', 'name', 'target', 'entryPoint', 'sources', 'assets', 'documents', 'build']);
  if (root.schemaVersion !== 1) throw new Error('Version de projet non prise en charge ; aucun fichier modifié.');
  const projectId = string(root.projectId, UUID);
  if (typeof root.name !== 'string' || root.name.length < 1 || root.name.length > 100 || !root.name.trim()) throw new Error('Nom de projet requis (1–100 caractères).');
  const target = object(root.target, ['machineProfileId', 'dialect'], ['expectedFirmwareSetId']);
  if (target.machineProfileId !== 'cpc6128-classic-v1' || target.dialect !== 'locomotive-1.1') throw new Error('Profil CPC 6128 / BASIC 1.1 requis.');
  if (!Array.isArray(root.assets) || root.assets.length) throw new Error('Ressources binaires non prises en charge dans cette alpha.');
  if (!Array.isArray(root.documents) || root.documents.length > DOCUMENT_COUNT_LIMIT) throw new Error('10 documents maximum dans cette alpha.');
  const documents: ProjectDocument[] = root.documents.map(value => {
    const item = object(value, ['id', 'path', 'sha256', 'mediaType', 'role', 'originalName']);
    const id = string(item.id, ID), path = string(item.path, PATH);
    if (path.length > 240 || !path.startsWith('documents/') || path.split('/').some(segment => /[. ]$/.test(segment) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))) throw new Error('Chemin documentaire relatif portable sous documents/ requis.');
    const extensions: Record<string, RegExp> = { 'text/plain': /\.txt$/i, 'text/markdown': /\.md$/i, 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i, 'application/pdf': /\.pdf$/i };
    if (typeof item.mediaType !== 'string' || !Object.hasOwn(extensions, item.mediaType)) throw new Error('Seuls TXT, Markdown, PNG, JPEG et PDF sont pris en charge dans cette alpha.');
    if (!extensions[item.mediaType]!.test(path)) throw new Error('Extension documentaire incohérente.');
    if (!['context', 'inspiration', 'asset-source'].includes(item.role as string)) throw new Error('Rôle documentaire invalide.');
    if (typeof item.originalName !== 'string' || !item.originalName.trim() || item.originalName.length > 255 || /[\x00-\x1f\x7f/\\]/.test(item.originalName)) throw new Error('Nom original documentaire invalide.');
    return { id, path, sha256: string(item.sha256, /^[a-f0-9]{64}$/), mediaType: item.mediaType as ProjectDocument['mediaType'], role: item.role as ProjectDocument['role'], originalName: item.originalName };
  });
  const build = object(root.build, ['listingFormat', 'diskFormat', 'filesystem', 'textEncoding', 'lineEnding', 'asciiEof', 'fileOrder']);
  const supported: ProjectManifest['build'] = { listingFormat: 'ascii', diskFormat: 'standard-dsk', filesystem: 'amsdos-data', textEncoding: 'ascii-strict', lineEnding: 'crlf', asciiEof: 'ctrl-z', fileOrder: 'cpc-name' };
  if (Object.entries(supported).some(([key, item]) => build[key] !== item)) throw new Error('Recette de construction non prise en charge.');
  if (!Array.isArray(root.sources) || root.sources.length < 1 || root.sources.length > 64) throw new Error('Le projet doit contenir 1 à 64 sources.');
  const sources = root.sources.map(value => {
    const source = object(value, ['id', 'path', 'cpcName']);
    const id = string(source.id, ID); const path = string(source.path, PATH); validateSourcePath(path);
    return { id, path, cpcName: string(source.cpcName, /^[A-Z0-9_]{1,8}\.BAS$/) };
  });
  for (const field of ['id', 'path', 'cpcName'] as const) {
    if (new Set(sources.map(source => source[field].toLowerCase())).size !== sources.length) throw new Error(`Collision de ${field} dans les sources.`);
  }
  for (const field of ['id', 'path'] as const) {
    const values = [...sources, ...documents].map(item => item[field].toLowerCase());
    if (new Set(values).size !== values.length) throw new Error(`Collision de ${field} dans le projet.`);
  }
  const entryPoint = string(root.entryPoint, ID);
  if (!sources.some(source => source.id === entryPoint)) throw new Error('Le point d’entrée doit référencer une source déclarée.');
  const result: ProjectManifest = { schemaVersion: 1, projectId, name: root.name, target: { machineProfileId: 'cpc6128-classic-v1', dialect: 'locomotive-1.1' }, entryPoint, sources, assets: [], documents, build: supported };
  if (target.expectedFirmwareSetId !== undefined) result.target.expectedFirmwareSetId = string(target.expectedFirmwareSetId, ID);
  return result;
}
export function newProject(name: string, projectId: string): ProjectManifest {
  return parseProject({ schemaVersion: 1, projectId, name, target: { machineProfileId: 'cpc6128-classic-v1', dialect: 'locomotive-1.1' }, entryPoint: 'main',
    sources: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }], assets: [], documents: [],
    build: { listingFormat: 'ascii', diskFormat: 'standard-dsk', filesystem: 'amsdos-data', textEncoding: 'ascii-strict', lineEnding: 'crlf', asciiEof: 'ctrl-z', fileOrder: 'cpc-name' } });
}
export function addProjectSource(project: ProjectManifest, name: string): ProjectManifest {
  if (!/^[A-Za-z0-9_]{1,8}$/.test(name)) throw new Error('Nom de source : 1–8 lettres ASCII, chiffres ou underscore.');
  return parseProject({ ...project, sources: [...project.sources, { id: name.toLowerCase(), path: `src/${name.toLowerCase()}.bas`, cpcName: `${name.toUpperCase()}.BAS` }] });
}
export function buildProjectDisk(project: ProjectManifest, snapshots: { id: string; source: string }[]): Uint8Array {
  const manifest = parseProject(project);
  if (snapshots.length !== manifest.sources.length || new Set(snapshots.map(source => source.id)).size !== snapshots.length) throw new Error('Snapshot de sources incomplet ou dupliqué.');
  const files = manifest.sources.map(item => {
    const buffer = snapshots.find(source => source.id === item.id);
    if (!buffer) throw new Error(`Snapshot absent : ${item.path}`);
    try { return { name: item.cpcName, bytes: encodeListing(buffer.source) }; }
    catch (error) { throw new Error(`${item.path} : ${error instanceof Error ? error.message : 'Échec d’encodage'}`); }
  });
  const disk = createDataDisk(files); readDataDisk(disk); return disk;
}
