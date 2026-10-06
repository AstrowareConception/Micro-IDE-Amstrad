import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export async function verifyRecentProjects(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const entries = [
      { id: 'a', name: 'Jeu CPC', path: '/recette/A', lastOpenedAt: '2026-10-06T08:00:00.000Z', available: true },
      { id: 'b', name: 'Jeu CPC', path: '/recette/B', lastOpenedAt: '2026-10-05T08:00:00.000Z', available: true },
      { id: 'missing', name: 'Ancien jeu', path: '/supprime/jeu', lastOpenedAt: '2026-10-04T08:00:00.000Z', available: false },
    ];
    window.recentOpenCalls = [];
    window.confirm = () => false;
    window.desktop = { setDirty() {}, open: async () => null, save: async () => null, exportDisk: async () => null, project: { open: async () => null }, recentProjects: {
      list: async () => [...entries],
      open: async id => {
        window.recentOpenCalls.push(id);
        if (id === 'missing') return { error: 'Projet récent indisponible : dossier déplacé, supprimé ou inaccessible.' };
        return { sessionId: `recent-${id}`, manifest: { name: 'Jeu CPC', sources: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }], entryPoint: 'main', documents: [] }, files: [{ id: 'main', path: 'src/main.bas', source: `10 REM PROJECT ${id.toUpperCase()}\n20 END\n` }] };
      },
      remove: async id => { entries.splice(entries.findIndex(entry => entry.id === id), 1); return [...entries]; },
      clear: async () => { entries.splice(0); return []; },
    } };
  });
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
    async function show() {
      await page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true }).getByRole('button', { name: 'Fichier', exact: true }).click();
      await page.getByRole('menuitem', { name: /^Projets récents…/  }).click();
      await expect(page.getByRole('dialog', { name: 'Projets récents', exact: true }).getByText('Chargement…')).toHaveCount(0);
    }
    const dialog = page.getByRole('dialog', { name: 'Projets récents', exact: true });
    await show(); await expect(dialog.getByRole('listitem')).toHaveCount(3);
    await expect(dialog).toContainText('Dossier ou manifeste indisponible');
    await dialog.getByRole('searchbox').fill('/recette/A'); await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await dialog.getByRole('button', { name: /^Ouvrir le projet Jeu CPC/  }).click();
    await expect(dialog).toHaveCount(0); await expect(page.locator('.view-lines')).toContainText('PROJECT A');
    const input = page.locator('.listing .monaco-editor textarea'); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM UNSAVED');
    await show(); await dialog.getByRole('listitem').filter({ hasText: '/recette/B' }).getByRole('button', { name: /^Ouvrir le projet Jeu CPC/  }).click();
    await expect(dialog.getByRole('alert')).toContainText('Ouverture annulée'); assert.deepEqual(await page.evaluate(() => window.recentOpenCalls), ['a']);
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click(); await expect(page.locator('.view-lines')).toContainText('UNSAVED');
    await input.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('UNSAVED');
    await page.evaluate(() => { window.confirm = () => true; });
    await page.keyboard.press('Control+r'); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: /^Ouvrir le projet Ancien jeu/  }).click();
    await expect(dialog.getByRole('alert')).toContainText('Projet récent indisponible'); await expect(page.locator('.view-lines')).toContainText('PROJECT A');
    await dialog.getByRole('button', { name: 'Retirer Ancien jeu des projets récents', exact: true }).click(); await expect(dialog.getByRole('listitem')).toHaveCount(2);
    await page.screenshot({ path: 'out/recent-projects-alpha.png' });
    await dialog.getByRole('button', { name: 'Effacer la liste', exact: true }).click(); await expect(dialog).toContainText('Aucun projet récent');
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click(); await expect(page.locator('.view-lines')).toContainText('PROJECT A');
    await expect(page.locator('dialog.recent-projects-dialog')).toHaveCount(0);
    await page.evaluate(() => { window.desktop.recentProjects.list = async () => new Promise(() => {}); });
    await page.keyboard.press('Control+r'); await expect(dialog).toContainText('Chargement…');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect(page.locator('.view-lines')).toContainText('PROJECT A');
  } finally { await page.close(); }
}
