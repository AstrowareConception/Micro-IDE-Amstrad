import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm, lstat, readdir } from 'node:fs/promises';
import { join, dirname, delimiter, isAbsolute, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { GitInspection, GIT_NULL } from './git-inspection.ts';
import { ProjectStore } from './project-store.ts';
import { parseProject } from '../../packages/workspace/src/project.ts';
import { gitPath, parseStatus } from '../../packages/version-control/src/inspection.ts';
import { GIT_ACTION_LABELS, branchName, remoteName, remoteUrl, type GitOverview, type GitRequest, type GitOperationPlan } from '../../packages/version-control/src/operations.ts';

interface Options {
  approvedLocal?: readonly string[];
  authorization?: (url: string) => string | undefined;
  validateProject?: (folder: string) => Promise<unknown>;
  /** Trusted host test fixture only, never an IPC option. TLS verification remains enabled. */
  certificateAuthority?: string;
}
interface Plan { view: GitOperationPlan; revision: string; request: GitRequest }
const OID = /^[a-f0-9]{40}$/;
const PRIVATE_PATH = /(?:^|\/)(?:\.env(?:\..*)?|documents|roms|firmware|\.microide(?:-.*)?|checkpoints|conversations|logs|node_modules|out|dist)(?:\/|$)|\.(?:rom|dsk|sna|local\.json)$/i;
const SECRET = /sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/;
/** Typed native commands. Local config is qualified by GitInspection before use. */
export class GitOperations {
  private plan: Plan | undefined;
  private fetchedAt: string | null = null;
  private active = false;
  private child: ChildProcess | undefined;
  private interrupted = false;
  readonly root: string;
  private readonly inspector: GitInspection;
  private readonly options: Options;
  constructor(root: string, inspector: GitInspection, options: Options = {}) {
    this.root = root; this.inspector = inspector;
    this.options = options.certificateAuthority || !process.env.GIT_SSL_CAINFO ? options : { ...options, certificateAuthority: process.env.GIT_SSL_CAINFO };
  }
  private async run(args: string[], url?: string): Promise<Buffer> {
    const executable = await this.inspector.executablePath();
    const searchPath = (process.env.PATH ?? '').split(delimiter).filter(path => isAbsolute(path) && (isAbsolute(relative(this.root, path)) || relative(this.root, path) === '..' || relative(this.root, path).startsWith('..' + (process.platform === 'win32' ? '\\' : '/')))).join(delimiter);
    const env: NodeJS.ProcessEnv = { PATH: searchPath, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GIT_NULL, GIT_CONFIG_SYSTEM: GIT_NULL,
      GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_ATTR_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
    for (const key of ['SystemRoot', 'HOME', 'USERPROFILE', 'SSH_AUTH_SOCK', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
    env.GIT_SSH_COMMAND = 'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes -oPermitLocalCommand=no -oClearAllForwardings=yes';
    const authorization = url && this.options.authorization?.(url);
    if (authorization) { env.GIT_CONFIG_COUNT = '1'; env.GIT_CONFIG_KEY_0 = 'http.' + new URL(url).origin + '/.extraHeader'; env.GIT_CONFIG_VALUE_0 = 'Authorization: ' + authorization; }
    return new Promise((resolve, reject) => {
      this.interrupted = false;
      const child = spawn(executable, ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=' + GIT_NULL,
        '-c', 'core.attributesFile=' + GIT_NULL, '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'protocol.ssh.allow=always',
        ...(url && this.options.approvedLocal?.includes(url) ? ['-c', 'protocol.file.allow=always'] : []),
        '-c', 'http.followRedirects=false', '-c', 'http.sslVerify=true', '-c', 'credential.helper=', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0',
        ...(this.options.certificateAuthority ? ['-c', 'http.sslCAInfo=' + this.options.certificateAuthority] : []), ...args],
        { cwd: this.root, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      const chunks: Buffer[] = []; let bytes = 0, failed = false;
      for (const stream of [child.stdout, child.stderr]) stream?.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) { failed = true; this.terminate(child); }
        else if (stream === child.stdout) chunks.push(chunk);
      });
      child.once('error', () => { failed = true; });
      const timer = setTimeout(() => this.cancel(), url ? 120_000 : 15_000);
      child.once('exit', () => this.terminate(child));
      child.once('close', code => {
        clearTimeout(timer); this.terminate(child); this.child = undefined;
        if (this.interrupted) reject(new Error('Opération Git interrompue. Vérifiez son résultat puis actualisez avant de recommencer.'));
        else if (failed || code !== 0) reject(new Error(url ? 'Opération distante refusée ou interrompue. Vérifiez connexion, droits, clé SSH, divergence et verrou Git ; actualisez avant de recommencer.' : 'Opération Git refusée. Vérifiez branche, fichiers modifiés et verrou Git ; actualisez avant de recommencer.'));
        else resolve(Buffer.concat(chunks));
      });
    });
  }
  private terminate(child: ChildProcess): void {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      if (child.exitCode !== null) return;
      const root = process.env.SystemRoot;
      if (root && isAbsolute(root)) spawn(join(root, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => undefined);
      child.kill();
    } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Owned process group already ended. */ } }
  }
  cancel(): { stopped: boolean } {
    if (!this.child) return { stopped: false };
    this.interrupted = true; this.terminate(this.child); return { stopped: true };
  }
  private async text(args: string[], url?: string): Promise<string> { return new TextDecoder('utf-8', { fatal: true }).decode(await this.run(args, url)); }
  async overview(): Promise<GitOverview> {
    const revision = await this.inspector.operationRevision();
    const status = parseStatus(await this.text(['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all']));
    const remotes = [];
    for (const name of (await this.text(['remote'])).trim().split('\n').filter(Boolean)) {
      remoteName(name);
      const fetch = (await this.text(['remote', 'get-url', '--all', name])).trim().split('\n');
      const push = (await this.text(['remote', 'get-url', '--push', '--all', name])).trim().split('\n');
      if (fetch.length !== 1 || push.length !== 1 || fetch[0] !== push[0]) throw new Error('Remote avec URLs multiples ou push distinct non qualifié.');
      remotes.push({ name, url: remoteUrl(fetch[0], this.options.approvedLocal) });
    }
    const output = await this.text(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(upstream:short)%00%(HEAD)', 'refs/heads/', 'refs/remotes/']);
    const branches = output.trim().split('\n').filter(Boolean).map(line => {
      const [ref = '', oid = '', upstream = '', head = ''] = line.split('\0');
      if (!OID.test(oid) || !ref.startsWith('refs/')) throw new Error('Référence Git invalide.');
      return { name: ref.replace(/^refs\/(heads|remotes)\//, ''), oid, upstream, current: head === '*', remote: ref.startsWith('refs/remotes/') };
    }).filter(branch => !branch.name.endsWith('/HEAD'));
    let ahead = 0, behind = 0;
    if (branches.find(branch => branch.current)?.upstream) {
      const counts = (await this.text(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}', '--'])).trim().split(/\s+/);
      ahead = Number(counts[0]); behind = Number(counts[1]);
    }
    if (revision !== await this.inspector.operationRevision()) throw new Error('Dépôt modifié pendant la lecture ; actualisez Git.');
    return { revision, branch: status.branch, head: status.head, remotes, branches, ahead, behind, fetchedAt: this.fetchedAt };
  }
  private async clean(): Promise<void> {
    if (parseStatus(await this.text(['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all'])).changes.length) throw new Error('Enregistrez puis commitez ou arbitrez les changements sur disque avant cette opération.');
    for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'index.lock']) {
      try { await lstat(join(this.root, '.git', marker)); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      throw new Error('Une opération Git ou un verrou est déjà présent ; terminez ou annulez-la explicitement.');
    }
  }
  async targetFiles(oid: string): Promise<{ path: string; oid: string }[]> {
    if (!OID.test(oid)) throw new Error('Commit cible invalide.');
    const records = (await this.text(['ls-tree', '-r', '-z', oid])).split('\0').filter(Boolean);
    if (records.length > 256) throw new Error('Arbre de projet supérieur à 256 fichiers.');
    return records.map(record => {
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(record);
      if (!match) throw new Error('Liens symboliques et sous-modules refusés dans la cible.');
      const path = gitPath(match[3]!);
      if (/[\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => /^\.microide(?:-|$)/i.test(part))) throw new Error('Chemin de cible réservé ou non qualifié.');
      return { path, oid: match[2]! };
    });
  }
  async validateTarget(oid: string): Promise<void> {
    const files = await this.targetFiles(oid), folder = await mkdtemp(join(tmpdir(), 'cpceleste-git-preview-')); let total = 0;
    try {
      const tracked = new Set((await this.text(['ls-files', '-z'])).split('\0').filter(Boolean));
      for (const file of files) {
        let path = this.root;
        for (const part of file.path.split('/')) {
          path = join(path, part);
          try {
            const stat = await lstat(path);
            if (stat.isSymbolicLink() || !stat.isDirectory() && path !== join(this.root, file.path)) throw new Error('Chemin local non qualifié.');
            if (path === join(this.root, file.path) && !tracked.has(file.path)) throw new Error('Une cible remplacerait un fichier local non suivi ou ignoré.');
          } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        }
      }
      for (const file of files) {
        const bytes = await this.run(['cat-file', 'blob', file.oid]); total += bytes.length;
        if (total > 16 * 1024 * 1024) throw new Error('Arbre cible supérieur à 16 Mio.');
        await mkdir(dirname(join(folder, file.path)), { recursive: true }); await writeFile(join(folder, file.path), bytes, { flag: 'wx', mode: 0o600 });
      }
      await (this.options.validateProject ?? (folder => ProjectStore.open(folder)))(folder);
    } catch { throw new Error('Projet cible invalide, non portable ou en collision avec un fichier ignoré. Branche et fichiers courants conservés ; vérifiez manifeste, sources et documents.'); }
    finally { await rm(folder, { recursive: true, force: true }); }
  }
  async clone(url: string): Promise<void> {
    const target = remoteUrl(url, this.options.approvedLocal);
    if ((await readdir(this.root)).length) throw new Error('Un nouveau dossier vide est requis pour cloner.');
    const template = await mkdtemp(join(tmpdir(), 'cpceleste-git-template-'));
    try {
      await this.run(['clone', '--no-checkout', '--no-tags', '--no-recurse-submodules', '--template=' + template, '--', target, '.'], target);
      await this.inspector.operationRevision();
      const head = (await this.text(['rev-parse', '--verify', 'HEAD'])).trim();
      await this.validateTarget(head);
      if ((await readdir(this.root)).some(name => name !== '.git')) throw new Error('Le dossier de clone a été modifié ; checkout refusé.');
      await this.run(['reset', '--hard', head]);
    } finally { await rm(template, { recursive: true, force: true }); }
  }
  private async publishedFiles(head: string, target: string): Promise<{ commits: number; files: string[] }> {
    const commits = (await this.text(['rev-list', '--max-count=201', head, ...(target ? ['^' + target] : []), '--'])).trim().split('\n').filter(Boolean);
    if (commits.length > 200) throw new Error('Publication supérieure à 200 nouveaux commits ; publication intégrée refusée.');
    const paths = new Set<string>(); let bytes = 0;
    for (const commit of commits) for (const file of await this.targetFiles(commit)) {
      if (PRIVATE_PATH.test(file.path)) throw new Error('Publication bloquée : contenu privé dans les commits à envoyer (' + file.path + ').');
      const content = await this.run(['cat-file', 'blob', file.oid]); bytes += content.length;
      if (bytes > 32 * 1024 * 1024) throw new Error('Analyse de publication supérieure à 32 Mio.');
      let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); } catch { throw new Error('Publication de contenu binaire non qualifiée : ' + file.path); }
      if (SECRET.test(text)) throw new Error('Publication bloquée : motif de secret détecté dans les nouveaux commits. Corrigez l’histoire et révoquez le secret avant tout partage.');
      if (file.path === 'microide.project.json' && parseProject(JSON.parse(text)).documents.length) throw new Error('Le manifeste publié référence des documents privés ; préparez explicitement un projet portable avant publication.');
      paths.add(file.path);
    }
    return { commits: commits.length, files: [...paths].sort() };
  }
  async prepare(revision: unknown, input: unknown): Promise<GitOperationPlan> {
    this.plan = undefined;
    if (this.active || typeof revision !== 'string' || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Requête Git invalide.');
    const request = input as GitRequest;
    if (Object.keys(request).some(key => !['action', 'remote', 'url', 'branch'].includes(key)) || !['add-remote', 'set-remote', 'remove-remote', 'create-branch', 'switch-branch', 'delete-branch', 'fetch', 'pull', 'push', 'upstream'].includes(request.action)) throw new Error('Action Git invalide.');
    let snapshot = await this.overview(); if (revision !== snapshot.revision) throw new Error('Aperçu Git périmé ; actualisez.');
    if (snapshot.branch === '(detached)') throw new Error('Revenez sur une branche locale avant cette opération.');
    const action = request.action, remote = request.remote === undefined ? '' : remoteName(request.remote), branch = request.branch === undefined ? snapshot.branch : branchName(request.branch);
    let url = '', target = '', commits = 0, files: string[] = [];
    if (action.includes('remote') || ['fetch', 'pull', 'push', 'upstream'].includes(action)) {
      remoteName(remote);
      const existing = snapshot.remotes.find(entry => entry.name === remote);
      if (action === 'add-remote') { if (existing) throw new Error('Ce remote existe déjà.'); url = remoteUrl(request.url, this.options.approvedLocal); }
      else { if (!existing) throw new Error('Remote inconnu.'); url = action === 'set-remote' ? remoteUrl(request.url, this.options.approvedLocal) : existing.url; }
    }
    if (['create-branch', 'switch-branch', 'delete-branch', 'upstream', 'pull', 'push'].includes(action)) {
      if (!OID.test(snapshot.head)) throw new Error('Créez un premier commit avant de gérer les branches ou de synchroniser.');
      branchName(branch);
    }
    if (['switch-branch', 'delete-branch', 'upstream', 'pull'].includes(action)) await this.clean();
    if (action === 'pull') {
      const before = await this.inspector.workspaceRevision();
      await this.run(['fetch', '--atomic', '--prune', '--no-tags', '--no-recurse-submodules', '--', url, '+refs/heads/*:refs/remotes/' + remote + '/*'], url);
      this.fetchedAt = new Date().toISOString();
      if (before !== await this.inspector.workspaceRevision()) throw new Error('Fichiers ou HEAD modifiés pendant le fetch ; pull interrompu.');
      snapshot = await this.overview();
    }
    if (action === 'create-branch' && snapshot.branches.some(entry => !entry.remote && entry.name === branch)) throw new Error('Branche locale déjà existante.');
    if (action === 'switch-branch') {
      const entry = snapshot.branches.find(entry => entry.name === branch); if (!entry) throw new Error('Branche inconnue.');
      if (entry.remote && snapshot.branches.some(local => !local.remote && local.name === branch.slice(branch.indexOf('/') + 1))) throw new Error('Cette branche locale existe déjà ; sélectionnez-la dans la liste locale.');
      target = entry.oid; await this.validateTarget(target);
    }
    if (action === 'delete-branch') {
      const entry = snapshot.branches.find(entry => !entry.remote && entry.name === branch); if (!entry || entry.current) throw new Error('Choisissez une autre branche locale.');
      if ((await this.text(['merge-base', snapshot.head, entry.oid])).trim() !== entry.oid) throw new Error('Branche non fusionnée ; suppression sûre refusée.');
      target = entry.oid;
    }
    if (action === 'pull' || action === 'upstream') {
      const entry = snapshot.branches.find(entry => entry.remote && entry.name === remote + '/' + branch); if (!entry) throw new Error('Faites Fetch pour charger cette branche distante.');
      target = entry.oid;
      if (action === 'pull') {
        const common = (await this.text(['merge-base', snapshot.head, target])).trim();
        if (common !== snapshot.head && common !== target) throw new Error('Histoires divergentes : pull fast-forward refusé. Aucun rebase ni fusion automatique.');
        if (common === target) target = snapshot.head;
        await this.validateTarget(target);
      }
    }
    if (action === 'push') {
      const response = (await this.text(['ls-remote', '--heads', '--', url, 'refs/heads/' + branch], url)).trim();
      target = response ? response.split(/\s+/)[0]! : '';
      if (target && (!OID.test(target) || (await this.text(['merge-base', snapshot.head, target])).trim() !== target)) throw new Error('Remote en avance ou objet absent : faites Fetch puis examinez la divergence. Aucun push forcé.');
      ({ commits, files } = await this.publishedFiles(snapshot.head, target));
    }
    if (snapshot.revision !== await this.inspector.operationRevision()) throw new Error('Dépôt modifié pendant la préparation.');
    const view = { id: randomUUID(), action, localBranch: snapshot.branch, branch, remote, url, head: snapshot.head, target, commits, files };
    this.plan = { view, revision: snapshot.revision, request: structuredClone(request) }; return structuredClone(view);
  }
  selection(id: unknown): GitOperationPlan { if (typeof id !== 'string' || id !== this.plan?.view.id) throw new Error('Plan Git périmé ; préparez de nouveau.'); return structuredClone(this.plan.view); }
  async apply(id: unknown): Promise<{ overview: GitOverview; changesFiles: boolean; summary: string }> {
    const view = this.selection(id), plan = this.plan!; this.plan = undefined;
    if (this.active) throw new Error('Une opération Git est déjà active.'); this.active = true;
    try {
      if (plan.revision !== await this.inspector.operationRevision()) throw new Error('Dépôt modifié depuis la préparation ; opération refusée.');
      const { action, branch, remote, url, head, target } = view;
      if (['switch-branch', 'delete-branch', 'upstream', 'pull'].includes(action)) await this.clean();
      if (action === 'add-remote') await this.run(['remote', 'add', '--', remote, url]);
      else if (action === 'set-remote') await this.run(['remote', 'set-url', '--', remote, url]);
      else if (action === 'remove-remote') await this.run(['remote', 'remove', remote]);
      else if (action === 'create-branch') await this.run(['branch', '--no-track', branch, head]);
      else if (action === 'switch-branch') {
        const snapshot = await this.overview(), entry = snapshot.branches.find(entry => entry.name === branch);
        if (entry?.remote) await this.run(['switch', '--no-overwrite-ignore', '--create', branchName(branch.slice(remoteName(branch.split('/')[0]).length + 1)), '--track', 'refs/remotes/' + branch]);
        else await this.run(['switch', '--no-overwrite-ignore', '--no-guess', branch]);
      }
      else if (action === 'delete-branch') await this.run(['branch', '--delete', branch]);
      else if (action === 'fetch') { await this.run(['fetch', '--atomic', '--prune', '--no-tags', '--no-recurse-submodules', '--', url, '+refs/heads/*:refs/remotes/' + remote + '/*'], url); this.fetchedAt = new Date().toISOString(); }
      else if (action === 'pull') { if (target !== head) await this.run(['merge', '--no-overwrite-ignore', '--ff-only', '--no-edit', '--no-autostash', target]); }
      else if (action === 'upstream') await this.run(['branch', '--set-upstream-to=' + remote + '/' + branch]);
      else if (action === 'push') {
        const current = (await this.text(['ls-remote', '--heads', '--', url, 'refs/heads/' + branch], url)).trim().split(/\s+/)[0] ?? '';
        if (current !== target) throw new Error('Branche distante modifiée depuis l’aperçu ; faites Fetch puis préparez à nouveau.');
        await this.run(['push', '--porcelain', '--no-verify', '--', url, head + ':refs/heads/' + branch], url);
        await this.run(['update-ref', 'refs/remotes/' + remote + '/' + branch, head]);
        await this.run(['config', '--local', 'branch.' + (await this.overview()).branch + '.remote', remote]);
        await this.run(['config', '--local', 'branch.' + (await this.overview()).branch + '.merge', 'refs/heads/' + branch]);
      }
      return { overview: await this.overview(), changesFiles: action === 'switch-branch' || action === 'pull', summary: GIT_ACTION_LABELS[action] + ' : terminé. Les compteurs décrivent les références connues localement.' };
    } catch (error) { throw new Error((error instanceof Error ? error.message : 'Échec Git.') + ' Aucun nouvel essai automatique ; inspectez le statut avant de reprendre.'); }
    finally { this.active = false; }
  }
}
