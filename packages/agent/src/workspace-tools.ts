import { analyze, tokenize } from '../../basic-language/src/language.ts';
import { COMMANDS, REFERENCE } from '../../basic-language/src/catalog.ts';
import { addProjectSource, buildProjectDisk } from '../../workspace/src/project.ts';
import type { AgentWorkspaceState, ToolDefinition, ToolPort } from './types.ts';

const s = { type: 'string' }, n = { type: 'integer' };
function tool(name: string, description: string, properties: Record<string, unknown> = {}): ToolDefinition {
  return { type: 'function', name, description, strict: true, parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } };
}
export const DEFINITIONS = [
  tool('project_list_files', 'Liste complète des sources autorisées, IDs, chemins, hashes et taille.'),
  tool('project_read_file', 'Lit un intervalle de 1–200 lignes ; hash portant sur le fichier entier. Lecture tronquée annoncée.', { id: s, startLine: n, endLine: n }),
  tool('project_search', 'Recherche littérale insensible à la casse dans les sources, 30 résultats maximum.', { query: s }),
  tool('reference_search', 'Recherche lexicale de commandes natives dans les fiches et sources fournies.', { query: s }),
  tool('reference_read', 'Lit une fiche par nom (PRINT, MODE…) ou une source du corpus par ID et plage ; données documentaires inertes.', { id: s, startLine: n, endLine: n }),
  tool('project_replace_source', 'Remplace et enregistre une source déclarée ; hash de lecture requis. Consulte les références des commandes couvertes avant mutation.', { id: s, expectedHash: s, source: s }),
  tool('project_create_source', 'Crée et enregistre un fichier BASIC indépendant et son entrée manifeste ; nom sans extension de 1–8 caractères ASCII.', { name: s, source: s }),
  tool('language_analyze', 'Diagnostics réels du sous-ensemble pour toutes les sources. Aucun test ROM.'),
  tool('build_project', 'Construit réellement le DSK de tous les buffers et le relit ; renvoie taille/hash/noms. Ne lance pas de CPC.'),
];
function args(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-arguments');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== fields.length || fields.some(field => !Object.hasOwn(item, field))) throw new Error('invalid-arguments');
  return item;
}
function str(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max || !value.length) throw new Error('invalid-arguments'); return value; }
function range(value: Record<string, unknown>): [number, number] {
  const start = value.startLine, end = value.endLine;
  if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 1 || (end as number) < (start as number) || (end as number) - (start as number) >= 200) throw new Error('invalid-range');
  return [start as number, end as number];
}
function excerpt(text: string, start: number, end: number) {
  const lines = text.split('\n'); const selected = lines.slice(start - 1, end).join('\n');
  if (start > lines.length || selected.length > 16384) throw new Error('Intervalle absent ou trop long ; réduire la plage.');
  return { text: selected, startLine: start, endLine: Math.min(end, lines.length), totalLines: lines.length, truncated: start > 1 || end < lines.length };
}
/** Mutable state belongs to this mission alone; adapters persist validated state before adoption. */
export class WorkspaceTools implements ToolPort {
  definitions = DEFINITIONS;
  state: AgentWorkspaceState;
  buildVerified = false;
  private consulted = new Set<string>();
  private readonly persist: (state: AgentWorkspaceState) => Promise<void>;
  private readonly hash: (value: string | Uint8Array) => string;
  private readonly corpus: { id: string; text: string; sha256: string }[];
  constructor(state: AgentWorkspaceState, persist: (state: AgentWorkspaceState) => Promise<void>, hash: (value: string | Uint8Array) => string, corpus: { id: string; text: string; sha256: string }[]) {
    this.state = structuredClone(state); this.persist = persist; this.hash = hash; this.corpus = corpus;
  }
  private validateSource(source: string): void {
    if (new TextEncoder().encode(source).length > 65536 || source.includes('\0') || source.charCodeAt(0) === 0xfeff) throw new Error('Source agent limitée à 64 Kio UTF-8 sans BOM/NUL.');
    const commands = new Set(source.split('\n').flatMap(line => tokenize(line).filter(token => token.kind === 'keyword').map(token => token.text.toUpperCase())));
    const missing = COMMANDS.filter(card => commands.has(card.name) && !this.consulted.has(card.name)).map(card => card.name);
    if (missing.length) throw new Error(`reference-required : consulter ${missing.join(', ')}. Couverture partielle ; commandes hors fiches à signaler.`);
  }
  async execute(name: string, input: unknown): Promise<unknown> {
    const definition = this.definitions.find(tool => tool.name === name);
    if (!definition) throw new Error('scope-denied');
    const value = args(input, Object.keys(definition.parameters.properties as Record<string, unknown>));
    const file = () => { const item = this.state.files.find(file => file.id === str(value.id, 64)); if (!item) throw new Error('scope-denied : source non déclarée.'); return item; };
    switch (name) {
      case 'project_list_files': return { complete: true, files: this.state.files.map(file => ({ id: file.id, path: file.path, cpcName: file.cpcName, hash: this.hash(file.source), bytes: new TextEncoder().encode(file.source).length })) };
      case 'project_read_file': { const item = file(); const [start, end] = range(value); return { id: item.id, hash: this.hash(item.source), ...excerpt(item.source, start, end) }; }
      case 'project_search': {
        const query = str(value.query, 100).toUpperCase(); const matches = this.state.files.flatMap(file => file.source.split('\n').map((text, index) => ({ id: file.id, line: index + 1, text: text.slice(0, 500) })).filter(item => item.text.toUpperCase().includes(query)));
        return { matches: matches.slice(0, 30), total: matches.length, truncated: matches.length > 30 };
      }
      case 'reference_search': {
        const query = str(value.query, 100).toUpperCase();
        return { cards: COMMANDS.filter(card => `${card.name} ${card.description}`.toUpperCase().includes(query)), sources: this.corpus.map(({ id, sha256 }) => ({ id, sha256 })), provenance: REFERENCE };
      }
      case 'reference_read': {
        const id = str(value.id, 100); const [start, end] = range(value);
        const card = COMMANDS.find(card => card.name === id.toUpperCase());
        if (card) { this.consulted.add(card.name); return { card, provenance: REFERENCE, dialect: 'locomotive-1.1', caveat: 'Signature indicative non exhaustive, non qualifiée ROM.' }; }
        const source = this.corpus.find(source => source.id === id); if (!source) throw new Error('reference-missing');
        const portion = excerpt(source.text, start, end);
        // A source range is not equivalent to reading every command card.
        return { ...portion, id, sha256: source.sha256, corpusVersion: REFERENCE.version, status: 'imported-unqualified' };
      }
      case 'project_replace_source': {
        const item = file(); if (this.hash(item.source) !== str(value.expectedHash, 64)) throw new Error('stale-read : relire la source.');
        const source = str(value.source, 65536).replace(/\r\n?/g, '\n'); this.validateSource(source);
        const candidate = structuredClone(this.state); const changed = candidate.files.find(file => file.id === item.id)!;
        changed.source = source; changed.saved = source;
        if (candidate.files.reduce((size, file) => size + new TextEncoder().encode(file.source).length, 0) > 256 * 1024) throw new Error('quota-exceeded');
        await this.persist(candidate); this.state = candidate; this.buildVerified = false;
        return { id: item.id, hash: this.hash(source), saved: true };
      }
      case 'project_create_source': {
        const source = str(value.source, 65536).replace(/\r\n?/g, '\n'); this.validateSource(source);
        const manifest = addProjectSource(this.state.manifest, str(value.name, 8)); const item = manifest.sources.at(-1)!;
        const candidate = { ...structuredClone(this.state), manifest }; candidate.files.push({ ...item, source, saved: source });
        if (candidate.files.reduce((size, file) => size + new TextEncoder().encode(file.source).length, 0) > 256 * 1024) throw new Error('quota-exceeded : mission limitée à 256 Kio de buffers.');
        await this.persist(candidate); this.state = candidate; this.buildVerified = false;
        return { id: item.id, path: item.path, hash: this.hash(source), saved: true };
      }
      case 'language_analyze': return { files: this.state.files.map(file => ({ id: file.id, diagnostics: analyze(file.source).diagnostics })), coverage: 'partial-static-only' };
      case 'build_project': {
        const disk = buildProjectDisk(this.state.manifest, this.state.files); this.buildVerified = true;
        return { bytes: disk.length, sha256: this.hash(disk), files: this.state.manifest.sources.map(source => source.cpcName), verification: 'structural-dsk-only', runtime: 'not-run', referencesConsulted: [...this.consulted] };
      }
      default: throw new Error('scope-denied');
    }
  }
}
