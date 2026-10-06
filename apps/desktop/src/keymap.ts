export const DEFAULT_KEYMAP = Object.freeze({
  open: 'Mod+O', project: 'Mod+Shift+O', 'recent-projects': 'Mod+R', save: 'Mod+S', 'save-all': 'Mod+Shift+S', 'save-as': 'Mod+Alt+S',
  run: 'F5', reference: 'F1', palette: 'Mod+Shift+P', 'quick-sources': 'Mod+P', settings: 'Mod+,',
  'search-sources': 'Mod+Shift+F', explorer: 'Mod+Shift+E', git: 'Mod+Shift+G', documents: 'Mod+Shift+D', agent: 'Mod+Shift+A',
  renumber: 'Mod+Shift+R', firmware: 'Mod+Alt+R', terminal: 'Mod+`', sidebar: 'Mod+B', output: 'Mod+J',
  'close-tab': 'Mod+W', 'next-tab': 'Mod+Tab', 'previous-tab': 'Mod+Shift+Tab',
  'git-push': 'Mod+Alt+K', 'git-fetch': 'Mod+Alt+G', 'git-branches': 'Mod+Alt+B', 'focus-mode': 'Mod+Shift+F11', notifications: 'Mod+Alt+N',
});
export type Keymap = Record<keyof typeof DEFAULT_KEYMAP, string>;
export type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'>;
const reserved = new Set(['Alt+F4', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Y', 'Mod+X', 'Mod+C', 'Mod+V', 'Mod+A', 'Mod+F', 'Mod+H', 'Mod+G', 'Mod+D', 'Mod+Space', 'Mod+/', 'Mod+Shift+K', 'F8', 'Shift+F8', 'F12', 'Mod+L', 'Mod+T', 'Mod+N', 'Mod+Q']);
export function shortcutFromEvent(event: ShortcutEvent): string | undefined {
  if (event.isComposing || event.ctrlKey && event.metaKey) return undefined;
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!/^(?:[A-Z0-9,`/]|Tab|Space|F(?:[1-9]|1[0-2]))$/.test(key)) return undefined;
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier && !/^F\d+$/.test(key)) return undefined;
  return [modifier ? 'Mod' : '', event.shiftKey ? 'Shift' : '', event.altKey ? 'Alt' : '', key].filter(Boolean).join('+');
}
export function keymapErrors(value: Keymap): string[] {
  const used = new Map<string, string>(), errors: string[] = [];
  for (const id of Object.keys(DEFAULT_KEYMAP) as (keyof Keymap)[]) {
    const shortcut = value[id]; if (shortcut === '') continue;
    if (typeof shortcut !== 'string' || !/^(?:Mod\+)?(?:Shift\+)?(?:Alt\+)?(?:[A-Z0-9,`/]|Tab|Space|F(?:[1-9]|1[0-2]))$/.test(shortcut) || !shortcut.startsWith('Mod+') && !/(?:^|\+)F\d+$/.test(shortcut)) { errors.push(`${id} : combinaison invalide.`); continue; }
    if (reserved.has(shortcut)) errors.push(`${id} : ${shortcutLabel(shortcut)} est réservé à l’éditeur ou au système.`);
    const previous = used.get(shortcut); if (previous) errors.push(`${previous} / ${id} : ${shortcutLabel(shortcut)} est attribué deux fois.`);
    used.set(shortcut, id);
  }
  return errors;
}
export function parseKeymap(value: unknown): Keymap {
  const result: Keymap = { ...DEFAULT_KEYMAP };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const id of Object.keys(result) as (keyof Keymap)[]) if (typeof (value as Keymap)[id] === 'string') result[id] = (value as Keymap)[id];
  return keymapErrors(result).length ? { ...DEFAULT_KEYMAP } : result;
}
export function keymapPreset(name: string): Keymap {
  const result: Keymap = { ...DEFAULT_KEYMAP };
  if (name === 'jetbrains') { result.palette = 'Mod+Shift+A'; result.agent = ''; result['quick-sources'] = 'Mod+Shift+N'; result.settings = 'Mod+Alt+S'; result['save-as'] = ''; result['focus-mode'] = 'Mod+Shift+F12'; }
  return result;
}
export function shortcutLabel(value: string): string { return value.replace(/Mod/g, 'Ctrl/Cmd').replace(/Shift/g, 'Maj').replace(/Alt/g, 'Alt').replace(/\+/g, ' + '); }
