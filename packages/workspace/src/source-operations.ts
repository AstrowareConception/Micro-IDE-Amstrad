import { parseProject, validateSourcePath, type ProjectManifest, type ProjectSource, type SourceSnapshot } from './project.ts';
export type SourceOperation = { action: 'rename'; id: string; name: string } | { action: 'move'; id: string; path: string } | { action: 'delete'; id: string; entryPoint: string };
export interface SourcePlan { id: string; action: SourceOperation['action']; source: ProjectSource; destination?: ProjectSource; entryPoint: string }
export interface SourceMutationResult { manifest: ProjectManifest; files: SourceSnapshot[]; restoredDraft?: { id: string; source: string } }
export interface SourceUndo { revision: string; createdAt: string; files: string[] }
export interface SourceDraft { id: string; path: string; source: string }
export interface SourceOperationsPort {
  prepare(sessionId: string, request: SourceOperation): Promise<SourcePlan | { error: string }>;
  apply(sessionId: string, planId: string, source: string): Promise<SourceMutationResult | { error: string } | null>;
  last(sessionId: string): Promise<SourceUndo | { error: string } | undefined>;
  restore(sessionId: string, revision: string): Promise<SourceMutationResult | { error: string } | null>;
  draft(sessionId: string): Promise<SourceDraft | { error: string } | undefined>;
}
/** One declared source changes; identity and all other project properties survive. */
export function planSourceOperation(project: ProjectManifest, value: unknown): { manifest: ProjectManifest; action: SourceOperation['action']; source: ProjectSource; destination?: ProjectSource } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action de source requise.');
  const request = value as Record<string, unknown>, field = request.action === 'rename' ? 'name' : request.action === 'move' ? 'path' : request.action === 'delete' ? 'entryPoint' : undefined;
  if (!field || Object.keys(request).length !== 3 || !['action', 'id', field].every(key => Object.hasOwn(request, key)) || typeof request.id !== 'string' || typeof request[field] !== 'string') throw new Error('Action de source invalide.');
  const manifest = parseProject(project), source = manifest.sources.find(source => source.id === request.id);
  if (!source) throw new Error('Source non déclarée.');
  let destination: ProjectSource | undefined;
  if (request.action === 'rename') {
    const name = request.name as string;
    if (!/^[A-Za-z0-9_]{1,8}$/.test(name)) throw new Error('Nom CPC : 1–8 lettres ASCII, chiffres ou underscore.');
    destination = { ...source, path: source.path.slice(0, source.path.lastIndexOf('/') + 1) + name.toLowerCase() + '.bas', cpcName: name.toUpperCase() + '.BAS' };
  } else if (request.action === 'move') {
    const path = request.path as string; validateSourcePath(path);
    destination = { ...source, path };
  } else {
    if (manifest.sources.length === 1) throw new Error('La dernière source du projet ne peut pas être supprimée.');
    if (!manifest.sources.some(item => item.id === request.entryPoint && item.id !== source.id)) throw new Error('Choisissez une source restante comme entrée.');
  }
  if (destination && destination.path.toLowerCase() === source.path.toLowerCase() && destination.path !== source.path) throw new Error('Changement de casse seul refusé pour préserver la portabilité.');
  const after = parseProject({ ...manifest, sources: destination ? manifest.sources.map(item => item.id === source.id ? destination : item) : manifest.sources.filter(item => item.id !== source.id), entryPoint: request.action === 'delete' ? request.entryPoint : manifest.entryPoint });
  if (JSON.stringify(after) === JSON.stringify(manifest)) throw new Error('Aucun changement à appliquer.');
  return { manifest: after, action: request.action as SourceOperation['action'], source, ...(destination ? { destination } : {}) };
}
