import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, parsePreferences, loadPreferences, persistPreferences, PREFERENCES_KEY, LEGACY_PREFERENCES_KEY } from '../apps/desktop/src/preferences.ts';
import { DEFAULT_KEYMAP, keymapErrors, parseKeymap, keymapPreset, shortcutFromEvent } from '../apps/desktop/src/keymap.ts';
import { importProfile, exportProfile, loadProfiles, saveProfiles, profilesRevision, PROFILES_KEY, PROFILE_BYTES } from '../apps/desktop/src/personalization-profiles.ts';
function storage(t: TestContext) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  t.after(() => { if (before) Object.defineProperty(globalThis, 'localStorage', before); else Reflect.deleteProperty(globalThis, 'localStorage'); }); return values;
}
test('personalization bounds visual options and does not share mutable default keymaps', () => {
  const p = parsePreferences({ density: 'compact', accent: 'violet', lineNumbers: 'relative', lineHeight: 30, ruler: 80, cursorStyle: 'block', cursorBlinking: 'solid', fontLigatures: true });
  assert.equal(p.accent, 'violet'); assert.equal(p.lineHeight, 30); assert.equal(p.lineNumbers, 'relative'); assert.equal(p.fontLigatures, true);
  assert.equal(parsePreferences({ fontSize: 32, lineHeight: 12 }).lineHeight, 32);
  const invalid = parsePreferences({ accent: 'url(secret)', lineHeight: -1, ruler: 999, density: 'tiny', cursorStyle: 'bad', keymap: { run: 'Mod+Z' } });
  assert.deepEqual(invalid, DEFAULT_PREFERENCES); invalid.keymap.run = ''; assert.equal(DEFAULT_KEYMAP.run, 'F5');
});
test('legacy settings migrate without losing values or overwriting the old record', t => {
  const values = storage(t), old = JSON.stringify({ fontSize: 23, theme: 'light', autoSave: false, sidebarWidth: 290 }); values.set(LEGACY_PREFERENCES_KEY, old);
  const p = loadPreferences(); assert.equal(p.fontSize, 23); assert.equal(p.theme, 'light'); assert.equal(p.sidebarWidth, 290);
  assert.equal(persistPreferences(p), true); assert.equal(values.get(LEGACY_PREFERENCES_KEY), old); assert.deepEqual(loadPreferences(), p); assert.equal(JSON.parse(values.get(PREFERENCES_KEY)!).version, 2);
});
test('unknown or corrupt stored versions stay intact and storage failure stays session-only', t => {
  const values = storage(t);
  for (const raw of ['{broken', JSON.stringify({ version: 99, preferences: { fontSize: 20 } })]) { values.set(PREFERENCES_KEY, raw); assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES); assert.equal(persistPreferences(parsePreferences(null)), false); assert.equal(values.get(PREFERENCES_KEY), raw); }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw new Error('Unavailable'); } } }); assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES); assert.equal(persistPreferences(parsePreferences(null)), false);
});
test('keymaps enforce exact modifiers, unique bindings and reserved editor gestures', () => {
  assert.deepEqual(keymapErrors({ ...DEFAULT_KEYMAP }), []); assert.deepEqual(keymapErrors(keymapPreset('jetbrains')), []);
  assert.ok(keymapErrors({ ...DEFAULT_KEYMAP, run: 'Mod+S' }).some(error => error.includes('deux fois')));
  for (const run of ['Mod+Z', 'Alt+F4', 'F8', 'F12', 'A', 'Mod+Mod+A', 'Alt+Ctrl+S', 'Mod+Shift+K']) assert.ok(keymapErrors({ ...DEFAULT_KEYMAP, run }).length, run);
  assert.deepEqual(parseKeymap({ run: 'Mod+Z' }), DEFAULT_KEYMAP); assert.equal(parseKeymap({ run: '' }).run, ''); assert.equal(Object.hasOwn(parseKeymap({ secret: 'x' }), 'secret'), false);
});
test('shortcut matching handles Ctrl/Cmd, casing, physical function keys and composition', () => {
  const e = { key: 'a', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, isComposing: false };
  assert.equal(shortcutFromEvent(e), 'Mod+Shift+A'); assert.equal(shortcutFromEvent({ ...e, ctrlKey: false, metaKey: true }), 'Mod+Shift+A');
  assert.equal(shortcutFromEvent({ ...e, isComposing: true }), undefined); assert.equal(shortcutFromEvent({ ...e, key: 'Dead' }), undefined);
  assert.equal(shortcutFromEvent({ ...e, ctrlKey: false, shiftKey: false, key: 'F5' }), 'F5'); assert.equal(shortcutFromEvent({ ...e, ctrlKey: false }), undefined);
});
test('profile roundtrip contains only preferences and rejects secrets, unknown versions, conflicts and large payloads', () => {
  const prefs = parsePreferences({ ...DEFAULT_PREFERENCES, accent: 'amber', keymap: keymapPreset('jetbrains') });
  const text = exportProfile(' Mon atelier ', { ...prefs, apiKey: 'PRIVATE', source: 'PRIVATE' } as typeof prefs);
  assert.ok(!text.includes('PRIVATE')); assert.deepEqual(importProfile(text), { name: 'Mon atelier', preferences: prefs });
  const value = JSON.parse(text);
  for (const bad of [{ ...value, version: 2 }, { ...value, apiKey: 'x' }, { ...value, name: '' }, { ...value, preferences: { ...value.preferences, secret: 'x' } }, { ...value, preferences: { ...value.preferences, keymap: { run: 'Mod+S' } } }]) assert.throws(() => importProfile(JSON.stringify(bad)));
  assert.throws(() => importProfile('é'.repeat(PROFILE_BYTES)), /64 Kio/);
});
test('named profiles persist independently, remain bounded and preserve unknown storage', t => {
  const values = storage(t), p = { name: 'Atelier', preferences: parsePreferences(null) };
  assert.equal(saveProfiles([p]), true); assert.deepEqual(loadProfiles(), [p]); const old = values.get(PROFILES_KEY)!;
  assert.equal(saveProfiles([p, { ...p, name: 'atelier' }]), false); assert.equal(values.get(PROFILES_KEY), old);
  assert.equal(saveProfiles(Array.from({ length: 13 }, (_, index) => ({ ...p, name: String(index) }))), false);
  const future = JSON.stringify({ version: 99, profiles: [] }); values.set(PROFILES_KEY, future); assert.deepEqual(loadProfiles(), []); assert.equal(saveProfiles([]), false); assert.equal(values.get(PROFILES_KEY), future);
});
test('stale profile changes cannot discard profiles saved from another window', t => {
  const values = storage(t), p = { name: 'Premier', preferences: parsePreferences(null) }, initial = profilesRevision();
  assert.equal(saveProfiles([p], initial), true); const current = values.get(PROFILES_KEY)!;
  assert.equal(saveProfiles([{ ...p, name: 'Autre' }], initial), false); assert.equal(values.get(PROFILES_KEY), current);
});
