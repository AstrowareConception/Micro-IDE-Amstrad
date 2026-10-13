import type { ProjectAsset } from '../../workspace/src/project.ts';
import { assembleZ80 } from './assemble.ts';
export interface BinaryRegion { id: string; assetId: string; sha256: string; offset: number; length: number; origin: number; kind: 'code' | 'data'; note: string; listing: string }
export interface BinaryAnalysis { revision: string | null; regions: BinaryRegion[] }
export interface BinaryFileView { id: string; name: string; sha256: string; size: number; payloadBytes: number; loadAddress?: number; entryAddress?: number; hex: string }
export interface BinaryWorkbenchPort {
  load(sessionId: string): Promise<BinaryAnalysis | { error: string }>;
  inspect(sessionId: string, assetId: string): Promise<BinaryFileView | { error: string }>;
  generate(sessionId: string, assetId: string, offset: number, length: number, origin: number, kind: 'code' | 'data'): Promise<{ listing: string } | { error: string }>;
  save(sessionId: string, revision: string | null, regions: BinaryRegion[]): Promise<BinaryAnalysis | { error: string }>;
  verify(sessionId: string, revision: string | null): Promise<{ changedBytes: number; regions: number } | { error: string }>;
  exportDisk(sessionId: string, revision: string | null): Promise<{ name: string } | { error: string } | null>;
}
export function validateRegions(value: unknown, assets: ProjectAsset[]): BinaryRegion[] {
  if (!Array.isArray(value) || value.length > 128) throw Error('128 zones maximum.');
  const result: BinaryRegion[] = []; let total = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'assetId,id,kind,length,listing,note,offset,origin,sha256') throw Error('Zone invalide.');
    const row = raw as BinaryRegion, asset = assets.find(item => item.id === row.assetId);
    if (!asset || row.sha256 !== asset.sha256) throw Error('Empreinte de zone périmée.');
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(row.id) || result.some(item => item.id === row.id)) throw Error('Identifiant de zone invalide ou dupliqué.');
    if (!Number.isInteger(row.offset) || row.offset < 0 || !Number.isInteger(row.length) || row.length < 1 || row.length > 16384 || row.offset + row.length > asset.byteLength || !Number.isInteger(row.origin) || row.origin < 0 || row.origin + row.length > 65536) throw Error('Plage de zone invalide.');
    if (row.kind !== 'code' && row.kind !== 'data' || typeof row.note !== 'string' || row.note.length > 4000 || row.note.includes('\0') || typeof row.listing !== 'string' || row.listing.length > 1024 * 1024 || row.listing.includes('\0')) throw Error('Annotation invalide.');
    total += row.listing.length + row.note.length; if (total > 800000) throw Error('Budget d’annotations dépassé.');
    if (result.some(item => item.assetId === row.assetId && row.offset < item.offset + item.length && item.offset < row.offset + row.length)) throw Error('Zones superposées : choisissez des plages distinctes.');
    result.push({ ...row });
  }
  return result;
}
export function patchRegions(original: Uint8Array, payloadOffset: number, payloadLength: number, regions: BinaryRegion[]): { bytes: Uint8Array; changedBytes: number } {
  const bytes = original.slice(); let changedBytes = 0;
  for (const region of regions) {
    if (region.offset + region.length > payloadLength) throw Error('Zone hors charge utile.');
    const assembled = assembleZ80(region.listing);
    if (assembled.origin !== region.origin || assembled.bytes.length !== region.length) throw Error('Origine et taille doivent rester identiques ; aucune relocalisation automatique.');
    for (let i = 0; i < region.length; i++) {
      const position = payloadOffset + region.offset + i;
      if (bytes[position] !== assembled.bytes[i]) changedBytes++;
      bytes[position] = assembled.bytes[i]!;
    }
  }
  return { bytes, changedBytes };
}
