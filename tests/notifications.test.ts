import test from 'node:test';
import assert from 'node:assert/strict';
import { appendNotification, canRevealNotification, filterNotifications, notificationMessage, NOTIFICATION_LIMIT, type NotificationInput } from '../apps/desktop/src/notifications.ts';
import { parsePreferences, DEFAULT_PREFERENCES } from '../apps/desktop/src/preferences.ts';
import { exportProfile, importProfile } from '../apps/desktop/src/personalization-profiles.ts';
const input: NotificationInput = { source: 'git', target: 'git', level: 'error', sessionId: 'project-a', message: 'Transfert interrompu.' };
test('notifications coalesce a repeated outcome without mutating existing read state', () => {
  const first = appendNotification([], input, 'first', 10).map(item => ({ ...item, read: true }));
  const next = appendNotification(first, input, 'unused', 100);
  assert.equal(next.length, 1); assert.equal(next[0]!.id, 'first'); assert.equal(next[0]!.count, 2); assert.equal(next[0]!.read, false); assert.equal(next[0]!.createdAt, 10); assert.equal(next[0]!.updatedAt, 100);
  assert.equal(first[0]!.count, 1); assert.equal(first[0]!.read, true);
  assert.equal(appendNotification(next, input, 'later', 5100).length, 2);
});
test('independent contexts and outcomes remain separate, in a bounded newest-first ledger', () => {
  let items = appendNotification([], input, 'first', 0);
  for (const change of [{ sessionId: 'project-b' }, { level: 'warning' as const }, { target: 'terminal' as const }, { source: 'terminal' as const }]) items = appendNotification(items, { ...input, ...change }, String(items.length), 1);
  assert.equal(items.length, 5);
  for (let i = 0; i < 150; i++) items = appendNotification(items, { ...input, message: `Opération ${i}` }, `event-${i}`, i * 100);
  assert.equal(items.length, NOTIFICATION_LIMIT); assert.equal(items[0]!.id, 'event-149'); assert.equal(items.at(-1)!.id, 'event-50');
  assert.deepEqual(appendNotification(items, { ...input, message: ' \0 ' }, 'empty', 99999), items);
});
test('notification summaries scrub recognizable credentials and URLs before truncation', () => {
  const raw = 'sk-test_private ghp_private github_pat_private Bearer private-token token=private-value password="private password" https://user:private@example.test/path?token=private';
  const safe = notificationMessage(raw); assert.equal(safe.includes('private'), false); assert.equal(safe.includes('example.test'), false);
  assert.equal(notificationMessage('x'.repeat(1400)).length, 1200);
  const next = appendNotification([], { ...input, message: '<script>alert(1)</script>\0' }, 'plain', 0); assert.equal(next[0]!.message, '<script>alert(1)</script>');
  assert.equal(Object.hasOwn(next[0]!, 'html'), false);
});
test('notification filters combine severity, origin, unread and case-insensitive search', () => {
  const items = [...appendNotification([], input, 'git', 1), ...appendNotification([], { source: 'agent', level: 'success', message: 'Mission terminée.' }, 'agent', 2).map(item => ({ ...item, read: true }))];
  const all = { query: '', level: 'all' as const, source: 'all' as const, unread: false };
  assert.equal(filterNotifications(items, { ...all, query: '  MISSION ' })[0]!.id, 'agent');
  assert.equal(filterNotifications(items, { ...all, query: 'erreur', unread: true, source: 'git' }).length, 1);
  assert.equal(filterNotifications(items, { ...all, level: 'success', unread: true }).length, 0);
  assert.equal(filterNotifications(items, { ...all, query: 'inconnu' }).length, 0);
});
test('a detail action cannot navigate into another project session', () => {
  const item = appendNotification([], input, 'id', 1)[0]!;
  assert.equal(canRevealNotification(item, 'project-a'), true); assert.equal(canRevealNotification(item, 'project-b'), false); assert.equal(canRevealNotification(item, undefined), false);
  assert.equal(canRevealNotification({ ...item, sessionId: undefined }, 'project-b'), true);
  assert.equal(canRevealNotification(appendNotification([], { source: 'settings', level: 'info', message: 'Appliqué.' }, 'id', 0)[0]!, undefined), false);
});
test('popup preferences accept only known modes and travel with portable profiles', () => {
  assert.equal(parsePreferences({}).notificationPopups, 'all'); assert.equal(parsePreferences({ notificationPopups: 'unknown' }).notificationPopups, 'all');
  for (const mode of ['all', 'errors', 'off'] as const) {
    const preferences = parsePreferences({ ...DEFAULT_PREFERENCES, notificationPopups: mode });
    assert.equal(importProfile(exportProfile('Atelier', preferences)).preferences.notificationPopups, mode);
  }
});
