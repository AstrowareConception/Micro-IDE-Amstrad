import { execFile } from 'node:child_process';
import { lstat, readdir, realpath, access, readFile, writeFile, mkdir, mkdtemp, rmdir, unlink, open, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname, delimiter, isAbsolute, relative, basename } from 'node:path';
import { devNull } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { gitPath, parseStatus, commitInput, PROJECT_GIT_IGNORE, type GitCommitInput, type GitCommitPlan, type GitCommitResult, type GitChange, type GitDiff, type DiffSide, type RepositoryStatus, type GitInitPlan, type IndexAction, type GitHistory } from '../../packages/version-control/src/inspection.ts';

const LIMIT = 1024 * 1024;
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const safeKeys = /^(core\.(repositoryformatversion|filemode|bare|logallrefupdates|ignorecase|precomposeunicode|autocrlf|eol|safecrlf|ignorestat|symlinks|protecthfs|protectntfs)|user\.(name|email)|remote\.[^.]+\.(url|pushurl|fetch|tagopt)|branch\..+\.(remote|merge))$/i;
/** Host-only, deliberately conservative inspection policy, not an OS sandbox. */
export class GitInspection {
  private executable: string | undefined;
  private changes = new Map<string, GitChange>();
  private snapshot: { id: string; signature: string } | undefined;
  private initPlan: { view: GitInitPlan; signature: string } | undefined;
  private mutating = false;
  private commitPlan: { view: GitCommitPlan; signature: string; ref: string } | undefined;
  private historyCursor: { id: string; head: string; offset: number } | undefined;
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
  private async run(args: string[], cwd = this.root, indexFile?: string, options?: { input?: string; identity?: GitCommitInput; prepared?: () => Promise<void> }): Promise<string> {
    const executable = await this.locate();
    const env: NodeJS.ProcessEnv = { PATH: this.searchPath, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_GLOBAL: devNull, GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_ATTR_NOSYSTEM: '1' };
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    if (indexFile) env.GIT_INDEX_FILE = indexFile;
    if (options?.identity) {
      env.GIT_AUTHOR_NAME = env.GIT_COMMITTER_NAME = options.identity.name;
      env.GIT_AUTHOR_EMAIL = env.GIT_COMMITTER_EMAIL = options.identity.email;
    }
    return new Promise((resolve, reject) => {
      let preparationError: unknown, preparing = false, output = '';
      const child = execFile(executable, ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
        '-c', `core.attributesFile=${devNull}`, '-c', `core.hooksPath=${devNull}`, '-c', 'protocol.allow=never', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args],
      { cwd, env, shell: false, windowsHide: true, timeout: 10_000, maxBuffer: LIMIT, encoding: 'buffer' }, (error, stdout) => {
        // Never return stderr, config values, credentials or absolute host paths over IPC.
        if (preparationError) { reject(preparationError); return; }
        if (error) { reject(new Error('Opération Git refusée ou interrompue (10 s / 1 Mio maximum).')); return; }
        try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(stdout)); }
        catch { reject(new Error('Sortie Git UTF-8 requise.')); }
      });
      child.stdin?.on('error', () => { /* Process error is reported through the callback. */ });
      if (options?.prepared) {
        child.stdout?.on('data', bytes => {
          output += bytes.toString();
          if (!preparing && output.includes('prepare: ok\n')) {
            preparing = true;
            void options.prepared!().then(() => child.stdin?.end('commit\n')).catch(error => { preparationError = error; child.stdin?.end('abort\n'); });
          }
        });
        child.stdin?.write(options.input ?? '');
      } else child.stdin?.end(options?.input ?? '');
    });
  }
  private async metadata(): Promise<'repository' | 'not-repository' | 'parent-repository'> {
    if (await realpath(this.root) !== this.root || !(await lstat(this.root)).isDirectory()) throw new Error('Racine de dépôt modifiée.');
    let stat;
    try { stat = await lstat(join(this.root, '.git')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Métadonnées Git inaccessibles.');
      if (await this.exists(join(this.root, 'HEAD')) && await this.exists(join(this.root, 'objects')) && await this.exists(join(this.root, 'config')))
        throw new Error('Dépôt bare non pris en charge.');
      let parent = dirname(this.root);
      for (;;) {
        try { await lstat(join(parent, '.git')); return 'parent-repository'; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Dépôt parent inaccessible.'); }
        if (parent === dirname(parent)) break;
        parent = dirname(parent);
      }
      return 'not-repository';
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Worktree lié ou lien .git non pris en charge.');
    if (await this.exists(join(this.root, '.git/microide-init-pending'))) throw new Error('Initialisation Git incomplète : conserver .git et .gitignore, examiner le dossier avant toute reprise.');
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
      if (!safeKeys.test(key) || (/^remote\..+\.tagopt$/i.test(key) && !['--tags', '--no-tags'].includes(value)) || (key.toLowerCase() === 'core.bare' && value.toLowerCase() !== 'false') ||
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
  async history(cursor?: unknown): Promise<GitHistory> {
    try {
      if (await this.metadata() !== 'repository') throw new Error('Historique : aucun dépôt à la racine.');
      let head: string, offset = 0;
      if (cursor === undefined) {
        this.historyCursor = undefined;
        head = parseStatus(await this.rawStatus()).head;
        if (head === '(initial)') return { head, commits: [] };
      } else {
        if (typeof cursor !== 'string' || cursor !== this.historyCursor?.id) throw new Error('Page d’historique périmée ; recommencez la lecture.');
        ({ head, offset } = this.historyCursor);
      }
      if (!/^[0-9a-f]{40}$/.test(head) || offset >= 2000) throw new Error('Historique non qualifié ou limite de 2 000 commits atteinte.');
      const output = await this.run(['log', '--no-show-signature', '--no-notes', '--no-color', '--no-decorate', '-z', '--format=%H%x00%aI%x00%s', '--max-count=21', `--skip=${offset}`, head, '--']);
      const fields = output.split('\0');
      if (fields.pop() !== '' || fields.length % 3) throw new Error('Historique Git incomplet.');
      const commits = [];
      for (let i = 0; i < fields.length; i += 3) {
        const oid = fields[i]!, date = fields[i + 1]!, subject = fields[i + 2]!;
        if (!/^[0-9a-f]{40}$/.test(oid) || !/^\d{4}-\d{2}-\d{2}T/.test(date) || subject.length > 8192) throw new Error('Entrée d’historique non qualifiée.');
        commits.push({ oid, date, subject });
      }
      this.historyCursor = commits.length > 20 && offset + 20 < 2000 ? { id: randomUUID(), head, offset: offset + 20 } : undefined;
      return { head, commits: commits.slice(0, 20), ...(this.historyCursor ? { nextCursor: this.historyCursor.id } : {}) };
    } catch (error) { return this.failure(error); }
  }
  private failure(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) throw new Error('Métadonnées Git inaccessibles.');
    throw error;
  }
  private async inspect(): Promise<RepositoryStatus> {
    this.changes.clear(); this.snapshot = undefined; this.initPlan = undefined; this.commitPlan = undefined;
    const version = (await this.run(['--version'])).trim();
    if (!/^git version \d+\.\d+\.\d+[^\r\n]*$/.test(version)) throw new Error('Version Git non reconnue.');
    const state = await this.metadata();
    if (state !== 'repository') return { state, version, branch: '', head: '', changes: [] };
    const parsed = parseStatus(await this.run(['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all', '--ignore-submodules=none']));
    // Read twice around hashing: refuse an inconsistent view, never publish it as a mutation precondition.
    let signature: string | undefined;
    try { signature = await this.signature(); }
    catch { /* Read-only status remains usable; unqualified files do not receive a mutation token. */ }
    const checked = parseStatus(await this.rawStatus());
    if (JSON.stringify(parsed) !== JSON.stringify(checked) || (signature && signature !== await this.signature())) throw new Error('Dépôt modifié pendant la lecture ; actualisez Git.');
    if (signature) this.snapshot = { id: randomUUID(), signature };
    for (const change of parsed.changes) {
      change.id = randomUUID();
      change.indexable = !!this.snapshot && this.permittedPaths().includes(change.path) && change.kind !== 'conflict' && change.kind !== 'rename';
      this.changes.set(change.id, change);
    }
    return { state, version, ...parsed, ...(this.snapshot ? { snapshotId: this.snapshot.id } : {}) };
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
    const permitted = new Set(this.permittedPaths());
    if (!permitted.has(change.path) || (change.originalPath && !permitted.has(change.originalPath)))
      throw new Error('Diff limité au manifeste, à .gitignore et aux sources BASIC déclarées ; autres contenus privés exclus du diff.');
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
  private permittedPaths(): string[] { return ['microide.project.json', '.gitignore', ...this.sourcePaths()]; }
  private async exists(path: string): Promise<boolean> {
    try { await lstat(path); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  private async bytes(relativePath: string, missing = false): Promise<Buffer | undefined> {
    let path = this.root;
    for (const segment of relativePath.split('/')) {
      path = join(path, segment);
      try {
        const stat = await lstat(path);
        if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('Chemin de versionnement non qualifié.');
      } catch (error) { if (missing && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    }
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > LIMIT) throw new Error('Fichier Git ordinaire de 1 Mio maximum requis.');
    const bytes = await readFile(path);
    if (bytes.length > LIMIT) throw new Error('Fichier Git supérieur à 1 Mio.');
    return bytes;
  }
  private async workingSignature(): Promise<string> {
    const root = await lstat(this.root);
    if (!root.isDirectory() || await realpath(this.root) !== this.root) throw new Error('Racine de dépôt modifiée.');
    const hashes: [string, string][] = [];
    for (const path of this.permittedPaths()) {
      gitPath(path); const bytes = await this.bytes(path, true); hashes.push([path, bytes ? digest(bytes) : 'absent']);
    }
    return digest(JSON.stringify([root.dev, root.ino, hashes]));
  }
  private async rawStatus(): Promise<string> {
    return this.run(['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all', '--ignore-submodules=none']);
  }
  private async signature(): Promise<string> {
    return digest(JSON.stringify([await this.rawStatus(), digest(await this.bytes('.git/config') ?? ''),
      digest(await this.bytes('.git/index', true) ?? ''), await this.workingSignature()]));
  }
  /** Host adapters use the same metadata policy before typed Git operations. */
  async operationRevision(): Promise<string> {
    if (await this.metadata() !== 'repository') throw new Error('Créez d’abord un dépôt Git à la racine du projet.');
    return digest(JSON.stringify([await this.signature(), await this.run(['for-each-ref', '--format=%(refname) %(objectname)'])]));
  }
  async workspaceRevision(): Promise<string> { await this.metadata(); return this.signature(); }
  async executablePath(): Promise<string> { return this.locate(); }
  private async commitRef(): Promise<string> {
    const version = /^git version (\d+)\.(\d+)\./.exec((await this.run(['--version'])).trim());
    if (!version || Number(version[1]) < 2 || Number(version[1]) === 2 && Number(version[2]) < 48) throw new Error('Git 2.48 ou supérieur requis pour les commits intégrés.');
    if (await this.metadata() !== 'repository') throw new Error('Aucun dépôt Git local.');
    for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-apply', 'rebase-merge', 'BISECT_LOG'])
      if (await this.exists(join(this.root, '.git', marker))) throw new Error('Opération Git en cours : terminez-la hors de ce panneau.');
    const status = parseStatus(await this.rawStatus());
    if (status.branch === '(detached)' || status.changes.some(change => change.kind === 'conflict')) throw new Error('Branche locale sans conflit requise pour créer un commit.');
    if (status.head !== '(initial)' && !/^[a-f0-9]{40}$/.test(status.head)) throw new Error('Dépôt SHA-1 requis.');
    const ref = (await this.run(['symbolic-ref', '--quiet', 'HEAD'])).trim();
    if (!ref.startsWith('refs/heads/') || ref.length > 240 || /[\s\x00-\x1f]/.test(ref)) throw new Error('Référence de branche non qualifiée.');
    await this.run(['check-ref-format', ref]);
    if ((await this.bytes('.git/HEAD'))?.toString('utf8') !== `ref: ${ref}\n`) throw new Error('HEAD symbolique non qualifié.');
    const branch = await this.bytes(`.git/${ref}`, true);
    if (branch && !/^[a-f0-9]{40}\n?$/.test(branch.toString('utf8'))) throw new Error('Branche indirecte non qualifiée.');
    return ref;
  }
  async prepareCommit(input: unknown): Promise<GitCommitPlan> {
    this.commitPlan = undefined;
    const identity = commitInput(input), ref = await this.commitRef(), signature = await this.signature();
    const staged = await this.run(['diff', '--cached', '--name-status', '-z', '--no-renames', '--']);
    const fields = staged.split('\0'); if (fields.pop() !== '' || fields.length % 2 || !fields.length || fields.length > 132) throw new Error('Index vide ou trop de fichiers à committer (66 maximum).');
    const permitted = new Set(this.permittedPaths()); const files: GitCommitPlan['files'] = [];
    for (let index = 0; index < fields.length; index += 2) {
      const status = fields[index]!, path = gitPath(fields[index + 1]!);
      if (!['A', 'M', 'D'].includes(status) || !permitted.has(path)) throw new Error('Commit limité aux changements indexés des sources déclarées, manifeste et .gitignore ; autres contenus exclus.');
      files.push({ path, status: status as 'A' | 'M' | 'D' });
    }
    const entries = (await this.run(['ls-files', '--stage', '-z'])).split('\0').filter(Boolean); let total = 0;
    for (const file of files.filter(file => file.status !== 'D')) {
      const entry = entries.find(entry => entry.slice(entry.indexOf('\t') + 1) === file.path);
      const match = entry && /^(100644|100755) ([a-f0-9]{40}) 0\t/.exec(entry);
      if (!match) throw new Error('Index sans lien et sans conflit requis.');
      const content = await this.run(['cat-file', 'blob', match[2]!]); total += Buffer.byteLength(content);
      if (content.includes('\0') || content.charCodeAt(0) === 0xfeff || total > 8 * LIMIT) throw new Error('Fichiers indexés UTF-8 sans BOM/NUL, 1 Mio/fichier et 8 Mio/commit requis.');
    }
    const diff = await this.run(['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', '--']);
    const temporary = join(this.root, `.git/microide-commit-index-${randomUUID()}`); let tree: string;
    try {
      const bytes = await this.bytes('.git/index'); if (!bytes) throw new Error('Index absent.');
      await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
      tree = (await this.run(['write-tree'], this.root, temporary)).trim();
    } finally { await unlink(temporary).catch(() => undefined); }
    if (!/^[a-f0-9]{40}$/.test(tree) || ref !== await this.commitRef() || signature !== await this.signature()) throw new Error('Dépôt modifié pendant la préparation du commit.');
    const head = parseStatus(await this.rawStatus()).head;
    const view = { ...identity, id: randomUUID(), branch: ref.slice(11), head, tree, files, diff };
    this.commitPlan = { view, signature, ref }; return structuredClone(view);
  }
  commitSelection(id: unknown): GitCommitPlan {
    if (typeof id !== 'string' || id !== this.commitPlan?.view.id) throw new Error('Aperçu de commit périmé ; préparez de nouveau.');
    return structuredClone(this.commitPlan.view);
  }
  async commit(id: unknown): Promise<GitCommitResult> {
    if (this.mutating) throw new Error('Mutation Git déjà en cours.');
    const view = this.commitSelection(id), plan = this.commitPlan!; this.commitPlan = undefined; this.mutating = true;
    const lockPath = join(this.root, '.git/index.lock'), messagePath = join(this.root, `.git/microide-message-${randomUUID()}`);
    let lock: Awaited<ReturnType<typeof open>> | undefined, oid: string | undefined, published = false;
    try {
      try { lock = await open(lockPath, 'wx', 0o600); } catch { throw new Error('Index Git verrouillé ; verrou existant conservé.'); }
      const owned = await lock.stat();
      const check = async () => {
        const stat = await lstat(lockPath);
        if (stat.isSymbolicLink() || stat.dev !== owned.dev || stat.ino !== owned.ino || plan.ref !== await this.commitRef() || plan.signature !== await this.signature()) throw new Error('Dépôt/index/fichiers modifiés depuis l’aperçu ; commit refusé.');
      };
      await check(); await writeFile(messagePath, view.message, { flag: 'wx', mode: 0o600 });
      oid = (await this.run(['commit-tree', '--no-gpg-sign', view.tree, ...(view.head === '(initial)' ? [] : ['-p', view.head]), '-F', messagePath], this.root, undefined, { identity: view })).trim();
      if (!/^[a-f0-9]{40}$/.test(oid)) throw new Error('Objet commit non qualifié.');
      await check();
      await this.run(['update-ref', '--stdin', '--create-reflog', '-m', `CPCéleste: ${view.message.split('\n')[0]}`], this.root, undefined,
        { identity: view, input: `start\nupdate HEAD ${oid} ${view.head === '(initial)' ? '0'.repeat(40) : view.head}\nprepare\n`, prepared: check });
      published = true;
      const status = await this.inspect();
      if (status.head !== oid || status.branch !== view.branch) throw new Error('HEAD modifié après publication.');
      return { oid, branch: view.branch, status };
    } catch (error) {
      // A timeout may happen after update-ref; never retry a commit silently.
      if (oid) {
        try { published ||= parseStatus(await this.rawStatus()).head === oid; } catch { /* Result remains unconfirmed. */ }
        if (published) throw new Error(`Commit ${oid} créé mais résultat non confirmé ; consultez l’historique avant de reprendre.`);
      }
      return this.failure(error);
    } finally {
      if (lock) {
        const owned = await lock.stat().catch(() => undefined); await lock.close().catch(() => undefined);
        const current = await lstat(lockPath).catch(() => undefined);
        if (owned && current && !current.isSymbolicLink() && owned.dev === current.dev && owned.ino === current.ino) await unlink(lockPath).catch(() => undefined);
      }
      await unlink(messagePath).catch(() => undefined); this.mutating = false;
    }
  }
  async prepareInit(): Promise<GitInitPlan> {
    try {
      this.initPlan = undefined;
      const status = await this.inspect();
      if (status.state !== 'not-repository') throw new Error('Dépôt existant ou parent : initialisation refusée.');
      const preserveIgnore = await this.exists(join(this.root, '.gitignore'));
      if (preserveIgnore) { const bytes = await this.bytes('.gitignore'); if (!bytes || bytes.length > 16 * 1024) throw new Error('.gitignore non qualifié ou supérieur à 16 Kio.'); new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      const view: GitInitPlan = { id: randomUUID(), rootName: basename(this.root), branch: 'main', ignoreText: PROJECT_GIT_IGNORE, version: status.version, preserveIgnore };
      this.initPlan = { view, signature: await this.workingSignature() }; return { ...view };
    } catch (error) { return this.failure(error); }
  }
  async init(id: unknown): Promise<RepositoryStatus> {
    if (this.mutating) throw new Error('Mutation Git déjà en cours.');
    this.mutating = true;
    let claimed = false;
    try {
      const plan = this.initPlan; this.initPlan = undefined;
      if (typeof id !== 'string' || !plan || plan.view.id !== id) throw new Error('Plan Git périmé ; préparez à nouveau la création.');
      if (await this.metadata() !== 'not-repository' || plan.signature !== await this.workingSignature())
        throw new Error('Projet modifié depuis l’aperçu ; aucun dépôt créé.');
      // Exclusive claim: never reinitialize, replace or delete an existing repository/ignore file.
      await mkdir(join(this.root, '.git'), { mode: 0o700 }); claimed = true;
      await writeFile(join(this.root, '.git/microide-init-pending'), plan.view.id, { flag: 'wx', mode: 0o600 });
      if (!plan.view.preserveIgnore) await writeFile(join(this.root, '.gitignore'), PROJECT_GIT_IGNORE, { flag: 'wx', mode: 0o600 });
      const template = await mkdtemp(join(this.root, '.git/empty-template-'));
      await this.run([`--git-dir=${join(this.root, '.git')}`, `--work-tree=${this.root}`, 'init', '--quiet', '--initial-branch=main',
        '--object-format=sha1', '--ref-format=files', `--template=${template}`]);
      await rmdir(template);
      if (plan.view.preserveIgnore) { await mkdir(join(this.root, '.git/info'), { recursive: true }); await writeFile(join(this.root, '.git/info/exclude'), PROJECT_GIT_IGNORE, { flag: 'wx', mode: 0o600 }); }
      await unlink(join(this.root, '.git/microide-init-pending'));
      return await this.inspect();
    } catch (error) {
      if (claimed) throw new Error('Création Git non confirmée : conserver .git et .gitignore, examiner le dossier ; aucune suppression automatique.');
      return this.failure(error);
    } finally { this.mutating = false; }
  }
  indexSelection(snapshotId: unknown, changeId: unknown, action: unknown): GitChange {
    if (typeof snapshotId !== 'string' || snapshotId !== this.snapshot?.id || typeof changeId !== 'string' || (action !== 'stage' && action !== 'unstage'))
      throw new Error('Sélection Git périmée ou invalide ; actualisez Git.');
    const change = this.changes.get(changeId);
    if (!change || change.kind === 'conflict' || change.kind === 'rename' || !this.permittedPaths().includes(change.path))
      throw new Error('Indexation limitée aux sources déclarées, au manifeste et à .gitignore ; conflits, renommages et contenus privés refusés.');
    if ((action === 'stage' && change.worktree === '.') || (action === 'unstage' && (change.index === '.' || change.index === '?')))
      throw new Error('Aucun changement sélectionnable de ce côté.');
    return { ...change };
  }
  async changeIndex(snapshotId: unknown, changeId: unknown, action: unknown): Promise<RepositoryStatus> {
    if (this.mutating) throw new Error('Mutation Git déjà en cours.');
    this.mutating = true;
    const lockPath = join(this.root, '.git/index.lock'), temporary = join(this.root, `.git/microide-index-${randomUUID()}`);
    let lock: Awaited<ReturnType<typeof open>> | undefined, published = false;
    try {
      const change = this.indexSelection(snapshotId, changeId, action), expected = this.snapshot!.signature;
      if (await this.metadata() !== 'repository') throw new Error('Dépôt Git indisponible.');
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch { throw new Error('Index Git verrouillé ou inaccessible ; aucun verrou existant supprimé.'); }
      const owned = await lock.stat();
      const assertLock = async () => {
        const current = await lstat(lockPath);
        if (current.isSymbolicLink() || current.dev !== owned.dev || current.ino !== owned.ino) throw new Error('Verrou Git remplacé ; publication refusée.');
      };
      if (expected !== await this.signature()) throw new Error('Dépôt ou fichiers modifiés depuis le statut ; index inchangé, actualisez Git.');
      const source = await this.bytes(change.path, true);
      if (source) {
        const value = new TextDecoder('utf-8', { fatal: true }).decode(source);
        if (value.includes('\0')) throw new Error('Seuls fichiers texte UTF-8 sont indexables.');
      }
      const previous = await this.bytes('.git/index', true);
      if (previous) await writeFile(temporary, previous, { flag: 'wx', mode: 0o600 });
      if (action === 'stage') await this.run(['add', '--', `:(literal)${change.path}`], this.root, temporary);
      else if ((await this.rawStatus()).includes('# branch.oid (initial)\0'))
        await this.run(['update-index', '--force-remove', '--', change.path], this.root, temporary);
      else await this.run(['reset', '--quiet', 'HEAD', '--', `:(literal)${change.path}`], this.root, temporary);
      const candidate = await this.bytes(relative(this.root, temporary).split('\\').join('/'));
      await this.metadata();
      if (expected !== await this.signature()) throw new Error('Dépôt ou fichiers modifiés pendant la préparation ; index inchangé, actualisez Git.');
      await assertLock(); await lock.writeFile(candidate!); await lock.sync();
      if (expected !== await this.signature()) throw new Error('Dépôt modifié avant publication ; index inchangé, actualisez Git.');
      await assertLock(); await rename(lockPath, join(this.root, '.git/index')); published = true;
      await lock.close(); lock = undefined;
      this.snapshot = undefined; this.changes.clear();
      return await this.inspect();
    } catch (error) {
      if (published) throw new Error('Index modifié mais actualisation impossible ; consulter Git avant toute nouvelle opération.');
      return this.failure(error);
    } finally {
      if (lock) {
        const owned = await lock.stat().catch(() => undefined); await lock.close().catch(() => undefined);
        const current = await lstat(lockPath).catch(() => undefined);
        if (owned && current && !current.isSymbolicLink() && owned.dev === current.dev && owned.ino === current.ino) await unlink(lockPath).catch(() => undefined);
      }
      // Only this operation's opaque temporary index; never remove a pre-existing index.lock.
      await unlink(temporary).catch(() => undefined);
      this.mutating = false;
    }
  }
}
