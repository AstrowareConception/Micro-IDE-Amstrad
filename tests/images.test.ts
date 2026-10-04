import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { png, chunk } from './image-fixtures.ts';
import { inspectImage } from '../packages/workspace/src/image.ts';
import { newProject, parseProject, buildProjectDisk } from '../packages/workspace/src/project.ts';
import type { DocumentImage, ImageDecoder } from '../packages/workspace/src/project.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { runAgent } from '../packages/agent/src/runner.ts';
import type { AgentWorkspaceState } from '../packages/agent/src/types.ts';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const uuid = '647f023d-1272-4b66-8c47-b064b8de9512';
const image = (): DocumentImage => ({ id: 'title', path: 'documents/title.png', sha256: hash(png()), mediaType: 'image/png', originalName: 'Titre.png', role: 'inspiration', bytes: png().length, width: 320, height: 200, previewWidth: 320, previewHeight: 200, dataUrl: 'data:image/png;base64,YWJj' });
const state = (): AgentWorkspaceState => ({ sessionId: 'session', manifest: parseProject({ ...newProject('Images', uuid), documents: [imageMetadata()] }), files: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS', source: '10 END', saved: '10 END' }] });
function imageMetadata() { const { id, path, sha256, mediaType, originalName, role } = image(); return { id, path, sha256, mediaType, originalName, role }; }

test('PNG preflight checks signature, CRC, full boundaries, animation and decoded dimension budget', () => {
  const bytes = png(); assert.deepEqual(inspectImage(bytes), { width: 320, height: 200, mediaType: 'image/png' });
  const corrupt = Buffer.from(bytes); corrupt[30] = corrupt[30]! ^ 1;
  const large = Buffer.from(bytes), header = Buffer.from(bytes.subarray(16, 29)); header.writeUInt32BE(4097); chunk('IHDR', header).copy(large, 8);
  const animated = Buffer.concat([bytes.subarray(0, 33), chunk('acTL', new Uint8Array(8)), bytes.subarray(33)]);
  for (const value of [bytes.subarray(0, 40), corrupt, large, animated, Buffer.concat([bytes, Buffer.from('EXTRA')]), Buffer.from('<svg/>'), Buffer.from('RIFF....WEBP')]) assert.throws(() => inspectImage(value));
});
test('JPEG preflight bounds baseline/progressive headers and rejects missing EOI, repeated SOF and huge frames', () => {
  const jpeg = (marker = 0xc0, width = 320) => Buffer.from([0xff, 0xd8, 0xff, marker, 0, 11, 8, 0, 200, width >>> 8, width & 255, 1, 1, 0x11, 0, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x11, 0xff, 0, 0x22, 0xff, 0xd9]);
  assert.deepEqual(inspectImage(jpeg()), { width: 320, height: 200, mediaType: 'image/jpeg' });
  assert.equal(inspectImage(jpeg(0xc2)).mediaType, 'image/jpeg');
  for (const value of [jpeg().subarray(0, 29), jpeg(0xc1), jpeg(0xc0, 4097), Buffer.concat([jpeg(), Buffer.from('TRAIL')]), Buffer.concat([jpeg().subarray(0, 15), jpeg().subarray(2)])]) assert.throws(() => inspectImage(value));
});
test('project v1 accepts PNG/JPEG metadata with consistent paths, remains portable and excludes images from DSK', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'microide-images-')), root = join(directory, 'project');
  const { mkdir } = await import('node:fs/promises'); await mkdir(root);
  const selected = join(directory, 'Titre.png'); await writeFile(selected, png());
  // Adapter contract fixture, not proof of actual pixel decoding (covered by Electron).
  const decoder: ImageDecoder = async (bytes, mediaType) => { const header = inspectImage(bytes); assert.equal(header.mediaType, mediaType); const { dataUrl, previewWidth, previewHeight } = image(); return { ...header, dataUrl, previewWidth, previewHeight }; };
  const { store, snapshot } = await ProjectStore.create(root, 'Images', decoder);
  const before = buildProjectDisk(snapshot.manifest, snapshot.files); await store.importDocument(selected);
  assert.deepEqual(buildProjectDisk(store.manifest, snapshot.files), before);
  const metadata = store.manifest.documents[0]!; assert.deepEqual(await readFile(join(root, metadata.path)), png());
  const moved = root + '-moved'; await rename(root, moved);
  assert.equal((await ProjectStore.open(moved, decoder)).snapshot.manifest.documents[0]!.sha256, hash(png()));
  await assert.rejects(ProjectStore.open(moved), /décodeur image/);
  await writeFile(join(moved, metadata.path), 'CORRUPT'); await assert.rejects(ProjectStore.open(moved, decoder), /stale-read/);
  assert.throws(() => parseProject({ ...newProject('Invalid', uuid), documents: [{ ...imageMetadata(), path: 'documents/title.md' }] }));
});
test('image tools isolate text search, scope and metadata; runner sends actual image content and replays once', async () => {
  const tools = new WorkspaceTools(state(), async () => assert.fail('Image tool cannot write'), hash, [], [image()]);
  const list = JSON.stringify(await tools.execute('documents_list', {})); assert.ok(!list.includes('base64')); assert.ok(list.includes('previewWidth'));
  await assert.rejects(tools.execute('documents_read_text', { id: 'title', startLine: 1, endLine: 1 }), /unsupported-capability/);
  await assert.rejects(tools.execute('documents_inspect_image', { id: 'foreign' }), /scope-denied/);
  assert.deepEqual(await tools.execute('documents_search', { query: 'title' }), { matches: [], total: 0, truncated: false, trust: 'untrusted-document-data' });
  const denied = new WorkspaceTools(state(), async () => undefined, hash, []);
  await assert.rejects(denied.execute('documents_inspect_image', { id: 'title' }), /scope-denied/);
  let turns = 0, reads = 0; const execute = tools.execute.bind(tools);
  tools.execute = async (...args) => { reads++; return execute(...args); };
  const result = await runAgent({ tools, objective: 'Observe le titre.', context: {}, signal: new AbortController().signal, emit: () => undefined, takeSteering: () => [], model: { respond: async input => {
    if (turns++ < 2) return { tokens: 1, output: [{ type: 'function_call', call_id: 'once', name: 'documents_inspect_image', arguments: '{"id":"title"}' }] };
    const outputs = input.filter(item => item.type === 'function_call_output'); assert.equal(outputs.length, 2);
    assert.deepEqual(outputs[0]!.output, outputs[1]!.output);
    const parts = outputs[0]!.output as Record<string, unknown>[];
    assert.equal(parts[1]!.type, 'input_image'); assert.equal(parts[1]!.image_url, image().dataUrl);
    assert.equal(JSON.parse(parts[0]!.text as string).trust, 'untrusted-document-data');
    return { tokens: 1, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Bilan contrôlé, pas de vision réelle qualifiée.' }] }] };
  } } });
  assert.equal(result.status, 'completed'); assert.equal(reads, 1);
});
