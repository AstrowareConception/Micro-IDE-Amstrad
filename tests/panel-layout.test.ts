import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPanelLayouts, parsePanelLayouts, fitPanel } from '../apps/desktop/src/panel-layout.ts';

test('panel storage discards corrupt geometry, unknown fields and invalid modes', () => {
  assert.deepEqual(parsePanelLayouts(null), defaultPanelLayouts());
  const parsed = parsePanelLayouts({ output: { floating: 'true', maximized: true, visible: false, rect: { x: -10, y: NaN, width: Infinity, height: 2 }, source: 'private' }, tools: [] });
  assert.deepEqual(parsed.output, { ...defaultPanelLayouts().output, visible: false });
  assert.equal(Object.hasOwn(parsed.output, 'source'), false);
  const valid = { ...defaultPanelLayouts(), output: { visible: true, floating: true, maximized: true, rect: { x: 45, y: 60, width: 1000, height: 700 } } };
  assert.deepEqual(parsePanelLayouts(valid), valid);
});
test('floating panels remain entirely reachable on a smaller window', () => {
  const rect = fitPanel({ x: 2000, y: 1800, width: 900, height: 600 }, { width: 640, height: 480 });
  assert.deepEqual(rect, { x: 8, y: 8, width: 624, height: 464 });
  assert.deepEqual(fitPanel({ x: -50, y: -30, width: 20, height: 10 }, { width: 1000, height: 800 }), { x: 8, y: 8, width: 260, height: 160 });
  for (const viewport of [{ width: 320, height: 240 }, { width: 1024, height: 768 }, { width: 3840, height: 2160 }]) {
    const panel = fitPanel({ x: 8000, y: 8000, width: 10000, height: 10000 }, viewport);
    assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= viewport.width && panel.y + panel.height <= viewport.height);
  }
});
