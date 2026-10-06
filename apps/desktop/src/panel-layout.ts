export interface PanelRect { x: number; y: number; width: number; height: number }
export interface PanelLayout { visible: boolean; floating: boolean; maximized: boolean; rect: PanelRect }
export type PanelId = 'tools' | 'agent' | 'output';
export type PanelLayouts = Record<PanelId, PanelLayout>;
export const PANEL_LAYOUT_KEY = 'cpceleste.panels.v1';
export function defaultPanelLayouts(): PanelLayouts {
  return {
    tools: { visible: true, floating: false, maximized: false, rect: { x: 60, y: 170, width: 320, height: 520 } },
    agent: { visible: true, floating: false, maximized: false, rect: { x: 420, y: 170, width: 380, height: 520 } },
    output: { visible: true, floating: false, maximized: false, rect: { x: 120, y: 190, width: 900, height: 540 } },
  };
}
export function parsePanelLayouts(value: unknown): PanelLayouts {
  const result = defaultPanelLayouts();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const id of ['tools', 'agent', 'output'] as const) {
    const panel = (value as Record<string, unknown>)[id];
    if (!panel || typeof panel !== 'object' || Array.isArray(panel)) continue;
    const input = panel as Record<string, unknown>;
    if (typeof input.visible === 'boolean') result[id].visible = input.visible;
    if (typeof input.floating === 'boolean') result[id].floating = input.floating;
    if (typeof input.maximized === 'boolean') result[id].maximized = input.maximized && result[id].floating;
    if (input.rect && typeof input.rect === 'object') {
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        const number = (input.rect as Record<string, unknown>)[key];
        const minimum = key === 'width' ? 260 : key === 'height' ? 160 : 0;
        if (typeof number === 'number' && Number.isFinite(number) && number >= minimum && number <= 10000) result[id].rect[key] = Math.round(number);
      }
    }
  }
  return result;
}
/** Keep the whole floating panel reachable after a window or monitor resize. */
export function fitPanel(rect: PanelRect, viewport: { width: number; height: number }): PanelRect {
  const availableWidth = Math.max(1, viewport.width - 16), availableHeight = Math.max(1, viewport.height - 16);
  const width = Math.min(availableWidth, Math.max(260, rect.width)), height = Math.min(availableHeight, Math.max(160, rect.height));
  return { width, height, x: Math.max(8, Math.min(rect.x, viewport.width - width - 8)), y: Math.max(8, Math.min(rect.y, viewport.height - height - 8)) };
}
export function loadPanelLayouts(): PanelLayouts {
  try { return parsePanelLayouts(JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) ?? 'null')); }
  catch { return defaultPanelLayouts(); }
}
export function persistPanelLayouts(value: PanelLayouts): boolean {
  try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(parsePanelLayouts(value))); return true; }
  catch { return false; }
}
