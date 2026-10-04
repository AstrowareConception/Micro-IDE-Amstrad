import test from 'node:test';
import assert from 'node:assert/strict';
import { saveBatch, SaveBatchFailure, type SaveBatchPort } from '../packages/workspace/src/save-batch.ts';
const encode = (value: string) => new TextEncoder().encode(value);
const entries = () => ['a', 'b'].map(id => ({ id, before: encode(`old-${id}`), after: encode(`new-${id}`) }));
function fixture() {
  const disk = new Map<string, Uint8Array>(entries().map(item => [item.id, item.before])); const writes: string[] = [];
  const port: SaveBatchPort = { assertCurrent: async () => {}, read: async id => disk.get(id)!, write: async (id, bytes) => { disk.set(id, bytes); writes.push(id); } };
  return { disk, writes, port };
}
test('batch preflights every source and writes only changed bytes', async () => {
  const { disk, writes, port } = fixture();
  const plan = entries(); plan[1]!.after = plan[1]!.before;
  assert.deepEqual(await saveBatch(plan, port), ['a']); assert.deepEqual(writes, ['a']);
  assert.deepEqual(disk.get('b'), encode('old-b'));
  assert.deepEqual(await saveBatch(plan.map(item => ({ ...item, before: item.after })), port), []);
});
test('late preflight conflict refuses all writes', async () => {
  const { disk, writes, port } = fixture(); disk.set('b', encode('external'));
  await assert.rejects(saveBatch(entries(), port), /Aucune source enregistrée/);
  assert.deepEqual(writes, []); assert.deepEqual(disk.get('a'), encode('old-a'));
});
test('second write failure compensates the first and preserves original bytes', async () => {
  const { disk, writes, port } = fixture(); const write = port.write;
  port.write = async (id, bytes) => { if (id === 'b') throw new Error('DISK FULL'); await write(id, bytes); };
  await assert.rejects(saveBatch(entries(), port), error => error instanceof SaveBatchFailure && !error.incomplete && /DISK FULL/.test(error.message));
  assert.deepEqual(writes, ['a', 'a']); assert.deepEqual(disk.get('a'), encode('old-a')); assert.deepEqual(disk.get('b'), encode('old-b'));
});
test('external change during a batch is never erased by compensation', async () => {
  const { disk, port } = fixture(); const write = port.write;
  port.write = async (id, bytes) => { await write(id, bytes); if (id === 'a' && new TextDecoder().decode(bytes) === 'new-a') disk.set('b', encode('external')); };
  await assert.rejects(saveBatch(entries(), port), error => error instanceof SaveBatchFailure && !error.incomplete);
  assert.deepEqual(disk.get('a'), encode('old-a')); assert.deepEqual(disk.get('b'), encode('external'));
});
test('externally modified written file is preserved and incomplete rollback is explicit', async () => {
  const { disk, port } = fixture(); const write = port.write;
  port.write = async (id, bytes) => { if (id === 'b') { disk.set('a', encode('external-a')); throw new Error('FAIL'); } await write(id, bytes); };
  await assert.rejects(saveBatch(entries(), port), error => error instanceof SaveBatchFailure && error.incomplete && /Projet bloqué/.test(error.message));
  assert.deepEqual(disk.get('a'), encode('external-a'));
});
test('manifest change after first write rolls it back, duplicate lots fail', async () => {
  const { disk, writes, port } = fixture(); let checks = 0;
  port.assertCurrent = async () => { if (++checks === 3) throw new Error('MANIFEST CHANGED'); };
  await assert.rejects(saveBatch(entries(), port), /MANIFEST CHANGED/);
  assert.deepEqual(disk.get('a'), encode('old-a')); assert.deepEqual(writes, ['a', 'a']);
  await assert.rejects(saveBatch([entries()[0]!, entries()[0]!], port), /dupliqué/);
});
