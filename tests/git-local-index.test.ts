import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, lstat, chmod, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitInspection } from '../apps/desktop/git-inspection.ts';
import { PROJECT_GIT_IGNORE, type RepositoryStatus } from '../packages/version-control/src/inspection.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
  { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
async function project() {
  const root = await mkdtemp(join(tmpdir(), 'microide-index-'));
  await mkdir(join(root, 'src')); await writeFile(join(root, 'src/main.bas'), '10 REM ORIGINAL\n20 END\n');
  return { root, inspector: new GitInspection(root, () => ['src/main.bas', 'src/util.bas']) };
}
function selected(status: RepositoryStatus, path = 'src/main.bas') {
  assert.ok(status.snapshotId); const change = status.changes.find(change => change.path === path); assert.ok(change);
  return [status.snapshotId, change.id] as const;
}

test('init preview and exclusive creation use main, private exclusions, no templates/index/commit', async () => {
  const { root, inspector } = await project();
  await mkdir(join(root, 'documents')); await writeFile(join(root, 'documents/private.md'), 'ORIGINAL PRIVATE');
  await writeFile(join(root, '.env'), 'ORIGINAL LOCAL FIXTURE'); await writeFile(join(root, 'local.rom'), 'ORIGINAL SYNTHETIC');
  const source = await readFile(join(root, 'src/main.bas'));
  const plan = await inspector.prepareInit(); assert.equal(plan.ignoreText, PROJECT_GIT_IGNORE); assert.equal(plan.branch, 'main');
  await assert.rejects(lstat(join(root, '.git')), { code: 'ENOENT' });
  const status = await inspector.init(plan.id); assert.equal(status.head, '(initial)'); assert.equal(status.branch, 'main');
  assert.deepEqual(status.changes.map(change => change.path).sort(), ['.gitignore', 'src/main.bas']);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), PROJECT_GIT_IGNORE);
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), source);
  assert.equal(await readFile(join(root, '.git/HEAD'), 'utf8'), 'ref: refs/heads/main\n');
  await assert.rejects(lstat(join(root, '.git/index')), { code: 'ENOENT' });
  assert.ok(!(await readdir(join(root, '.git'))).some(name => /template|pending|hooks/.test(name)));
  assert.throws(() => git(root, 'rev-parse', '--verify', 'HEAD'));
  await assert.rejects(inspector.init(plan.id), /périmé/);
  await assert.rejects(inspector.prepareInit(), /existant/);
});

test('init refuses stale previews, preserves existing ignore files and rejects parent/bare repositories or occupied git paths', async () => {
  const stale = await project(), plan = await stale.inspector.prepareInit();
  await writeFile(join(stale.root, 'src/main.bas'), '10 REM EXTERNAL\n');
  await assert.rejects(stale.inspector.init(plan.id), /modifié/);
  await assert.rejects(lstat(join(stale.root, '.git')), { code: 'ENOENT' });
  const existing = await project(); await writeFile(join(existing.root, '.gitignore'), '# USER ORIGINAL\n');
  const existingPlan = await existing.inspector.prepareInit(); assert.equal(existingPlan.preserveIgnore, true);
  await existing.inspector.init(existingPlan.id);
  assert.equal(await readFile(join(existing.root, '.git/info/exclude'), 'utf8'), PROJECT_GIT_IGNORE);
  assert.equal(await readFile(join(existing.root, '.gitignore'), 'utf8'), '# USER ORIGINAL\n');
  const occupied = await project(), occupiedPlan = await occupied.inspector.prepareInit();
  await writeFile(join(occupied.root, '.git'), 'ORIGINAL OCCUPIED');
  await assert.rejects(occupied.inspector.init(occupiedPlan.id), /Worktree/);
  assert.equal(await readFile(join(occupied.root, '.git'), 'utf8'), 'ORIGINAL OCCUPIED');
  const parent = await project(); git(parent.root, 'init', '--initial-branch=main'); await mkdir(join(parent.root, 'child'));
  await assert.rejects(new GitInspection(join(parent.root, 'child'), () => []).prepareInit(), /parent/);
  const bare = await project(); git(bare.root, 'init', '--bare');
  await assert.rejects(bare.inspector.prepareInit(), /bare/);
});

test('unborn stage/unstage selects only one file; ignored private contents stay absent from index', async () => {
  const { root, inspector } = await project();
  let status = await inspector.init((await inspector.prepareInit()).id);
  const source = await readFile(join(root, 'src/main.bas')), head = await readFile(join(root, '.git/HEAD'));
  status = await inspector.changeIndex(...selected(status), 'stage');
  assert.equal(git(root, 'ls-files', '-z'), 'src/main.bas\0');
  assert.match((await inspector.diff(status.changes.find(c => c.path === 'src/main.bas')!.id, 'index')).text, /ORIGINAL/);
  status = await inspector.changeIndex(...selected(status), 'unstage');
  assert.equal(git(root, 'ls-files', '-z'), '');
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), source); assert.deepEqual(await readFile(join(root, '.git/HEAD')), head);
  assert.ok(status.changes.some(c => c.path === 'src/main.bas' && c.kind === 'untracked'));
  assert.ok(!(await readdir(join(root, '.git'))).some(name => name.startsWith('microide-index-') || name === 'index.lock'));
});

