import { execFile } from 'node:child_process';
import { lstat, readdir, realpath, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname, delimiter, isAbsolute, relative } from 'node:path';
import { devNull } from 'node:os';
import { randomUUID } from 'node:crypto';
import { gitPath, parseStatus, type GitChange, type GitDiff, type DiffSide, type RepositoryStatus } from '../../packages/version-control/src/inspection.ts';

const LIMIT = 1024 * 1024;
const safeKeys = /^(core\.(repositoryformatversion|filemode|bare|logallrefupdates|ignorecase|precomposeunicode|autocrlf|eol|safecrlf|ignorestat|symlinks|protecthfs|protectntfs)|user\.(name|email)|remote\.[^.]+\.(url|pushurl|fetch)|branch\..+\.(remote|merge))$/i;
/** Host-only, deliberately conservative inspection policy, not an OS sandbox. */
export class GitInspection {
  private executable: string | undefined;
  private changes = new Map<string, GitChange>();
  private readonly root: string;
  private readonly sourcePaths: () => readonly string[];
  private readonly searchPath: string;
  constructor(root: string, sourcePaths: () => readonly string[], searchPath = process.env.PATH ?? '') {
    this.root = root; this.sourcePaths = sourcePaths; this.searchPath = searchPath;
  }
  private async locate(): Promise<string> {
    if (this.executable) return this.executable;
    for (const directory of this.searchPath.split(delimiter)) {
      if (!isAbsolute(directory)) continue;
      const candidate = join(directory, process.platform === 'win32' ? 'git.exe' : 'git');
      try {
        const path = await realpath(candidate);
        const location = relative(this.root, path);
        if (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) continue;
        if (!(await lstat(path)).isFile()) continue;
        await access(path, constants.X_OK); this.executable = path; return path;
      } catch { /* Only absolute PATH entries; never search the project/current directory. */ }
    }
    throw new Error('Git introuvable. Installez Git puis redémarrez l’IDE ; l’édition reste disponible.');
  }
  private async run(args: string[], cwd = this.root): Promise<string> {
    const executable = await this.locate();
    const env: NodeJS.ProcessEnv = { PATH: this.searchPath, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_GLOBAL: devNull, GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_ATTR_NOSYSTEM: '1' };
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    return new Promise((resolve, reject) => {
      execFile(executable, ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
        '-c', `core.attributesFile=${devNull}`, '-c', 'protocol.allow=never', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args],
      { cwd, env, shell: false, windowsHide: true, timeout: 10_000, maxBuffer: LIMIT, encoding: 'buffer' }, (error, stdout) => {
        // Never return stderr, config values, credentials or absolute host paths over IPC.
        if (error) { reject(new Error('Lecture Git refusée ou interrompue (10 s / 1 Mio maximum).')); return; }
        try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(stdout)); }
        catch { reject(new Error('Sortie Git UTF-8 requise.')); }
      });
    });
  }
  private async metadata(): Promise<'repository' | 'not-repository' | 'parent-repository'> {
    if (await realpath(this.root) !== this.root || !(await lstat(this.root)).isDirectory()) throw new Error('Racine de dépôt modifiée.');
    let stat;
    try { stat = await lstat(join(this.root, '.git')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Métadonnées Git inaccessibles.');
      let parent = dirname(this.root);
      while (parent !== dirname(parent)) {
        try { await lstat(join(parent, '.git')); return 'parent-repository'; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Dépôt parent inaccessible.'); }
        parent = dirname(parent);
      }
      return 'not-repository';
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Worktree lié ou lien .git non pris en charge.');
    // Reject indirections even deep in refs/objects. Bound work rather than silently skip entries.
    let count = 0;
    const walk = async (folder: string, depth: number): Promise<void> => {
      if (depth > 32) throw new Error('Métadonnées Git trop profondes.');
      for (const name of await readdir(folder)) {
        if (++count > 10_000) throw new Error('Métadonnées Git supérieures à 10 000 entrées.');
        const path = join(folder, name), entry = await lstat(path);
        if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) throw new Error('Lien ou fichier spécial dans .git refusé.');
        if (entry.isDirectory()) await walk(path, depth + 1);
      }
    };
    await walk(join(this.root, '.git'), 0);
    for (const relative of ['commondir', 'config.worktree', 'objects/info/alternates', 'objects/info/http-alternates']) {
      try { await lstat(join(this.root, '.git', relative)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw new Error('Métadonnées Git inaccessibles.'); }
      throw new Error('Stockage Git externe ou worktree non pris en charge.');
    }
    const config = await this.run(['config', '--file', join(this.root, '.git/config'), '--no-includes', '--null', '--list']);
    for (const record of config.split('\0').filter(Boolean)) {
      const newline = record.indexOf('\n'), key = newline < 0 ? record : record.slice(0, newline), value = newline < 0 ? '' : record.slice(newline + 1);
      if (!safeKeys.test(key) || (key.toLowerCase() === 'core.bare' && value.toLowerCase() !== 'false') ||
          (key.toLowerCase() === 'core.repositoryformatversion' && value !== '0'))
        throw new Error('Configuration Git non qualifiée : includes, filtres, extensions et commandes auxiliaires refusés.');
    }
    const index = await this.run(['ls-files', '--stage', '-z']);
    if (/(?:^|\0)160000 /.test(index)) throw new Error('Sous-modules non pris en charge.');
    return 'repository';
  }
  async status(): Promise<RepositoryStatus> {
    try { return await this.inspect(); }
    catch (error) { return this.failure(error); }
  }
  private failure(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) throw new Error('Métadonnées Git inaccessibles.');
    throw error;
  }
  private async inspect(): Promise<RepositoryStatus> {
    this.changes.clear();
    const version = (await this.run(['--version'])).trim();
    if (!/^git version \d+\.\d+\.\d+[^\r\n]*$/.test(version)) throw new Error('Version Git non reconnue.');
    const state = await this.metadata();
    if (state !== 'repository') return { state, version, branch: '', head: '', changes: [] };
    const parsed = parseStatus(await this.run(['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all', '--ignore-submodules=none']));
    for (const change of parsed.changes) { change.id = randomUUID(); this.changes.set(change.id, change); }
    return { state, version, ...parsed };
  }
  async diff(id: unknown, side: unknown): Promise<GitDiff> {
    try { return await this.readDiff(id, side); }
    catch (error) { return this.failure(error); }
  }
  private async readDiff(id: unknown, side: unknown): Promise<GitDiff> {
    if (typeof id !== 'string' || (side !== 'worktree' && side !== 'index')) throw new Error('Sélection de diff invalide.');
    const change = this.changes.get(id);
    if (!change) throw new Error('Sélection Git périmée ; actualisez le statut.');
    if (change.kind === 'untracked' || change.kind === 'conflict') throw new Error('Diff des fichiers non suivis ou en conflit non pris en charge.');
    // No private documents, ROM, conversations, credentials or arbitrary host content.
    const permitted = new Set(['microide.project.json', ...this.sourcePaths()]);
    if (!permitted.has(change.path) || (change.originalPath && !permitted.has(change.originalPath)))
      throw new Error('Diff limité au manifeste et aux sources BASIC déclarées ; autres contenus privés exclus du diff.');
    if (await this.metadata() !== 'repository') throw new Error('Dépôt Git indisponible.');
    for (const relative of [change.path, ...(change.originalPath ? [change.originalPath] : [])]) {
      let path = this.root;
      for (const segment of gitPath(relative).split('/')) {
        path = join(path, segment);
        try { const entry = await lstat(path); if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) throw new Error('Lien refusé dans le diff.'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Chemin de diff non qualifié.'); }
      }
    }
    const paths = [change.path, ...(change.originalPath ? [change.originalPath] : [])].map(path => `:(literal)${path}`);
    const text = await this.run(['diff', ...(side === 'index' ? ['--cached'] : []), '--no-ext-diff', '--no-textconv', '--no-color',
      '--ignore-submodules=all', '--no-renames', '--', ...paths]);
    if (text.includes('\0')) throw new Error('Diff texte requis.');
    return { path: change.path, side: side as DiffSide, text };
  }
}
