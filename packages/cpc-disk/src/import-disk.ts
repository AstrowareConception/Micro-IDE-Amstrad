import { readImportDisk } from './read-import-disk.ts';
import { detokenizeBasic, protectBasic } from './basic-codec.ts';
import { encodeBasicAscii } from './basic-ascii.ts';

export type DiskFileKind = 'basic-ascii' | 'basic-tokenized' | 'basic-protected' | 'binary' | 'unknown';
export interface DiskImportFile {
  id: string; name: string; recordBytes: number; kind: DiskFileKind; reason: string;
  loadAddress?: number; entryAddress?: number; payloadBytes?: number;
  source?: string; records: Uint8Array;
}
export interface DiskInspection { profile: string; files: DiskImportFile[] }
export type DiskImportPreview = {
  id: string; name: string; sha256: string; profile: DiskInspection['profile'];
  files: Omit<DiskImportFile, 'records'>[];
};
export interface DiskImportRequest { id: string; name: string; sourceIds: string[]; entryId: string; kind?: 'binary' }

/** Structural transport check, not a claim that the program has valid BASIC syntax. */
function asciiSource(records: Uint8Array): string | undefined {
  const eof = records.indexOf(0x1a);
  const body = eof < 0 ? records : records.subarray(0, eof);
  if (body.some(byte => byte !== 10 && byte !== 13 && (byte < 32 || byte > 126))) return;
  const source = new TextDecoder().decode(body).replace(/\r\n?/g, '\n');
  try { encodeBasicAscii(source); return source.endsWith('\n') ? source : source + '\n'; } catch { return; }
}

/** No I/O, ROM, AI or extension-based guessing. The strict reader bounds work to one DATA disk. */
export function inspectDataDisk(disk: Uint8Array): DiskInspection {
  let extracted;
  try { extracted = readImportDisk(disk); }
  catch (error) { throw new Error('DSK non pris en charge ou endommagé : DATA/SYSTEM standard ou Extended, 40 pistes, une face, utilisateur 0 requis. ' + (error instanceof Error ? error.message : '')); }
  return { profile: extracted.profile, files: extracted.files.map((file,index)=>inspectCpcFile(file.name,file.records,`file-${index}`)) };
}
export function inspectCpcFile(name:string, records:Uint8Array, id='file-0'):DiskImportFile {
    const file={name,records};
    const result: DiskImportFile = { id, name: file.name, recordBytes: file.records.length,
      kind: 'unknown', reason: 'Contenu non reconnu ; copie brute conservée, sans conversion.', records: file.records };
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
          result.payloadBytes=length; result.loadAddress=records[21]!+256*records[22]!; result.entryAddress=records[26]!+256*records[27]!;
          result.kind = type === 0 ? 'basic-tokenized' : type === 1 ? 'basic-protected' : 'binary';
          result.reason = type === 0 ? 'BASIC tokenisé présumé (en-tête AMSDOS) ; détokenisation non disponible.'
            : type === 1 ? 'BASIC protégé présumé (en-tête AMSDOS) ; conversion non disponible.'
            : 'Binaire AMSDOS présumé ; peut contenir du code ou des données. Conservé sans modification dans le build.';
          if (type === 0 || type === 1) {
            try { result.source = detokenizeBasic(type === 1 ? protectBasic(records.slice(128, 128 + length)) : records.slice(128, 128 + length)); result.reason = type === 1 ? 'BASIC déprotégé et détokenisé ; présentation normalisée, original conservé.' : 'BASIC détokenisé ; présentation normalisée, original conservé.'; }
            catch (error) { result.reason = 'Conversion refusée : ' + (error instanceof Error ? error.message : 'format inconnu'); }
          }
          return result;
        }
        result.reason = 'En-tête AMSDOS plausible, type non pris en charge ; aucune conversion.'; return result;
      }
    }
    const source = asciiSource(records);
    if (source !== undefined) {
      result.kind = 'basic-ascii'; result.source = source;
      result.reason = 'Listing ASCII numéroté éditable ; les octets après CTRL-Z sont conservés dans l’original, pas dans le listing. Syntaxe et dépendances à vérifier.';
    }
    if (source === undefined) { try { result.source=detokenizeBasic(records);result.kind='basic-tokenized';result.reason='BASIC tokenisé sans en-tête, structure validée ; original conservé.'; } catch { /* No forced conversion. */ } }
    return result;
}

export function selectImportSources(inspection: DiskInspection, request: DiskImportRequest): DiskImportFile[] {
  if (request?.kind === 'binary') {
    if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 100 || !Array.isArray(request.sourceIds) || request.sourceIds.length !== 0 || !inspection.files.some(file => file.id === request.entryId)) throw Error('Projet binaire : nom, entrée et aucune source BASIC requis.');
    return [];
  }
  if (request?.kind !== undefined) throw Error('Type d’import inconnu.');
  if (!request || typeof request.name !== 'string' || !request.name.trim() || request.name.length > 100 ||
      !Array.isArray(request.sourceIds) || request.sourceIds.length < 1 || request.sourceIds.length > 64 ||
      new Set(request.sourceIds).size !== request.sourceIds.length || !request.sourceIds.includes(request.entryId))
    throw new Error('Choisissez un nom, au moins un listing BASIC convertible et une entrée parmi les fichiers sélectionnés.');
  return request.sourceIds.map(id => {
    const file = inspection.files.find(file => file.id === id);
    if (!file || file.source === undefined) throw new Error('Source absente ou non convertible ; aucun projet créé.');
    return file;
  });
}
