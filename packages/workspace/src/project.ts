import { encodeListing } from '../../basic-language/src/build.ts';
import { createDataDisk, readDataDisk } from '../../cpc-disk/src/data-disk.ts';

export interface ProjectSource { id: string; path: string; cpcName: string }
export interface ProjectManifest {
  schemaVersion: 1; projectId: string; name: string;
  target: { machineProfileId: 'cpc6128-classic-v1'; dialect: 'locomotive-1.1'; expectedFirmwareSetId?: string };
  entryPoint: string; sources: ProjectSource[]; assets: []; documents: [];
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
/** Supported v1 subset. Assets/documents and other encodings are explicitly refused, never dropped. */
export function parseProject(value: unknown): ProjectManifest {
  const root = object(value, ['schemaVersion', 'projectId', 'name', 'target', 'entryPoint', 'sources', 'assets', 'documents', 'build']);
  if (root.schemaVersion !== 1) throw new Error('Version de projet non prise en charge ; aucun fichier modifié.');
  const projectId = string(root.projectId, UUID);
  if (typeof root.name !== 'string' || root.name.length < 1 || root.name.length > 100 || !root.name.trim()) throw new Error('Nom de projet requis (1–100 caractères).');
  const target = object(root.target, ['machineProfileId', 'dialect'], ['expectedFirmwareSetId']);
  if (target.machineProfileId !== 'cpc6128-classic-v1' || target.dialect !== 'locomotive-1.1') throw new Error('Profil CPC 6128 / BASIC 1.1 requis.');
  if (!Array.isArray(root.assets) || root.assets.length || !Array.isArray(root.documents) || root.documents.length)
    throw new Error('Cette alpha ouvre les projets BASIC sans ressources ni documents. Leur prise en charge reste à réaliser.');
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
  const entryPoint = string(root.entryPoint, ID);
  if (!sources.some(source => source.id === entryPoint)) throw new Error('Le point d’entrée doit référencer une source déclarée.');
  const result: ProjectManifest = { schemaVersion: 1, projectId, name: root.name, target: { machineProfileId: 'cpc6128-classic-v1', dialect: 'locomotive-1.1' }, entryPoint, sources, assets: [], documents: [], build: supported };
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
