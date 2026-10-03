/** Standard CPCEMU container / AMSDOS DATA filesystem. No host I/O. */
export const DATA_PROFILE = Object.freeze({
  tracks: 40, sectors: 9, sectorBytes: 512, trackBytes: 4864,
  diskBytes: 194816, blockBytes: 1024, directoryEntries: 64, fileBlocks: 178,
  writerVersion: "data-standard-sequential-v1",
});
const SIGNATURE = "MV - CPCEMU Disk-File\r\nDisk-Info\r\n";
const TRACK_SIGNATURE = "Track-Info\r\n";
const ascii = new TextEncoder();

export interface DiskFile { name: string; bytes: Uint8Array }
export interface ExtractedFile { name: string; records: Uint8Array; extents: number; blocks: number[] }

export function validateCpcName(name: string): void {
  if (!/^[A-Z0-9_]{1,8}(\.[A-Z0-9_]{1,3})?$/.test(name)) throw new Error("Invalid CPC 8.3 filename: " + name);
}

export function createDataDisk(files: readonly DiskFile[]): Uint8Array {
  const ordered = [...files].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const names = new Set<string>();
  let entries = 0, blocks = 0;
  for (const file of ordered) {
    validateCpcName(file.name);
    if (names.has(file.name)) throw new Error("Duplicate CPC filename");
    names.add(file.name);
    entries += Math.max(1, Math.ceil(file.bytes.length / 16384));
    blocks += Math.ceil(file.bytes.length / 1024);
  }
  if (entries > 64 || blocks > 178) throw new Error("DATA disk capacity exceeded");
  const logical = new Uint8Array(184320).fill(0xe5);
  let directoryIndex = 0, nextBlock = 2;
  for (const file of ordered) {
    const [stem = "", extension = ""] = file.name.split(".");
    const count = Math.max(1, Math.ceil(file.bytes.length / 16384));
    for (let extent = 0; extent < count; extent++) {
      const start = directoryIndex++ * 32;
      const length = Math.min(16384, file.bytes.length - extent * 16384);
      logical.fill(0, start, start + 32);
      logical[start] = 0;
      logical.set(ascii.encode(stem.padEnd(8, " ") + extension.padEnd(3, " ")), start + 1);
      logical[start + 12] = extent & 31;
      logical[start + 14] = extent >>> 5;
      logical[start + 15] = Math.ceil(length / 128);
      const allocated = Math.ceil(length / 1024);
      for (let block = 0; block < allocated; block++) {
        logical[start + 16 + block] = nextBlock;
        const from = extent * 16384 + block * 1024;
        const part = file.bytes.subarray(from, Math.min(from + 1024, file.bytes.length));
        logical.fill(0x1a, nextBlock * 1024, (nextBlock + 1) * 1024);
        logical.set(part, nextBlock++ * 1024);
      }
    }
  }
  const disk = new Uint8Array(DATA_PROFILE.diskBytes);
  disk.set(ascii.encode(SIGNATURE));
  disk.set(ascii.encode("MicroIDE J0   "), 0x22);
  disk[0x30] = 40; disk[0x31] = 1; disk[0x32] = 0; disk[0x33] = 0x13;
  for (let track = 0; track < 40; track++) {
    const offset = 256 + track * 4864;
    disk.set(ascii.encode(TRACK_SIGNATURE), offset);
    disk[offset + 0x10] = track;
    disk[offset + 0x14] = 2; disk[offset + 0x15] = 9;
    disk[offset + 0x16] = 0x4e; disk[offset + 0x17] = 0xe5;
    for (let sector = 0; sector < 9; sector++) {
      const descriptor = offset + 0x18 + sector * 8;
      disk[descriptor] = track;
      disk[descriptor + 2] = 0xc1 + sector;
      disk[descriptor + 3] = 2;
      const begin = (track * 9 + sector) * 512;
      disk.set(logical.subarray(begin, begin + 512), offset + 256 + sector * 512);
    }
  }
  return disk;
}

function matches(bytes: Uint8Array, offset: number, expected: string): boolean {
  return [...ascii.encode(expected)].every((value, index) => bytes[offset + index] === value);
}

