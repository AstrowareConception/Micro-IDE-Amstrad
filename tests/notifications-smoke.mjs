import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
export async function exerciseNotifications(page, native = false) {
  await page.locator('.view-lines').first().waitFor();
  const editor = page.locator('.listing .monaco-editor textarea');
  await editor.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n300 REM NOTIFICATION DRAFT');
  const model = await page.locator('.listing .monaco-editor').elementHandle();
  async function menu(group, action) { await page.getByRole('navigation', { name: 'Menus de l’atelier' }).getByRole('button', { name: group, exact: true }).click(); await page.getByRole('menuitem', { name: action, exact: true }).click(); }
  async function center() { await menu('Affichage', 'Centre de notifications'); return page.getByRole('dialog', { name: 'Centre de notifications', exact: true }); }
  async function mode(value, apply = true) { await menu('Outils', 'Paramètres de CPCéleste'); const dialog = page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); await dialog.getByRole('button', { name: 'Notifications', exact: true }).click(); await dialog.getByLabel('Aperçus des notifications', { exact: true }).selectOption(value); await dialog.getByRole('button', { name: apply ? 'Appliquer les paramètres' : 'Annuler', exact: true }).click(); }
  let dialog = await center(); if (await dialog.getByRole('button', { name: 'Effacer l’historique de session' }).isEnabled()) await dialog.getByRole('button', { name: 'Effacer l’historique de session' }).click(); await expect(dialog).toContainText('Aucune notification dans cette session.'); await page.keyboard.press('Escape');
  await mode('all'); const preview = page.getByRole('complementary', { name: 'Dernière notification', exact: true }); await expect(preview).toContainText('Paramètres appliqués.');
  await preview.getByRole('button', { name: 'Masquer l’aperçu de notification', exact: true }).click(); await expect(preview).toHaveCount(0);
  await page.keyboard.press('Control+Alt+n'); dialog = page.getByRole('dialog', { name: 'Centre de notifications', exact: true }); await expect(dialog).toBeVisible(); await expect(dialog.getByLabel('Rechercher une notification', { exact: true })).toBeFocused();
  await dialog.getByLabel('Origine des notifications', { exact: true }).selectOption('settings'); await dialog.getByLabel('Niveau des notifications', { exact: true }).selectOption('success'); await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await dialog.getByLabel('Rechercher une notification', { exact: true }).fill('no-match-xyz'); await expect(dialog).toContainText('Aucune notification ne correspond aux filtres.'); await dialog.getByLabel('Rechercher une notification', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Tout marquer comme lu', exact: true }).click(); await dialog.getByLabel('Non lues seulement', { exact: true }).check(); await expect(dialog.getByRole('listitem')).toHaveCount(0);
  await dialog.getByLabel('Non lues seulement', { exact: true }).uncheck(); await dialog.getByRole('button', { name: 'Voir les détails', exact: true }).click(); const settings = page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); await expect(settings).toBeVisible(); await page.keyboard.press('Escape');
  await mode('off', false); await mode('errors'); await expect(preview).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Actions du listing', exact: true }).getByRole('button', { name: /^Exécuter/ }).click();
  await expect(preview).toContainText('Exécution CPC interrompue.');
  dialog = await center(); await dialog.getByLabel('Origine des notifications', { exact: true }).selectOption('emulator'); await dialog.getByLabel('Niveau des notifications', { exact: true }).selectOption('error'); await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Voir les détails', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Émulateur CPC 6128', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Arrêter et fermer le CPC', exact: true }).click();
  await mode('off'); await expect(preview).toHaveCount(0);
  dialog = await center(); await expect(dialog.getByRole('listitem')).not.toHaveCount(0); await page.screenshot({ path: native ? 'out/notifications-desktop-alpha.png' : 'out/notifications-alpha.png' });
  if (!native) for (const viewport of [{ width: 729, height: 720 }, { width: 420, height: 650 }]) { await page.setViewportSize(viewport); const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height); }
  if (!native) await page.setViewportSize({ width: 1440, height: 960 });
  await dialog.getByRole('button', { name: 'Retirer ce message', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Effacer l’historique de session', exact: true }).click(); await expect(dialog).toContainText('Aucune notification dans cette session.'); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(element => element === document.querySelector('.listing .monaco-editor'), model), true);
  await editor.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('NOTIFICATION DRAFT'); await page.keyboard.press('Control+y'); await expect(page.locator('.view-lines')).toContainText('NOTIFICATION DRAFT');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cpceleste.preferences.v2')).preferences.notificationPopups)).toBe('off');
}
export async function verifyNotifications(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  try { await page.goto('http://127.0.0.1:5173'); await exerciseNotifications(page);
    const fresh = await context.newPage(); await fresh.goto('http://127.0.0.1:5173'); await fresh.locator('.view-lines').first().waitFor(); await fresh.keyboard.press('Control+Alt+n'); await expect(fresh.getByRole('dialog', { name: 'Centre de notifications', exact: true })).toContainText('Aucune notification dans cette session.');
  } catch (error) { await page.screenshot({ path: 'out/notifications-failure.png' }).catch(() => undefined); throw error; } finally { await context.close(); }
}
