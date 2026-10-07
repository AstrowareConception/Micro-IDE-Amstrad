import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rename, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseStatus } from '../packages/version-control/src/inspection.ts';
import { GitInspection } from '../apps/desktop/git-inspection.ts';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
}
async function fixture(commit = true) {
  const root = await mkdtemp(join(tmpdir(), 'microide-git-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/main.bas'), '10 PRINT "BASE"\n20 END\n');
  git(root, 'init', '--initial-branch=main');
  if (commit) { git(root, 'add', '--', 'src/main.bas'); git(root, 'commit', '-m', 'Original fixture'); }
  return { root, inspector: new GitInspection(root, () => ['src/main.bas']) };
}

test('porcelain v2 preserves Unicode/spaces/newlines and rename pairs; rejects truncation and submodules', () => {
  const prefix = '# branch.oid abc\0# branch.head main\0';
  const parsed = parseStatus(prefix + '? -jeu é\n2.bas\0' + '2 R. N... 100644 100644 100644 a b R100 src/nouveau.bas\0src/ancien nom.bas\0');
  assert.equal(parsed.changes[0]?.path, '-jeu é\n2.bas');
  assert.equal(parsed.changes[1]?.originalPath, 'src/ancien nom.bas');
  assert.throws(() => parseStatus(prefix + '? a'), /tronqué/);
  assert.throws(() => parseStatus(prefix + '? ../secret\0'), /périmètre/);
  assert.throws(() => parseStatus(prefix + '1 M. S... 160000 160000 160000 a b module\0'), /Sous-module/);
  assert.throws(() => parseStatus(prefix + '2 R. N... 100644 100644 100644 a b R100 a\0'), /incomplet/);
  assert.throws(() => parseStatus(prefix + Array.from({ length: 2001 }, (_, i) => `? a${i}\0`).join('')), /2 000/);
});

test('real Git distinguishes index and disk; reads leave HEAD, index and source bytes intact', async () => {
  const { root, inspector } = await fixture();
  await writeFile(join(root, 'src/main.bas'), '10 PRINT "INDEX"\n20 END\n');
  git(root, 'add', '--', 'src/main.bas');
  await writeFile(join(root, 'src/main.bas'), '10 PRINT "DISK"\n20 END\n');
  const before = await Promise.all(['.git/HEAD', '.git/index', 'src/main.bas'].map(path => readFile(join(root, path))));
  const indexStat = await lstat(join(root, '.git/index'));
  const status = await inspector.status();
  assert.equal(status.branch, 'main'); assert.match(status.version, /^git version /);
  const change = status.changes[0]!;
  assert.equal(change.index, 'M'); assert.equal(change.worktree, 'M');
  const staged = await inspector.diff(change.id, 'index'), disk = await inspector.diff(change.id, 'worktree');
  assert.match(staged.text, /\+10 PRINT "INDEX"/); assert.ok(!staged.text.includes('DISK'));
  assert.match(disk.text, /-10 PRINT "INDEX"/); assert.match(disk.text, /\+10 PRINT "DISK"/);
  assert.deepEqual(await Promise.all(['.git/HEAD', '.git/index', 'src/main.bas'].map(path => readFile(join(root, path)))), before);
  assert.equal((await lstat(join(root, '.git/index'))).mtimeMs, indexStat.mtimeMs);
  await assert.rejects(inspector.diff('src/main.bas', 'index'), /périmée/);
  await assert.rejects(inspector.diff(change.id, 'shell'), /invalide/);
  await inspector.status(); await assert.rejects(inspector.diff(change.id, 'worktree'), /périmée/);
});

test('real unborn/detached repositories and literal names; rename and conflict records', async () => {
  const { root, inspector } = await fixture(false);
  let status = await inspector.status(); assert.equal(status.head, '(initial)');
  await assert.rejects(inspector.diff(status.changes[0]!.id, 'worktree'), /non suivis/);
  git(root, 'add', '--', 'src/main.bas'); git(root, 'commit', '-m', 'Base');
  git(root, 'checkout', '--detach'); status = await inspector.status(); assert.equal(status.branch, '(detached)');
  git(root, 'checkout', 'main');
  await rename(join(root, 'src/main.bas'), join(root, 'src/nouveau.bas')); git(root, 'add', '--', 'src');
  status = await inspector.status(); assert.equal(status.changes[0]?.kind, 'rename');
  assert.equal(status.changes[0]?.originalPath, 'src/main.bas');
  const renamed = new GitInspection(root, () => ['src/main.bas', 'src/nouveau.bas']);
  status = await renamed.status(); assert.match((await renamed.diff(status.changes[0]!.id, 'index')).text, /nouveau.bas/);
  const conflict = await fixture();
  git(conflict.root, 'switch', '-c', 'other'); await writeFile(join(conflict.root, 'src/main.bas'), '10 PRINT "OTHER"\n');
  git(conflict.root, 'commit', '-am', 'Other'); git(conflict.root, 'switch', 'main');
  await writeFile(join(conflict.root, 'src/main.bas'), '10 PRINT "MAIN"\n'); git(conflict.root, 'commit', '-am', 'Main');
  assert.throws(() => git(conflict.root, 'merge', 'other'));
  status = await conflict.inspector.status(); assert.equal(status.changes[0]?.kind, 'conflict');
  await assert.rejects(conflict.inspector.diff(status.changes[0]!.id, 'worktree'), /conflit/);
});

