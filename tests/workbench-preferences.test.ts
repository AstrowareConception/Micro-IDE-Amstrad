import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, parsePreferences } from '../apps/desktop/src/preferences.ts';
import { feedbackReport, FEEDBACK_REPOSITORY } from '../apps/desktop/feedback.ts';

test('preferences recover invalid storage and bound editing/layout values', () => {
  assert.deepEqual(parsePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences([]), DEFAULT_PREFERENCES);
  const result = parsePreferences({ fontSize: 200, autoSave: 'true', tabSize: 0, theme: 'invalid', agentWidth: Infinity, renumberStep: 0, fontFamily: '\0broken' });
  assert.deepEqual(result, DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences({ ...DEFAULT_PREFERENCES, theme: 'light', fontFamily: '  Courier New  ', fontSize: 20, autoSave: true }), { ...DEFAULT_PREFERENCES, theme: 'light', fontFamily: 'Courier New', fontSize: 20, autoSave: true });
});
test('unknown settings cannot enter persisted preferences or mutate defaults', () => {
  const result = parsePreferences({ apiKey: 'do-not-store', theme: 'system', outputHeight: 360 });
  assert.equal(Object.hasOwn(result, 'apiKey'), false);
  result.fontSize = 12;
  assert.equal(DEFAULT_PREFERENCES.fontSize, 16);
});
const input = { kind: 'feature' as const, title: 'Onglets & vues', usage: 'Deux projets CPC.', need: 'Comparer les sources. https://example.invalid/?a=1&b=2', expected: 'Deux panneaux.' };
test('feedback prepares an inert encoded GitHub draft on the fixed repository', () => {
  const result = feedbackReport(input), url = new URL(result.url);
  assert.equal(url.origin + url.pathname, FEEDBACK_REPOSITORY + '/issues/new');
  assert.equal(url.searchParams.get('template'), 'feature_request.md');
  assert.equal(url.searchParams.get('title'), '[Amélioration] Onglets & vues');
  assert.equal(url.searchParams.get('body'), result.body);
  assert.match(result.body, /Deux projets CPC/);
  assert.equal(result.prefilled, true);
  assert.equal(new URL(feedbackReport({ ...input, kind: 'bug' }).url).searchParams.get('template'), 'bug_report.md');
});
test('feedback rejects invalid/empty/oversized input and preserves long Unicode reports for copy', () => {
  for (const value of [null, [], {}, { ...input, kind: 'other' }, { ...input, title: ' ' }, { ...input, need: '' }, { ...input, usage: 'x'.repeat(1001) }, { ...input, need: '\0' }]) assert.throws(() => feedbackReport(value));
  const result = feedbackReport({ ...input, usage: 'é'.repeat(1000), need: 'é'.repeat(1500), expected: 'é'.repeat(1500) });
  assert.equal(result.prefilled, false);
  assert.equal(new URL(result.url).searchParams.has('body'), false);
  assert.ok(result.body.includes('é'.repeat(1500)));
});
