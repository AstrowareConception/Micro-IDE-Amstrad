import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { gitHttpsFixture } from './git-https-fixture.ts';
import { GitInspection, GIT_NULL } from '../apps/desktop/git-inspection.ts';
import { GitOperations } from '../apps/desktop/git-operations.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { PROJECT_GIT_IGNORE } from '../packages/version-control/src/inspection.ts';
import type { GitRequest } from '../packages/version-control/src/operations.ts';
const git = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: GIT_NULL, GIT_CONFIG_NOSYSTEM: '1' } });
async function perform(operations: GitOperations, request: GitRequest) { const state = await operations.overview(); const plan = await operations.prepare(state.revision, request); return operations.apply(plan.id); }
test('real authenticated HTTPS supports push, private-style clone, fetch/pull and rejects credentials/TLS without exposing secrets', { skip: process.platform === 'win32', timeout: 60_000 }, async () => {
  const server = await gitHttpsFixture();
  try {
    const a = join(server.root, 'A'), b = join(server.root, 'B');
    await mkdir(join(a, 'src'), { recursive: true }); await mkdir(b);
    await writeFile(join(a, 'microide.project.json'), JSON.stringify(newProject('HTTPS fixture', randomUUID()))); await writeFile(join(a, 'src/main.bas'), '10 REM HTTPS ORIGINAL\n20 END\n');
    await writeFile(join(a, '.gitignore'), PROJECT_GIT_IGNORE); git(a, 'init', '--quiet', '--initial-branch=main'); git(a, 'add', '.'); git(a, 'commit', '--quiet', '-m', 'Original');
    const options = { certificateAuthority: server.certificate, authorization: (url: string) => url === server.url ? server.authorization : undefined };
    const first = new GitOperations(a, new GitInspection(a, () => ['src/main.bas']), options);
    await perform(first, { action: 'add-remote', remote: 'origin', url: server.url }); await perform(first, { action: 'push', remote: 'origin', branch: 'main' });
    const second = new GitOperations(b, new GitInspection(b, () => ['src/main.bas']), options); await second.clone(server.url);
    assert.match(await readFile(join(b, 'src/main.bas'), 'utf8'), /HTTPS ORIGINAL/);
    await writeFile(join(b, 'src/main.bas'), '10 REM HTTPS ADVANCE\n20 END\n'); git(b, 'commit', '-am', 'Advance');
    await perform(second, { action: 'push', remote: 'origin', branch: 'main' });
    await perform(first, { action: 'fetch', remote: 'origin' }); assert.equal((await first.overview()).behind, 1);
    await perform(first, { action: 'pull', remote: 'origin', branch: 'main' }); assert.match(await readFile(join(a, 'src/main.bas'), 'utf8'), /HTTPS ADVANCE/);
    const wrong = new GitOperations(a, new GitInspection(a, () => ['src/main.bas']), { certificateAuthority: server.certificate, authorization: () => 'Basic WRONG_FIXTURE' });
    await assert.rejects(perform(wrong, { action: 'fetch', remote: 'origin' }), error => { assert.doesNotMatch(String(error), /WRONG_FIXTURE|not-a-personal/); return /refusée/.test(String(error)); });
    const noTrust = new GitOperations(a, new GitInspection(a, () => ['src/main.bas']), { authorization: () => server.authorization });
    await assert.rejects(perform(noTrust, { action: 'fetch', remote: 'origin' }), /refusée/);
    assert.ok(server.requests.some(entry => entry.method === 'POST' && entry.authorized)); assert.ok(server.requests.some(entry => !entry.authorized));
    assert.doesNotMatch(await readFile(join(a, '.git/config'), 'utf8'), /Authorization|not-a-personal/);
    const state = await first.overview(), plan = await first.prepare(state.revision, { action: 'fetch', remote: 'origin' });
    const count = server.requests.length, before = await readFile(join(a, 'src/main.bas'));
    server.stall(true); const pending = first.apply(plan.id); const rejected = assert.rejects(pending, /interrompue/);
    try {
      for (let attempt = 0; server.requests.length === count && attempt < 200; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(server.requests.length > count, 'real TLS transfer started'); assert.equal(first.cancel().stopped, true);
      await rejected;
      assert.deepEqual(await readFile(join(a, 'src/main.bas')), before); assert.equal((await first.overview()).head, state.head);
    } finally { server.stall(false); }
  } finally { await server.close(); }
});
