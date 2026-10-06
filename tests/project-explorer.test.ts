import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { ProjectExplorer } from '../apps/desktop/project-explorer.ts';
import { explorerPath } from '../packages/workspace/src/explorer.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-explorer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { store } = await ProjectStore.create(root, 'Explorateur');
  return { root, store, explorer: new ProjectExplorer(store) };
}
test('real tree classifies CPC sources and imported documents without altering the manifest or DSK scope', async t => {
  const { root, store, explorer } = await fixture(t);
  await mkdir(join(root, 'assets')); await writeFile(join(root, 'notes.md'), '# Recherche\n');
  await writeFile(join(root, 'assets/unregistered.bas'), '10 END\n');
  await store.importDocument(join(root, 'notes.md'));
  const before = await readFile(join(root, 'microide.project.json'), 'utf8');
  const listing = await explorer.list('', false);
  assert.equal(listing.complete, true);
  assert.deepEqual(listing.entries.filter(entry => entry.kind === 'directory').map(entry => entry.name), ['assets', 'documents', 'src']);
  assert.equal(listing.entries.find(entry => entry.name === 'microide.project.json')!.role, 'manifest');
  assert.equal((await explorer.list('src', false)).entries[0]!.sourceId, 'main');
  assert.equal((await explorer.list('documents', false)).entries[0]!.documentId, store.manifest.documents[0]!.id);
  assert.equal((await explorer.list('assets', false)).entries[0]!.role, 'ordinary');
  const note = listing.entries.find(entry => entry.name === 'notes.md')!;
  assert.equal((await explorer.preview(note.path, note.revision)).text, '# Recherche\n');
  assert.equal(await readFile(join(root, 'microide.project.json'), 'utf8'), before);
  assert.equal(store.manifest.sources.length, 1);
});
test('private/generated directories stay hidden by default and links are identified without traversal', async t => {
  const { root, explorer } = await fixture(t);
  await mkdir(join(root, 'node_modules')); await writeFile(join(root, '.env'), 'PRIVATE=value');
  await symlink(tmpdir(), join(root, 'outside'), 'junction');
  const listing = await explorer.list('', false);
  assert.equal(listing.hiddenCount, 2);
  assert.ok(!listing.entries.some(entry => entry.name === '.env' || entry.name === 'node_modules'));
  const link = listing.entries.find(entry => entry.name === 'outside')!;
  assert.equal(link.kind, 'link');
  await assert.rejects(explorer.list('outside', false), /symbolique|jonction/);
  await assert.rejects(explorer.preview('outside', link.revision), /symbolique|jonction/);
  assert.ok((await explorer.list('', true)).entries.some(entry => entry.name === '.env'));
  for (const path of ['../secret', '/etc/passwd', 'src/../secret', 'C:/private', 'src\\main.bas', 'src//main.bas', '\0']) assert.throws(() => explorerPath(path));
  assert.equal(explorerPath('..notes'), '..notes');
  await assert.rejects(explorer.list('', 'yes'), /visibilité/);
});
test('large and binary files expose only metadata; inert UTF-8 text is read-only and stale snapshots are refused', async t => {
  const { root, explorer } = await fixture(t);
  await writeFile(join(root, 'large.txt'), Buffer.alloc(65537, 65));
  await writeFile(join(root, 'binary.dat'), Buffer.from([0, 1, 255]));
  await writeFile(join(root, 'empty.txt'), '');
  await writeFile(join(root, 'page.html'), '<script>throw new Error("inert")</script>');
  const entries = (await explorer.list('', false)).entries;
  for (const name of ['large.txt', 'binary.dat']) { const entry = entries.find(item => item.name === name)!; assert.equal((await explorer.preview(entry.path, entry.revision)).text, undefined); }
  const empty = entries.find(item => item.name === 'empty.txt')!; assert.equal((await explorer.preview(empty.path, empty.revision)).text, '');
  const html = entries.find(item => item.name === 'page.html')!; assert.match((await explorer.preview(html.path, html.revision)).text!, /<script>/);
  await writeFile(join(root, 'page.html'), 'EXTERNAL');
  await assert.rejects(explorer.preview(html.path, html.revision), /modifié/);
  assert.equal(await readFile(join(root, 'page.html'), 'utf8'), 'EXTERNAL');
  const source = (await explorer.list('src', false)).entries[0]!;
  await assert.rejects(explorer.preview(source.path, source.revision), /vue dédiée/);
});
test('folder enumeration is bounded and signals incomplete results instead of silently dropping files', async t => {
  const { root, explorer } = await fixture(t);
  await mkdir(join(root, 'many'));
  await Promise.all(Array.from({ length: 501 }, (_, index) => writeFile(join(root, 'many', `${index}.txt`), '')));
  const listing = await explorer.list('many', false);
  assert.equal(listing.entries.length, 500); assert.equal(listing.complete, false);
});
test('changed manifests and replaced file paths cannot be opened through an old explorer reference', async t => {
  const { root, explorer } = await fixture(t);
  await writeFile(join(root, 'notes.txt'), 'KEEP');
  const item = (await explorer.list('', false)).entries.find(entry => entry.name === 'notes.txt')!;
  await rm(join(root, 'notes.txt')); await symlink(join(root, 'src/main.bas'), join(root, 'notes.txt'));
  await assert.rejects(explorer.preview(item.path, item.revision), /symbolique|jonction/);
  const path = join(root, 'microide.project.json'); await writeFile(path, (await readFile(path, 'utf8')) + ' ');
  await assert.rejects(explorer.list('', false), /manifeste a changé/);
});
