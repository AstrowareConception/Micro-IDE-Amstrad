import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newProject } from '../packages/workspace/src/project.ts';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { runAgent, createRunState } from '../packages/agent/src/runner.ts';
import { readUsage, estimateTurn, parseBudget } from '../packages/agent/src/consumption.ts';
import { parseOfficialPricing, fetchOfficialPricing } from '../apps/desktop/openai-pricing.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import { OpenAIProvider } from '../apps/desktop/openai-provider.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import type { AgentEvent, AgentWorkspaceState, ModelPort, PricingProfile } from '../packages/agent/src/types.ts';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const state = (): AgentWorkspaceState => ({ sessionId: 'session', manifest: newProject('Mahjong', '647f023d-1272-4b66-8c47-b064b8de9512'), files: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS', source: '10 END\n', saved: '10 END\n' }] });
const call = (id: string, name: string, args: unknown) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
const message = { type: 'message', content: [{ type: 'output_text', text: 'Titre créé ; DSK construit. Aucun CPC exécuté.' }] };
const objective = 'fais moi un ecran de titre pour mon jeu de mahjong en mode 1, le plus détaillé possible ! ecran fixe, je veux de la finesse dans les détails';
const fixtureTitle = '10 MODE 1\n20 BORDER 0:INK 0,0:INK 1,26:INK 2,6:INK 3,18\n30 PAPER 0:PEN 1:CLS\n40 LOCATE 15,3:PRINT "MAHJONG"\n50 FOR X=24 TO 616 STEP 148\n60 MOVE X,80:DRAW X+112,80:DRAW X+112,300:DRAW X,300:DRAW X,80\n70 NEXT X\n80 END\n';
// Controlled provider data, not an evaluation of a paid model or an aesthetic CPC oracle.
const markdown = 'Model ID: `gpt-5.6-luna`\n\n## Pricing\n\n### Text tokens\n\n| Input | $0.2 | 1M tokens |\n| Cached input | $0.02 | 1M tokens |\n| Output | $1.2 | 1M tokens |\n\n- Prompts with >272K input tokens are priced at 2x input and 1.5x output for the full request.\n- Cache writes are billed at 1.25x the uncached input token rate.\n\n## Endpoints\n';
const pricing = (): PricingProfile => parseOfficialPricing(markdown, 'gpt-5.6-luna');
const rawUsage = { total_tokens: 1200, input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 600, cache_write_tokens: 100 }, output_tokens_details: { reasoning_tokens: 80 } };

test('complete cards returned by search satisfy the write guard; batches report unknown commands without widening scope', async () => {
  const tools = new WorkspaceTools(state(), async () => undefined, hash, []);
  await tools.execute('reference_search', { query: 'PRINT' });
  await tools.execute('reference_search', { query: 'END' });
  await tools.execute('project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: '10 PRINT "TITLE"\n20 END\n' });
  const batch = await tools.execute('reference_read_many', { names: ['MODE', 'INK', 'DOES_NOT_EXIST'] }) as { missing: string[] };
  assert.deepEqual(batch.missing, ['DOES_NOT_EXIST']);
  await assert.rejects(tools.execute('project_replace_source', { id: 'main', expectedHash: hash(tools.state.files[0]!.source), source: '10 CLS\n20 END' }), /reference-required.*CLS.*reference_read_many/);
  await assert.rejects(tools.execute('reference_read_many', { names: Array(33).fill('PRINT') }), /invalid/);
});

test('mahjong mission pauses after 12 turns then resumes context and writes/builds the title with visible tool outcomes', async () => {
  const tools = new WorkspaceTools(state(), async () => undefined, hash, []), saved = createRunState(objective, {}), events: AgentEvent[] = [];
  let step = 0;
  const model: ModelPort = { respond: async input => {
    step++;
    assert.match(JSON.stringify(input[0]), /mahjong/);
    let output;
    if (step === 1) output = [call('read', 'project_read_file', { id: 'main', startLine: 1, endLine: 200 })];
    else if (step <= 12) output = [call(`ref-${step}`, 'reference_search', { query: 'MODE' })];
    else if (step === 13) { assert.match(JSON.stringify(input), /ref-12/); output = [call('batch', 'reference_read_many', { names: ['MODE', 'BORDER', 'INK', 'PAPER', 'PEN', 'CLS', 'LOCATE', 'PRINT', 'FOR', 'TO', 'STEP', 'MOVE', 'DRAW', 'NEXT', 'END'] })]; }
    else if (step === 14) output = [call('write', 'project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: fixtureTitle })];
    else if (step === 15) output = [call('build', 'build_project', {})];
    else output = [message];
    return { output, tokens: 1200, usage: readUsage(rawUsage, true)!, model: 'gpt-5.6-luna', serviceTier: 'default' };
  } };
  const options = { model, tools, objective, context: {}, state: saved, pricing: pricing(), signal: new AbortController().signal, emit: (event: AgentEvent) => events.push(event), takeSteering: () => [], maxTurns: 12 };
  const paused = await runAgent(options);
  assert.equal(paused.status, 'paused-limit'); assert.equal(paused.turns, 12); assert.equal(tools.state.files[0]!.source, '10 END\n');
  const completed = await runAgent(options);
  assert.equal(completed.status, 'completed'); assert.equal(completed.turns, 16); assert.equal(completed.tokens, 16 * 1200);
  assert.equal(completed.usage!.reasoning, 16 * 80); assert.equal(completed.costComplete, true);
  assert.equal(tools.state.files[0]!.source, fixtureTitle); assert.equal(tools.buildVerified, true);
  assert.ok(events.some(event => event.tool === 'project_replace_source' && event.success === true));
});

test('resuming a tool/token limit drains queued calls once and preserves replay/collision checks', async () => {
  for (const limit of ['calls', 'tokens']) {
    const tools = new WorkspaceTools(state(), async () => undefined, hash, []), saved = createRunState(objective, {});
    let requests = 0, executions = 0; const execute = tools.execute.bind(tools); tools.execute = async (...args) => { executions++; return execute(...args); };
    const model: ModelPort = { respond: async () => ({ tokens: 1000, output: ++requests === 1 ? [call('one', 'project_list_files', {}), call('two', 'project_list_files', {})] : [call('one', 'project_list_files', {}), message] }) };
    const options = { model, tools, objective, context: {}, state: saved, signal: new AbortController().signal, emit: () => undefined, takeSteering: () => [], maxTurns: 1, maxCalls: limit === 'calls' ? 1 : 60, maxTokens: limit === 'tokens' ? 1000 : 60000 };
    assert.equal((await runAgent(options)).status, 'paused-limit');
    await runAgent({ ...options, maxTurns: 2, maxCalls: 60, maxTokens: 60000 });
    assert.equal(executions, 2); assert.equal(saved.calls, 2);
    const collision: ModelPort = { respond: async () => ({ tokens: 1, output: [call('one', 'project_search', { query: 'END' })] }) };
    assert.equal((await runAgent({ ...options, model: collision })).status, 'failed');
  }
});

test('write errors are shown to users, fed to the model and bounded on stagnation; progress counters are live', async () => {
  const tools = new WorkspaceTools(state(), async () => undefined, hash, []), events: AgentEvent[] = []; let count = 0, progressCalls = 0;
  const result = await runAgent({ model: { respond: async input => { if (count) assert.match(JSON.stringify(input), /reference-required/); return { tokens: 1, output: [call(String(++count), 'project_replace_source', { id: 'main', expectedHash: hash('10 END\n'), source: '10 PRINT "TITLE"\n20 END' })] }; } }, tools, objective, context: {}, signal: new AbortController().signal, emit: event => events.push(event), takeSteering: () => [], progress: result => { progressCalls = Math.max(progressCalls, result.calls); } });
  assert.equal(result.status, 'paused-limit'); assert.equal(result.failedCalls, 3); assert.equal(progressCalls, 3);
  assert.equal(events.filter(event => event.success === false && /reference-required/.test(event.text)).length, 3);
});

test('pricing accounts for ordinary/cache-write/cache-read/output tokens once, long prompts, stale/unknown/tier/missing data', () => {
  const usage = readUsage(rawUsage, true)!;
  assert.equal(estimateTurn(usage, pricing(), 'gpt-5.6-luna', 'default'), (300 * .2 + 600 * .02 + 100 * .2 * 1.25 + 200 * 1.2) / 1e6);
  const longUsage = { ...usage, input: 300000 };
  assert.equal(estimateTurn(longUsage, pricing(), 'gpt-5.6-luna', 'default'), ((300000 - 700) * .4 + 600 * .04 + 100 * .4 * 1.25 + 200 * 1.8) / 1e6);
  for (const [profile, model, tier] of [[pricing(), 'new-unknown', 'default'], [pricing(), 'gpt-5.6-luna', 'priority'], [{ ...pricing(), fetchedAt: '2000-01-01T00:00:00Z' }, 'gpt-5.6-luna', 'default']] as const) assert.equal(estimateTurn(usage, profile, model, tier), undefined);
  assert.equal(estimateTurn(undefined, pricing(), 'gpt-5.6-luna', 'default'), undefined);
  assert.equal(readUsage({ ...rawUsage, input_tokens_details: { cached_tokens: 600 } }, true)!.complete, false);
  assert.equal(readUsage({ ...rawUsage, input_tokens_details: { cached_tokens: 9999 } }, true), undefined);
  assert.equal(readUsage({ total_tokens: 1200 }, true), undefined);
});

test('official pricing is public, bounded, unambiguous and fails closed on changed surcharge rules', async () => {
  const result = await fetchOfficialPricing('gpt-5.6-luna', async (url, init) => { assert.equal(url, 'https://developers.openai.com/api/docs/models/gpt-5.6-luna.md'); assert.ok(!JSON.stringify(init).includes('Authorization')); return new Response(markdown); });
  assert.equal(result.cacheWriteMultiplier, 1.25);
  for (const text of [markdown.replace('Model ID: `gpt-5.6-luna`', 'Model ID: `wrong`'), markdown.replace('## Endpoints', '- Unknown surcharge.\n\n## Endpoints'), markdown.replace('| Output | $1.2 | 1M tokens |', '| Output | Custom | 1M tokens |')]) assert.throws(() => parseOfficialPricing(text, 'gpt-5.6-luna'));
  await assert.rejects(fetchOfficialPricing('../private', async () => assert.fail()), /invalide/);
  await assert.rejects(fetchOfficialPricing('gpt-5.6-luna', async () => new Response('a'.repeat(65537))), /volumineux/);
});

test('dated snapshot prices use only the default mapping attested by the official model page', async () => {
  const dated = 'gpt-5.6-luna-2026-10-01', documented = markdown.replace('## Pricing', `- Default snapshot: \`${dated}\`\n\n## Pricing`);
  const transport: typeof fetch = async url => String(url).includes(dated) ? new Response('', { status: 404 }) : new Response(documented);
  const profile = await fetchOfficialPricing(dated, transport);
  assert.equal(profile.model, dated); assert.ok(profile.source.endsWith('gpt-5.6-luna'));
  assert.notEqual(estimateTurn(readUsage(rawUsage, true), profile, dated, 'default'), undefined);
  await assert.rejects(fetchOfficialPricing('gpt-5.6-luna-2026-09-01', transport), /correspondance/);
  const alias = parseOfficialPricing(documented, 'gpt-5.6-luna');
  assert.notEqual(estimateTurn(readUsage(rawUsage, true), alias, dated, 'default'), undefined);
});

test('incomplete and cancelled responses retain known billed usage and never execute their proposed writes', async () => {
  const provider = new OpenAIProvider('sk-test-fixture-not-real', 'gpt-5.6-luna', async () => Response.json({ status: 'incomplete', output: [call('write', 'project_create_source', { name: 'OTHER', source: '10 END' })], usage: rawUsage, model: 'gpt-5.6-luna', service_tier: 'default' }));
  const tools = new WorkspaceTools(state(), async () => assert.fail(), hash, []);
  const result = await runAgent({ model: provider, tools, objective, context: {}, pricing: pricing(), signal: new AbortController().signal, emit: () => undefined, takeSteering: () => [] });
  assert.equal(result.status, 'failed'); assert.equal(result.tokens, 1200); assert.equal(result.calls, 0); assert.equal(result.costComplete, true);
  const abort = new AbortController();
  const cancelled = await runAgent({ model: { respond: async () => { abort.abort(); return { tokens: 1200, output: [call('write', 'project_list_files', {})], usage: readUsage(rawUsage, true)!, model: 'gpt-5.6-luna', serviceTier: 'default' }; } }, tools, objective, context: {}, pricing: pricing(), signal: abort.signal, emit: () => undefined, takeSteering: () => [] });
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.tokens, 1200); assert.equal(cancelled.calls, 0);
});

test('controller resumes the same task/checkpoint but refuses edited buffers, external changes and restored tasks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cpc-mission-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'project'));
  const { store, snapshot } = await ProjectStore.create(join(root, 'project'), 'Mahjong'); let step = 0;
  const controller = new AgentController(join(root, 'checkpoints'), join(process.cwd(), 'knowledge/locomotive-basic'), async () => Response.json({ status: 'completed', output: ++step === 1 ? [call('ref', 'reference_read_many', { names: ['END', 'PRINT'] })] : step === 2 ? [call('write', 'project_replace_source', { id: 'main', expectedHash: hash((await store.agentState([{ id: 'main', source: initial }])).files[0]!.source), source: '10 PRINT "RESUMED"\n20 END\n' })] : step === 3 ? [call('build', 'build_project', {})] : [message], usage: { total_tokens: 1 } }));
  const initial = snapshot.files[0]!.source;
  controller.configure('sk-test-fixture-not-real', 'gpt-5.6-luna');
  const { taskId } = await controller.start(store, objective, [{ id: 'main', source: initial }], false, { maxTurns: 1, maxCalls: 60, maxTokens: 60000 });
  const settle = async (id = taskId) => {
    const deadline = Date.now() + 10000;
    while (controller.running && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(controller.running, false, 'The controlled mission must finish before inspecting its checkpoint.');
    return controller.status(id);
  };
  assert.equal((await settle()).resumable, true);
  await assert.rejects(controller.resume(taskId, store, [{ id: 'main', source: initial + '30 REM USER\n' }]), /stale-read/);
  await writeFile(join(store.root, 'src/main.bas'), initial + '30 REM EXTERNAL\n');
  await assert.rejects(controller.resume(taskId, store, [{ id: 'main', source: initial }]), /changé sur disque/);
  await writeFile(join(store.root, 'src/main.bas'), initial);
  assert.equal((await controller.resume(taskId, store, [{ id: 'main', source: initial }])).taskId, taskId); await settle();
  assert.equal(await readFile(join(store.root, 'src/main.bas'), 'utf8'), '10 PRINT "RESUMED"\n20 END\n');
  const checkpoint = JSON.parse(await readFile(join(root, 'checkpoints', taskId, 'checkpoint.json'), 'utf8'));
  assert.equal(checkpoint.initial.files[0].source, initial);
  await controller.restore(taskId, [{ id: 'main', source: '10 PRINT "RESUMED"\n20 END\n' }]);
  await assert.rejects(controller.resume(taskId, store, [{ id: 'main', source: initial }]), /ne peut pas être reprise/);
  for (const key of ['', 'sk-replacement-fixture-key']) {
    step = 0;
    const next = await controller.start(store, objective, [{ id: 'main', source: initial }], false, { maxTurns: 1, maxCalls: 60, maxTokens: 60000 });
    assert.equal((await settle(next.taskId)).resumable, true);
    controller.configure(key, 'gpt-5.6-luna');
    assert.equal(controller.status(next.taskId).resumable, false);
    await assert.rejects(controller.resume(next.taskId, store, [{ id: 'main', source: initial }]), /ne peut pas être reprise/);
    assert.equal(step, 1);
    controller.configure('sk-test-fixture-not-real', 'gpt-5.6-luna');
  }
});

test('budget defaults and IPC values have finite integer bounds', () => {
  assert.equal(parseBudget(undefined).maxTurns, 20);
  for (const value of [{ maxTurns: 0, maxCalls: 60, maxTokens: 60000 }, { maxTurns: 101, maxCalls: 60, maxTokens: 60000 }, { maxTurns: 20, maxCalls: 60, maxTokens: Infinity }, { maxTurns: 20, maxCalls: 60, maxTokens: 60000, extra: true }]) assert.throws(() => parseBudget(value));
});

test('provider failures expose partial usage and missing effective model never produces an estimate', async () => {
  const tools = new WorkspaceTools(state(), async () => undefined, hash, []);
  const failed = await runAgent({ model: { respond: async () => { throw new Error('Quota OpenAI (429).'); } }, tools, objective, context: {}, signal: new AbortController().signal, emit: () => undefined, takeSteering: () => [] });
  assert.equal(failed.status, 'failed'); assert.equal(failed.usage!.complete, false); assert.equal(failed.costComplete, false);
  const provider = new OpenAIProvider('sk-test-fixture-not-real', 'gpt-5.6-luna', async () => Response.json({ status: 'completed', output: [message], usage: rawUsage, service_tier: 'default' }));
  const turn = await provider.respond([], [], new AbortController().signal);
  assert.equal(turn.model, undefined);
  assert.equal(estimateTurn(turn.usage, pricing(), turn.model, turn.serviceTier), undefined);
});
