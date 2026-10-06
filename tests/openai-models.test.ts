import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../apps/desktop/openai-provider.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';

const key = 'sk-test-models-not-real';
const row = (id: string, created = 100) => ({ id, created, owned_by: 'openai', object: 'model' });

test('official model listing is fresh, bounded, secret-free and admits future GPT families', async () => {
  let requests = 0;
  const provider = new OpenAIProvider(key, 'gpt-test', async (url, init) => {
    requests++; assert.equal(url, 'https://api.openai.com/v1/models'); assert.equal(init?.method, 'GET');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error'); assert.equal(init?.body, undefined);
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${key}`);
    return Response.json({ data: [row('gpt-99-future', 300), row('gpt-4.1', 200), row('gpt-4.1', 200), row('o3'), row('tts-1'), row('gpt-4o-audio-preview'), row('gpt-image-1'), row('text-embedding-3-small'), { ...row('gpt-4-retired'), shutdown_date: '2000-01-01' }, { id: '<script>' }, { ...row('gpt-100'), created: -1 }] });
  });
  assert.deepEqual((await provider.listModels()).map(item => item.id), ['gpt-99-future', 'gpt-4.1', 'o3']);
  await provider.listModels(); assert.equal(requests, 2);
  const changed = provider.withModel('gpt-99-future'); assert.equal(changed.model, 'gpt-99-future');
  assert.ok(!JSON.stringify(await provider.listModels()).includes(key));
});

test('model errors never reflect provider bodies or credentials and malformed/oversize catalogues fail', async () => {
  for (const response of [new Response(key, { status: 401 }), new Response(key, { status: 403 }), new Response(key, { status: 429 }), new Response('not-json'), Response.json({ data: [] }), Response.json({ data: [row(key)] }), new Response('X'.repeat(1024 * 1024 + 1)), new Response(new ReadableStream({ start(controller) { controller.error(new Error(key)); } }))]) {
    const provider = new OpenAIProvider(key, 'gpt-test', async () => response);
    await assert.rejects(provider.listModels(), error => error instanceof Error && !error.message.includes(key));
  }
  await assert.rejects(new OpenAIProvider(key, 'gpt-test', async () => { throw new Error(key); }).listModels(), /connexion ou délai/);
});

test('connect requires an explicit listed choice, refresh retains selection and adopts new/removed models', async () => {
  let ids = ['gpt-99-future', 'gpt-4.1'];
  const controller = new AgentController('/unused', '/unused', async () => Response.json({ data: ids.map(id => row(id)) }));
  const connected = await controller.models(key); assert.equal(connected.model, '');
  assert.throws(() => controller.selectModel('forged'), /liste OpenAI/);
  assert.deepEqual(controller.selectModel('gpt-4.1'), { model: 'gpt-4.1' });
  ids = ['gpt-100-new', 'gpt-4.1']; const refreshed = await controller.models();
  assert.equal(refreshed.model, 'gpt-4.1'); assert.ok(refreshed.models.some(item => item.id === 'gpt-100-new'));
  refreshed.models.length = 0; assert.deepEqual(controller.selectModel('gpt-100-new'), { model: 'gpt-100-new' });
  ids = ['gpt-4.1']; await controller.models(); assert.throws(() => controller.selectModel('gpt-100-new'), /liste OpenAI/);
  controller.configure('', ''); await assert.rejects(controller.models(), /Configurez une clé/);
  assert.throws(() => controller.selectModel('gpt-4.1'), /liste OpenAI/);
});

test('a delayed listing cannot resurrect a forgotten key or replace newer configuration', async () => {
  let release: ((response: Response) => void) | undefined;
  const controller = new AgentController('/unused', '/unused', async () => new Promise<Response>(resolve => { release = resolve; }));
  const pending = controller.models(key); controller.configure('', '');
  release!(Response.json({ data: [row('gpt-99-future')] }));
  await assert.rejects(pending, /Configuration modifiée/);
  await assert.rejects(controller.models(), /Configurez une clé/);
});
