import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
// UI/lifecycle recipe with a controlled transport. Real ROM execution is separate.
export async function verifyBasicTests(browser, errors) {
 const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
  const sources = [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }, { id: 'other', path: 'src/other.bas', cpcName: 'OTHER.BAS' }, { id: 'helper', path: 'src/helper.bas', cpcName: 'HELPER.BAS' }];
  const texts = ['10 REM @CPCTEST 1 Score\n20 END', '10 REM @CPCTEST 1 Bonus\n20 END', '10 PRINT "Ordinary listing"\n20 END'];
  window.testScope = 'tests'; window.testPrepares = []; window.testWorkers = []; window.testStops = 0; window.testMode = 'passed';
  window.confirm = () => true;
  window.desktop = { setDirty() {}, project: { open: async () => ({ sessionId: window.testScope, manifest: { name: 'Tests', entryPoint: 'main', sources, documents: [] }, files: sources.map((s, i) => ({ ...s, source: texts[i] })) }) }, emulator: { prepare: async request => {
   window.testPrepares.push(request);
   if (window.holdTestPrepare) await new Promise(resolve => { window.releaseTestPrepare = resolve; });
   return window.missingTestRoms ? { error: 'ROM manquantes (transport contrôlé).' } : { label: 'controlled' };
  } } };
  const nativeTimeout = window.setTimeout;
  window.setTimeout = (fn, delay, ...args) => nativeTimeout(fn, window.fastTestTimeout && delay === 60000 ? 100 : delay, ...args);
  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, { construct(Target, args) {
   if (!String(args[0]).includes('basic-test-worker')) return new Target(...args);
   const worker = { onmessage: null, onerror: null, terminate() { window.testStops++; }, postMessage(message) {
    worker.message = message;
    if (window.testMode === 'hold') return;
    queueMicrotask(() => worker.onmessage?.({ data: { id: message.id, result: {
     sourceId: message.source.id, name: message.source.name, outcome: window.testMode, message: 'Résultat du transport contrôlé.', emulatedSeconds: 6,
     cases: [{ slot: 1, line: 1, name: message.source.source.includes('Bonus') ? 'Bonus' : 'Score', outcome: window.testMode, observed: window.testMode === 'passed' ? 1 : 2 }], sourceSha256: 'a'.repeat(64), diskSha256: 'b'.repeat(64),
    } } }));
   } }; window.testWorkers.push(worker); return worker;
  } });
 });
 try {
  await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  const menus = page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true });
  await menus.getByRole('button', { name: 'BASIC', exact: true }).click(); await page.getByRole('menuitem', { name: 'Tests BASIC à la demande…', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Tests BASIC', exact: true });
  await expect(panel).toContainText('Ouvrez un listing de test'); assert.equal(await page.evaluate(() => window.testPrepares.length), 0);
  await panel.getByLabel('Listings à tester').selectOption('loaded'); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect(panel).toContainText('2/2 listings terminés'); await expect(panel.locator('article')).toHaveCount(2);
  assert.equal(await page.evaluate(() => window.testPrepares.length), 2); assert.equal(await page.evaluate(() => window.testStops), 2);
  assert.ok(await page.evaluate(() => window.testPrepares.every(value => Object.keys(value).length === 1 && typeof value.source === 'string')), 'Standalone immutable listings, not project entry point');
  await expect(page.getByRole('tab', { name: /src\/main.bas/ })).not.toContainText('*');
  const downloading = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Exporter JSON', exact: true }).click();
  const download = await downloading, chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(report.results.length, 2); assert.equal(report.stale, false); assert.equal(report.running, false); assert.ok(!JSON.stringify(report).includes('20 END'));
  await mkdir('out', { recursive: true }); await page.getByRole('button', { name: 'Agrandir les sorties', exact: true }).click();
  await panel.getByRole('heading', { name: 'Tests BASIC à la demande', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'out/basic-tests-browser.png' });
  await page.getByRole('button', { name: 'Restaurer les sorties', exact: true }).click();
  const input = page.locator('.listing .monaco-editor textarea'); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n30 REM changed');
  await expect(panel).toContainText('Rapport obsolète'); assert.equal(await page.evaluate(() => window.testPrepares.length), 2, 'Typing does not run tests');
  await panel.getByLabel('Listings à tester').selectOption('active'); await page.evaluate(() => { window.testMode = 'failed'; });
  await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click(); await expect(panel.getByRole('heading', { level: 3 })).toContainText('Échoué');
  await page.evaluate(() => { window.testMode = 'hold'; }); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect(panel).toContainText('Tests en cours'); await expect.poll(() => page.evaluate(() => window.testWorkers.length)).toBe(4);
  await page.evaluate(() => { window.oldTestHandler = window.testWorkers.at(-1).onmessage; window.oldTestMessage = window.testWorkers.at(-1).message; });
  await panel.getByRole('button', { name: 'Annuler les tests', exact: true }).click(); await expect(panel).toContainText('Tests annulés'); assert.equal(await page.evaluate(() => window.testStops), 4);
  await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await page.evaluate(() => window.oldTestHandler({ data: { id: window.oldTestMessage.id, result: { sourceId: window.oldTestMessage.source.id, name: 'old', outcome: 'passed', cases: [], emulatedSeconds: 0 } } }));
  await expect(panel).toContainText('Tests en cours'); await expect(panel.locator('article')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.testWorkers.length)).toBe(5);
  await page.evaluate(() => window.testWorkers.at(-1).onerror({ preventDefault() {} })); await expect(panel).toContainText('Worker de tests interrompu'); assert.equal(await page.evaluate(() => window.testStops), 5);
  await page.evaluate(() => { window.fastTestTimeout = true; }); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect(panel).toContainText('Délai réel de 60 secondes'); assert.equal(await page.evaluate(() => window.testStops), 6);
  await page.evaluate(() => { window.fastTestTimeout = false; window.missingTestRoms = true; }); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect(panel).toContainText('ROM manquantes'); assert.equal(await page.evaluate(() => window.testWorkers.length), 6);
  // Cancel during asynchronous preparation; the late image must not spawn a worker.
  await page.evaluate(() => { window.missingTestRoms = false; window.holdTestPrepare = true; }); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof window.releaseTestPrepare)).toBe('function'); await panel.getByRole('button', { name: 'Annuler les tests', exact: true }).click();
  await page.evaluate(() => { window.releaseTestPrepare(); window.holdTestPrepare = false; }); await expect(panel).toContainText('Tests annulés'); assert.equal(await page.evaluate(() => window.testWorkers.length), 6);
  // Clean the draft, start again, replace project while IDs and contents are unchanged.
  await input.focus(); await page.keyboard.press('Control+z'); await panel.getByRole('button', { name: 'Exécuter les tests BASIC', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testWorkers.length)).toBe(7);
  await page.evaluate(() => { window.testScope = 'next-tests'; }); await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  await expect(panel).toContainText('Ouvrez un listing de test'); assert.equal(await page.evaluate(() => window.testStops), 7);
  const exampleDownloading = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Télécharger un exemple de tests', exact: true }).click();
  const exampleFile = await exampleDownloading, exampleChunks = []; for await (const chunk of await exampleFile.createReadStream()) exampleChunks.push(chunk);
  assert.ok(Buffer.concat(exampleChunks).toString('utf8').includes('MEMORY &7FFF')); await expect(page.getByRole('tab', { name: /src\/main.bas/ })).not.toContainText('*');
 } finally { await page.close(); }
}
