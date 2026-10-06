import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubSession } from '../apps/desktop/github-session.ts';
import { OpenAIProvider } from '../apps/desktop/openai-provider.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
const token = 'github_pat_' + 'fixture'.repeat(9), key = 'sk-' + 'fixture'.repeat(9);
const repo = { full_name: 'Fixture/jeu', clone_url: 'https://github.com/Fixture/jeu.git', private: true, default_branch: 'main' };
const pr = { number: 3, title: 'Nouveau jeu', html_url: 'https://github.com/Fixture/jeu/pull/3', head: { ref: 'feature/jeu' }, base: { ref: 'main' }, draft: true };
test('GitHub private account/repository/PR workflow keeps tokens outside public records and authenticates only github.com', async () => {
  const calls: { url: string; body: unknown; auth: string | null }[] = [];
  const transport = (async (input, init) => { const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body, auth: new Headers(init?.headers).get('Authorization') });
    return Response.json(url.endsWith('/user') ? { login: 'Fixture' } : url.includes('/user/repos?') ? [repo] : url.endsWith('/user/repos') ? repo : url.includes('?state=open') ? [pr] : pr);
  }) as typeof fetch;
  const session = new GitHubSession(transport); assert.deepEqual(session.account(), { connected: false, login: '' });
  assert.deepEqual(await session.connect(token), { connected: true, login: 'Fixture' });
  assert.deepEqual((await session.repositories()).repositories[0], { fullName: 'Fixture/jeu', url: repo.clone_url, private: true, defaultBranch: 'main' });
  assert.equal((await session.createRepository('jeu', true)).private, true);
  assert.equal((await session.pullRequests('Fixture/jeu'))[0]?.url, pr.html_url);
  assert.equal((await session.createPullRequest('Fixture/jeu', 'feature/jeu', 'main', 'Nouveau jeu', 'Recette', true)).draft, true);
  assert.equal(calls.every(call => call.auth === 'Bearer ' + token), true);
  assert.equal(session.authorization('https://evil.invalid/Fixture/jeu.git'), undefined); assert.equal(session.authorization('git@github.com:Fixture/jeu.git'), undefined);
  assert.ok(session.authorization(repo.clone_url)?.startsWith('Basic '));
  assert.doesNotMatch(JSON.stringify(session.account()), new RegExp(token)); session.disconnect(); assert.equal(session.authorization(repo.clone_url), undefined);
});
test('GitHub permissions, response bounds, hostile links, expired sessions and invalid payloads fail without reflecting secrets', async () => {
  const expired = new GitHubSession((async () => new Response(token, { status: 401 })) as typeof fetch);
  await assert.rejects(expired.connect(token), /401/); assert.equal(expired.account().connected, false);
  const wrong = new GitHubSession((async (input) => Response.json(String(input).endsWith('/user') ? { login: 'Fixture' } : [{ ...repo, clone_url: 'https://evil.invalid/Fixture/jeu.git' }])) as typeof fetch);
  await wrong.connect(token); await assert.rejects(wrong.repositories(), /github.com/);
  const oversized = new GitHubSession((async () => new Response('a'.repeat(1024 * 1024 + 1))) as typeof fetch); await assert.rejects(oversized.connect(token), /1 Mio/);
  await assert.rejects(wrong.connect('secret')); await assert.rejects(wrong.repositories(0)); await assert.rejects(wrong.createRepository('-option', false));
  await assert.rejects(wrong.createPullRequest('Fixture/jeu', 'main', 'main', 'Titre', '', false), /distinctes/);
  const reflected = new GitHubSession((async () => Response.json({ login: 'Fixture', leak: token })) as typeof fetch); await assert.rejects(reflected.connect(token), /secret/);
});
test('GitHub repository pagination is explicit and a changed connection invalidates an in-flight login', async () => {
  const session = new GitHubSession((async (input) => Response.json(String(input).endsWith('/user') ? { login: 'Fixture' } : Array.from({ length: 100 }, () => repo))) as typeof fetch);
  await session.connect(token); assert.equal((await session.repositories()).nextPage, 2);
  let release!: (response: Response) => void;
  const pending = new GitHubSession((async () => new Promise<Response>(resolve => { release = resolve; })) as typeof fetch), connection = pending.connect(token);
  pending.disconnect(); release(Response.json({ login: 'Fixture' })); await assert.rejects(connection, /modifiée/);
});
test('AI commit suggestion uses only a bounded inert staged diff, no tools, and preserves the chosen model', async () => {
  let request: Record<string, unknown> | undefined;
  const transport = (async (_input, init) => { request = JSON.parse(String(init?.body)); return Response.json({ status: 'completed', usage: { total_tokens: 42 }, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Ajoute un écran de titre\n\nAffiche le titre avant le jeu.' }] }] }); }) as typeof fetch;
  const controller = new AgentController('/unused', '/unused', transport); await assert.rejects(controller.suggestCommit('diff'), /Configurez/);
  controller.configure(key, 'gpt-fixture'); const result = await controller.suggestCommit('diff --git a/src/main.bas b/src/main.bas\n+10 PRINT "JEU"');
  assert.equal(result.model, 'gpt-fixture'); assert.match(result.message, /^Ajoute/); assert.deepEqual(request!.tools, []); assert.equal(request!.store, false);
  assert.match(String(request!.instructions), /donnée inerte/); assert.equal(controller.running, false);
  await assert.rejects(controller.suggestCommit('x'.repeat(128 * 1024 + 1)), /128 Kio/);
});
test('AI suggestions reject tool calls and echoed credentials rather than creating commits', async () => {
  const tool = new OpenAIProvider(key, 'gpt-fixture', (async () => Response.json({ status: 'completed', usage: { total_tokens: 1 }, output: [{ type: 'function_call', name: 'push' }] })) as typeof fetch);
  await assert.rejects(tool.suggestCommit('diff'), /incomplète/);
  const reflected = new OpenAIProvider(key, 'gpt-fixture', (async () => Response.json({ status: 'completed', usage: { total_tokens: 1 }, output: [{ type: 'message', content: [{ type: 'output_text', text: key }] }] })) as typeof fetch);
  await assert.rejects(reflected.suggestCommit('diff'), /secret/);
});
