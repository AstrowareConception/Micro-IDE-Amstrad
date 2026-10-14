/** Synthetic container variant only; contains no commercial program or disk bytes. */
export function historicalExtended(standard: Uint8Array, extraTracks = [5, 10, 15, 20, 25, 30, 35, 39], system = false): Uint8Array {
  const disk = new Uint8Array(standard.length + extraTracks.length * 256);
  disk.set(new TextEncoder().encode('EXTENDED CPC DSK File\r\nDisk-Info\r\n'));
  disk[48] = 40; disk[49] = 1;
  let offset = 256;
  for (let track = 0; track < 40; track++) {
    const extra = extraTracks.includes(track), size = extra ? 5120 : 4864;
    const source = 256 + (system ? Math.max(0, track - 2) : track) * 4864;
    disk[52 + track] = size / 256;
    disk.set(standard.subarray(source, source + 256), offset);
    disk.fill(0, offset + 24, offset + 256);
    disk[offset + 16] = track; disk[offset + 21] = extra ? 10 : 9;
    // Extra first to ensure physical order cannot determine logical sector placement.
    const order = [...(extra ? [9] : []), 0, 5, 1, 6, 2, 7, 3, 8, 4];
    let data = offset + 256;
    for (const [index, sector] of order.entries()) {
      const extraSector = sector === 9, length = extraSector ? 256 : 512;
      const d = offset + 24 + index * 8;
      disk.set([track, 0, (system ? 0x41 : 0xc1) + sector, extraSector ? 1 : 2, 0x80, 0, 0, length / 256], d);
      if (extraSector) disk.fill(0x5a, data, data + length);
      else disk.set(standard.subarray(source + 256 + sector * 512, source + 256 + (sector + 1) * 512), data);
      data += length;
    }
    offset += size;
  }
  return disk;
}
