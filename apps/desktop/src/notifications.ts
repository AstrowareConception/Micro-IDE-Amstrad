export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';
export type NotificationSource = 'workspace' | 'settings' | 'git' | 'terminal' | 'agent' | 'emulator';
export type NotificationTarget = 'project' | 'settings' | 'git' | 'terminal' | 'agent' | 'emulator' | 'problems' | 'recovery';
export interface NotificationInput {
  message: string; level: NotificationLevel; source: NotificationSource;
  target?: NotificationTarget; sessionId?: string | undefined;
}
export interface WorkbenchNotification extends NotificationInput {
  id: string; createdAt: number; updatedAt: number; count: number; read: boolean;
}
export type Notify = (input: NotificationInput) => void;
export const NOTIFICATION_LIMIT = 100;
export const LEVEL_LABELS: Record<NotificationLevel, string> = { info: 'Information', success: 'Réussite', warning: 'Avertissement', error: 'Erreur' };
export const SOURCE_LABELS: Record<NotificationSource, string> = { workspace: 'Projet et sources', settings: 'Paramètres', git: 'Git', terminal: 'Terminal', agent: 'Agent IA', emulator: 'CPC' };
// A small, local summary only. Raw provider replies, terminal output and Git
// diffs never enter this ledger. Scrubbing is additional defence for messages.
export function notificationMessage(message: string): string {
  return message.replace(/https?:\/\/\S+/gi, '[URL masquée]')
    .replace(/\b(?:sk-[\w-]+|gh[pousr]_[\w]+|github_pat_[\w]+)\b/g, '[clé masquée]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [valeur masquée]')
    .replace(/\b((?:api[_ -]?key|token|authorization|password|secret|mot de passe)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[valeur masquée]')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim().slice(0, 1200);
}
export function appendNotification(items: readonly WorkbenchNotification[], input: NotificationInput, id: string, now: number): WorkbenchNotification[] {
  const message = notificationMessage(input.message);
  if (!message) return [...items];
  const previous = items[0];
  const same = previous && previous.message === message && previous.source === input.source && previous.level === input.level && previous.sessionId === input.sessionId && previous.target === input.target;
  if (same && now >= previous.updatedAt && now - previous.updatedAt < 5000) {
    return [{ ...previous, updatedAt: now, count: previous.count + 1, read: false }, ...items.slice(1)];
  }
  return [{ ...input, message, id, createdAt: now, updatedAt: now, count: 1, read: false }, ...items].slice(0, NOTIFICATION_LIMIT);
}
export interface NotificationFilter { query: string; level: NotificationLevel | 'all'; source: NotificationSource | 'all'; unread: boolean }
export function filterNotifications(items: readonly WorkbenchNotification[], filter: NotificationFilter): WorkbenchNotification[] {
  const query = filter.query.trim().toLocaleLowerCase('fr');
  return items.filter(item => (filter.level === 'all' || item.level === filter.level) && (filter.source === 'all' || item.source === filter.source) && (!filter.unread || !item.read) && `${item.message} ${SOURCE_LABELS[item.source]} ${LEVEL_LABELS[item.level]}`.toLocaleLowerCase('fr').includes(query));
}
export function canRevealNotification(item: WorkbenchNotification, sessionId: string | undefined): boolean {
  return !!item.target && (item.sessionId === undefined || item.sessionId === sessionId);
}
