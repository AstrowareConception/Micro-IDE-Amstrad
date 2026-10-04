import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { CPC_PROFILE, ROM_BYTES, ROM_ROLES, parseFirmware, romRole } from '../../packages/emulator/src/firmware.ts';
import type { FirmwareConfiguration, FirmwareStatus } from '../../packages/emulator/src/firmware.ts';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Main-owned store; renderer supplies a role only, never a path or ROM bytes. */
export class FirmwareStore {
  readonly root: string;
  constructor(root: string) { this.root = root; }
  private async directories(): Promise<void> {
    for (const directory of [this.root, join(this.root, 'roms')]) {
      await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Stockage ROM : répertoire local ordinaire requis.');
    }
  }
  private async bytes(path: string, maximum: number): Promise<Buffer> {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) throw new Error('Fichier ROM ordinaire requis, taille limitée.');
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size > maximum) throw new Error('Le fichier ROM a changé pendant sa lecture.');
      const result = Buffer.alloc(maximum + 1);
      let count = 0;
      while (count < result.length) {
        const read = await handle.read(result, count, result.length - count, count);
        if (!read.bytesRead) break;
        count += read.bytesRead;
      }
      if (count > maximum) throw new Error('Fichier ROM trop volumineux.');
      return result.subarray(0, count);
    } finally { await handle.close(); }
  }
  private async configuration(): Promise<FirmwareConfiguration> {
    await this.directories();
    let bytes: Buffer;
    try { bytes = await this.bytes(join(this.root, 'configuration.json'), 4096); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 1, profile: CPC_PROFILE, slots: {} };
      throw error;
    }
    return parseFirmware(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  }
  private async save(configuration: FirmwareConfiguration): Promise<void> {
    const temp = join(this.root, `.configuration-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, JSON.stringify(configuration, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temp, join(this.root, 'configuration.json'));
    } finally { await unlink(temp).catch(() => undefined); }
  }
  private async readRom(hash: string): Promise<Buffer> {
    const bytes = await this.bytes(join(this.root, 'roms', hash + '.rom'), ROM_BYTES);
    if (bytes.length !== ROM_BYTES || digest(bytes) !== hash) throw new Error('ROM absente ou corrompue.');
    return bytes;
  }
  async status(): Promise<FirmwareStatus> {
    const configuration = await this.configuration();
    const slots = await Promise.all(ROM_ROLES.map(async role => {
      const sha256 = configuration.slots[role];
      if (!sha256) return { role, state: 'absent' as const };
      try { await this.readRom(sha256); return { role, state: 'available' as const, sha256 }; }
      catch { return { role, state: 'invalid' as const, sha256 }; }
    }));
    return { profile: CPC_PROFILE, qualification: 'experimental', complete: slots.every(slot => slot.state === 'available'), slots };
  }
  async importRom(roleValue: unknown, selectedPath: string): Promise<FirmwareStatus> {
    const role = romRole(roleValue);
    const configuration = await this.configuration();
    const bytes = await this.bytes(selectedPath, ROM_BYTES);
    if (bytes.length !== ROM_BYTES) throw new Error('Chaque ROM séparée doit contenir exactement 16 384 octets.');
    const hash = digest(bytes), path = join(this.root, 'roms', hash + '.rom');
    try { await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    // Never silently replace an occupied/corrupt hash-addressed object.
    await this.readRom(hash);
    await this.save({ ...configuration, slots: { ...configuration.slots, [role]: hash } });
    return this.status();
  }
  async clear(): Promise<FirmwareStatus> {
    await this.configuration(); // Unsupported/corrupt config must not be silently reset.
    await this.save({ schemaVersion: 1, profile: CPC_PROFILE, slots: {} });
    return this.status();
  }
  /** Future emulator adapter only. Copies are private to the consumer, with revalidation. */
  async load(): Promise<Record<'os' | 'basic' | 'amsdos', Uint8Array>> {
    const configuration = await this.configuration();
    const result = {} as Record<'os' | 'basic' | 'amsdos', Uint8Array>;
    for (const role of ROM_ROLES) {
      const hash = configuration.slots[role];
      if (!hash) throw new Error('Jeu ROM incomplet.');
      result[role] = new Uint8Array(await this.readRom(hash));
    }
    return result;
  }
}
