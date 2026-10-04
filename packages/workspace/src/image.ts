export const IMAGE_PIXELS = 4_000_000;
export const IMAGE_SIDE = 4096;
export const PREVIEW_BYTES = 128 * 1024;
export interface ImageHeader { width: number; height: number; mediaType: 'image/png' | 'image/jpeg' }
function dimensions(width: number, height: number): void {
  if (!width || !height || width > IMAGE_SIDE || height > IMAGE_SIDE || width * height > IMAGE_PIXELS) throw new Error('Image limitée à 4 mégapixels et 4096 pixels par côté.');
}
/** Structural preflight before a native pixel decoder. This is not a substitute for decoding. */
export function inspectImage(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) {
    let offset = 8, width = 0, height = 0, data = false, ended = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset), end = offset + size + 12;
      if (end > bytes.length) throw new Error('PNG tronqué.');
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('Chunk PNG invalide.');
      let crc = 0xffffffff;
      for (const byte of bytes.subarray(offset + 4, end - 4)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
      if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end - 4)) throw new Error('CRC PNG invalide.');
      if (offset === 8 && type !== 'IHDR') throw new Error('En-tête PNG absent.');
      if (type === 'IHDR') {
        if (width || size !== 13) throw new Error('En-tête PNG invalide.');
        width = view.getUint32(offset + 8); height = view.getUint32(offset + 12); dimensions(width, height);
        if (bytes[offset + 16] !== 8 || ![0, 2, 3, 4, 6].includes(bytes[offset + 17]!) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20]! > 1) throw new Error('PNG 8 bits standard requis.');
      }
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw new Error('PNG animé non pris en charge.');
      if (type === 'IDAT') data = true;
      if (type === 'IEND') { if (size !== 0 || end !== bytes.length || !data) throw new Error('Fin PNG invalide.'); ended = true; break; }
      offset = end;
    }
    if (!ended) throw new Error('PNG incomplet.');
    return { width, height, mediaType: 'image/png' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2, width = 0, height = 0, scan = false, hasScan = false;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) { if (!scan) throw new Error('Marqueur JPEG invalide.'); offset++; continue; }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (scan && (marker === 0 || (marker! >= 0xd0 && marker! <= 0xd7))) continue;
      if (marker === 0xd9) {
        if (!width || !hasScan || offset !== bytes.length) throw new Error('Fin JPEG invalide.');
        return { width, height, mediaType: 'image/jpeg' };
      }
      if (marker === undefined || marker === 0xd8 || offset + 2 > bytes.length) throw new Error('JPEG tronqué ou multiple.');
      const size = view.getUint16(offset), end = offset + size;
      if (size < 2 || end > bytes.length) throw new Error('Segment JPEG tronqué.');
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (![0xc0, 0xc2].includes(marker) || width || size < 8 || bytes[offset + 2] !== 8 || ![1, 3].includes(bytes[offset + 7]!)) throw new Error('JPEG 8 bits gris/RGB baseline ou progressif requis.');
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); dimensions(width, height);
      }
      scan = marker === 0xda; if (scan) hasScan = true;
      offset = end;
    }
    throw new Error('JPEG incomplet.');
  }
  throw new Error('Signature PNG ou JPEG requise.');
}
