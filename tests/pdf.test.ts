import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pdfFixture } from './pdf-fixtures.ts';
import { extractPdf } from '../apps/desktop/pdf-document.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { validatePdfText } from '../packages/workspace/src/pdf.ts';
import { buildProjectDisk, type DocumentPdf } from '../packages/workspace/src/project.ts';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const folder = () => mkdtemp(join(tmpdir(), 'microide-pdf-'));

test('real PDF.js worker extracts numbered pages, ignores actions, preserves blank pages and refuses encrypted/corrupt/over-limit PDFs', async () => {
  const preview = await extractPdf(pdfFixture([['TITRE PDF', 'Regles originales'], []]));
  assert.equal(preview.pageCount, 2); assert.match(preview.pages[0]!.text, /TITRE PDF\nRegles originales/);
  assert.equal(preview.pages[1]!.text, ''); assert.ok(!JSON.stringify(preview).includes('PRIVATE_SCRIPT'));
  await assert.rejects(extractPdf(Buffer.from('not a PDF')), /signature/);
  await assert.rejects(extractPdf(Buffer.from('%PDF-1.7\nBROKEN')), /invalide/);
  await assert.rejects(extractPdf(pdfFixture([['SECRET']], true)), /chiffré/);
  await assert.rejects(extractPdf(pdfFixture(Array.from({ length: 21 }, () => ['page']))), /quota-exceeded/);
  await assert.rejects(extractPdf(pdfFixture([['X'.repeat(66000)]], false, 0.001)), /quota-exceeded/);
  await assert.rejects(extractPdf(pdfFixture(Array.from({ length: 5 }, () => ['X'.repeat(60000)]), false, 0.001)), /quota-exceeded/);
});

