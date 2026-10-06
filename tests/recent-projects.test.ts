import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, symlink, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { RecentProjectsStore } from '../apps/desktop/recent-projects-store.ts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-recent-')), profile = join(root, 'profile'); await mkdir(profile);
  return { root, profile, store: new RecentProjectsStore(profile) };
}
async function folder(root: string, name: string) { const path = join(root, name); await mkdir(path); await writeFile(join(path, 'microide.project.json'), '{}'); return path; }

test('recent projects persist, deduplicate canonical folders and promote the latest opening', async () => {
  const { root, profile, store } = await fixture(), a = await folder(root, 'A'), b = await folder(root, 'B');
  assert.deepEqual(await store.list(), []);
  const projectId = randomUUID(); await store.remember(a, projectId, 'Même nom'); await store.remember(b, randomUUID(), 'Même nom');
  const first = await store.list(); assert.deepEqual(first.map(entry => entry.path), [await realpath(b), await realpath(a)]);
  await store.remember(join(a, '.'), projectId, 'A renommé');
  const next = await new RecentProjectsStore(profile).list(); assert.equal(next.length, 2); assert.equal(next[0]?.id, first[1]?.id); assert.equal(next[0]?.name, 'A renommé');
  assert.ok(next.every(entry => entry.available)); assert.equal((await store.get(next[0]!.id)).projectId, projectId);
  for (const id of [undefined, a, {}, randomUUID()]) await assert.rejects(store.get(id));
});
test('recent projects keep missing entries and forgetting never deletes project files', async () => {
  const { root, store } = await fixture(), path = await folder(root, 'Projet'); await store.remember(path, randomUUID(), 'Projet');
  const [entry] = await store.list(); await rename(path, join(root, 'Déplacé'));
  assert.equal((await store.list())[0]?.available, false);
  assert.deepEqual(await store.remove(entry!.id), []); assert.equal(await readFile(join(root, 'Déplacé', 'microide.project.json'), 'utf8'), '{}');
  await store.remember(join(root, 'Déplacé'), randomUUID(), 'Projet déplacé'); await store.clear(); assert.deepEqual(await store.list(), []);
  assert.equal(await readFile(join(root, 'Déplacé', 'microide.project.json'), 'utf8'), '{}');
});
test('recent projects bound the registry to the latest twenty folders', async () => {
  const { root, store } = await fixture();
  for (let index = 0; index < 22; index++) await store.remember(await folder(root, `P${index}`), randomUUID(), `P${index}`);
  const entries = await store.list(); assert.equal(entries.length, 20); assert.equal(entries[0]?.name, 'P21'); assert.equal(entries.at(-1)?.name, 'P2');
});
test('invalid/unknown/oversized private registries are preserved instead of overwritten', async () => {
  const { root, profile, store } = await fixture(), path = await folder(root, 'Projet');
  for (const value of ['{broken', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [{ path: '/tmp' }] }), 'x'.repeat(128 * 1024 + 1)]) {
    await writeFile(join(profile, 'recent-projects.json'), value);
    await assert.rejects(store.list()); await assert.rejects(store.remember(path, randomUUID(), 'Projet')); await assert.rejects(store.clear());
    assert.equal(await readFile(join(profile, 'recent-projects.json'), 'utf8'), value);
  }
});
test('a registry symlink cannot redirect the private preference write', { skip: process.platform === 'win32' }, async () => {
  const { root, profile, store } = await fixture(), target = join(root, 'external.json'); await writeFile(target, '{"version":1,"entries":[]}');
  await symlink(target, join(profile, 'recent-projects.json'));
  await assert.rejects(store.clear()); assert.equal(await readFile(target, 'utf8'), '{"version":1,"entries":[]}');
});
