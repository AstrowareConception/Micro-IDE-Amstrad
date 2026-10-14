import type { DocumentSnapshot, ProjectDocument, ProjectManifest } from './project.ts';
export const KNOWLEDGE_CATEGORIES = { reference: 'Références techniques', design: 'Conception du projet', progress: 'Suivi du développement', resource: 'Ressources documentaires' } as const;
export type KnowledgeCategory = keyof typeof KNOWLEDGE_CATEGORIES;
export type KnowledgeAccess = 'excluded' | 'available' | 'essential';
export interface KnowledgeVersion { path: string; sha256: string; savedAt: string }
export interface KnowledgeMetadata { category: KnowledgeCategory; editable: boolean; access: KnowledgeAccess; versions: KnowledgeVersion[] }
export type KnowledgeRequest =
  | { action: 'create'; title: string; source: string; category: KnowledgeCategory }
  | { action: 'save'; id: string; revision: string; source: string }
  | { action: 'configure'; id: string; revision: string; category: KnowledgeCategory; access: KnowledgeAccess }
  | { action: 'restore'; id: string; revision: string; path: string };
export interface KnowledgeResult { manifest: ProjectManifest; document: DocumentSnapshot }
export interface KnowledgePort { write(sessionId: string, request: KnowledgeRequest): Promise<KnowledgeResult | { error: string }> }
export function parseKnowledge(value: unknown, mediaType: string): KnowledgeMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Métadonnées de connaissances invalides.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['category','editable','access','versions'].includes(k)) || typeof v.category !== 'string' || !Object.hasOwn(KNOWLEDGE_CATEGORIES,v.category) || typeof v.editable !== 'boolean' || !['excluded','available','essential'].includes(String(v.access)) || !Array.isArray(v.versions) || v.versions.length > 10) throw Error('Métadonnées de connaissances invalides.');
  if (v.editable && mediaType !== 'text/markdown' || v.access === 'essential' && !['text/plain','text/markdown'].includes(mediaType) || !v.editable && v.versions.length) throw Error('Mode documentaire incompatible avec le format.');
  const versions = v.versions.map((item: unknown): KnowledgeVersion => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Version documentaire invalide.');
    const x = item as Record<string, unknown>;
    if (Object.keys(x).length !== 3 || typeof x.path !== 'string' || !/^documents\/note-[a-f0-9-]+\.md$/.test(x.path) || typeof x.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(x.sha256) || typeof x.savedAt !== 'string' || !Number.isFinite(Date.parse(x.savedAt)) || new Date(x.savedAt).toISOString() !== x.savedAt) throw Error('Version documentaire invalide.');
    return { path: x.path, sha256: x.sha256, savedAt: x.savedAt };
  });
  return { category: v.category as KnowledgeCategory, editable:v.editable, access:v.access as KnowledgeAccess, versions };
}
export function documentAllowed(document: ProjectDocument, includeLegacy: boolean): boolean {
  return document.knowledge ? document.knowledge.access !== 'excluded' : includeLegacy;
}
/** Bounded bootstrap data; never instructions or permissions. Full text remains available through tools. */
export function knowledgeContext(documents: DocumentSnapshot[]) {
  let remaining = 12000;
  return documents.filter(d => d.knowledge?.access === 'essential' && 'text' in d).map(d => {
    const source = 'text' in d ? d.text : '', text = source.slice(0,Math.min(4000,remaining)); remaining -= text.length;
    return { id:d.id, originalName:d.originalName, sha256:d.sha256, text, truncated:text.length < source.length, trust:'project-document-data' };
  });
}
