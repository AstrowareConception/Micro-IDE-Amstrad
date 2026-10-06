import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { newProject, addProjectSource } from '../packages/workspace/src/project.ts';
import { readDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
const temporary = await mkdtemp(join(tmpdir(), 'cpceleste-source-ui-')), root = join(temporary, 'project');
await mkdir(join(root, 'src/levels'), { recursive: true });
const manifest = addProjectSource(newProject('Sources natives', randomUUID()), 'UTIL'), original = '10 REM ORIGINAL\r\n20 END\r\n';
await writeFile(join(root, 'microide.project.json'), JSON.stringify(manifest)); await writeFile(join(root, 'src/main.bas'), original); await writeFile(join(root, 'src/util.bas'), '10 REM UTILITY\n20 RETURN\n');
let desktop, page; const errors = [];
try {
  desktop = await electron.launch({ args: ['.'], timeout: 30000, env: { ...process.env, XDG_CONFIG_HOME: join(temporary, 'config') } }); page = await desktop.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.locator('.view-lines').first().waitFor();
  await desktop.evaluate(({ dialog }, root) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }); dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); }, root);
  const staleId = await page.evaluate(async () => (await window.desktop.project.open()).sessionId);
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click(); await expect(page.getByRole('tab', { name: 'src/main.bas', exact: true })).toBeVisible();
  assert.match((await page.evaluate(sessionId => window.desktop.sourceOperations.prepare(sessionId, { action: 'rename', id: 'main', name: 'BAD' }), staleId)).error, /périmée/);
  const input = page.locator('.listing .monaco-editor textarea'); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM NATIVE MAIN DRAFT');
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).click(); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM NATIVE UTIL DRAFT');
  await page.getByRole('tab', { name: /src\/main.bas/ }).click();
  async function action(label) { await page.getByRole('button', { name: 'Projet', exact: true }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click(); }
  async function apply(dialog) { await dialog.getByRole('button', { name: 'Préparer l’aperçu', exact: true }).click(); await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog).toHaveCount(0); }
  await action('Renommer cette source…'); let dialog = page.getByRole('dialog', { name: 'Renommer la source', exact: true }); await dialog.getByLabel('Nouveau nom CPC (sans .BAS)', { exact: true }).fill('TITLE'); await apply(dialog);
  await expect(page.getByRole('tab', { name: /src\/title.bas.*modifié/ })).toBeVisible(); assert.equal(await readFile(join(root, 'src/title.bas'), 'utf8'), original);
  await input.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('MAIN DRAFT'); await page.keyboard.press('Control+y'); await expect(page.locator('.view-lines')).toContainText('MAIN DRAFT');
  await action('Déplacer cette source…'); dialog = page.getByRole('dialog', { name: 'Déplacer la source', exact: true }); await dialog.getByLabel('Nouveau chemin sous src/', { exact: true }).fill('src/levels/title.bas'); await apply(dialog);
  assert.equal(await readFile(join(root, 'src/levels/title.bas'), 'utf8'), original); await expect(page.getByRole('tab', { name: /src\/util.bas.*modifié/ })).toBeVisible();
  const exported = join(temporary, 'renamed.dsk'); await desktop.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, exported);
  await page.getByRole('button', { name: 'Exporter DSK', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: /DSK DATA construit/ })).toBeVisible();
  assert.ok(readDataDisk(new Uint8Array(await readFile(exported))).some(file => file.name === 'TITLE.BAS'));
  await action('Supprimer cette source…'); dialog = page.getByRole('dialog', { name: 'Supprimer la source', exact: true }); await dialog.getByRole('button', { name: 'Préparer l’aperçu', exact: true }).click();
  await desktop.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); }); const baseline = await readFile(join(root, 'microide.project.json'));
  await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('annulée'); assert.deepEqual(await readFile(join(root, 'microide.project.json')), baseline);
  await desktop.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); }); await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /title.bas/ })).toHaveCount(0); await assert.rejects(readFile(join(root, 'src/levels/title.bas')), { code: 'ENOENT' });
  await page.getByRole('button', { name: 'Consulter le brouillon conservé', exact: true }).click();
  const archive = page.getByRole('dialog', { name: 'Brouillon conservé', exact: true }); await expect(archive.getByRole('textbox')).toHaveValue(/NATIVE MAIN DRAFT/); await page.keyboard.press('Escape'); await expect(archive).toHaveCount(0);
  await page.getByRole('button', { name: 'Rétablir la dernière organisation', exact: true }).click(); await expect(page.getByRole('tab', { name: /src\/levels\/title.bas.*modifié/ })).toBeVisible();
  await page.getByRole('tab', { name: /title.bas/ }).click(); await expect(page.locator('.view-lines')).toContainText('NATIVE MAIN DRAFT'); assert.equal(await readFile(join(root, 'src/levels/title.bas'), 'utf8'), original);
  await page.screenshot({ path: 'out/source-operations-desktop-alpha.png' }); assert.deepEqual(errors, []);
  console.log('Native source operations: rename/move preserve dirty buffers and undo, CPC disk names, cancellation, dirty deletion and recovery passed.');
} catch (error) { await page?.screenshot({ path: 'out/source-operations-desktop-failure.png' }).catch(() => undefined); throw error; }
finally { if (desktop) { await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined); await desktop.close().catch(() => undefined); } await rm(temporary, { recursive: true, force: true }); }
