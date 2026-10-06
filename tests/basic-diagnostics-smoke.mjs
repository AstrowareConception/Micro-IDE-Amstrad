import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
export async function verifyBasicDiagnostics(browser, errors) {
 const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
  const sources = [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }, { id: 'util', path: 'src/util.bas', cpcName: 'UTIL.BAS' }];
  window.desktop = { setDirty() {}, project: { open: async () => ({ sessionId: 'diagnostics', manifest: { name: 'Diagnostics', entryPoint: 'main', sources, documents: [] }, files: sources.map(source => ({ ...source, source: source.id === 'main' ? '10 MODE 1\n20 END' : '10 IF A THEN POKE 1,\n20 PRINT "OPEN' })) }) } };
  window.analysisRequests = 0; window.analysisWorkers = [];
  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, { construct(Target, args) {
   const worker = new Target(...args);
   if (String(args[0]).includes('analysis-worker')) {
    worker.addEventListener('message', event => { if (window.holdAnalysisDelivery) event.stopImmediatePropagation(); });
    window.analysisWorkers.push(worker); const post = worker.postMessage.bind(worker);
    worker.postMessage = (...values) => { window.analysisRequests++; post(...values); };
   }
   return worker;
  } });
 });
 try {
  await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  const problems = page.getByRole('region', { name: 'Diagnostics BASIC', exact: true });
  await expect(problems.getByRole('button', { name: /src\/util.bas · L1 · Erreur/ }).first()).toBeVisible();
  assert.ok(await page.getByRole('tab', { name: /src\/util.bas/ }).getByLabel(/diagnostic/).count());
  await problems.getByLabel('Gravité', { exact: true }).selectOption('warning'); await expect(problems.getByRole('button', { name: /Chaîne ouverte/ })).toBeVisible();
  await problems.getByLabel('Gravité', { exact: true }).selectOption('all');
  await problems.getByLabel('Rechercher un diagnostic', { exact: true }).fill('syntax-operand'); await expect(problems.getByRole('button')).toHaveCount(1);
  await problems.getByRole('button').click(); await expect(page.locator('.view-lines')).toContainText('IF A THEN POKE'); await expect(page.locator('footer')).toContainText('L1 · C');
  await problems.getByLabel('Rechercher un diagnostic', { exact: true }).fill('');
  await problems.locator('summary').click(); await expect(problems).toContainText('PRINT : expressions adjacentes');
  const input = page.locator('.listing .monaco-editor textarea');
  await input.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 MODE');
  await page.keyboard.insertText(' 1\n20 END');
  await expect(problems.getByText('Aucun problème détecté dans le sous-ensemble analysé.', { exact: true })).toBeVisible(); await expect(page.locator('.basic-error-glyph')).toHaveCount(0);
  await input.focus(); await page.keyboard.press('Control+Home'); await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await expect(page.locator('.basic-error-glyph')).toHaveCount(1);
  await page.keyboard.press('Control+z'); await expect(page.locator('.basic-error-glyph')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z'); await expect(page.locator('.basic-error-glyph')).toHaveCount(1);
  await page.keyboard.press('Control+z'); await expect(page.locator('.basic-error-glyph')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Panneaux de sortie', exact: true }).getByRole('button', { name: 'Performance', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Performance de l’atelier', exact: true });
  await expect(panel).toHaveAttribute('data-monitoring', 'active'); await expect(panel).toContainText('worker unique'); await expect(panel.locator('tbody tr')).toHaveCount(2);
  await expect(panel.locator('tbody')).not.toContainText('En attente');
  const initial = await page.evaluate(() => window.analysisRequests); await expect.poll(() => panel.textContent()).toContain('1 s ·');
  assert.equal(await page.evaluate(() => window.analysisRequests), initial, 'No idle BASIC analysis');
  // Explicit changes yield one coalesced request and lexical cache reuse.
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n30 A='); await page.keyboard.insertText('1');
  await expect.poll(() => page.evaluate(() => window.analysisRequests)).toBe(initial + 1);
  await expect(panel.locator('tbody tr').filter({ hasText: 'util.bas' })).toContainText('3 lignes');
  await page.keyboard.press('Control+j'); await expect(panel).toHaveCount(0);
  await page.keyboard.press('Control+j'); await expect(page.getByRole('region', { name: 'Performance de l’atelier', exact: true })).toHaveAttribute('data-monitoring', 'active');
  await page.getByRole('button', { name: /^Problèmes \d/ }).click(); await expect(panel).toHaveCount(0);
  // Worker failure during pending work is visible; explicit retry recovers.
  const beforeFailure = await page.evaluate(() => { window.holdAnalysisDelivery = true; return window.analysisRequests; });
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n40 MODE');
  await expect.poll(() => page.evaluate(() => window.analysisRequests)).toBe(beforeFailure + 1);
  await page.evaluate(() => { window.holdAnalysisDelivery = false; window.analysisWorkers.at(-1).dispatchEvent(new ErrorEvent('error', { message: 'test failure' })); });
  await expect(problems.getByRole('button', { name: 'Réessayer l’analyse', exact: true })).toBeVisible();
  await problems.getByRole('button', { name: 'Réessayer l’analyse', exact: true }).click();
  await expect(page.locator('.basic-error-glyph')).toHaveCount(1);
  await page.getByRole('tab', { name: /src\/main.bas/ }).click(); await input.focus(); await page.keyboard.press('F8');
  await expect(page.getByRole('tab', { name: /src\/util.bas/ })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: 'out/basic-diagnostics-alpha.png' });
 } catch (error) { await page.screenshot({ path: 'out/basic-diagnostics-failure.png' }).catch(() => undefined); throw error; }
 finally { await page.close(); }
}
