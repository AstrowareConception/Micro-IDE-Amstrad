import type { ProjectSnapshot } from '../../workspace/src/project.ts';
export interface GitRemote { name: string; url: string }
export interface GitBranch { name: string; oid: string; upstream: string; current: boolean; remote: boolean }
export interface GitOverview { revision: string; branch: string; head: string; remotes: GitRemote[]; branches: GitBranch[]; ahead: number; behind: number; fetchedAt: string | null }
export type GitAction = 'add-remote' | 'set-remote' | 'remove-remote' | 'create-branch' | 'switch-branch' | 'delete-branch' | 'fetch' | 'pull' | 'push' | 'upstream';
export const GIT_ACTION_LABELS: Record<GitAction, string> = {
  'add-remote': 'Ajouter un remote', 'set-remote': 'Modifier l’URL du remote', 'remove-remote': 'Retirer le remote',
  'create-branch': 'Créer la branche', 'switch-branch': 'Basculer sur la branche', 'delete-branch': 'Supprimer la branche',
  fetch: 'Fetch : actualiser les références', pull: 'Pull : avancer la branche', push: 'Push : publier la branche', upstream: 'Définir la branche suivie',
};
export interface GitRequest { action: GitAction; remote?: string; url?: string; branch?: string }
export interface GitOperationPlan { id: string; action: GitAction; localBranch: string; branch: string; remote: string; url: string; head: string; target: string; commits: number; files: string[] }
export interface GitOperationResult { overview: GitOverview; project?: ProjectSnapshot; summary: string }
export interface GitOperationsPort {
  cancel(): Promise<{ stopped: boolean } | { error: string }>;
  overview(sessionId: string): Promise<GitOverview | { error: string }>;
  prepare(sessionId: string, revision: string, request: GitRequest): Promise<GitOperationPlan | { error: string }>;
  apply(sessionId: string, planId: string): Promise<GitOperationResult | { error: string } | null>;
  suggestMessage(sessionId: string, identity: { name: string; email: string }): Promise<{ message: string; model: string } | { error: string } | null>;
}
export interface GitHubAccount { login: string; connected: boolean }
export interface GitHubRepository { fullName: string; url: string; private: boolean; defaultBranch: string }
export interface GitHubPullRequest { number: number; title: string; url: string; head: string; base: string; draft: boolean }
export interface GitHubPort {
  account(): Promise<GitHubAccount | { error: string }>;
  connect(token: string): Promise<GitHubAccount | { error: string }>;
  connectCLI(): Promise<GitHubAccount | { error: string }>;
  disconnect(): Promise<GitHubAccount | { error: string }>;
  tokenPage(): Promise<{ ok: boolean } | { error: string }>;
  repositories(page?: number): Promise<{ repositories: GitHubRepository[]; nextPage: number | null } | { error: string }>;
  createRepository(name: string, isPrivate: boolean): Promise<GitHubRepository | { error: string } | null>;
  pullRequests(sessionId: string, remote: string): Promise<GitHubPullRequest[] | { error: string }>;
  createPullRequest(sessionId: string, remote: string, base: string, title: string, body: string, draft: boolean): Promise<GitHubPullRequest | { error: string } | null>;
  open(url: string): Promise<{ ok: boolean } | { error: string }>;
}
export function branchName(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) || value.includes('..') || value.includes('//') ||
      value.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock')) || value === 'HEAD') throw new Error('Nom de branche invalide.');
  return value;
}
export function remoteName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) throw new Error('Nom de remote invalide.'); return value;
}
export function remoteUrl(value: unknown, approvedLocal: readonly string[] = []): string {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\x00-\x1f\x7f]/.test(value) && !approvedLocal.includes(value)) throw new Error('URL de remote invalide.');
  if (approvedLocal.includes(value)) return value;
  if (/^git@[A-Za-z0-9.-]+:[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..')) return value;
  let url: URL; try { url = new URL(value); } catch { throw new Error('Utilisez une URL HTTPS ou SSH git@hôte:organisation/dépôt.git.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname || url.pathname === '/') throw new Error('Remote HTTPS sans secret ni paramètres requis.');
  return url.href;
}
export function githubRepository(url: string): string {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url) ??
    /^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(url);
  if (!match || match[1]!.split('/').some(part => part === '.' || part === '..')) throw new Error('Sélectionnez un remote github.com.'); return match[1]!;
}
