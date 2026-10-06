import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
export async function exercisePersonalization(page, native = false) {
  await page.locator('.view-lines').first().waitFor();
  const editor = page.locator('.listing .monaco-editor textarea'); await editor.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n100 REM PERSONALIZATION DRAFT');
  await page.evaluate(() => { window.personalizationEditor = document.querySelector('.listing .monaco-editor'); });
  async function menu(group, action) { await page.getByRole('navigation', { name: 'Menus de l’atelier' }).getByRole('button', { name: group, exact: true }).click(); await page.getByRole('menuitem', { name: action, exact: true }).click(); }
  async function settings() { await menu('Outils', 'Paramètres de CPCéleste'); return page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); }
  let dialog = await settings(); await dialog.getByLabel('Couleur d’accent', { exact: true }).selectOption('rose'); await dialog.getByRole('button', { name: 'Annuler', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');
  dialog = await settings(); await dialog.getByLabel('Rechercher un réglage', { exact: true }).fill('curseur'); await expect(dialog.getByLabel('Forme du curseur', { exact: true })).toBeVisible(); await expect(dialog.getByLabel('Couleur d’accent', { exact: true })).toBeHidden();
  await dialog.getByLabel('Rechercher un réglage', { exact: true }).fill('no-match-xyz'); await expect(dialog.getByRole('status').filter({ hasText: 'Aucun groupe' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Tous les réglages', exact: true }).click();
  await dialog.getByLabel('Couleur d’accent', { exact: true }).selectOption('violet'); await dialog.getByLabel('Densité de l’interface', { exact: true }).selectOption('compact'); await dialog.getByLabel('Taille du code (px)', { exact: true }).fill('20');
  await dialog.getByLabel('Interligne du code (px, 0 = automatique)', { exact: true }).fill('30'); await dialog.getByLabel('Numéros de lignes physiques', { exact: true }).selectOption('relative'); await dialog.getByLabel('Clignotement du curseur', { exact: true }).selectOption('solid'); await dialog.getByLabel('Règle de colonne (0 = masquée)', { exact: true }).fill('80');
  await dialog.getByLabel('Base de raccourcis', { exact: true }).selectOption('jetbrains');
  const run = dialog.getByLabel('Raccourci : Exécuter dans le CPC 6128', { exact: true }); await run.focus(); await page.keyboard.press('Control+s'); await expect(dialog.getByRole('alert')).toContainText('deux fois'); await expect(dialog.getByRole('button', { name: 'Appliquer les paramètres', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+z'); await expect(dialog.getByRole('alert')).toContainText('réservé'); await page.keyboard.press('F6');
  const save = dialog.getByLabel('Raccourci : Enregistrer le listing actif', { exact: true }); await save.focus(); await page.keyboard.press('Control+Alt+d'); await expect(dialog.getByRole('button', { name: 'Appliquer les paramètres', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Appliquer les paramètres', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet'); await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect.poll(() => page.locator('.view-lines').evaluate(element => getComputedStyle(element).fontSize)).toBe('20px');
  await expect.poll(() => page.locator('.view-line').first().evaluate(element => getComputedStyle(element).lineHeight)).toBe('30px'); await expect(page.locator('.view-ruler')).toHaveCount(1);
  assert.equal(await page.evaluate(() => window.personalizationEditor === document.querySelector('.listing .monaco-editor')), true);
  await editor.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('PERSONALIZATION DRAFT'); await page.keyboard.press('Control+y'); await expect(page.locator('.view-lines')).toContainText('PERSONALIZATION DRAFT');
  await page.keyboard.press('Control+Shift+a'); await expect(page.getByRole('dialog', { name: 'Commandes CPCéleste', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
  await page.keyboard.press('Control+,'); await expect(page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+Alt+s'); dialog = page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Profils', exact: true }).click(); await dialog.getByLabel('Nom du profil', { exact: true }).fill('Atelier personnel'); await dialog.getByRole('button', { name: 'Enregistrer un nouveau profil', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('Profil enregistré');
  let exported;
  if (!native) { const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Exporter ces réglages', exact: true }).click(); exported = JSON.parse(await readFile(await (await download).path(), 'utf8')); assert.equal(exported.preferences.keymap.run, 'F6'); assert.equal(exported.preferences.accent, 'violet'); }
  else exported = await page.evaluate(() => ({ format: 'cpceleste-personalization', version: 1, name: 'Atelier personnel', preferences: JSON.parse(localStorage.getItem('cpceleste.preferences.v2')).preferences }));
  await dialog.getByLabel('Importer un profil JSON', { exact: true }).setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...exported, version: 99 })) }); await expect(dialog.getByRole('status')).toContainText('import refusé');
  await dialog.getByLabel('Importer un profil JSON', { exact: true }).setInputFiles({ name: 'portable.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...exported, name: 'Importé', preferences: { ...exported.preferences, accent: 'rose' } })) }); await expect(dialog.getByRole('status')).toContainText('Profil importé');
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
  dialog = await settings(); await dialog.getByLabel('Couleur d’accent', { exact: true }).selectOption('rose'); await dialog.getByRole('button', { name: 'Appliquer les paramètres', exact: true }).click();
  dialog = await settings(); await dialog.getByRole('button', { name: 'Profils', exact: true }).click(); await dialog.getByLabel('Profil enregistré', { exact: true }).selectOption('Atelier personnel'); await dialog.getByRole('button', { name: 'Charger le profil', exact: true }).click(); await dialog.getByRole('button', { name: 'Appliquer les paramètres', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
  await menu('Affichage', 'Restaurer la disposition des panneaux');
  const tools = page.getByLabel('Outils du projet', { exact: true }), agent = page.getByLabel('Assistant IA', { exact: true }), output = page.getByLabel('Sorties de l’atelier', { exact: true });
  await agent.getByRole('button', { name: 'Détacher l’agent IA', exact: true }).click(); await editor.focus(); await page.keyboard.press('Control+Shift+F12'); await expect(agent).toBeHidden(); await expect(tools).toBeHidden(); await expect(output).toBeHidden();
  await page.keyboard.press('Control+Shift+F12'); await expect(agent).toBeVisible(); await expect(agent).toHaveAttribute('data-floating', 'true'); await expect(tools).toBeVisible(); await expect(output).toBeVisible();
  await menu('Affichage', 'Disposition Édition'); await expect(tools).toBeVisible(); await expect(agent).toBeHidden(); await expect(output).toBeHidden();
  await menu('Affichage', 'Disposition Exécution'); await expect(output).toBeVisible(); await expect(tools).toBeHidden(); await expect(output).toContainText('Exécutez le listing'); assert.equal(await page.getByRole('dialog', { name: 'Émulateur CPC 6128', exact: true }).count(), 0);
  await menu('Affichage', 'Disposition Agent'); await expect(agent).toBeVisible(); await expect(output).toBeHidden(); await expect(agent).toHaveAttribute('data-floating', 'false');
  await menu('Affichage', 'Agrandir le texte du code'); await expect.poll(() => page.locator('.view-lines').evaluate(element => getComputedStyle(element).fontSize)).toBe('21px');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cpceleste.preferences.v2')).preferences.fontSize)).toBe(21);
  await editor.focus(); if (!native) { const download = page.waitForEvent('download'); await page.keyboard.press('Control+Alt+d'); assert.ok((await download).suggestedFilename().endsWith('.bas')); } else await page.keyboard.press('Control+Alt+d');
  await page.screenshot({ path: native ? 'out/personalization-desktop-alpha.png' : 'out/personalization-alpha.png' });
}
export async function verifyPersonalization(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); await context.addInitScript(() => { if (!localStorage.getItem('cpceleste.preferences.v2')) localStorage.setItem('cpceleste.preferences.v1', JSON.stringify({ fontSize: 18, theme: 'dark', autoSave: false })); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try { await page.goto('http://127.0.0.1:5173'); await expect.poll(() => page.locator('.view-lines').evaluate(element => getComputedStyle(element).fontSize)).toBe('18px'); await exercisePersonalization(page);
    const reopened = await context.newPage(); await reopened.goto('http://127.0.0.1:5173'); await reopened.locator('.view-lines').first().waitFor(); await expect(reopened.locator('html')).toHaveAttribute('data-accent', 'violet'); await expect.poll(() => reopened.locator('.view-lines').evaluate(element => getComputedStyle(element).fontSize)).toBe('21px'); await reopened.keyboard.press('Control+Alt+s'); const dialog = reopened.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); await expect(dialog.getByLabel('Profil enregistré', { exact: true })).toHaveValue(''); await expect(dialog.getByLabel('Profil enregistré', { exact: true }).locator('option')).toHaveCount(2); await expect(dialog.getByLabel('Raccourci : Exécuter dans le CPC 6128', { exact: true })).toHaveValue('F6');
    await expect(dialog.getByLabel('Clignotement du curseur', { exact: true })).toHaveValue('solid'); await reopened.keyboard.press('Escape'); await reopened.close();
  } catch (error) { await page.screenshot({ path: 'out/personalization-failure.png' }).catch(() => undefined); throw error; } finally { await context.close(); }
}