/** Independent traversal by CHRN sector IDs; physical interleave can differ. */
export function readDataDisk(disk: Uint8Array): ExtractedFile[] {
  if (disk.length !== 194816 || !matches(disk, 0, SIGNATURE) ||
      disk[0x30] !== 40 || disk[0x31] !== 1 || disk[0x32] !== 0 || disk[0x33] !== 0x13) {
    throw new Error("Expected a standard 40-track single-sided DATA disk");
  }
  const logical = new Uint8Array(184320);
  for (let track = 0, offset = 256; track < 40; track++, offset += 4864) {
    if (!matches(disk, offset, TRACK_SIGNATURE) || disk[offset + 16] !== track ||
        disk[offset + 17] !== 0 || disk[offset + 20] !== 2 || disk[offset + 21] !== 9) {
      throw new Error("Invalid DATA track header");
    }
    const seen = new Set<number>();
    for (let index = 0; index < 9; index++) {
      const p = offset + 24 + index * 8;
      const id = disk[p + 2]!;
      if (disk[p] !== track || disk[p + 1] !== 0 || disk[p + 3] !== 2 ||
          disk[p + 4] !== 0 || disk[p + 5] !== 0 || id < 0xc1 || id > 0xc9 || seen.has(id)) {
        throw new Error("Invalid DATA sector descriptor");
      }
      seen.add(id);
      const begin = offset + 256 + index * 512;
      logical.set(disk.subarray(begin, begin + 512), (track * 9 + id - 0xc1) * 512);
    }
  }
  const groups = new Map<string, { extent: number; records: Uint8Array; blocks: number[] }[]>();
  const allocated = new Set<number>();
  for (let slot = 0; slot < 64; slot++) {
    const p = slot * 32;
    if (logical[p] === 0xe5) continue;
    if (logical[p] !== 0 || logical[p + 13] !== 0 || (logical[p + 12]! & 0xe0) !== 0 ||
        (logical[p + 14]! & 0xc0) !== 0) throw new Error("Unsupported DATA directory entry");
    const field = (from: number, length: number) =>
      String.fromCharCode(...logical.subarray(from, from + length).map(v => v & 0x7f)).trimEnd();
    const stem = field(p + 1, 8), ext = field(p + 9, 3);
    const name = stem + (ext ? "." + ext : "");
    validateCpcName(name);
    const extent = logical[p + 12]! + 32 * logical[p + 14]!;
    const recordCount = logical[p + 15]!;
    if (recordCount > 128) throw new Error("Invalid record count");
    const records = new Uint8Array(recordCount * 128);
    const blocks: number[] = [];
    const blockCount = Math.ceil(records.length / 1024);
    for (let index = 0; index < 16; index++) {
      const block = logical[p + 16 + index]!;
      if (index >= blockCount) {
        if (block !== 0) throw new Error("Unexpected extent allocation");
        continue;
      }
      if (block < 2 || block >= 180 || allocated.has(block)) throw new Error("Overlapping or invalid allocation");
      allocated.add(block); blocks.push(block);
      const length = Math.min(1024, records.length - index * 1024);
      records.set(logical.subarray(block * 1024, block * 1024 + length), index * 1024);
    }
    const group = groups.get(name) ?? [];
    group.push({ extent, records, blocks }); groups.set(name, group);
  }
  return [...groups].map(([name, group]) => {
    group.sort((a, b) => a.extent - b.extent);
    let length = 0;
    group.forEach((part, index) => {
      if (part.extent !== index || (index < group.length - 1 && part.records.length !== 16384)) {
        throw new Error("Missing, duplicate or incomplete extent");
      }
      length += part.records.length;
    });
    const records = new Uint8Array(length);
    let offset = 0;
    for (const part of group) { records.set(part.records, offset); offset += part.records.length; }
    return { name, records, extents: group.length, blocks: group.flatMap(part => part.blocks) };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/** Explicitly ASCII: CTRL-Z is not used to truncate arbitrary binary records. */
export function decodeAsciiRecords(records: Uint8Array): Uint8Array {
  const end = records.indexOf(0x1a);
  if (end < 0) throw new Error("ASCII file has no logical EOF");
  return records.slice(0, end + 1);
}
