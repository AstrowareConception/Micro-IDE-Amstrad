import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';

const temporary = await mkdtemp(join(tmpdir(), 'microide-desktop-'));
const listing = join(temporary, 'source.bas');
const exported = join(temporary, 'program.dsk');
await writeFile(listing, '10 PRINT "DESKTOP"\r\n20 END\r\n');
// CI runs an unprivileged user with Chromium sandbox enabled. Do not disable sandbox to pass tests.
const desktop = await electron.launch({ args: ['.'], timeout: 30000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } });
let page;
try {
  page = await desktop.firstWindow();
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

  // Real native project persistence; dialogs only select test-owned directories.
  const root = join(temporary, 'project'); await mkdir(root);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, root);
  await page.getByLabel('Nom du projet', { exact: true }).fill('Multifichier CPC');
  const discard = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.getByRole('button', { name: 'Créer projet dans un dossier vide' }).click(); await discard;
  await page.getByRole('tab', { name: 'src/main.bas', exact: true }).waitFor();
  const sessionId = await page.evaluate(async () => (await window.desktop.project.open()).sessionId);
  // The direct test open refreshed the host session, so reopen through UI as well.
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Enregistrer Ctrl/ })).toBeEnabled();
  await page.getByRole('status').filter({ hasText: /Projet mis à jour/ }).waitFor();
  const baseline = await readFile(join(root, 'src/main.bas'), 'utf8');
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM MAIN DRAFT');
  await page.getByLabel('Nouvelle source (1–8 caractères)', { exact: true }).fill('UTIL');
  await page.getByRole('button', { name: 'Ajouter source', exact: true }).click();
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).waitFor();
  const utilityBaseline = await readFile(join(root, 'src/util.bas'), 'utf8');
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM UTIL DRAFT');
  await page.getByRole('tab', { name: /src\/main.bas/ }).click();
  await input.focus(); await page.keyboard.press('Control+z');
  // Monaco groups typing into undo elements, not necessarily one whole insertText call.
  // Observe an actual changed buffer rather than assuming Ctrl Z restores the initial file.
  await expect(page.locator('.monaco-editor .view-lines')).not.toContainText('DRAFT');
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /Listing enregistré/ }).waitFor();
  const undone = await readFile(join(root, 'src/main.bas'), 'utf8');
  assert.notEqual(undone, baseline + '30 REM MAIN DRAFT');
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), utilityBaseline);
  await input.focus();
  await page.keyboard.press('Control+Shift+z');
  await page.getByRole('tab', { name: /src\/main.bas.*modifié/ }).waitFor();
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /Listing enregistré/ }).waitFor();
  assert.equal(await readFile(join(root, 'src/main.bas'), 'utf8'), baseline + '30 REM MAIN DRAFT');
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), utilityBaseline, 'saving main must not save util draft');
  await page.getByRole('tab', { name: /src\/util.bas/ }).click();
  await page.getByRole('status').filter({ hasText: /L3 · C/ }).waitFor();
  await page.getByRole('button', { name: 'Définir comme entrée', exact: true }).click();
  await page.getByText('Entrée : UTIL.BAS', { exact: true }).waitFor();
  assert.equal(JSON.parse(await readFile(join(root, 'microide.project.json'), 'utf8')).entryPoint, 'util');
  await page.getByRole('button', { name: 'Exporter DSK', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /DSK DATA construit/ }).waitFor();
  const projectFiles = readDataDisk(new Uint8Array(await readFile(exported)));
  assert.deepEqual(projectFiles.map(file => file.name), ['MAIN.BAS', 'UTIL.BAS']);
  assert.equal(new TextDecoder().decode(decodeAsciiRecords(projectFiles[1].records)), (utilityBaseline + '30 REM UTIL DRAFT').replace(/\n/g, '\r\n') + '\r\n\x1a');
  assert.ok(await page.getByRole('tab', { name: /src\/util.bas.*modifié/ }).isVisible(), 'export must not mark draft saved');
  const stale = await page.evaluate(id => window.desktop.project.save(id, 'main', '10 END'), sessionId);
  assert.match(stale.error, /périmée/);
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /Listing enregistré/ }).waitFor();
  await writeFile(join(root, 'src/util.bas'), '10 REM EXTERNAL\n20 END\n');
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n40 REM DIRTY');
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /changé sur disque/ }).waitFor();
  assert.equal(await readFile(join(root, 'src/util.bas'), 'utf8'), '10 REM EXTERNAL\n20 END\n');
  const moved = root + '-moved'; await rename(root, moved);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, moved);
  const replace = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click(); await replace;
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).waitFor();
  await page.getByText('Entrée : UTIL.BAS', { exact: true }).waitFor();
  await page.screenshot({ path: 'out/project-alpha.png' });
  assert.deepEqual(errors, []);
  console.log('Electron smoke: isolation, standalone files, project create/open/add, independent undo/cursor/buffers, active save, entry, multifile DSK, stale sessions, conflicts and portable relocation passed.');
} catch (error) {
  await mkdir('out', { recursive: true });
  await page?.screenshot({ path: 'out/desktop-failure.png', timeout: 5000 }).catch(() => undefined);
  throw error;
} finally {
  // Only the test application is destroyed; fixture directory is intentionally retained for debugging.
  await desktop.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }).catch(() => undefined);
  await desktop.close();
}
