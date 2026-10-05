import { buildListingDisk } from '../../basic-language/src/build.ts';
import { buildProjectDisk, type ProjectManifest } from '../../workspace/src/project.ts';
export interface RunRequest { source?: string; sessionId?: string; sources?: { id: string; source: string }[] }
export interface RunImage { disk: Uint8Array; entry: string; label: string; sha256: string; roms: Record<'os' | 'basic' | 'amsdos', Uint8Array>; firmware: Record<'os' | 'basic' | 'amsdos', string> }
export interface EmulatorPort { prepare(request: RunRequest): Promise<RunImage | { error: string }> }
export function runDisk(value: unknown, manifest?: ProjectManifest): { disk: Uint8Array; entry: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Snapshot d’exécution invalide.');
  const request = value as Record<string, unknown>;
  if (!manifest) {
    if (Object.keys(request).length !== 1 || typeof request.source !== 'string' || new TextEncoder().encode(request.source).length > 1024 * 1024) throw new Error('Listing d’exécution UTF-8 de 1 Mio maximum requis.');
    return { disk: buildListingDisk(request.source), entry: 'MAIN.BAS' };
  }
  if (Object.keys(request).length !== 2 || !Object.hasOwn(request, 'sessionId') || !Array.isArray(request.sources) || request.sources.length > 64) throw new Error('Snapshot projet d’exécution invalide.');
  let total = 0;
  const sources = request.sources.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Source d’exécution invalide.');
    const item = value as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || typeof item.id !== 'string' || typeof item.source !== 'string') throw new Error('Source d’exécution invalide.');
    const size = new TextEncoder().encode(item.source).length; total += size;
    if (size > 1024 * 1024 || total > 8 * 1024 * 1024) throw new Error('Snapshot d’exécution trop volumineux.');
    return { id: item.id, source: item.source };
  });
  const disk = buildProjectDisk(manifest, sources);
  return { disk, entry: manifest.sources.find(source => source.id === manifest.entryPoint)!.cpcName };
}
export function runCommand(entry: string): string {
  if (!/^[A-Z0-9_]{1,8}\.BAS$/.test(entry)) throw new Error('Entrée CPC BASIC invalide.');
  return `RUN"${entry}"\r`;
}
