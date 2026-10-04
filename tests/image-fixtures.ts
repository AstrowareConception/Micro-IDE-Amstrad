import { deflateSync } from 'node:zlib';
export function chunk(type: string, content: Uint8Array): Buffer {
  const name = Buffer.from(type), data = Buffer.from(content); let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, name, data, tail]);
}
/** Original test-only colored raster, no third-party image. */
export function png(width = 320, height = 200, metadata = 'PRIVATE_IMAGE_METADATA'): Buffer {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = y * (width * 4 + 1) + 1 + x * 4;
    pixels.set([x < width / 2 ? 120 : 30, y < height / 2 ? 180 : 60, 220, x < 20 ? 0 : 255], at);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('tEXt', Buffer.from(`Comment\0${metadata}`)), chunk('IDAT', deflateSync(pixels)), chunk('IEND', new Uint8Array())]);
}
