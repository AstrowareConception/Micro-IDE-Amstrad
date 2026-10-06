/** Human-only project navigation. Opening a file never declares a CPC source. */
export interface ExplorerEntry {
  path: string;
  name: string;
  kind: 'directory' | 'file' | 'link' | 'other';
  role: 'source' | 'document' | 'manifest' | 'ordinary';
  sourceId?: string;
  documentId?: string;
  bytes: number;
  revision: string;
}
export interface ExplorerListing {
  directory: string;
  entries: ExplorerEntry[];
  complete: boolean;
  hiddenCount: number;
}
export interface ExplorerPreview { path: string; bytes: number; text?: string; notice: string }
export interface ExplorerPort {
  list(sessionId: string, directory: string, showHidden: boolean): Promise<ExplorerListing | { error: string }>;
  preview(sessionId: string, path: string, revision: string): Promise<ExplorerPreview | { error: string }>;
}
export const EXPLORER_ENTRY_LIMIT = 500;
export const EXPLORER_PREVIEW_LIMIT = 64 * 1024;
const GENERATED = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '__pycache__']);
export function hiddenExplorerName(name: string): boolean { return name.startsWith('.') || GENERATED.has(name.toLowerCase()); }
export function explorerPath(value: unknown, rootAllowed = false): string {
  if (rootAllowed && value === '') return '';
  if (typeof value !== 'string' || value.length > 1024 || /[\\\x00-\x1f\x7f:]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Chemin relatif du projet requis.');
  return value;
}
