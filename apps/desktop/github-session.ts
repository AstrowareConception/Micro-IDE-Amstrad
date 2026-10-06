import { execFile } from 'node:child_process';
import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, join, relative } from 'node:path';
import { branchName, githubRepository, type GitHubAccount, type GitHubRepository, type GitHubPullRequest } from '../../packages/version-control/src/operations.ts';
type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Réponse GitHub invalide.'); return value as RecordValue; }
function text(value: unknown, limit: number): string { if (typeof value !== 'string' || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('Texte GitHub invalide.'); return value; }
export class GitHubSession {
  private token: string | undefined;
  private login = '';
  private readonly transport: typeof fetch | undefined;
  private revision = 0;
  constructor(transport?: typeof fetch) { this.transport = transport; }
  account(): GitHubAccount { return { connected: !!this.token, login: this.login }; }
  disconnect(): GitHubAccount { this.token = undefined; this.login = ''; this.revision++; return this.account(); }
  authorization(url: string): string | undefined {
    if (!this.token || !/^https:\/\/github\.com\//.test(url)) return undefined;
    return 'Basic ' + Buffer.from('x-access-token:' + this.token).toString('base64');
  }
  private async request(path: string, method = 'GET', body?: unknown, token = this.token): Promise<unknown> {
    if (!token) throw new Error('Connectez un compte GitHub avant cette action.');
    const response = await (this.transport ?? fetch)('https://api.github.com' + path, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'CPCeleste' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      .catch(() => { throw new Error('GitHub inaccessible ou délai dépassé. Aucun nouvel essai automatique.'); });
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 401 ? 'Connexion GitHub refusée ou expirée (401).' : response.status === 403 ? 'Droits GitHub insuffisants ou limite API atteinte (403).' : response.status === 404 ? 'Dépôt GitHub inaccessible : vérifiez compte, droits et autorisation de l’organisation.' : response.status === 422 ? 'GitHub refuse cette création : nom, branches ou PR déjà existante. Vérifiez sur GitHub avant de recommencer.' : 'GitHub HTTP ' + response.status + '. Vérifiez le résultat sur GitHub avant de recommencer.'); }
    if (!response.body) throw new Error('Réponse GitHub absente.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 1024 * 1024) { await reader.cancel(); throw new Error('Réponse GitHub supérieure à 1 Mio.'); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const content = Buffer.concat(chunks), decoded = new TextDecoder('utf-8', { fatal: true }).decode(content);
    if (decoded.includes(token)) throw new Error('Réponse GitHub contenant un secret refusée.');
    try { return JSON.parse(decoded); } catch { throw new Error('Réponse GitHub JSON invalide.'); }
  }
  async connect(value: unknown): Promise<GitHubAccount> {
    if (typeof value !== 'string' || !/^(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{16,240}$/.test(value)) throw new Error('Jeton GitHub personnel valide requis.');
    const revision = this.revision, account = object(await this.request('/user', 'GET', undefined, value));
    if (typeof account.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(account.login)) throw new Error('Compte GitHub invalide.');
    if (revision !== this.revision) throw new Error('Connexion GitHub modifiée ; recommencez.');
    this.token = value; this.login = account.login; this.revision++; return this.account();
  }
  async connectCLI(untrustedRoot: string): Promise<GitHubAccount> {
    let executable: string | undefined;
    for (const directory of (process.env.PATH ?? '').split(delimiter)) {
      if (!isAbsolute(directory)) continue;
      try { const path = await realpath(join(directory, process.platform === 'win32' ? 'gh.exe' : 'gh')), location = relative(untrustedRoot, path);
        if (!isAbsolute(location) && location !== '..' && !location.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))) continue;
        if (!(await lstat(path)).isFile()) continue; await access(path, constants.X_OK); executable = path; break;
      } catch { /* Only host installations outside the project. */ }
    }
    if (!executable) throw new Error('GitHub CLI introuvable. Installez gh puis utilisez gh auth login --web, ou connectez un jeton personnel.');
    const token = await new Promise<string>((resolve, reject) => {
      const child = execFile(executable, ['auth', 'token', '--hostname', 'github.com'], { cwd: dirnameOfExecutable(executable!), shell: false, windowsHide: true, timeout: 15_000, maxBuffer: 4096, encoding: 'utf8' },
        (error, stdout) => error ? reject(new Error('Compte GitHub CLI non connecté. Utilisez gh auth login --web puis réessayez.')) : resolve(stdout.trim()));
      child.stdin?.end();
    });
    return this.connect(token);
  }
  private repository(value: unknown): GitHubRepository {
    const entry = object(value), fullName = text(entry.full_name, 201), url = text(entry.clone_url, 512);
    if (githubRepository(url) !== fullName || typeof entry.private !== 'boolean') throw new Error('Dépôt GitHub invalide.');
    return { fullName, url, private: entry.private, defaultBranch: branchName(entry.default_branch) };
  }
  async repositories(page: unknown = 1): Promise<{ repositories: GitHubRepository[]; nextPage: number | null }> {
    if (!Number.isSafeInteger(page) || (page as number) < 1 || (page as number) > 20) throw new Error('Page de dépôts invalide (20 maximum).');
    const result = await this.request('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=' + page);
    if (!Array.isArray(result) || result.length > 100) throw new Error('Liste GitHub invalide.');
    return { repositories: result.map(value => this.repository(value)), nextPage: result.length === 100 && (page as number) < 20 ? (page as number) + 1 : null };
  }
  async createRepository(name: unknown, isPrivate: unknown): Promise<GitHubRepository> {
    if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(name) || typeof isPrivate !== 'boolean') throw new Error('Nom et visibilité du dépôt requis.');
    return this.repository(await this.request('/user/repos', 'POST', { name, private: isPrivate, auto_init: false }));
  }
  private pullRequest(value: unknown, repository: string): GitHubPullRequest {
    const entry = object(value), url = text(entry.html_url, 512);
    if (!Number.isSafeInteger(entry.number) || (entry.number as number) < 1 || url !== 'https://github.com/' + repository + '/pull/' + entry.number || typeof entry.draft !== 'boolean') throw new Error('Pull request GitHub invalide.');
    return { number: entry.number as number, title: text(entry.title, 256), url, head: branchName(object(entry.head).ref), base: branchName(object(entry.base).ref), draft: entry.draft };
  }
  async pullRequests(repository: string): Promise<GitHubPullRequest[]> {
    githubRepository('https://github.com/' + repository); const result = await this.request('/repos/' + repository + '/pulls?state=open&per_page=100');
    if (!Array.isArray(result) || result.length > 100) throw new Error('Liste de PR invalide.');
    return result.map(value => this.pullRequest(value, repository));
  }
  async createPullRequest(repository: string, head: unknown, base: unknown, title: unknown, body: unknown, draft: unknown): Promise<GitHubPullRequest> {
    githubRepository('https://github.com/' + repository); const headBranch = branchName(head), baseBranch = branchName(base);
    if (headBranch === baseBranch || typeof draft !== 'boolean') throw new Error('Deux branches distinctes et état brouillon requis.');
    const subject = text(title, 256).trim(), description = text(body, 20_000); if (!subject) throw new Error('Titre de PR requis.');
    return this.pullRequest(await this.request('/repos/' + repository + '/pulls', 'POST', { head: headBranch, base: baseBranch, title: subject, body: description, draft }), repository);
  }
}
function dirnameOfExecutable(path: string): string { return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))); }
