import { readDirectory, type ExtractedFile } from './data-disk.ts';
export interface ImportDisk { profile: string; files: ExtractedFile[] }
/** Ordinary 40-track DATA/SYSTEM, one side, CP/M user 0. No copy-protection repair. */
export function readImportDisk(disk: Uint8Array): ImportDisk {
  const text = (p: number, n: number) => String.fromCharCode(...disk.subarray(p,p+n));
  const extended = text(0,34) === 'EXTENDED CPC DSK File\r\nDisk-Info\r\n';
  // Some historical standard images pad these labels with spaces instead of CR/LF.
  // Accept only the exact observed variant; all geometry/sector/allocation checks remain.
  const standard = text(0,34) === 'MV - CPCEMU Disk-File\r\nDisk-Info\r\n' ||
    text(0,34) === 'MV - CPCEMU Disk-File'.padEnd(34, ' ');
  if (!extended && !standard) throw new Error('Signature DSK inconnue.');
  if (disk.length < 256 || disk[48] !== 40 || disk[49] !== 1) throw new Error('40 pistes et une face requis.');
  const chunks: Uint8Array[] = [];
  let p = 256, sectorBase = 0;
  for (let track=0; track<40; track++) {
    const size = extended ? disk[52+track]! * 256 : disk[50]! + disk[51]! * 256;
    const trackSignature = text(p,12) === 'Track-Info\r\n' || (!extended && text(p,12) === 'Track-Info  ');
    if (size < 256 || p + size > disk.length || !trackSignature || disk[p+16] !== track || disk[p+17] !== 0 || disk[p+21] !== 9) throw new Error('Piste absente ou géométrie non prise en charge.');
    const logical = new Uint8Array(4608), seen = new Set<number>();
    let data = p + 256;
    for (let i=0;i<9;i++) {
      const d = p+24+i*8, id=disk[d+2]!;
      if (track === 0 && i === 0) sectorBase = id >= 0xc1 && id <= 0xc9 ? 0xc1 : id >= 0x41 && id <= 0x49 ? 0x41 : 0;
      const length = extended ? disk[d+6]! + disk[d+7]! * 256 : 512;
      if (!sectorBase || id < sectorBase || id >= sectorBase+9 || seen.has(id) || disk[d] !== track || disk[d+1] !== 0 || disk[d+3] !== 2 || disk[d+4] !== 0 || disk[d+5] !== 0 || length !== 512 || data+length > p+size) throw new Error('Secteurs protégés, faibles, manquants ou non standards : extraction refusée.');
      seen.add(id); logical.set(disk.subarray(data,data+length),(id-sectorBase)*512); data+=length;
    }
    chunks.push(logical); p += size;
  }
  if (p !== disk.length) throw new Error('Taille du conteneur incohérente.');
  const reserved = sectorBase === 0x41 ? 2 : 0;
  const logical = new Uint8Array((40-reserved)*4608);
  chunks.slice(reserved).forEach((chunk,i)=>logical.set(chunk,i*4608));
  return { profile: `${extended?'extended':'standard'}-${reserved?'system':'data'}-40`, files: readDirectory(logical) };
}