test('committed stage/unstage preserves other staged bytes and source/HEAD; executable index hook never runs', async () => {
  const { root, inspector } = await project();
  await writeFile(join(root, 'src/util.bas'), '10 REM BASE UTIL\n');
  await inspector.init((await inspector.prepareInit()).id); git(root, 'add', '--', 'src'); git(root, 'commit', '-m', 'Original fixture');
  await writeFile(join(root, 'src/util.bas'), '10 REM STAGED UTIL\n'); git(root, 'add', '--', 'src/util.bas');
  const stagedUtil = git(root, 'show', ':src/util.bas');
  await mkdir(join(root, '.git/hooks'));
  const hook = join(root, '.git/hooks/post-index-change'); await writeFile(hook, '#!/bin/sh\nprintf EXECUTED > SENTINEL\n'); await chmod(hook, 0o700);
  await writeFile(join(root, 'src/main.bas'), '10 REM SELECTED MAIN\n');
  let status = await inspector.status(); const head = await readFile(join(root, '.git/HEAD')), source = await readFile(join(root, 'src/main.bas')), oid = git(root, 'rev-parse', 'HEAD');
  status = await inspector.changeIndex(...selected(status), 'stage');
  assert.equal(git(root, 'show', ':src/main.bas'), '10 REM SELECTED MAIN\n'); assert.equal(git(root, 'show', ':src/util.bas'), stagedUtil);
  status = await inspector.changeIndex(...selected(status), 'unstage');
  assert.equal(git(root, 'show', ':src/main.bas'), '10 REM ORIGINAL\n20 END\n'); assert.equal(git(root, 'show', ':src/util.bas'), stagedUtil);
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), source); assert.deepEqual(await readFile(join(root, '.git/HEAD')), head);
  assert.equal(git(root, 'rev-parse', 'HEAD'), oid);
  await assert.rejects(lstat(join(root, 'SENTINEL')), { code: 'ENOENT' });
});

test('stale source bytes, external index/HEAD and existing index.lock block mutations, never removing external locks', async () => {
  const { root, inspector } = await project(); await inspector.init((await inspector.prepareInit()).id);
  let status = await inspector.status(); const original = selected(status);
  await writeFile(join(root, 'src/main.bas'), '10 REM EXTERNAL SAME STATUS\n');
  await assert.rejects(inspector.changeIndex(...original, 'stage'), /modifiés/);
  assert.equal(git(root, 'ls-files', '-z'), '');
  status = await inspector.status(); await writeFile(join(root, '.git/index.lock'), 'EXTERNAL LOCK');
  await assert.rejects(inspector.changeIndex(...selected(status), 'stage'), /verrouillé/);
  assert.equal(await readFile(join(root, '.git/index.lock'), 'utf8'), 'EXTERNAL LOCK');
  await unlink(join(root, '.git/index.lock')); // Test owns this exact synthetic lock, not a user's lock.
  status = await inspector.status(); git(root, 'add', '--', 'src/main.bas');
  const externalIndex = await readFile(join(root, '.git/index'));
  await assert.rejects(inspector.changeIndex(...selected(status), 'stage'), /modifiés/);
  assert.deepEqual(await readFile(join(root, '.git/index')), externalIndex);
  status = await inspector.status(); git(root, 'commit', '-m', 'External original fixture');
  await assert.rejects(inspector.changeIndex(...selected(status), 'unstage'), /modifiés/);
  await assert.rejects(inspector.changeIndex('forged', '/etc/passwd', 'stage'), /périmée/);
});

test('private tracked changes and execution config cannot be staged; concurrent/replayed operations are refused', async () => {
  const { root, inspector } = await project(); await inspector.init((await inspector.prepareInit()).id);
  await writeFile(join(root, 'private.txt'), 'ORIGINAL'); git(root, 'add', '--', 'private.txt'); git(root, 'commit', '-m', 'Original private fixture');
  await writeFile(join(root, 'private.txt'), 'MODIFIED');
  let status = await inspector.status();
  await assert.rejects(inspector.changeIndex(...selected(status, 'private.txt'), 'stage'), /contenus privés/);
  const selection = selected(status);
  const first = inspector.changeIndex(...selection, 'stage');
  await assert.rejects(inspector.changeIndex(...selection, 'stage'), /déjà en cours/); await first;
  await assert.rejects(inspector.changeIndex(...selection, 'stage'), /périmée/);
  await writeFile(join(root, 'src/main.bas'), '10 REM CHANGED\n'); status = await inspector.status();
  git(root, 'config', 'filter.evil.clean', 'touch SENTINEL');
  const index = await readFile(join(root, '.git/index'));
  await assert.rejects(inspector.changeIndex(...selected(status), 'stage'), /Configuration/);
  assert.deepEqual(await readFile(join(root, '.git/index')), index); await assert.rejects(lstat(join(root, 'SENTINEL')), { code: 'ENOENT' });
});

test('a failed native init retains a marked partial directory and original files; no automatic destructive retry', async () => {
  const { root } = await project(), binaryDirectory = await mkdtemp(join(tmpdir(), 'microide-failing-git-'));
  // Original failure transport, not a successful real-Git qualification or a renderer-selected executable.
  await writeFile(join(binaryDirectory, 'git'), '#!/bin/sh\nfor value in "$@"; do\n  if [ "$value" = "--version" ]; then printf "git version 2.51.1\\n"; exit 0; fi\ndone\nexit 1\n', { mode: 0o700 });
  const failing = new GitInspection(root, () => ['src/main.bas'], binaryDirectory);
  const plan = await failing.prepareInit(), source = await readFile(join(root, 'src/main.bas'));
  await assert.rejects(failing.init(plan.id), /Création Git non confirmée/);
  assert.equal(await readFile(join(root, '.git/microide-init-pending'), 'utf8'), plan.id);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), PROJECT_GIT_IGNORE);
  assert.deepEqual(await readFile(join(root, 'src/main.bas')), source);
  const normal = new GitInspection(root, () => ['src/main.bas']);
  await assert.rejects(normal.status(), /Initialisation Git incomplète/);
  await assert.rejects(normal.prepareInit(), /Initialisation Git incomplète/);
});