test('PDF worker cancellation and timeout reject promptly and terminate; decoder result validates page, UTF-8 budgets and controls', async () => {
  const signal = AbortSignal.abort();
  await assert.rejects(extractPdf(pdfFixture(), { signal }), /annulée/);
  const controller = new AbortController(); const pending = extractPdf(pdfFixture(), { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, /annulée/);
  await assert.rejects(extractPdf(pdfFixture(), { timeoutMs: 1 }), /timeout/);
  const preview = { pageCount: 1, pages: [{ page: 1, text: 'bonjour' }], extraction: 'pdfjs-text-v1' };
  assert.deepEqual(validatePdfText(preview), preview);
  for (const invalid of [{ ...preview, pageCount: 2 }, { ...preview, pages: [{ page: 0, text: 'ok' }] }, { ...preview, pages: [{ page: 1, text: '\0' }] }, { ...preview, pages: [{ page: 1, text: 'é'.repeat(33000) }] }]) assert.throws(() => validatePdfText(invalid));
});

test('PDF import keeps original bytes, verified cache and portability, excludes DSK, refuses tampering and a missing decoder', async () => {
  const root = await folder(), external = await folder(), path = join(external, 'Regles.pdf'), original = pdfFixture(); await writeFile(path, original);
  let decodes = 0; const extractor = async (data: Uint8Array) => { decodes++; return extractPdf(data); };
  const { store, snapshot } = await ProjectStore.create(root, 'PDF', undefined, extractor);
  const before = buildProjectDisk(snapshot.manifest, snapshot.files);
  const manifest = await store.importDocument(path), item = manifest.documents[0]!;
  assert.equal(item.mediaType, 'application/pdf'); assert.equal(item.sha256, hash(original));
  assert.deepEqual(await readFile(join(root, item.path)), original);
  const preview = await store.readDocument(item.id); assert.ok('pages' in preview); assert.equal(preview.pageCount, 2);
  preview.pages[0]!.text = 'MUTATED VIEW';
  const second = await store.readDocument(item.id); assert.ok('pages' in second); assert.match(second.pages[0]!.text, /TITRE/); assert.equal(decodes, 1);
  assert.deepEqual(buildProjectDisk(manifest, snapshot.files), before);
  await assert.rejects(ProjectStore.open(root), /extracteur PDF/);
  const moved = root + '-moved'; await rename(root, moved);
  const reopened = await ProjectStore.open(moved, undefined, extractPdf); assert.deepEqual(reopened.snapshot.manifest.documents, manifest.documents);
  await writeFile(join(moved, item.path), pdfFixture([['ALTERED']]));
  await assert.rejects(reopened.store.readDocument(item.id), /stale-read/);
  await assert.rejects(ProjectStore.open(moved, undefined, extractPdf), /stale-read/);
  const originalManifest = await readFile(join(moved, 'microide.project.json'));
  await writeFile(path, Buffer.from('%PDF-1.7\nINVALID'));
  await assert.rejects(reopened.store.importDocument(path), /invalide/);
  assert.deepEqual(await readFile(join(moved, 'microide.project.json')), originalManifest);
});

test('PDF tools expose metadata then requested page/line only, provenance, scoped search, blank-page honesty and bounded excerpts', async () => {
  const { store, snapshot } = await ProjectStore.create(await folder(), 'Scope');
  const state = await store.agentState(snapshot.files);
  const document: DocumentPdf = { id: 'pdf', path: 'documents/pdf.pdf', mediaType: 'application/pdf', role: 'context', originalName: 'Regles.pdf', sha256: hash('original'), bytes: 100, extraction: 'pdfjs-text-v1', pageCount: 3,
    pages: [{ page: 1, text: 'TITRE\nregle\nPRIVATE UNREAD' }, { page: 2, text: 'regle deux' }, { page: 3, text: '' }] };
  const tools = new WorkspaceTools(state, async () => {}, hash, [], [document]);
  const metadata = JSON.stringify(await tools.execute('documents_list', {})); assert.ok(metadata.includes('pageCount')); assert.ok(!metadata.includes('PRIVATE UNREAD'));
  const read = await tools.execute('documents_read_pdf_page', { id: 'pdf', page: 1, startLine: 1, endLine: 1 }) as Record<string, unknown>;
  assert.equal(read.text, 'TITRE'); assert.equal(read.truncated, true); assert.equal(read.sha256, document.sha256); assert.equal(read.page, 1);
  assert.equal(read.trust, 'untrusted-document-data');
  const blank = await tools.execute('documents_read_pdf_page', { id: 'pdf', page: 3, startLine: 1, endLine: 1 }) as Record<string, unknown>;
  assert.equal(blank.hasText, false); assert.equal(blank.text, '');
  const found = await tools.execute('documents_search', { query: 'regle' }) as { matches: { page: number; line: number }[] };
  assert.deepEqual(found.matches.map(({ page, line }) => ({ page, line })), [{ page: 1, line: 2 }, { page: 2, line: 1 }]);
  for (const page of [0, 4, 1.2]) await assert.rejects(tools.execute('documents_read_pdf_page', { id: 'pdf', page, startLine: 1, endLine: 1 }), /invalid-range/);
  await assert.rejects(tools.execute('documents_read_pdf_page', { id: '../outside', page: 1, startLine: 1, endLine: 1 }), /scope-denied/);
  await assert.rejects(tools.execute('documents_read_text', { id: 'pdf', startLine: 1, endLine: 1 }), /documents_read_pdf_page/);
  const unscoped = new WorkspaceTools(state, async () => {}, hash, []);
  await assert.rejects(unscoped.execute('documents_read_pdf_page', { id: 'pdf', page: 1, startLine: 1, endLine: 1 }), /scope-denied/);
  const large = new WorkspaceTools(state, async () => {}, hash, [], [{ ...document, pages: [{ page: 1, text: 'X'.repeat(17000) }], pageCount: 1 }]);
  await assert.rejects(large.execute('documents_read_pdf_page', { id: 'pdf', page: 1, startLine: 1, endLine: 1 }), /trop long/);
});

test('PDF authorization gates controller metadata and extracts; no original or unread page eagerly enters provider context', async () => {
  const root = await folder(), path = join(await folder(), 'Regles.pdf'); await writeFile(path, pdfFixture());
  const { store, snapshot } = await ProjectStore.create(root, 'Agent PDF', undefined, extractPdf); await store.importDocument(path);
  let step = 0; const requests: string[] = []; const savedFetch = globalThis.fetch;
  try {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); requests.push(JSON.stringify(body));
    const context = JSON.parse(body.input[0].content).project;
    const output = step++ === 0 && context.documents.length ? [{ type: 'function_call', call_id: 'page', name: 'documents_read_pdf_page', arguments: JSON.stringify({ id: context.documents[0].id, page: 1, startLine: 1, endLine: 1 }) }] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Fin sans build, donc non qualifiée.' }] }];
    return Response.json({ status: 'completed', output, usage: { total_tokens: 1 } });
  };
  const controller = new AgentController(await folder(), 'knowledge/locomotive-basic');
  controller.configure('sk-controlled-not-real', 'gpt-5.4-2026-03-05');
  let task = await controller.start(store, 'Lire PDF', snapshot.files, false);
  while (controller.running) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(JSON.parse(requests[0]!).input[0].content.includes('Regles.pdf'), false);
  step = 0; requests.length = 0; task = await controller.start(store, 'Lire PDF', snapshot.files, true);
  while (controller.running) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(requests[0]!.includes('Regles.pdf')); assert.ok(!requests[0]!.includes('TITRE PDF'));
  assert.ok(requests[1]!.includes('TITRE PDF')); assert.ok(requests.every(request => !request.includes('PRIVATE UNREAD PDF PAGE') && !request.includes('%PDF-')));
  assert.notEqual(controller.status(task.taskId).status, 'completed');
  } finally { globalThis.fetch = savedFetch; }
});
