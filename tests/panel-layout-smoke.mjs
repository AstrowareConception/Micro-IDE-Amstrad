import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

async function drag(page, locator, dx, dy) {
  const box = await locator.boundingBox(); assert.ok(box);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
}
export async function verifyPanelLayout(page) {
  const output = page.locator('.output-dock'), tools = page.locator('.tool-sidebar'), agent = page.locator('.ai-sidebar');
  const text = await page.locator('.view-lines').textContent();
  await page.evaluate(() => { window.layoutEditor = document.querySelector('.monaco-editor'); window.layoutAgent = document.querySelector('.agent-panel'); });
  const original = await output.boundingBox();
  await drag(page, page.getByRole('separator', { name: 'Hauteur des sorties', exact: true }), 0, -150);
  await expect.poll(async () => (await output.boundingBox()).height).toBeGreaterThan(original.height + 120);
  assert.ok((await page.locator('.editor-host').boundingBox()).height >= 140);
  const heightHandle = page.getByRole('separator', { name: 'Hauteur des sorties', exact: true });
  const beforeCancel = (await output.boundingBox()).height, edge = await heightHandle.boundingBox();
  await page.mouse.move(edge.x + 30, edge.y + 3); await page.mouse.down(); await page.mouse.move(edge.x + 30, edge.y - 60, { steps: 4 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect.poll(async () => (await output.boundingBox()).height).toBe(beforeCancel);
  const width = (await tools.boundingBox()).width;
  await drag(page, page.getByRole('separator', { name: 'Largeur des outils', exact: true }), 55, 0);
  await expect.poll(async () => (await tools.boundingBox()).width).toBeGreaterThan(width + 40);
  const agentWidth = (await agent.boundingBox()).width;
  await page.getByRole('separator', { name: 'Largeur de l’assistant', exact: true }).focus(); await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await agent.boundingBox()).width).toBeGreaterThan(agentWidth + 5);
  for (const [panel, name] of [[tools, 'les outils'], [agent, 'l’agent IA'], [output, 'les sorties']]) {
    await panel.getByRole('button', { name: `Détacher ${name}`, exact: true }).click();
    await expect(panel).toHaveAttribute('data-floating', 'true');
    const initial = await panel.boundingBox();
    await drag(page, panel.getByRole('button', { name: `Déplacer ${name}`, exact: true }), 35, 20);
    const moved = await panel.boundingBox(); assert.ok(moved.x > initial.x + 20 && moved.y > initial.y + 10);
    await drag(page, panel.getByRole('button', { name: `Redimensionner ${name}`, exact: true }), 70, 35);
    await expect.poll(async () => (await panel.boundingBox()).width).toBeGreaterThan(moved.width + 50);
    await panel.getByRole('button', { name: `Redimensionner ${name}`, exact: true }).focus(); await page.keyboard.press('ArrowDown');
    await panel.getByRole('button', { name: `Agrandir ${name}`, exact: true }).click();
    await expect.poll(async () => (await panel.boundingBox()).width).toBe(1424);
    await panel.getByRole('button', { name: `Restaurer ${name}`, exact: true }).click();
    await panel.getByRole('button', { name: `Réancrer ${name}`, exact: true }).click();
    await expect(panel).toHaveAttribute('data-floating', 'false');
  }
  assert.equal(await page.locator('.view-lines').textContent(), text);
  assert.ok(await page.evaluate(() => window.layoutEditor === document.querySelector('.monaco-editor') && window.layoutAgent === document.querySelector('.agent-panel')));
  await output.getByRole('button', { name: 'Détacher les sorties', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cpceleste.panels.v1')).output.floating)).toBe(true);
  const rect = await output.boundingBox();
  await page.reload(); await page.locator('.monaco-editor .view-line').first().waitFor();
  await expect(output).toHaveAttribute('data-floating', 'true');
  assert.deepEqual(await output.boundingBox(), rect);
  await page.setViewportSize({ width: 640, height: 480 });
  await expect.poll(async () => { const small = await output.boundingBox(); return small.x + small.width <= 640 && small.y + small.height <= 480; }).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true }).getByRole('button', { name: 'Affichage', exact: true }).click();
  await page.getByRole('menuitem', { name: /Restaurer la disposition des panneaux/ }).click();
  await expect(output).toHaveAttribute('data-floating', 'false');
  await expect.poll(async () => Math.round((await output.boundingBox()).height)).toBe(230);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cpceleste.preferences.v2')).preferences.outputHeight)).toBe(230);
  await page.screenshot({ path: 'out/dock-layout-alpha.png' });
}
