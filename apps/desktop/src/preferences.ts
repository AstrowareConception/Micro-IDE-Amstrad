export interface Preferences {
  theme: 'dark' | 'light' | 'system'; fontFamily: string; fontSize: number;
  tabSize: number; insertSpaces: boolean; wordWrap: boolean; minimap: boolean;
  autoIndent: boolean; autoClosingBrackets: boolean;
  autoSave: boolean; autoSaveDelay: number; renumberStart: number; renumberStep: number;
  sidebarWidth: number; agentWidth: number; outputHeight: number;
}
export const PREFERENCES_KEY = 'cpceleste.preferences.v1';
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  theme: 'dark', fontFamily: 'Consolas, "Liberation Mono", monospace', fontSize: 16,
  tabSize: 2, insertSpaces: true, wordWrap: true, minimap: false, autoIndent: true,
  autoClosingBrackets: true, autoSave: false, autoSaveDelay: 2000,
  renumberStart: 10, renumberStep: 10, sidebarWidth: 260, agentWidth: 310, outputHeight: 230,
});
export function parsePreferences(value: unknown): Preferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  if (['dark', 'light', 'system'].includes(String(input.theme))) result.theme = input.theme as Preferences['theme'];
  if (typeof input.fontFamily === 'string' && input.fontFamily.trim() && input.fontFamily.length <= 200 && !/[\x00-\x1f\x7f]/.test(input.fontFamily)) result.fontFamily = input.fontFamily.trim();
  for (const key of ['insertSpaces', 'wordWrap', 'minimap', 'autoIndent', 'autoClosingBrackets', 'autoSave'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  for (const [key, min, max] of [
    ['fontSize', 10, 32], ['tabSize', 1, 8], ['autoSaveDelay', 1000, 60000],
    ['renumberStart', 1, 65535], ['renumberStep', 1, 65535],
    ['sidebarWidth', 180, 360], ['agentWidth', 240, 420], ['outputHeight', 120, 360],
  ] as const) {
    const number = input[key];
    if (typeof number === 'number' && Number.isInteger(number) && number >= min && number <= max) result[key] = number;
  }
  return result;
}
export function loadPreferences(): Preferences {
  try { return parsePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_PREFERENCES }; }
}
export function persistPreferences(value: Preferences): boolean {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(parsePreferences(value))); return true; }
  catch { return false; }
}
