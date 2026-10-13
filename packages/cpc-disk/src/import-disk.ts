import { readDataDisk } from './data-disk.ts';
import { encodeBasicAscii } from './basic-ascii.ts';

export type DiskFileKind = 'basic-ascii' | 'basic-tokenized' | 'basic-protected' | 'binary' | 'unknown';
export interface DiskImportFile {
  id: string; name: string; recordBytes: number; kind: DiskFileKind; reason: string;
  source?: string; records: Uint8Array;
}
export interface DiskInspection { profile: 'standard-data-40'; files: DiskImportFile[] }
export type DiskImportPreview = {
  id: string; name: string; sha256: string; profile: DiskInspection['profile'];
  files: Omit<DiskImportFile, 'records'>[];
};
export interface DiskImportRequest { id: string; name: string; sourceIds: string[]; entryId: string }

/** Structural transport check, not a claim that the program has valid BASIC syntax. */
function asciiSource(records: Uint8Array): string | undefined {
  const eof = records.indexOf(0x1a);
  if (eof < 0 || records.subarray(eof + 1).some(byte => byte !== 0x1a && byte !== 0xe5 && byte !== 0)) return;
  const body = records.subarray(0, eof);
  if (body.some(byte => byte !== 10 && byte !== 13 && (byte < 32 || byte > 126))) return;
  const source = new TextDecoder().decode(body).replace(/\r\n?/g, '\n');
  try { encodeBasicAscii(source); return source.endsWith('\n') ? source : source + '\n'; } catch { return; }
}

/** No I/O, ROM, AI or extension-based guessing. The strict reader bounds work to one DATA disk. */
export function inspectDataDisk(disk: Uint8Array): DiskInspection {
  let extracted;
  try { extracted = readDataDisk(disk); }
  catch (error) { throw new Error('DSK non pris en charge ou endommagé : standard DATA, 40 pistes, une face, utilisateur 0 requis. ' + (error instanceof Error ? error.message : '')); }
  return { profile: 'standard-data-40', files: extracted.map((file, index) => {
    const result: DiskImportFile = { id: `file-${index}`, name: file.name, recordBytes: file.records.length,
      kind: 'unknown', reason: 'Contenu non reconnu ; copie brute conservée, sans conversion.', records: file.records };
    const records = file.records;
    if (records.length >= 128) {
      const checksum = records.subarray(0, 67).reduce((sum, byte) => sum + byte, 0);
      const stored = records[67]! + records[68]! * 256;
      if (checksum !== 0 && checksum === stored) {
        const length = records[64]! + records[65]! * 256 + records[66]! * 65536;
        if (128 + length > records.length || length === 0) {
          result.reason = 'En-tête AMSDOS plausible mais longueur invalide ; aucune conversion.'; return result;
        }
        const type = records[18];
        if (type === 0 || type === 1 || type === 2) {
          result.kind = type === 0 ? 'basic-tokenized' : type === 1 ? 'basic-protected' : 'binary';
          result.reason = type === 0 ? 'BASIC tokenisé présumé (en-tête AMSDOS) ; détokenisation non disponible.'
            : type === 1 ? 'BASIC protégé présumé (en-tête AMSDOS) ; conversion non disponible.'
            : 'Binaire AMSDOS présumé ; peut contenir du code ou des données. Non inclus dans le build.';
          return result;
        }
        result.reason = 'En-tête AMSDOS plausible, type non pris en charge ; aucune conversion.'; return result;
      }
    }
    const source = asciiSource(records);
    if (source !== undefined) {
      result.kind = 'basic-ascii'; result.source = source;
      result.reason = 'Listing ASCII numéroté éditable ; syntaxe et dépendances à vérifier dans le projet.';
    }
    return result;
  }) };
}

export function selectImportSources(inspection: DiskInspection, request: DiskImportRequest): DiskImportFile[] {
  if (!request || typeof request.name !== 'string' || !request.name.trim() || request.name.length > 100 ||
      !Array.isArray(request.sourceIds) || request.sourceIds.length < 1 || request.sourceIds.length > 64 ||
      new Set(request.sourceIds).size !== request.sourceIds.length || !request.sourceIds.includes(request.entryId))
    throw new Error('Choisissez un nom, au moins un listing ASCII et une entrée parmi les fichiers sélectionnés.');
  return request.sourceIds.map(id => {
    const file = inspection.files.find(file => file.id === id);
    if (!file || file.kind !== 'basic-ascii' || file.source === undefined) throw new Error('Source absente ou non convertible ; aucun projet créé.');
    return file;
  });
}
