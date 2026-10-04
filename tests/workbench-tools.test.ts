import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ProjectTerminal } from '../apps/desktop/terminal.ts';
import { GitInspection } from '../apps/desktop/git-inspection.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Original Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
  { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'cpceleste-tools-')); await mkdir(join(root, 'src')); await writeFile(join(root, 'src/main.bas'), '10 END\n'); return root; }
async function finished(terminal: ProjectTerminal, id: string) {
  for (let i = 0; i < 200; i++) { const state = terminal.status('fixture', id); if (state.state !== 'running') return state; await new Promise(resolve => setTimeout(resolve, 10)); }
  terminal.stop('fixture', id); throw new Error('Fixture deadline');
}
test('Git history has no unborn commits, freezes HEAD across pages and never modifies index/source', async () => {
  const root = await fixture(); git(root, 'init', '--initial-branch=main'); const inspector = new GitInspection(root, () => ['src/main.bas']);
  assert.deepEqual(await inspector.history(), { head: '(initial)', commits: [] });
  git(root, 'add', 'src/main.bas'); git(root, 'commit', '-m', 'Original');
  for (let i = 1; i <= 23; i++) git(root, 'commit', '--allow-empty', '-m', `Original <script> ${i}`);
  const before = await Promise.all(['.git/index', 'src/main.bas', '.git/HEAD'].map(path => readFile(join(root, path))));
  const first = await inspector.history(); assert.equal(first.commits.length, 20); assert.ok(first.nextCursor); assert.equal(first.commits[0]!.subject, 'Original <script> 23');
  git(root, 'commit', '--allow-empty', '-m', 'New external commit');
  const second = await inspector.history(first.nextCursor); assert.equal(second.head, first.head); assert.equal(second.commits.length, 4); assert.equal(second.commits.at(-1)!.subject, 'Original'); assert.equal(second.nextCursor, undefined);
  assert.deepEqual(await Promise.all(['.git/index', 'src/main.bas', '.git/HEAD'].map(path => readFile(join(root, path)))), before);
  await assert.rejects(inspector.history(first.nextCursor), /périmée/);
  await assert.rejects(inspector.history('--all'), /périmée/);
  await writeFile(join(root, '.git/config'), '[core]\nrepositoryformatversion=0\nbare=false\n[include]\npath=evil\n');
  await assert.rejects(inspector.history(), /Configuration/);
});
test('terminal runs in the project, captures literal stdout/stderr and validates ownership/input', { skip: process.platform === 'win32' }, async () => {
  const root = await fixture(), terminal = new ProjectTerminal();
  for (const value of ['', 'a\nrm', 'a\0b', 'x'.repeat(4097), {}]) assert.throws(() => ProjectTerminal.command(value), /Commande/);
  const result = await terminal.run('fixture', root, 'printf "<script>literal</script>"; printf "stderr" >&2; pwd');
  assert.throws(() => terminal.status('other', result.id), /périmée/); assert.throws(() => terminal.stop('fixture', 'forged'), /périmée/);
  const done = await finished(terminal, result.id); assert.equal(done.exitCode, 0); assert.equal(done.state, 'completed'); assert.match(done.output, /<script>literal<\/script>/); assert.match(done.output, /stderr/); assert.ok(done.output.includes(root));
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), '10 END\n');
});
test('terminal stops process groups, refuses concurrency and bounds noisy output', { skip: process.platform === 'win32' }, async () => {
  const root = await fixture(), terminal = new ProjectTerminal();
  const result = await terminal.run('fixture', root, 'sleep 20 & wait');
  await assert.rejects(terminal.run('fixture', root, 'echo other'), /déjà active/);
  terminal.stop('fixture', result.id); assert.equal((await finished(terminal, result.id)).reason, 'Arrêt demandé.');
  const noisy = await terminal.run('fixture', root, 'yes ORIGINAL');
  const done = await finished(terminal, noisy.id); assert.equal(done.state, 'stopped'); assert.match(done.reason, /64 Kio/); assert.ok(Buffer.byteLength(done.output) <= 64 * 1024);
});
