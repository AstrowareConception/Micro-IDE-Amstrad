import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { FirmwareStore } from '../apps/desktop/firmware-store.ts';
import { CPC_PROFILE, ROM_BYTES, parseFirmware } from '../packages/emulator/src/firmware.ts';

test('firmware contract rejects unknown roles, versions, profile, traversal and extra fields', () => {
  const valid = { schemaVersion: 1, profile: CPC_PROFILE, slots: { os: 'a'.repeat(64) } };
  assert.deepEqual(parseFirmware(valid), valid);
  for (const value of [{ ...valid, schemaVersion: 2 }, { ...valid, extra: true }, { ...valid, profile: 'cpc464' },
    { ...valid, slots: { os: '../elsewhere' } }, { ...valid, slots: { basic: 'A'.repeat(64) } },
    { ...valid, slots: { unknown: 'a'.repeat(64) } }, { ...valid, slots: [] }, null]) assert.throws(() => parseFirmware(value));
});

test('three local synthetic ROMs persist by hash, reload as copies, remain experimental and clear only selection', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'microide-firmware-')), root = join(temporary, 'store');
  const store = new FirmwareStore(root);
  assert.equal((await store.status()).complete, false);
  for (const [index, role] of ['os', 'basic', 'amsdos'].entries()) {
    const bytes = Buffer.alloc(ROM_BYTES, index + 1), path = join(temporary, role + '.rom');
    await writeFile(path, bytes);
    const result = await store.importRom(role, path);
    assert.equal(result.slots.find(slot => slot.role === role)?.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const reopened = new FirmwareStore(root);
  assert.equal((await reopened.status()).complete, true);
  assert.equal((await reopened.status()).qualification, 'experimental');
  const copies = await reopened.load(); copies.os[0] = 99;
  assert.equal((await reopened.load()).os[0], 1);
  const config = await readFile(join(root, 'configuration.json'), 'utf8');
  assert.ok(!config.includes(temporary));
  assert.equal((await reopened.clear()).complete, false);
  assert.equal((await readdir(join(root, 'roms'))).length, 3);
  await assert.rejects(reopened.load(), /incomplet/);
});

test('invalid size or role cannot replace selection; hash corruption is detected and never overwritten', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'microide-firmware-')), root = join(temporary, 'store');
  const store = new FirmwareStore(root), source = join(temporary, 'synthetic.rom');
  await writeFile(source, Buffer.alloc(ROM_BYTES, 7));
  const imported = await store.importRom('os', source), configPath = join(root, 'configuration.json');
  const baseline = await readFile(configPath, 'utf8');
  for (const size of [0, ROM_BYTES - 1, ROM_BYTES + 1, 1024 * 1024]) {
    const bad = join(temporary, 'bad.rom'); await writeFile(bad, Buffer.alloc(size));
    await assert.rejects(store.importRom('os', bad));
    assert.equal(await readFile(configPath, 'utf8'), baseline);
  }
  await assert.rejects(store.importRom('../../other', source), /Rôle/);
  const object = join(root, 'roms', imported.slots[0]!.sha256 + '.rom');
  await writeFile(object, Buffer.alloc(ROM_BYTES, 8));
  assert.equal((await store.status()).slots[0]!.state, 'invalid');
  await assert.rejects(store.importRom('os', source), /corrompue/);
  assert.equal((await readFile(object))[0], 8);
  await assert.rejects(store.load(), /corrompue/);
  await unlink(object); assert.equal((await store.status()).slots[0]!.state, 'invalid');
});

test('symbolic ROMs, cache directories and manifest links are refused; malformed config is preserved', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'microide-firmware-')), root = join(temporary, 'store');
  const store = new FirmwareStore(root), source = join(temporary, 'synthetic.rom'), link = join(temporary, 'link.rom');
  await writeFile(source, Buffer.alloc(ROM_BYTES)); await symlink(source, link);
  await assert.rejects(store.importRom('os', link), /ordinaire/);
  const config = join(root, 'configuration.json');
  await writeFile(config, '{'); await assert.rejects(store.status()); await assert.rejects(store.clear());
  assert.equal(await readFile(config, 'utf8'), '{');
  await unlink(config); await symlink(source, config); await assert.rejects(store.clear(), /ordinaire/);
  const linkedStore = join(temporary, 'linked-store'); await symlink(root, linkedStore);
  await assert.rejects(new FirmwareStore(linkedStore).status(), /répertoire/);
  const other = join(temporary, 'other'); await mkdir(other);
  await symlink(join(root, 'roms'), join(other, 'roms'));
  await assert.rejects(new FirmwareStore(other).status(), /répertoire/);
});
