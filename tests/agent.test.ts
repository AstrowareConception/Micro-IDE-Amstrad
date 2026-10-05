import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAgent } from '../packages/agent/src/runner.ts';
import { WorkspaceTools, DEFINITIONS } from '../packages/agent/src/workspace-tools.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { OpenAIProvider, DEFAULT_MODEL } from '../apps/desktop/openai-provider.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import type { AgentWorkspaceState, ModelPort } from '../packages/agent/src/types.ts';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const state = (): AgentWorkspaceState => ({ sessionId: 'session', manifest: newProject('Agent', '647f023d-1272-4b66-8c47-b064b8de9512'), files: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS', source: '10 END\n', saved: '10 END\n' }] });
const call = (id: string, name: string, args: unknown) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
const message = { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Bilan' }] };
const run = (model: ModelPort, tools: WorkspaceTools, extra = {}) => runAgent({ model, tools, objective: 'Crée un programme', context: {}, signal: new AbortController().signal, emit: () => undefined, takeSteering: () => [], ...extra });

test('agent renumber uses the shared planner and persisted mutation guard, refuses stale/unknown IDs, and keeps no-op drafts', async () => {
  const initial = state(); initial.files[0]!.source = '10 GOTO 100\n100 END';
  let writes = 0;
  const tools = new WorkspaceTools(initial, async candidate => { writes++; assert.equal(candidate.files[0]!.source, '1000 GOTO 1010\n1010 END'); }, hash, []);
  const parameters = { id: 'main', expectedHash: hash(initial.files[0]!.source), start: 1000, step: 10, from: 1, to: 65535 };
  await assert.rejects(tools.execute('language_renumber', parameters), /reference-required/);
  for (const id of ['GOTO', 'END']) await tools.execute('reference_read', { id, startLine: 1, endLine: 1 });
  await assert.rejects(tools.execute('language_renumber', { ...parameters, id: 'foreign' }), /scope-denied/);
  await assert.rejects(tools.execute('language_renumber', { ...parameters, expectedHash: 'old' }), /stale-read/);
  await tools.execute('build_project', {}); assert.equal(tools.buildVerified, true);
  const result = await tools.execute('language_renumber', parameters) as { saved: boolean; substitutions: number };
  assert.equal(result.saved, true); assert.equal(result.substitutions, 3); assert.equal(writes, 1); assert.equal(tools.buildVerified, false);
  const draft = state(); draft.files[0]!.source = '10 END';
  const noOp = new WorkspaceTools(draft, async () => assert.fail('No-op must not save dirty source'), hash, []);
  const unchanged = await noOp.execute('language_renumber', { ...parameters, expectedHash: hash('10 END'), start: 10 }) as { saved: boolean; noOp: boolean };
  assert.equal(unchanged.saved, false); assert.equal(unchanged.noOp, true);
});

test('tools require source hashes, declared IDs and consulted command cards; unknown tools cannot widen scope', async () => {
  let writes = 0; const tools = new WorkspaceTools(state(), async () => { writes++; }, hash, []);
  await assert.rejects(tools.execute('project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: '10 PRINT "OK"\n20 END\n' }), /reference-required/);
  for (const id of ['PRINT', 'END']) await tools.execute('reference_read', { id, startLine: 1, endLine: 1 });
  await assert.rejects(tools.execute('project_replace_source', { id: 'main', expectedHash: 'old', source: '10 END' }), /stale-read/);
  await assert.rejects(tools.execute('project_read_file', { id: '../../secret', startLine: 1, endLine: 2 }), /scope-denied/);
  await assert.rejects(tools.execute('shell', { command: 'anything' }), /scope-denied/);
  await tools.execute('project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: '10 PRINT "OK"\n20 END\n' });
  assert.equal(writes, 1); assert.equal(tools.state.files[0]!.saved, '10 PRINT "OK"\n20 END\n');
  const build = await tools.execute('build_project', {}) as { verification: string; runtime: string };
  assert.equal(build.verification, 'structural-dsk-only'); assert.equal(build.runtime, 'not-run');
});
test('runner returns real build failures to the model for correction and preserves reasoning items', async () => {
  const tools = new WorkspaceTools(state(), async () => undefined, hash, []); let turn = 0;
  const model: ModelPort = { respond: async input => {
    turn++;
    if (turn === 1) return { tokens: 3, output: [{ type: 'reasoning', id: 'rs', encrypted_content: 'opaque' }, call('ref', 'reference_read', { id: 'END', startLine: 1, endLine: 1 })] };
    assert.ok(input.some(item => item.type === 'reasoning'));
    if (turn === 2) return { tokens: 3, output: [call('bad', 'project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: '0 END' }), call('buildbad', 'build_project', {})] };
    if (turn === 3) { assert.match(JSON.stringify(input), /error/); return { tokens: 3, output: [call('fix', 'project_replace_source', { id: 'main', expectedHash: hash('0 END'), source: '10 END\n' }), call('buildok', 'build_project', {})] }; }
    return { tokens: 3, output: [message] };
  } };
  const result = await run(model, tools); assert.equal(result.status, 'completed'); assert.equal(result.tokens, 12); assert.equal(tools.buildVerified, true);
});
test('callId replay is idempotent and conflicting replay fails instead of repeating a mutation', async () => {
  let reads = 0, turn = 0; const tools = new WorkspaceTools(state(), async () => undefined, hash, []);
  const execute = tools.execute.bind(tools); tools.execute = async (...args) => { reads++; return execute(...args); };
  const result = await run({ respond: async () => ({ tokens: 1, output: ++turn < 3 ? [call('same', 'project_list_files', {})] : [call('same', 'project_search', { query: 'END' })] }) }, tools);
  assert.equal(reads, 1); assert.equal(result.status, 'failed'); assert.match(result.summary, /callId/);
});
test('cancellation ignores late tool responses, steering arrives at a turn boundary and budgets stop loops', async () => {
  const abort = new AbortController(); const tools = new WorkspaceTools(state(), async () => assert.fail('Must not mutate'), hash, []);
  const cancelled = await run({ respond: async () => { abort.abort(); return { tokens: 2, output: [call('late', 'project_create_source', { name: 'NEW', source: '10 END' })] }; } }, tools, { signal: abort.signal });
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.calls, 0);
  const model: ModelPort = { respond: async input => { assert.ok(input.some(item => item.content === 'Change la couleur')); return { tokens: 1, output: [call('list', 'project_list_files', {})] }; } };
  const bounded = await run(model, tools, { maxTurns: 1, takeSteering: () => ['Change la couleur'] }); assert.equal(bounded.status, 'paused-limit');
});
test('OpenAI transport uses Responses, exact schemas, no storage or retry, and never reflects a key', async () => {
  const key = 'sk-test-fixture-not-real'; let requests = 0;
  const transport: typeof fetch = async (url, init) => {
    requests++; assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal((init!.headers as Record<string, string>).Authorization, `Bearer ${key}`); assert.equal(init!.redirect, 'error');
    const body = JSON.parse(init!.body as string); assert.equal(body.store, false); assert.equal(body.parallel_tool_calls, false); assert.deepEqual(body.tools, DEFINITIONS); assert.deepEqual(body.include, ['reasoning.encrypted_content']);
    return Response.json({ status: 'completed', output: [message], usage: { total_tokens: 5 } });
  };
  const provider = new OpenAIProvider(key, DEFAULT_MODEL, transport);
  assert.equal((await provider.respond([], DEFINITIONS, new AbortController().signal)).tokens, 5); assert.equal(requests, 1);
  const denied = new OpenAIProvider(key, DEFAULT_MODEL, async () => new Response(key, { status: 401 }));
  await assert.rejects(denied.respond([], [], new AbortController().signal), /401/);
  const leaking = new OpenAIProvider(key, DEFAULT_MODEL, async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: key }] }], usage: { total_tokens: 5 } }));
  await assert.rejects(leaking.respond([], [], new AbortController().signal), /secret refusée/);
});
test('agent batch preflight refuses an occupied destination, keeps external bytes and restores created files safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-batch-')); const { store } = await ProjectStore.create(root, 'Batch');
  const baseline = await readFile(join(root, 'src/main.bas'), 'utf8');
  const initial = await store.agentState([{ id: 'main', source: baseline + '30 REM UNSAVED' }]);
  const tools = new WorkspaceTools(initial, state => store.applyAgentState(state), hash, []);
  await tools.execute('reference_read', { id: 'END', startLine: 1, endLine: 1 });
  await tools.execute('project_create_source', { name: 'NEW', source: '10 END\n' });
  await tools.execute('project_replace_source', { id: 'main', expectedHash: hash(initial.files[0]!.source), source: '10 END\n' });
  const collision = structuredClone(tools.state);
  collision.files[0]!.saved = '10 REM CHANGED\n20 END\n';
  collision.manifest.sources.push({ id: 'owned', path: 'src/owned.bas', cpcName: 'OWNED.BAS' });
  collision.files.push({ id: 'owned', path: 'src/owned.bas', cpcName: 'OWNED.BAS', source: '10 END', saved: '10 END' });
  await writeFile(join(root, 'src/owned.bas'), 'EXTERNAL CONTENT');
  await assert.rejects(store.applyAgentState(collision), /EEXIST/);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 END\n');
  assert.equal(await readFile(join(root, 'src/owned.bas'), 'utf8'), 'EXTERNAL CONTENT');
  await store.applyAgentState(initial);
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), baseline);
  assert.equal(initial.files[0]!.source, baseline + '30 REM UNSAVED');
  await assert.rejects(readFile(join(root, 'src/new.bas')), /ENOENT/);
  assert.equal(JSON.parse(await readFile(join(root, 'microide.project.json'), 'utf8')).sources.length, 1);
});
test('controller rejects missing configuration and does not create secret files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-controller-')); const { store, snapshot } = await ProjectStore.create(root, 'No key');
  const storage = join(root, 'private'); await mkdir(storage);
  const controller = new AgentController(storage, 'knowledge/locomotive-basic');
  await assert.rejects(controller.start(store, 'Mission', snapshot.files), /clé API/);
  assert.equal(controller.configure('sk-test-fixture-not-real', DEFAULT_MODEL).configured, true);
  assert.equal(controller.configure('', DEFAULT_MODEL).configured, false);
});
