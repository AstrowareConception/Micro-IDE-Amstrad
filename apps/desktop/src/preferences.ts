import { DEFAULT_KEYMAP, parseKeymap, type Keymap } from './keymap.ts';
export interface Preferences {
  theme: 'dark' | 'light' | 'system'; fontFamily: string; fontSize: number;
  tabSize: number; insertSpaces: boolean; wordWrap: boolean; minimap: boolean;
  autoIndent: boolean; autoClosingBrackets: boolean;
  autoSave: boolean; autoSaveDelay: number; renumberStart: number; renumberStep: number;
  sidebarWidth: number; agentWidth: number; outputHeight: number;
  accent: 'cyan' | 'amber' | 'violet' | 'green' | 'rose'; density: 'comfortable' | 'compact';
  lineHeight: number; lineNumbers: 'on' | 'relative' | 'off'; whitespace: 'none' | 'selection' | 'all';
  cursorStyle: 'line' | 'block' | 'underline'; cursorBlinking: 'blink' | 'solid';
  fontLigatures: boolean; indentGuides: boolean; bracketColors: boolean; ruler: number;
  notificationPopups: 'all' | 'errors' | 'off';
  keymap: Keymap;
}
export const PREFERENCES_KEY = 'cpceleste.preferences.v2';
export const LEGACY_PREFERENCES_KEY = 'cpceleste.preferences.v1';
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  theme: 'dark', fontFamily: 'Consolas, "Liberation Mono", monospace', fontSize: 16,
  tabSize: 2, insertSpaces: true, wordWrap: true, minimap: false, autoIndent: true,
  autoClosingBrackets: true, autoSave: false, autoSaveDelay: 2000,
  renumberStart: 10, renumberStep: 10, sidebarWidth: 260, agentWidth: 310, outputHeight: 230,
  accent: 'cyan', density: 'comfortable', lineHeight: 0, lineNumbers: 'on', whitespace: 'selection',
  cursorStyle: 'line', cursorBlinking: 'blink', fontLigatures: false, indentGuides: true, bracketColors: false, ruler: 0,
  notificationPopups: 'all', keymap: DEFAULT_KEYMAP,
});
export function parsePreferences(value: unknown): Preferences {
  const result: Preferences = { ...DEFAULT_PREFERENCES, keymap: { ...DEFAULT_KEYMAP } };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  if (['dark', 'light', 'system'].includes(String(input.theme))) result.theme = input.theme as Preferences['theme'];
  if (typeof input.fontFamily === 'string' && input.fontFamily.trim() && input.fontFamily.length <= 200 && !/[\x00-\x1f\x7f]/.test(input.fontFamily)) result.fontFamily = input.fontFamily.trim();
  for (const key of ['insertSpaces', 'wordWrap', 'minimap', 'autoIndent', 'autoClosingBrackets', 'autoSave', 'fontLigatures', 'indentGuides', 'bracketColors'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  for (const [key, min, max] of [
    ['fontSize', 10, 32], ['tabSize', 1, 8], ['autoSaveDelay', 1000, 60000],
    ['renumberStart', 1, 65535], ['renumberStep', 1, 65535],
    ['sidebarWidth', 180, 800], ['agentWidth', 240, 800], ['outputHeight', 120, 1200],
    ['lineHeight', 0, 60], ['ruler', 0, 240],
  ] as const) {
    const number = input[key];
    if (typeof number === 'number' && Number.isInteger(number) && number >= min && number <= max) result[key] = number;
  }
  for (const [key, choices] of [['notificationPopups', ['all', 'errors', 'off']], ['accent', ['cyan', 'amber', 'violet', 'green', 'rose']], ['density', ['comfortable', 'compact']], ['lineNumbers', ['on', 'relative', 'off']], ['whitespace', ['none', 'selection', 'all']], ['cursorStyle', ['line', 'block', 'underline']], ['cursorBlinking', ['blink', 'solid']]] as const) {
    if ((choices as readonly unknown[]).includes(input[key])) Object.assign(result, { [key]: input[key] });
  }
  result.keymap = parseKeymap(input.keymap);
  if (result.lineHeight > 0) result.lineHeight = Math.max(result.fontSize, result.lineHeight);
  return result;
}
export function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored === null) return parsePreferences(JSON.parse(localStorage.getItem(LEGACY_PREFERENCES_KEY) ?? 'null'));
    const value = JSON.parse(stored);
    return parsePreferences(value?.version === 2 ? value.preferences : null);
  } catch { return parsePreferences(null); }
}
export function persistPreferences(value: Preferences): boolean {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored !== null && JSON.parse(stored)?.version !== 2) return false;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 2, preferences: parsePreferences(value) })); return true;
  }
  catch { return false; }
}
