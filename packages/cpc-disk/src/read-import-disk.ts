import { readDirectory, type ExtractedFile } from './data-disk.ts';
export interface ImportDisk { profile: string; files: ExtractedFile[]; warnings?: string[] }
/** Extract the ordinary DATA/SYSTEM filesystem; preserve special sectors only in the original DSK. */
export function readImportDisk(disk: Uint8Array): ImportDisk {
  const text = (p: number, n: number) => String.fromCharCode(...disk.subarray(p, p + n));
  const extended = text(0, 34) === 'EXTENDED CPC DSK File\r\nDisk-Info\r\n';
  const standard = text(0, 34) === 'MV - CPCEMU Disk-File\r\nDisk-Info\r\n' ||
    text(0, 34) === 'MV - CPCEMU Disk-File'.padEnd(34, ' ');
  if (!extended && !standard) throw new Error('Signature DSK inconnue.');
  if (disk.length < 256 || disk[48] !== 40 || disk[49] !== 1) throw new Error('40 pistes et une face requis.');
  const chunks: Uint8Array[] = [], extraTracks: number[] = [];
  let p = 256, sectorBase = 0, endOfCylinderCount = 0;
  for (let track = 0; track < 40; track++) {
    const size = extended ? disk[52 + track]! * 256 : disk[50]! + disk[51]! * 256;
    const trackSignature = text(p, 12) === 'Track-Info\r\n' || (!extended && text(p, 12) === 'Track-Info  ');
    const count = disk[p + 21];
    if (size < 256 || p + size > disk.length || !trackSignature || disk[p + 16] !== track || disk[p + 17] !== 0 ||
        (count !== 9 && !(extended && count === 10))) throw new Error(`Piste ${track} : en-tête absent, tronqué ou géométrie non prise en charge.`);
    // Infer the filesystem from its sector IDs, never from physical interleave order.
    if (track === 0) {
      const ids = Array.from({ length: count }, (_, i) => disk[p + 24 + i * 8 + 2]!);
      sectorBase = ids.includes(0xc1) ? 0xc1 : ids.includes(0x41) ? 0x41 : 0;
      if (!sectorBase) throw new Error('Profil DATA/SYSTEM non reconnu sur la piste 0.');
    }
    const logical = new Uint8Array(4608), seen = new Set<number>();
    let data = p + 256, logicalCount = 0;
    for (let i = 0; i < count; i++) {
      const d = p + 24 + i * 8, id = disk[d + 2]!;
      const fail = (reason: string): never => { throw new Error(`Secteurs non exploitables : piste ${track}, secteur &${id.toString(16).toUpperCase()} : ${reason} Extraction refusée.`); };
      const length = extended ? disk[d + 6]! + disk[d + 7]! * 256 : 512;
      if (seen.has(id)) fail('Identifiant dupliqué.');
      seen.add(id);
      if (disk[d] !== track || disk[d + 1] !== 0) fail('Adresse de piste/face incohérente.');
      // ST1 bit 7 is End of Cylinder, not a CRC/data error. Accept it alone,
      // report it, and still reject every other status bit (including ST2).
      if ((disk[d + 4]! & 0x7f) !== 0 || disk[d + 5] !== 0) fail('Statut FDC signalant une erreur ou une marque spéciale.');
      if (data + length > p + size) fail('Données tronquées.');
      if (id >= sectorBase && id < sectorBase + 9) {
        if (disk[d + 3] !== 2 || length !== 512) fail('512 octets uniques requis, secteur faible ou taille non prise en charge.');
        logical.set(disk.subarray(data, data + length), (id - sectorBase) * 512); logicalCount++;
      } else {
        // Qualified historical variant: one extra 256-byte sector CA (or 4A)
        // alongside all nine filesystem sectors. No guessing at other layouts.
        if (!extended || count !== 10 || id !== sectorBase + 9 || disk[d + 3] !== 1 || length !== 256) fail('Secteur supplémentaire non pris en charge.');
        extraTracks.push(track);
      }
      if (disk[d + 4] === 0x80) endOfCylinderCount++;
      data += length;
    }
    if (logicalCount !== 9) throw new Error(`Piste ${track} : les neuf secteurs DATA/SYSTEM ne sont pas tous présents.`);
    chunks.push(logical); p += size;
  }
  if (p !== disk.length) throw new Error('Taille du conteneur incohérente.');
  const reserved = sectorBase === 0x41 ? 2 : 0;
  const logical = new Uint8Array((40 - reserved) * 4608);
  chunks.slice(reserved).forEach((chunk, i) => logical.set(chunk, i * 4608));
  const warnings: string[] = [];
  if (endOfCylinderCount) warnings.push(`${endOfCylinderCount} secteur(s) portent uniquement l’indicateur FDC de fin de cylindre (ST1=&80) ; données extraites sans correction.`);
  if (extraTracks.length) warnings.push(`${extraTracks.length} secteur(s) supplémentaire(s) de 256 octets hors système de fichiers, pistes ${extraTracks.join(', ')} : conservés dans le DSK original, non reproduits à l’export. Une protection ou un chargement direct peut en dépendre ; le lancement du jeu n’est pas garanti.`);
  return { profile: `${extended ? 'extended' : 'standard'}-${reserved ? 'system' : 'data'}-40`, files: readDirectory(logical), ...(warnings.length ? { warnings } : {}) };
}
