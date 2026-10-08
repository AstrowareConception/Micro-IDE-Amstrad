import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
export async function verifyBasicQuality(browser, errors) {
 const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, acceptDownloads: true }); page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
  const sources = [{ id: 'main', path: 'src/main.bas', cpcName: 'MAIN.BAS' }, { id: 'util', path: 'src/util.bas', cpcName: 'UTIL.BAS' }];
  const texts = ['10 A=1:B=2:C=3:D=4:E=5\n20 GOTO100:PRINT 1\n100 END', '10 A=A+1:B=B+2\n20 PRINT "SCORE";A;B\n30 REM pause\n40 A=A+1:B=B+2\n50 PRINT "SCORE";A;B\n60 IF A THEN IF B THEN IF C THEN PRINT 1\n70 PRINT "' + 'X'.repeat(130) + '"'];
  window.qualityScope = 'quality';
  window.desktop = { setDirty() {}, project: { open: async () => ({ sessionId: window.qualityScope, manifest: { name: 'Quality', entryPoint: 'main', sources, documents: [] }, files: sources.map((s, i) => ({ ...s, source: texts[i] })) }) } };
  window.qualityRequests = 0; window.qualityStops = 0; window.qualityWorkers = [];
  const nativeTimeout = window.setTimeout; window.setTimeout = (fn, delay, ...args) => nativeTimeout(fn, window.qualityTimeout && delay === 15000 ? 0 : delay, ...args);
  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, { construct(Target, args) {
   const worker = new Target(...args);
   if (String(args[0]).includes('quality-worker')) {
    window.qualityWorkers.push(worker); const post = worker.postMessage.bind(worker), terminate = worker.terminate.bind(worker);
    worker.postMessage = (...values) => { window.qualityRequests++; if (!window.holdQuality) post(...values); };
    worker.terminate = () => { window.qualityStops++; terminate(); };
   }
   return worker;
  } });
 });
 try {
  await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  assert.equal(await page.evaluate(() => window.qualityRequests), 0);
  const menus = page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true });
  await menus.getByRole('button', { name: 'BASIC', exact: true }).click(); await page.getByRole('menuitem', { name: 'Rapport de qualité BASIC…', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Qualité du code BASIC', exact: true });
  await expect(panel).toContainText('Choisissez le périmètre'); assert.equal(await page.evaluate(() => window.qualityRequests), 0);
  await panel.getByLabel('Périmètre du rapport').selectOption('loaded'); await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await expect(panel).toContainText('Rapport sur les sources inchangées.'); await expect(panel.locator('.quality-metrics tbody tr')).toHaveCount(2);
  for (const code of ['dense-line', 'unreachable-tail', 'duplicate-block', 'conditional-density', 'long-line']) await expect(panel).toContainText(code);
  assert.equal(await page.evaluate(() => window.qualityRequests), 1); assert.equal(await page.evaluate(() => window.qualityStops), 1);
  const download = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Exporter JSON', exact: true }).click();
  const file = await download, chunks = []; for await (const c of await file.createReadStream()) chunks.push(c);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(exported.stale, false); assert.equal(exported.report.sources.length, 2); assert.ok(exported.report.sources[1].findings.some(f => f.code === 'duplicate-block'));
  assert.ok(!JSON.stringify(exported).includes('SCORE'), 'Exports omit source code');
  await mkdir('out', { recursive: true }); await page.getByRole('button', { name: 'Agrandir les sorties', exact: true }).click();
  await panel.getByRole('heading', { name: 'Qualité du code BASIC', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'out/basic-quality-browser.png' }); await page.getByRole('button', { name: 'Restaurer les sorties', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer l’onglet src/util.bas', exact: true }).click(); await expect(page.getByRole('tab', { name: /src\/util.bas/ })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Autre occurrence · L4 · BASIC 40', exact: true }).click();
  await expect(page.getByRole('tab', { name: /src\/util.bas/ })).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('footer')).toContainText('L4 · C');
  const input = page.locator('.listing .monaco-editor textarea'); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n80 PRINT "CHANGED"');
  await expect(panel).toContainText('Rapport obsolète'); await expect(panel.getByRole('button', { name: 'Autre occurrence · L4 · BASIC 40', exact: true })).toBeDisabled();
  assert.equal(await page.evaluate(() => window.qualityRequests), 1, 'Typing does not trigger quality analysis');
  const mdDownload = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Exporter Markdown', exact: true }).click(); const mdFile = await mdDownload, mdChunks = [];
  for await (const c of await mdFile.createReadStream()) mdChunks.push(c); const markdown = Buffer.concat(mdChunks).toString('utf8');
  assert.ok(markdown.includes('obsolète')); assert.ok(markdown.includes('Complexité cyclomatique estimée')); assert.ok(markdown.includes('BASIC 40'));
  // Cancel and failure release the disposable worker; retry needs a user action.
  await page.evaluate(() => { window.holdQuality = true; }); await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await page.evaluate(() => { window.oldQualityHandler = window.qualityWorkers.at(-1).onmessage; });
  await panel.getByRole('button', { name: 'Annuler l’analyse', exact: true }).click(); await expect(panel).toContainText('Analyse annulée.');
  assert.equal(await page.evaluate(() => window.qualityStops), 2);
  await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await page.evaluate(() => window.oldQualityHandler({ data: { id: 2, report: { sources: [] } } }));
  await expect(panel).toContainText('Analyse de qualité en cours…'); await expect(panel.locator('.quality-metrics tbody tr')).toHaveCount(0);
  await page.evaluate(() => { window.qualityWorkers.at(-1).dispatchEvent(new ErrorEvent('error', { message: 'test failure' })); }); await expect(panel).toContainText('Analyse de qualité indisponible.');
  await page.evaluate(() => { window.holdQuality = false; }); await panel.getByLabel('Périmètre du rapport').selectOption('active'); await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await expect(panel.locator('.quality-metrics tbody tr')).toHaveCount(1); await expect(panel).toContainText('Rapport sur les sources inchangées.');
  assert.equal(await page.evaluate(() => window.qualityRequests), 4); assert.equal(await page.evaluate(() => window.qualityStops), 4);
  // Leaving the pane keeps the snapshot, without launching another scan.
  await page.getByRole('button', { name: /^Problèmes \d/ }).click(); await page.getByRole('navigation', { name: 'Panneaux de sortie', exact: true }).getByRole('button', { name: 'Qualité', exact: true }).click(); await expect(panel.locator('.quality-metrics tbody tr')).toHaveCount(1);
  assert.equal(await page.evaluate(() => window.qualityRequests), 4);
  await page.evaluate(() => { window.holdQuality = true; window.qualityTimeout = true; }); await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await expect(panel).toContainText('Analyse interrompue après 15 secondes.'); assert.equal(await page.evaluate(() => window.qualityStops), 5);
  await page.evaluate(() => { window.qualityTimeout = false; }); await panel.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  // Project replacement cancels even when the new project has identical source IDs/content.
  await input.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 A=A+1:B=B+2\n20 PRINT "SCORE";A;B\n30 REM pause\n40 A=A+1:B=B+2\n50 PRINT "SCORE";A;B\n60 IF A THEN IF B THEN IF C THEN PRINT 1\n70 PRINT "' + 'X'.repeat(130) + '"');
  await page.evaluate(() => { window.qualityScope = 'quality-next'; }); await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  await expect(panel).toContainText('Choisissez le périmètre'); assert.equal(await page.evaluate(() => window.qualityStops), 6);
 } finally { await page.close(); }
}
