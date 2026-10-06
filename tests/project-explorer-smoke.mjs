import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export async function verifyProjectExplorer(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const sources = [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }, { id: 'util', path: 'src/util.bas', cpcName: 'UTIL.BAS' }];
    const documents = [{ id: 'doc', path: 'documents/doc.txt', originalName: 'Indices.txt', mediaType: 'text/plain', role: 'context', sha256: 'a'.repeat(64) }];
    const manifest = { name: 'Projet exploré', sources, documents, entryPoint: 'main' };
    const entry = (path, kind = 'file', role = 'ordinary', extra = {}) => ({ path, name: path.split('/').pop(), kind, role, bytes: 16, revision: 'a'.repeat(64), ...extra });
    window.explorerCalls = []; window.previewCalls = [];
    window.desktop = { setDirty() {}, open: async () => null, save: async () => null, exportDisk: async () => null,
      project: { open: async () => ({ sessionId: 'explorer', manifest, files: sources.map(source => ({ ...source, source: source.id === 'main' ? '10 REM MAIN\n20 END\n' : '10 REM UTIL\n20 RETURN\n' })) }), readDocument: async () => ({ ...documents[0], bytes: 12, text: 'Indices du jeu' }) },
      explorer: {
        list: async (sessionId, directory, showHidden) => {
          window.explorerCalls.push({ sessionId, directory, showHidden });
          const entries = directory === '' ? [entry('documents', 'directory'), entry('src', 'directory'), entry('notes.md'), entry('binary.dat'), entry('large.txt'), entry('outside', 'link'), entry('microide.project.json', 'file', 'manifest'), ...(showHidden ? [entry('.env')] : [])]
            : directory === 'src' ? sources.map(source => entry(source.path, 'file', 'source', { sourceId: source.id })) : [entry(documents[0].path, 'file', 'document', { documentId: 'doc' })];
          return { directory, entries, complete: true, hiddenCount: directory === '' && !showHidden ? 1 : 0 };
        },
        preview: async (sessionId, path) => { window.previewCalls.push(path); return path === 'large.txt' ? { path, bytes: 65537, notice: 'Aperçu texte limité à 64 Kio' } : path === 'binary.dat' ? { path, bytes: 10, notice: 'Format binaire' } : { path, bytes: 20, text: '<script>throw new Error("inert")</script>\nRecherche', notice: 'Lecture seule' }; },
      },
    };
  });
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
    await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Explorateur du projet', exact: true });
    await expect(panel).toContainText('masqué');
    await panel.getByRole('button', { name: 'Dossier src', exact: true }).click();
    const main = panel.getByRole('button', { name: /^src\/main.bas/ });
    const util = panel.getByRole('button', { name: /^src\/util.bas/ });
    await main.click(); const input = page.locator('.listing .monaco-editor textarea');
    await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM DRAFT');
    await expect(main).toContainText('modifié');
    await util.click(); await expect(page.locator('.view-lines')).toContainText('UTIL');
    await main.click(); await expect(page.locator('.view-lines')).toContainText('DRAFT');
    await panel.getByRole('button', { name: /notes.md/ }).click();
    const preview = page.getByRole('dialog', { name: 'Aperçu de notes.md', exact: true });
    await expect(preview.getByRole('textbox')).toHaveValue(/<script>/); await expect(preview.getByRole('textbox')).toHaveAttribute('readonly', '');
    await page.keyboard.press('Escape'); await expect(preview).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /notes.md/ })).toBeFocused();
    await input.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('DRAFT');
    await panel.getByRole('button', { name: /outside/ }).click(); await expect(panel.getByRole('status')).toContainText('non parcouru');
    assert.ok(!(await page.evaluate(() => window.previewCalls)).includes('outside'));
    for (const path of ['binary.dat', 'large.txt']) {
      await panel.getByRole('button', { name: new RegExp(path) }).click(); const dialog = page.getByRole('dialog', { name: `Aperçu de ${path}`, exact: true });
      await expect(dialog.getByRole('textbox')).toHaveCount(0); await dialog.getByRole('button', { name: 'Fermer l’aperçu', exact: true }).click();
    }
    await panel.getByRole('searchbox').fill('notes'); await expect(panel.getByRole('button', { name: /binary.dat/ })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Dossier src', exact: true })).toBeVisible();
    await panel.getByRole('searchbox').fill(''); await panel.getByRole('checkbox', { name: 'Privés et générés', exact: true }).check();
    await expect(panel.getByRole('button', { name: /.env/ })).toBeVisible();
    await panel.getByRole('button', { name: 'Dossier documents', exact: true }).click();
    await panel.getByRole('button', { name: /Indices.txt/ }).click();
    await expect(page.getByRole('region', { name: 'Documents du projet', exact: true }).getByRole('textbox')).toHaveValue('Indices du jeu');
    await page.keyboard.press('Control+Shift+e');
    await panel.getByRole('button', { name: 'Actualiser les fichiers', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Dossier src', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: 'out/project-explorer-alpha.png' });
    assert.ok((await page.evaluate(() => window.explorerCalls)).every(call => call.sessionId === 'explorer'));
    // A host refusal remains visible and leaves the current editor intact.
    await page.evaluate(() => { window.desktop.explorer.preview = async () => ({ error: 'Fichier modifié depuis l’affichage ; actualisez l’explorateur.' }); });
    await panel.getByRole('button', { name: /notes.md/ }).click(); await expect(panel.getByRole('status')).toContainText('Fichier modifié');
    await expect(page.locator('.view-lines')).toContainText('MAIN');
  } finally { await page.close(); }
}
