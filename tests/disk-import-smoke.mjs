import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeBasicAscii } from '../packages/cpc-disk/src/basic-ascii.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';

/** Browser UI + actual worker and filesystem adapter. Native dialogs/IPC are covered separately. */
export async function verifyDiskImport(browser) {
  const parent = await mkdtemp(join(tmpdir(), 'cpceleste-import-ui-')), path = join(parent, 'archives.dsk');
  const bytes = createDataDisk([{ name: 'MENU.BAS', bytes: encodeBasicAscii('10 PRINT "RECOVERED"\n20 END\n') },
    { name: 'OLD.BIN', bytes: encodeBasicAscii('10 PRINT "BASIC IN BIN"\n20 END\n') },
    { name: 'IMAGE.SCR', bytes: encodeAmsdosBinary('IMAGE.SCR', new Uint8Array(32), 0xc000) }]);
  await writeFile(path, bytes);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let session, root, calls = 0;
  await page.exposeFunction('inspectFixtureDisk', async () => { session = await DiskImportSession.prepare(path); return session.preview; });
  await page.exposeFunction('createFixtureProject', async request => {
    calls++; root = await session.create(parent, request); return (await ProjectStore.open(root)).snapshot;
  });
  await page.addInitScript(() => {
    window.allowDiscard = false; window.confirm = () => window.allowDiscard;
    window.desktop = { setDirty() {}, open: async () => null, save: async () => null, exportDisk: async () => null,
      diskImport: { inspect: () => window.inspectFixtureDisk(), create: request => window.createFixtureProject(request) } };
  });
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.monaco-editor .view-line').first().waitFor();
    const input = page.locator('.listing .monaco-editor textarea');
    await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('100 REM UNSAVED');
    await page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true }).getByRole('button', { name: 'Fichier', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Importer une disquette DSK…', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Importer une disquette DSK', exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog.locator('tbody tr')).toHaveCount(3);
    await expect(dialog.getByLabel('Importer IMAGE.SCR', { exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Examiner OLD.BIN', exact: true }).click();
    await expect(dialog.getByRole('region', { name: 'Aperçu de OLD.BIN', exact: true })).toContainText('BASIC IN BIN');
    await dialog.getByLabel('Importer MENU.BAS', { exact: true }).uncheck();
    await expect(dialog.getByLabel('Programme à lancer', { exact: true })).toHaveValue('file-2');
    await dialog.getByLabel('Nom du projet importé', { exact: true }).fill('Mes anciens programmes');
    await dialog.getByRole('button', { name: 'Choisir le dossier parent et importer', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Création annulée'); assert.equal(calls, 0);
    await expect(page.locator('.view-lines')).toContainText('UNSAVED');
    await mkdir('out', { recursive: true }); await page.screenshot({ path: 'out/dsk-import-alpha.png' });
    await page.evaluate(() => { window.allowDiscard = true; });
    await dialog.getByRole('button', { name: 'Choisir le dossier parent et importer', exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(page.locator('.view-lines')).toContainText('BASIC IN BIN');
    assert.equal(calls, 1); const opened = await ProjectStore.open(root);
    assert.equal(opened.snapshot.files.length, 1); assert.equal(opened.snapshot.files[0].cpcName, 'OLD.BIN');
    assert.deepEqual(await readFile(join(root, '.microide/imports/original.dsk')), Buffer.from(bytes));
    assert.deepEqual(await readFile(path), Buffer.from(bytes)); assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

export async function verifyDiskImportDesktop(page, desktop, parent) {
  const path = join(parent, 'native-import.dsk');
  const bytes = createDataDisk([{ name: 'OLD.BIN', bytes: encodeBasicAscii('10 PRINT "NATIVE IMPORT"\n20 END\n') }]);
  await writeFile(path, bytes);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, path);
  const preview = await page.evaluate(() => window.desktop.diskImport.inspect()); assert.ok(preview.id, JSON.stringify(preview));
  const request = { id: preview.id, name: 'Import natif', sourceIds: [preview.files[0].id], entryId: preview.files[0].id };
  assert.match((await page.evaluate(request => window.desktop.diskImport.create(request), { ...request, id: 'expired' })).error, /périmé/);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, parent);
  const result = await page.evaluate(request => window.desktop.diskImport.create(request), request);
  assert.equal(result.files[0].source, '10 PRINT "NATIVE IMPORT"\n20 END\n'); assert.equal(result.files[0].cpcName, 'OLD.BIN');
  assert.deepEqual(await readFile(path), Buffer.from(bytes));
  assert.match((await page.evaluate(request => window.desktop.diskImport.create(request), request)).error, /Analysez/);
}
