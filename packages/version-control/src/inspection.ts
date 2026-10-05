/** Application contract. No executable, host path or free-form command. */
export interface GitChange {
  id: string;
  path: string;
  originalPath?: string;
  kind: 'tracked' | 'rename' | 'untracked' | 'conflict';
  index: string;
  worktree: string;
  indexable?: boolean;
}
export interface RepositoryStatus {
  state: 'repository' | 'not-repository' | 'parent-repository';
  version: string;
  branch: string;
  head: string;
  changes: GitChange[];
  snapshotId?: string;
}
export type DiffSide = 'worktree' | 'index';
export interface GitDiff { path: string; side: DiffSide; text: string }
export interface GitCommit { oid: string; date: string; subject: string }
export interface GitHistory { head: string; commits: GitCommit[]; nextCursor?: string }
export type IndexAction = 'stage' | 'unstage';
export interface GitInitPlan { id: string; rootName: string; branch: 'main'; ignoreText: string; version: string }
export const PROJECT_GIT_IGNORE = '# Micro IDE Amstrad — contenu local privé et artefacts\n' +
  '/documents/\n/roms/\n/firmware/\n/.microide/\n/.microide-*/\n/out/\n/dist/\n/node_modules/\n/cache/\n/checkpoints/\n/conversations/\n/logs/\n' +
  '.env\n.env.*\n*.rom\n*.dsk\n*.sna\n*.log\n*.local.json\n';
export interface GitCommitInput { name: string; email: string; message: string }
export interface GitCommitPlan extends GitCommitInput {
  id: string; branch: string; head: string; tree: string;
  files: { path: string; status: 'A' | 'M' | 'D' }[]; diff: string;
}
export interface GitCommitResult { oid: string; branch: string; status: RepositoryStatus }
export function commitInput(value: unknown): GitCommitInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3 || !['name', 'email', 'message'].every(key => Object.hasOwn(value, key))) throw new Error('Identité et message de commit requis.');
  const { name, email, message } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || name.length > 100 || /[\x00-\x1f\x7f-\x9f<>]/.test(name) || typeof email !== 'string' || email.length > 254 || !/^[^\s<>@\x00-\x1f\x7f-\x9f]+@[^\s<>@\x00-\x1f\x7f-\x9f]+$/.test(email)) throw new Error('Nom (1–100 caractères) et email Git valides requis.');
  if (typeof message !== 'string' || !message.trim() || message.length > 8192 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) throw new Error('Message de commit requis, 8 192 caractères maximum.');
  return { name: name.trim(), email, message: message.replace(/\r\n?/g, '\n').trim() + '\n' };
}
export interface VersionControlPort {
  prepareCommit(sessionId: string, input: GitCommitInput): Promise<GitCommitPlan | { error: string }>;
  commit(sessionId: string, planId: string): Promise<GitCommitResult | { error: string } | null>;
  status(sessionId: string): Promise<RepositoryStatus | { error: string }>;
  diff(sessionId: string, changeId: string, side: DiffSide): Promise<GitDiff | { error: string }>;
  history(sessionId: string, cursor?: string): Promise<GitHistory | { error: string }>;
  prepareInit(sessionId: string): Promise<GitInitPlan | { error: string }>;
  init(sessionId: string, planId: string): Promise<RepositoryStatus | { error: string } | null>;
  changeIndex(sessionId: string, snapshotId: string, changeId: string, action: IndexAction): Promise<RepositoryStatus | { error: string } | null>;
}
export function gitPath(value: string): string {
  if (!value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git'))
    throw new Error('Chemin Git hors périmètre.');
  return value;
}
function fields(record: string, count: number): { fields: string[]; path: string } {
  const result: string[] = []; let offset = 0;
  for (let i = 0; i < count; i++) {
    const end = record.indexOf(' ', offset);
    if (end < 0) throw new Error('Statut Git incomplet.');
    result.push(record.slice(offset, end)); offset = end + 1;
  }
  return { fields: result, path: gitPath(record.slice(offset)) };
}
/** Porcelain v2 NUL records; never split file names on whitespace/newlines. */
export function parseStatus(text: string): Omit<RepositoryStatus, 'state' | 'version'> {
  if (text && !text.endsWith('\0')) throw new Error('Statut Git tronqué.');
  const records = text.split('\0'); records.pop();
  const changes: GitChange[] = []; let branch = '', head = '';
  for (let i = 0; i < records.length; i++) {
    if (changes.length >= 2000) throw new Error('Statut supérieur à 2 000 changements.');
    const record = records[i]!;
    if (record.startsWith('# ')) {
      if (record.startsWith('# branch.head ')) branch = record.slice(14);
      if (record.startsWith('# branch.oid ')) head = record.slice(13);
      continue;
    }
    if (record.startsWith('? ')) {
      changes.push({ id: '', path: gitPath(record.slice(2)), kind: 'untracked', index: '?', worktree: '?' }); continue;
    }
    const type = record[0];
    if (type !== '1' && type !== '2' && type !== 'u') throw new Error('Statut Git non reconnu.');
    const parsed = fields(record, type === '1' ? 8 : type === '2' ? 9 : 10);
    const xy = parsed.fields[1]!;
    if (!/^[.MADRCUT?!]{2}$/.test(xy) || parsed.fields[2] !== 'N...' || parsed.fields.slice(3, type === 'u' ? 7 : 6).includes('160000'))
      throw new Error('Sous-module ou statut Git non pris en charge.');
    const change: GitChange = { id: '', path: parsed.path, kind: type === 'u' ? 'conflict' : type === '2' ? 'rename' : 'tracked', index: xy[0]!, worktree: xy[1]! };
    if (type === '2') {
      const original = records[++i];
      if (original === undefined) throw new Error('Renommage Git incomplet.');
      change.originalPath = gitPath(original);
    }
    changes.push(change);
    if (changes.length > 2000) throw new Error('Statut supérieur à 2 000 changements.');
  }
  if (!branch || !head) throw new Error('En-tête Git incomplet.');
  return { branch, head, changes };
}