test('config execution surfaces are refused before inspection and never run', async () => {
  for (const [key, value] of [['core.fsmonitor', 'touch SENTINEL'], ['filter.evil.clean', 'touch SENTINEL'],
    ['include.path', 'external-config'], ['diff.evil.textconv', 'touch SENTINEL'], ['core.worktree', '..'],
    ['remote.origin.promisor', 'true'], ['extensions.worktreeConfig', 'true']]) {
    const { root, inspector } = await fixture();
    await writeFile(join(root, '.gitattributes'), '*.bas filter=evil diff=evil\n');
    git(root, 'config', key!, value!);
    await assert.rejects(inspector.status(), /Configuration Git non qualifiée/);
    await assert.rejects(lstat(join(root, 'SENTINEL')), { code: 'ENOENT' });
  }
});

test('missing Git, non-repository, parent repository, linked worktree and metadata indirections', async () => {
  const root = await mkdtemp(join(tmpdir(), 'microide-no-git-'));
  await assert.rejects(new GitInspection(root, () => [], '').status(), /Git introuvable/);
  assert.equal((await new GitInspection(root, () => []).status()).state, 'not-repository');
  const parent = await fixture(); await mkdir(join(parent.root, 'child'));
  assert.equal((await new GitInspection(join(parent.root, 'child'), () => []).status()).state, 'parent-repository');
  await writeFile(join(root, '.git'), `gitdir: ${join(parent.root, '.git')}\n`);
  await assert.rejects(new GitInspection(root, () => []).status(), /Worktree/);
  const linked = await fixture(); await symlink(join(parent.root, '.git/config'), join(linked.root, '.git/evil'));
  await assert.rejects(linked.inspector.status(), /Lien/);
  const alternate = await fixture(); await writeFile(join(alternate.root, '.git/objects/info/alternates'), '/private/objects\n');
  await assert.rejects(alternate.inspector.status(), /Stockage Git externe/);
});

test('private files and symlink contents never become a readable diff', async () => {
  const { root, inspector } = await fixture();
  await writeFile(join(root, 'private.txt'), 'PRIVATE ORIGINAL'); git(root, 'add', '--', 'private.txt'); git(root, 'commit', '-m', 'Original local fixture');
  await writeFile(join(root, 'private.txt'), 'PRIVATE CHANGED');
  let status = await inspector.status();
  await assert.rejects(inspector.diff(status.changes.find(change => change.path === 'private.txt')!.id, 'worktree'), /contenus privés/);
  const outside = await mkdtemp(join(tmpdir(), 'microide-outside-')); await writeFile(join(outside, 'secret.bas'), 'SECRET HOST CONTENT');
  await rename(join(root, 'src/main.bas'), join(root, 'src/old.bas')); await symlink(join(outside, 'secret.bas'), join(root, 'src/main.bas'));
  status = await inspector.status();
  await assert.rejects(inspector.diff(status.changes.find(change => change.path === 'src/main.bas')!.id, 'worktree'), /Chemin de diff/);
});

test('diff is bounded without silent truncation and external environment overrides are ignored', async () => {
  const { root, inspector } = await fixture();
  const keys = ['GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0'];
  const previous = keys.map(key => process.env[key]);
  process.env.GIT_CONFIG_COUNT = '1'; process.env.GIT_CONFIG_KEY_0 = 'core.fsmonitor'; process.env.GIT_CONFIG_VALUE_0 = 'touch SENTINEL';
  try {
    await writeFile(join(root, 'src/main.bas'), '10 REM ' + 'X'.repeat(1100 * 1024) + '\n');
    const status = await inspector.status();
    await assert.rejects(inspector.diff(status.changes[0]!.id, 'worktree'), /interrompue/);
    await assert.rejects(lstat(join(root, 'SENTINEL')), { code: 'ENOENT' });
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});

test('real file names are NUL-delimited and literal pathspecs cannot select other files', async () => {
  const { root } = await fixture();
  const names = ['src/-jeu é\n2.bas', 'src/[glob].bas', 'src/g.bas'];
  for (const name of names) await writeFile(join(root, name), '10 REM ORIGINAL\n');
  git(root, 'add', '--', ...names); git(root, 'commit', '-m', 'Literal names');
  for (const name of names) await writeFile(join(root, name), `10 REM ${name.includes('g.bas') ? 'OTHER CONTENT' : 'SELECTED'}\n`);
  const inspector = new GitInspection(root, () => names), status = await inspector.status();
  assert.ok(status.changes.some(change => change.path === names[0]));
  const diff = await inspector.diff(status.changes.find(change => change.path === names[1])!.id, 'worktree');
  assert.match(diff.text, /SELECTED/); assert.ok(!diff.text.includes('OTHER CONTENT'));
  const oid = git(root, 'rev-parse', 'HEAD').trim();
  git(root, 'update-index', '--add', '--cacheinfo', `160000,${oid},module`);
  await assert.rejects(inspector.status(), /Sous-modules/);
});

test('portable suite definitions are indexable; private report history remains excluded', async () => {
 const { root, inspector } = await fixture();
 await writeFile(join(root, 'microide.tests.json'), '{"schemaVersion":1,"suites":[]}\n');
 await mkdir(join(root, '.microide/test-reports'), { recursive: true });
 await writeFile(join(root, '.microide/test-reports/history.json'), 'private');
 const status = await inspector.status();
 assert.equal(status.changes.find(change => change.path === 'microide.tests.json')?.indexable, true);
 const privateChange = status.changes.find(change => change.path.includes('.microide'));
 assert.ok(!privateChange?.indexable);
});
