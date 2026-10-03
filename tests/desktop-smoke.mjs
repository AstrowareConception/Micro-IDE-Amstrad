import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';

const temporary = await mkdtemp(join(tmpdir(), 'microide-desktop-'));
const listing = join(temporary, 'source.bas');
const exported = join(temporary, 'program.dsk');
await writeFile(listing, '10 PRINT "DESKTOP"\r\n20 END\r\n');
// CI runs an unprivileged user with Chromium sandbox enabled. Do not disable sandbox to pass tests.
const desktop = await electron.launch({ args: ['.'], timeout: 30000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } });
try {
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('heading', { name: 'Micro IDE Amstrad' }).waitFor();
  await page.locator('.monaco-editor .view-line').first().waitFor();
  const preferences = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.contextIsolation, true); assert.equal(preferences.sandbox, true); assert.equal(preferences.nodeIntegration, false);
  assert.deepEqual(await page.evaluate(() => [typeof window.require, typeof window.process]), ['undefined', 'undefined']);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, listing);
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /Listing ouvert/ }).waitFor();
  const input = page.locator('.monaco-editor textarea');
  await input.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 PRINT "MODIFIED"\n20 END\n');
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /Listing enregistré/ }).waitFor();
  assert.equal(await readFile(listing, 'utf8'), '10 PRINT "MODIFIED"\n20 END\n');
  await writeFile(listing, '10 REM EXTERNAL\n20 END\n');
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /changé sur disque/ }).waitFor();
  assert.equal(await readFile(listing, 'utf8'), '10 REM EXTERNAL\n20 END\n');
  await desktop.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, exported);
  await page.getByRole('button', { name: 'Exporter DSK', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /DSK DATA construit/ }).waitFor();
  assert.equal(readDataDisk(new Uint8Array(await readFile(exported)))[0].name, 'MAIN.BAS');
  const invalid = await page.evaluate(() => window.desktop.save(123));
  assert.match(invalid.error, /invalide/);
  // Native close cancellation preserves a dirty editor.
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM DIRTY');
  await page.locator('.tab').filter({ hasText: /modifié/ }).waitFor();
  await desktop.evaluate(({ dialog, BrowserWindow }) => { dialog.showMessageBoxSync = () => 0; BrowserWindow.getAllWindows()[0].close(); });
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  await mkdir('out', { recursive: true }); await page.screenshot({ path: 'out/desktop-alpha.png' });
  assert.deepEqual(errors, []);
  console.log('Electron smoke: sandbox, IPC validation, native open/save, conflict protection, DSK export and dirty close passed.');
} finally {
  // Only the test application is destroyed; fixture directory is intentionally retained for debugging.
  await desktop.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }).catch(() => undefined);
  await desktop.close();
}
