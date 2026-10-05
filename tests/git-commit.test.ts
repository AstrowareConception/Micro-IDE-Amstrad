import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, lstat, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitInspection } from '../apps/desktop/git-inspection.ts';
import { commitInput } from '../packages/version-control/src/inspection.ts';
const identity = { name: 'Auteur de test', email: 'author@example.invalid', message: 'Premier commit\n\nDétails Unicode : été.' };
const git = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Outside', '-c', 'user.email=outside@example.invalid', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cpceleste-commit-')); await mkdir(join(root, 'src')); await writeFile(join(root, 'src/main.bas'), '10 REM INDEXED\n20 END\n');
  git(root, 'init', '--quiet', '--initial-branch=main'); git(root, 'add', '--', 'src/main.bas');
  return { root, inspector: new GitInspection(root, () => ['src/main.bas']) };
}
test('first and subsequent commits use exact staged bytes, explicit identity/message, preserve real index/config/worktree and reflog', async () => {
  const { root, inspector } = await fixture(); await writeFile(join(root, 'src/main.bas'), '10 REM WORKTREE ONLY\n20 END\n');
  const index = await readFile(join(root, '.git/index')), config = await readFile(join(root, '.git/config'));
  const plan = await inspector.prepareCommit(identity); assert.equal(plan.head, '(initial)'); assert.match(plan.diff, /INDEXED/); assert.doesNotMatch(plan.diff, /WORKTREE ONLY/);
  assert.throws(() => git(root, 'rev-parse', '--verify', 'HEAD'));
  const result = await inspector.commit(plan.id); assert.equal(git(root, 'show', 'HEAD:src/main.bas'), '10 REM INDEXED\n20 END\n');
  assert.equal(git(root, 'show', '-s', '--format=%an <%ae>%n%cn <%ce>%n%B', 'HEAD').trim(), 'Auteur de test <author@example.invalid>\nAuteur de test <author@example.invalid>\nPremier commit\n\nDétails Unicode : été.');
  assert.deepEqual(await readFile(join(root, '.git/index')), index); assert.deepEqual(await readFile(join(root, '.git/config')), config); assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 REM WORKTREE ONLY\n20 END\n');
  assert.equal(result.status.changes[0]!.worktree, 'M'); assert.ok(git(root, 'reflog', 'show', 'main').includes('CPCéleste'));
  await assert.rejects(inspector.commit(plan.id), /périmé/);
  git(root, 'add', '--', 'src/main.bas'); const next = await inspector.prepareCommit({ ...identity, message: 'Second' }); const second = await inspector.commit(next.id);
  assert.equal(git(root, 'rev-parse', 'HEAD^').trim(), result.oid); assert.equal(git(root, 'rev-parse', 'HEAD').trim(), second.oid);
  assert.equal((await inspector.history()).commits.length, 2);
});
test('stale index, working bytes, HEAD, branch and config invalidate the prepared commit without another commit', async () => {
  for (const change of ['index', 'working', 'head', 'branch', 'config']) {
    const { root, inspector } = await fixture(); const plan = await inspector.prepareCommit(identity);
    if (change === 'index') { await writeFile(join(root, 'src/main.bas'), '10 END\n'); git(root, 'add', '--', 'src/main.bas'); }
    if (change === 'working') await writeFile(join(root, 'src/main.bas'), '10 END\n');
    if (change === 'head') git(root, 'commit', '--quiet', '-m', 'Outside');
    if (change === 'branch') git(root, 'symbolic-ref', 'HEAD', 'refs/heads/other');
    if (change === 'config') git(root, 'config', 'user.name', 'Changed');
    const config = await readFile(join(root, '.git/config')), index = await readFile(join(root, '.git/index'));
    await assert.rejects(inspector.commit(plan.id), /modifiés|refusé/);
    assert.deepEqual(await readFile(join(root, '.git/config')), config); assert.deepEqual(await readFile(join(root, '.git/index')), index);
    await assert.rejects(lstat(join(root, '.git/index.lock')), { code: 'ENOENT' });
    if (change === 'head') assert.equal(git(root, 'rev-list', '--count', 'HEAD').trim(), '1'); else assert.throws(() => git(root, 'rev-parse', '--verify', 'HEAD'));
  }
});
test('private staged paths, links, binary/oversize files, empty index and detached/operation states are refused', async () => {
  for (const name of ['documents/private.md', '.env', '.microide/private.txt']) {
    const { root, inspector } = await fixture(); await mkdir(join(root, name.split('/').slice(0, -1).join('/')), { recursive: true }); await writeFile(join(root, name), 'PRIVATE'); git(root, 'add', '--', name);
    await assert.rejects(inspector.prepareCommit(identity), /autres contenus/);
  }
  for (const content of [Buffer.from('10\0END'), Buffer.alloc(1024 * 1024 + 1, 65)]) {
    const { root, inspector } = await fixture(); await writeFile(join(root, 'src/main.bas'), content); git(root, 'add', '--', 'src/main.bas'); await assert.rejects(inspector.prepareCommit(identity));
  }
  const { root, inspector } = await fixture(); git(root, 'update-index', '--cacheinfo', '120000', git(root, 'rev-parse', ':src/main.bas').trim(), 'src/main.bas'); await assert.rejects(inspector.prepareCommit(identity), /sans lien/);
  git(root, 'update-index', '--force-remove', '--', 'src/main.bas'); await assert.rejects(inspector.prepareCommit(identity), /vide/);
  git(root, 'add', '--', 'src/main.bas'); git(root, 'commit', '--quiet', '-m', 'Outside'); git(root, 'checkout', '--quiet', '--detach'); await assert.rejects(inspector.prepareCommit(identity), /Branche/);
  git(root, 'checkout', '--quiet', 'main'); await writeFile(join(root, '.git/MERGE_HEAD'), git(root, 'rev-parse', 'HEAD')); await assert.rejects(inspector.prepareCommit(identity), /en cours/);
});
test('existing locks are preserved, hooks do not run, and tracked unchanged files outside scope survive', async () => {
  const { root, inspector } = await fixture(); const plan = await inspector.prepareCommit(identity); await writeFile(join(root, '.git/index.lock'), 'OUTSIDE LOCK');
  await assert.rejects(inspector.commit(plan.id), /verrouillé/); assert.equal(await readFile(join(root, '.git/index.lock'), 'utf8'), 'OUTSIDE LOCK');
  const next = await fixture(); await mkdir(join(next.root, '.git/hooks'), { recursive: true });
  for (const hook of ['pre-commit', 'commit-msg', 'post-commit', 'reference-transaction']) { const path = join(next.root, '.git/hooks', hook); await writeFile(path, '#!/bin/sh\ntouch HOOK_RAN\nexit 1\n'); await chmod(path, 0o700); }
  const ready = await next.inspector.prepareCommit(identity); await next.inspector.commit(ready.id); await assert.rejects(lstat(join(next.root, 'HOOK_RAN')), { code: 'ENOENT' });
});
test('identity/message validation treats option-like text literally and refuses controls or unknown keys', async () => {
  assert.equal(commitInput({ name: '--author', email: 'x@y', message: '--amend\n\n$(literal)' }).message, '--amend\n\n$(literal)\n');
  for (const invalid of [{ ...identity, name: 'Bad\nName' }, { ...identity, email: 'Bad\nEmail@x' }, { ...identity, message: ' ' }, { ...identity, message: 'A\0B' }, { ...identity, message: 'X'.repeat(8193) }, { ...identity, extra: true }]) assert.throws(() => commitInput(invalid));
});
test('Git prepared locks block branch switches and later working edits abort publication cleanly', async () => {
  for (const mode of ['edit', 'switch']) {
    const { root, inspector } = await fixture(); const plan = await inspector.prepareCommit(identity);
    const original = inspector['run'].bind(inspector);
    inspector['run'] = async (args, cwd, indexFile, options) => {
      if (options?.prepared) {
        const check = options.prepared;
        options = { ...options, prepared: async () => {
          assert.ok((await lstat(join(root, '.git/HEAD.lock'))).isFile());
          if (mode === 'edit') await writeFile(join(root, 'src/main.bas'), '10 REM LATE EDIT\n');
          else assert.throws(() => git(root, 'symbolic-ref', 'HEAD', 'refs/heads/other'));
          await check();
        } };
      }
      return original(args, cwd, indexFile, options);
    };
    if (mode === 'edit') { await assert.rejects(inspector.commit(plan.id), /modifiés/); assert.throws(() => git(root, 'rev-parse', '--verify', 'HEAD')); }
    else assert.equal((await inspector.commit(plan.id)).branch, 'main');
    for (const path of ['.git/index.lock', '.git/HEAD.lock', '.git/refs/heads/main.lock']) await assert.rejects(lstat(join(root, path)), { code: 'ENOENT' });
  }
});
test('unchanged tracked files outside scope survive, staged deletion is exact and repository config stays untouched', async () => {
  const { root, inspector } = await fixture(); await writeFile(join(root, 'README.md'), 'EXISTING'); git(root, 'add', '--', 'README.md'); git(root, 'commit', '-q', '-m', 'Outside baseline');
  const config = await readFile(join(root, '.git/config')); git(root, 'rm', '--', 'src/main.bas');
  const plan = await inspector.prepareCommit(identity); assert.deepEqual(plan.files, [{ path: 'src/main.bas', status: 'D' }]); await inspector.commit(plan.id);
  assert.equal(git(root, 'show', 'HEAD:README.md'), 'EXISTING'); assert.throws(() => git(root, 'show', 'HEAD:src/main.bas'));
  assert.deepEqual(await readFile(join(root, '.git/config')), config);
});
