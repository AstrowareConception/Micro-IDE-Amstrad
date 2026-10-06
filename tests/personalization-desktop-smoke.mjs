import { exerciseNotifications } from './notifications-smoke.mjs';
import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exercisePersonalization } from './personalization-smoke.mjs';
const root = await mkdtemp(join(tmpdir(), 'cpceleste-personalization-')); let app, page; const errors = [];
try {
  app = await electron.launch({ args: ['.'], env: { ...process.env, XDG_CONFIG_HOME: root } }); page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ dialog }) => { globalThis.personalizationSaveCalls = 0; dialog.showSaveDialog = async () => { globalThis.personalizationSaveCalls++; return { canceled: true }; }; });
  await exercisePersonalization(page, true); await exerciseNotifications(page, true); assert.equal(await app.evaluate(() => globalThis.personalizationSaveCalls), 1); assert.deepEqual(errors, []);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined); await app.close().catch(() => undefined); app = undefined;
  app = await electron.launch({ args: ['.'], env: { ...process.env, XDG_CONFIG_HOME: root } }); page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.locator('.view-lines').first().waitFor(); await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet'); await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.keyboard.press('Control+Alt+n'); await expect(page.getByRole('dialog', { name: 'Centre de notifications', exact: true })).toContainText('Aucune notification dans cette session.'); await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Alt+s'); const settings = page.getByRole('dialog', { name: 'Paramètres de CPCéleste', exact: true }); await expect(settings.getByLabel('Taille du code (px)', { exact: true })).toHaveValue('21'); await expect(settings.getByLabel('Profil enregistré', { exact: true }).locator('option')).toHaveCount(2); await expect(settings.getByLabel('Raccourci : Exécuter dans le CPC 6128', { exact: true })).toHaveValue('F6'); assert.deepEqual(errors, []);
  console.log('Native personalization: editor identity/undo, visual options, keymap conflicts and dispatch, profile import/cancel/load, layouts/focus and persisted zoom passed.');
} catch (error) { await page?.screenshot({ path: 'out/personalization-desktop-failure.png' }).catch(() => undefined); throw error; }
finally { if (app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined); await app.close().catch(() => undefined); } await rm(root, { recursive: true, force: true }); }
