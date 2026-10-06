import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
export async function verifySourceOperations(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let manifest = { name: 'Sources organisées', entryPoint: 'main', sources: [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }, { id: 'util', path: 'src/util.bas', cpcName: 'UTIL.BAS' }], documents: [] }, plan, last, previous, draft;
    const contents = { main: '10 REM MAIN\n20 END\n', util: '10 REM UTIL\n20 RETURN\n' };
    const result = () => ({ manifest: structuredClone(manifest), files: manifest.sources.map(source => ({ ...source, source: contents[source.id] })) });
    window.sourceCalls = []; window.cancelSource = false;
    window.desktop = { setDirty() {}, project: { open: async () => ({ sessionId: 'source-ui', ...result() }) }, sourceOperations: {
      prepare: async (_session, request) => {
        window.sourceCalls.push(request);
        if (request.name === 'UTIL') return { error: 'Collision de cpcName dans les sources.' };
        const source = manifest.sources.find(source => source.id === request.id);
        plan = { id: crypto.randomUUID(), action: request.action, source, entryPoint: request.action === 'delete' ? request.entryPoint : manifest.entryPoint,
          ...(request.action === 'delete' ? {} : { destination: { ...source, path: request.action === 'rename' ? `src/${request.name.toLowerCase()}.bas` : request.path, cpcName: request.action === 'rename' ? `${request.name.toUpperCase()}.BAS` : source.cpcName } }) };
        return plan;
      },
      apply: async (_session, _id, source) => {
        if (window.cancelSource) { window.cancelSource = false; return null; }
        previous = structuredClone(manifest); draft = plan.action === 'delete' ? { id: plan.source.id, source } : undefined;
        manifest = { ...manifest, entryPoint: plan.entryPoint, sources: plan.action === 'delete' ? manifest.sources.filter(source => source.id !== plan.source.id) : manifest.sources.map(source => source.id === plan.source.id ? plan.destination : source) };
        last = { revision: 'a'.repeat(64), createdAt: new Date().toISOString(), files: [plan.source.path] }; return result();
      },
      last: async () => last,
      draft: async () => draft ? { ...draft, path: "src/levels/title.bas" } : undefined,
      restore: async () => { manifest = previous; last = undefined; return { ...result(), ...(draft ? { restoredDraft: draft } : {}) }; },
    } };
  });
  async function action(label) {
    await page.getByRole('button', { name: 'Projet', exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  }
  async function apply(dialog) { await dialog.getByRole('button', { name: 'Préparer l’aperçu', exact: true }).click(); await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog).toHaveCount(0); }
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor(); await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
    const input = page.locator('.listing .monaco-editor textarea');
    await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM MAIN DRAFT');
    await page.getByRole('tab', { name: 'src/util.bas', exact: true }).click(); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM UTIL DRAFT');
    await page.getByRole('tab', { name: /src\/main.bas/ }).click();
    await action('Renommer cette source…'); let dialog = page.getByRole('dialog', { name: 'Renommer la source', exact: true });
    await dialog.getByLabel('Nouveau nom CPC (sans .BAS)', { exact: true }).fill('UTIL'); await dialog.getByRole('button', { name: 'Préparer l’aperçu', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('Collision');
    await dialog.getByLabel('Nouveau nom CPC (sans .BAS)', { exact: true }).fill('TITLE'); await apply(dialog);
    await expect(page.getByRole('tab', { name: /src\/title.bas.*modifié/ })).toBeVisible(); await expect(page.getByRole('tab', { name: /src\/util.bas.*modifié/ })).toBeVisible();
    await expect(page.locator('.view-lines')).toContainText('MAIN DRAFT'); await input.focus(); await page.keyboard.press('Control+z'); await expect(page.locator('.view-lines')).not.toContainText('MAIN DRAFT');
    await page.keyboard.press('Control+y'); await expect(page.locator('.view-lines')).toContainText('MAIN DRAFT');
    await action('Déplacer cette source…'); dialog = page.getByRole('dialog', { name: 'Déplacer la source', exact: true });
    await dialog.getByLabel('Nouveau chemin sous src/', { exact: true }).fill('src/levels/title.bas'); await dialog.getByRole('button', { name: 'Préparer l’aperçu', exact: true }).click(); await expect(dialog.locator('table')).toContainText('TITLE.BAS');
    await page.screenshot({ path: 'out/source-operations-alpha.png' });
    await page.evaluate(() => { window.cancelSource = true; }); await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('annulée'); await expect(page.getByRole('tab', { name: /src\/title.bas/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Appliquer après confirmation', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('tab', { name: /src\/levels\/title.bas/ })).toBeVisible();
    await page.getByRole('tab', { name: /title.bas/ }).click({ button: 'middle' });
    await expect(page.getByRole('tab', { name: /title.bas/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Actions de src/levels/title.bas', exact: true }).click();
    await page.getByRole('dialog', { name: 'Actions de src/levels/title.bas', exact: true }).getByRole('button', { name: 'Supprimer cette source…', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Supprimer la source', exact: true }); await expect(dialog).toContainText('Ce brouillon est modifié'); await apply(dialog);
    await expect(page.getByRole('tab', { name: /title.bas/ })).toHaveCount(0); await expect(page.getByRole('tab', { name: /util.bas.*modifié/ })).toBeVisible();
    await page.getByRole('button', { name: 'Consulter le brouillon conservé', exact: true }).click();
    const archive = page.getByRole('dialog', { name: 'Brouillon conservé', exact: true }); await expect(archive.getByRole('textbox')).toHaveValue(/MAIN DRAFT/); await page.keyboard.press('Escape'); await expect(archive).toHaveCount(0);
    await page.getByRole('button', { name: 'Rétablir la dernière organisation', exact: true }).click(); await expect(page.getByRole('tab', { name: /src\/levels\/title.bas.*modifié/ })).toBeVisible();
    await page.getByRole('tab', { name: /title.bas/ }).click(); await expect(page.locator('.view-lines')).toContainText('MAIN DRAFT');
    assert.equal((await page.evaluate(() => window.sourceCalls)).length, 4);
  } catch (error) { await page.screenshot({ path: 'out/source-operations-failure.png' }).catch(() => undefined); throw error; }
  finally { await page.close(); }
}
