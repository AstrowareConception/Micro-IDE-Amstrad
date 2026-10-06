import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, realpath, symlink } from 'node:fs/promises';
import { tmpdir, devNull } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GitInspection } from '../apps/desktop/git-inspection.ts';
import { GitOperations } from '../apps/desktop/git-operations.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { branchName, remoteUrl, githubRepository, type GitRequest } from '../packages/version-control/src/operations.ts';
import { PROJECT_GIT_IGNORE } from '../packages/version-control/src/inspection.ts';
const git = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
  { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1' }, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
async function fixture() {
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'cpceleste-git-ops-'))), a = join(temp, 'A'), remote = join(temp, 'remote.git'), b = join(temp, 'B');
  await mkdir(join(a, 'src'), { recursive: true }); await mkdir(remote);
  await writeFile(join(a, 'microide.project.json'), JSON.stringify(newProject('Git fixture', randomUUID())));
  await writeFile(join(a, 'src/main.bas'), '10 REM ORIGINAL\n20 END\n'); await writeFile(join(a, '.gitignore'), PROJECT_GIT_IGNORE);
  git(a, 'init', '--quiet', '--initial-branch=main'); git(a, 'add', '.'); git(a, 'commit', '--quiet', '-m', 'Initial');
  git(remote, 'init', '--bare', '--quiet', '--initial-branch=main');
  const inspector = new GitInspection(a, () => ['src/main.bas']), operations = new GitOperations(a, inspector, { approvedLocal: [remote] });
  return { temp, a, b, remote, inspector, operations };
}
async function perform(operations: GitOperations, request: GitRequest) { const state = await operations.overview(); const plan = await operations.prepare(state.revision, request); return operations.apply(plan.id); }
test('typed branches/remotes reject credentials, helpers, malformed refs and unapproved local paths', () => {
  for (const value of ['-bad', 'a..b', 'a//b', 'a/.hidden', 'a.lock', 'HEAD', 'a\nb', 'a@{x}', 'a/']) assert.throws(() => branchName(value));
  for (const value of ['ext::touch bad', 'file:///tmp/remote', '/tmp/remote', 'http://example.org/x', 'https://user:secret@example.org/x', 'https://github.com/a/b?token=secret']) assert.throws(() => remoteUrl(value));
  assert.equal(branchName('feature/jeu-cpc'), 'feature/jeu-cpc'); assert.equal(remoteUrl('https://github.com/Astro/jeu.git'), 'https://github.com/Astro/jeu.git');
  assert.equal(githubRepository('git@github.com:Astro/jeu.git'), 'Astro/jeu'); assert.throws(() => githubRepository('https://evil.invalid/a/b'));
});
test('remote configuration and local branches use previews, stale/replay guards and clean switching', async () => {
  const { a, remote, inspector, operations } = await fixture();
  await perform(operations, { action: 'add-remote', remote: 'origin', url: remote });
  assert.equal((await operations.overview()).remotes[0]?.url, remote);
  await perform(operations, { action: 'create-branch', branch: 'feature/jeu' });
  const state = await operations.overview(), stale = await operations.prepare(state.revision, { action: 'create-branch', branch: 'later' });
  await writeFile(join(a, 'src/main.bas'), '10 REM CHANGED\n20 END\n'); await assert.rejects(operations.apply(stale.id), /modifié/);
  git(a, 'restore', 'src/main.bas'); await assert.rejects(operations.apply(stale.id), /périmé/);
  git(a, 'switch', 'feature/jeu'); await writeFile(join(a, 'src/main.bas'), '10 REM FEATURE\n20 END\n'); git(a, 'commit', '-am', 'Feature');
  git(a, 'switch', 'main');
  const result = await perform(operations, { action: 'switch-branch', branch: 'feature/jeu' });
  assert.equal(result.changesFiles, true); assert.match(await readFile(join(a, 'src/main.bas'), 'utf8'), /FEATURE/);
  await assert.rejects(perform(operations, { action: 'delete-branch', branch: 'feature/jeu' }), /autre/);
  await perform(operations, { action: 'switch-branch', branch: 'main' });
  await assert.rejects(perform(operations, { action: 'delete-branch', branch: 'feature/jeu' }), /fusionnée/);
  await writeFile(join(a, 'notes.txt'), 'UNTRACKED'); await assert.rejects(perform(operations, { action: 'switch-branch', branch: 'feature/jeu' }), /arbitrez/);
  assert.equal((await inspector.status()).branch, 'main');
  await perform(operations, { action: 'set-remote', remote: 'origin', url: remote }); await perform(operations, { action: 'remove-remote', remote: 'origin' });
  assert.deepEqual((await operations.overview()).remotes, []);
});
test('two clones support first push/upstream, fetch, fast-forward and refuse divergence without changing sources', async () => {
  const { a, b, remote, operations } = await fixture();
  await perform(operations, { action: 'add-remote', remote: 'origin', url: remote });
  const state = await operations.overview(), push = await operations.prepare(state.revision, { action: 'push', remote: 'origin', branch: 'main' });
  assert.equal(push.commits, 1); assert.ok(push.files.includes('src/main.bas'));
  await operations.apply(push.id); assert.equal(git(remote, 'rev-parse', 'main'), git(a, 'rev-parse', 'HEAD'));
  assert.equal((await operations.overview()).branches.find(entry => entry.current)?.upstream, 'origin/main');
  git(a, 'clone', '--quiet', '--branch', 'main', remote, b);
  await writeFile(join(b, 'src/main.bas'), '10 REM REMOTE ADVANCE\n20 END\n'); git(b, 'commit', '-am', 'Remote'); git(b, 'push', 'origin', 'main');
  await perform(operations, { action: 'fetch', remote: 'origin' });
  assert.equal((await operations.overview()).behind, 1); assert.match(await readFile(join(a, 'src/main.bas'), 'utf8'), /ORIGINAL/);
  await perform(operations, { action: 'pull', remote: 'origin', branch: 'main' }); assert.match(await readFile(join(a, 'src/main.bas'), 'utf8'), /REMOTE ADVANCE/);
  await writeFile(join(a, 'src/main.bas'), '10 REM LOCAL\n20 END\n'); git(a, 'commit', '-am', 'Local');
  await writeFile(join(b, 'src/main.bas'), '10 REM OTHER\n20 END\n'); git(b, 'commit', '-am', 'Other'); git(b, 'push', 'origin', 'main');
  await perform(operations, { action: 'fetch', remote: 'origin' }); const before = git(a, 'rev-parse', 'HEAD'), source = await readFile(join(a, 'src/main.bas'));
  await assert.rejects(perform(operations, { action: 'pull', remote: 'origin', branch: 'main' }), /divergentes/);
  await assert.rejects(perform(operations, { action: 'push', remote: 'origin', branch: 'main' }), /avance/);
  assert.equal(git(a, 'rev-parse', 'HEAD'), before); assert.deepEqual(await readFile(join(a, 'src/main.bas')), source);
});
test('invalid projects, ignored-file collisions and unsafe configs are blocked before a checkout', async () => {
  const { a, operations } = await fixture(); git(a, 'branch', 'bad'); git(a, 'switch', 'bad');
  await writeFile(join(a, 'microide.project.json'), '{broken'); git(a, 'commit', '-am', 'Invalid manifest'); git(a, 'switch', 'main');
  const before = await readFile(join(a, 'microide.project.json'));
  await assert.rejects(perform(operations, { action: 'switch-branch', branch: 'bad' }), /cible invalide/);
  assert.deepEqual(await readFile(join(a, 'microide.project.json')), before);
  git(a, 'branch', 'collision'); git(a, 'switch', 'collision'); await writeFile(join(a, 'private.local.json'), 'REMOTE VERSION'); git(a, 'add', '-f', 'private.local.json'); git(a, 'commit', '-m', 'Tracked collision'); git(a, 'switch', 'main');
  await writeFile(join(a, 'private.local.json'), 'LOCAL PRIVATE');
  await assert.rejects(perform(operations, { action: 'switch-branch', branch: 'collision' }), /collision/);
  assert.equal(await readFile(join(a, 'private.local.json'), 'utf8'), 'LOCAL PRIVATE');
  git(a, 'config', 'filter.evil.smudge', 'touch SHOULD_NOT_RUN'); await assert.rejects(operations.overview(), /Configuration/);
});
test('push inspects all new history and blocks private paths or a secret deleted by a later commit', async () => {
  const { a, remote, operations } = await fixture(); await perform(operations, { action: 'add-remote', remote: 'origin', url: remote });
  await writeFile(join(a, 'src/main.bas'), '10 REM ' + 'sk-' + 'a'.repeat(40) + '\n20 END\n'); git(a, 'commit', '-am', 'Accidental fixture secret');
  await writeFile(join(a, 'src/main.bas'), '10 REM CLEAN NOW\n20 END\n'); git(a, 'commit', '-am', 'Remove fixture secret');
  await assert.rejects(perform(operations, { action: 'push', remote: 'origin', branch: 'main' }), /secret/);
  assert.throws(() => git(remote, 'rev-parse', '--verify', 'main'));
  git(a, 'branch', 'clean', 'HEAD~2'); git(a, 'switch', 'clean'); await mkdir(join(a, 'documents')); await writeFile(join(a, 'documents/private.txt'), 'ORIGINAL PRIVATE');
  git(a, 'add', '-f', 'documents/private.txt'); git(a, 'commit', '-m', 'Private fixture');
  await assert.rejects(perform(operations, { action: 'push', remote: 'origin', branch: 'clean' }), /privé/);
});
test('clone preserves an occupied destination and verifies a CPC project before checkout', async () => {
  const { a, remote, temp, operations } = await fixture(); await perform(operations, { action: 'add-remote', remote: 'origin', url: remote }); await perform(operations, { action: 'push', remote: 'origin', branch: 'main' });
  const root = join(temp, 'clone'); await mkdir(root);
  const clone = new GitOperations(root, new GitInspection(root, () => ['src/main.bas']), { approvedLocal: [remote] }); await clone.clone(remote);
  assert.match(await readFile(join(root, 'src/main.bas'), 'utf8'), /ORIGINAL/);
  await assert.rejects(clone.clone(remote), /vide/); assert.match(await readFile(join(root, 'src/main.bas'), 'utf8'), /ORIGINAL/);
  await perform(operations, { action: 'fetch', remote: 'origin' }); await perform(operations, { action: 'upstream', remote: 'origin', branch: 'main' });
  assert.equal((await operations.overview()).ahead, 0); assert.equal(git(a, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'HEAD'));
});
test('symbolic links in the received tree never reach checkout', { skip: process.platform === 'win32' }, async () => {
  const { a, operations } = await fixture(); git(a, 'branch', 'linked'); git(a, 'switch', 'linked'); await symlink('/outside', join(a, 'link')); git(a, 'add', 'link'); git(a, 'commit', '-m', 'Linked fixture'); git(a, 'switch', 'main');
  await assert.rejects(perform(operations, { action: 'switch-branch', branch: 'linked' }), /symboliques/); assert.equal(git(a, 'branch', '--show-current'), 'main');
});
