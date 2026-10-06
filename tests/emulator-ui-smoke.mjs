import assert from 'node:assert/strict';
import { chromium, _electron as electron, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { runDisk } from '../packages/emulator/src/run.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';
const romRoot = process.env.CPC_TEST_ROM_DIR;
if (!romRoot) throw new Error('CPC_TEST_ROM_DIR requis pour cette recette réelle.');
const source = '10 MODE 1:PRINT "EXECUTION CPC OK"\n20 POKE &8000,165\n30 END\n';
const reference = JSON.parse(await readFile('out/firmware-runtime.json', 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'cpceleste-emulator-')), browserMode = process.env.CPC_UI_MODE === 'browser';
let desktop, browser, server, page;
const errors = [];
try {
  if (browserMode) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'apps/desktop/vite.config.ts', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Preview timeout')), 15000); server.stdout.on('data', data => { if (String(data).includes('127.0.0.1')) { clearTimeout(timeout); resolve(); } }); server.once('exit', reject); });
    browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    let configured = false; const roms = {}; for (const role of ['os', 'basic', 'amsdos']) roms[role] = [...await readFile(join(romRoot, `cpc6128_${role}.bin`))];
    await page.exposeFunction('prepareCpc', request => { if (!configured) return { error: 'ROM CPC manquantes ou invalides : importez OS, BASIC 1.1 et AMSDOS dans Configuration ROM avant Exécuter.' }; const image = runDisk(request); return { ...image, disk: [...image.disk], sha256: createHash('sha256').update(image.disk).digest('hex'), label: 'Listing courant', roms, firmware: reference.firmware }; });
    await page.exposeFunction('configureCpc', () => { configured = true; });
    await page.addInitScript(() => { window.desktop = { setDirty() {}, emulator: { prepare: async request => { const value = await window.prepareCpc(request); if ('error' in value) return value; value.disk = new Uint8Array(value.disk); for (const role of ['os', 'basic', 'amsdos']) value.roms[role] = new Uint8Array(value.roms[role]); return value; } } }; });
    await page.goto('http://127.0.0.1:5173');
  } else {
    desktop = await electron.launch({ args: ['.'], timeout: 30000, env: { ...process.env, XDG_CONFIG_HOME: join(temporary, 'config') } }); page = await desktop.firstWindow();
  }
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'CPCéleste', exact: true }).waitFor();
  const run = page.getByRole('button', { name: /^Exécuter F5$/ });
  await run.click(); const machine = page.getByRole('dialog', { name: 'Émulateur CPC 6128', exact: true }); await expect(machine).toContainText('ROM CPC manquantes');
  await machine.getByRole('button', { name: 'Configurer les ROM', exact: true }).click(); await expect(machine).toHaveCount(0);
  if (browserMode) await page.evaluate(() => window.configureCpc());
  else {
    for (const [role, label] of [['os', 'OS CPC'], ['basic', 'BASIC 1.1'], ['amsdos', 'AMSDOS']]) {
      await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, join(romRoot, `cpc6128_${role}.bin`));
      const importButton = page.getByRole('button', { name: `Importer ${label}`, exact: true });
      await importButton.click(); await expect(page.locator('.firmware-notice')).toContainText('ROM importée');
      await expect(importButton).toBeEnabled();
      await expect(importButton.locator('..')).toContainText('Disponible');
    }
    await expect(page.getByRole('region', { name: 'Configuration ROM CPC', exact: true })).toContainText('Jeu complet');
    assert.match((await page.evaluate(() => window.desktop.emulator.prepare({ source: '10 END', path: '/tmp/forbidden' }))).error, /Listing d’exécution UTF-8/);
  }
  const editor = page.locator('.listing .monaco-editor textarea'); await editor.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(source);
  await page.keyboard.press('F5'); await expect(machine).toContainText('Commande RUN"MAIN.BAS" envoyée', { timeout: 30000 });
  const screen = machine.getByLabel('Écran et clavier du CPC', { exact: true });
  async function screenPrefix() { return screen.evaluate(async canvas => { const data = canvas.getContext('2d').getImageData(0, 0, 768, 52).data; const bytes = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join(''); }); }
  await expect.poll(screenPrefix, { timeout: 30000 }).toBe(reference.outputFramePrefix);
  await page.screenshot({ path: `out/emulator-${browserMode ? 'browser' : 'desktop'}-alpha.png` });
  await machine.getByRole('button', { name: 'Pause CPC', exact: true }).click(); await expect(machine).toContainText('En pause');
  await machine.getByText('Inspection CPC en pause', { exact: true }).click();
  const inspect = machine.getByRole('button', { name: 'Lire les registres et la RAM', exact: true });
  await inspect.click();
  const inspected = machine.getByRole('region', { name: 'État CPC inspecté', exact: true });
  await expect(inspected).toContainText('Instant de lecture');
  await expect(inspected.locator('tbody tr').first()).toContainText('&8000');
  await expect(inspected.locator('tbody tr').first().locator('td').first()).toContainText(/^A5 /);
  await machine.getByLabel('Adresse RAM hexadécimale', { exact: true }).fill('10000');
  await expect(inspect).toBeDisabled();
  await machine.getByLabel('Adresse RAM hexadécimale', { exact: true }).fill('FFFF'); await inspect.click();
  await expect(inspected.locator('tbody tr')).toHaveCount(1);
  await expect(inspected.locator('tbody tr th')).toContainText('&FFFF');
  await expect(inspected.locator('tbody tr td').first()).toHaveText(/^[A-F0-9]{2}$/);
  await machine.getByLabel('Adresse RAM hexadécimale', { exact: true }).fill('8000'); await inspect.click();
  await expect(inspected.locator('tbody tr').first()).toContainText('&8000');
  const clock = (await machine.innerText()).match(/([\d.]+) s émulées/)[1]; await page.waitForTimeout(300); assert.equal((await machine.innerText()).match(/([\d.]+) s émulées/)[1], clock);
  const dock = page.locator('.output-dock'), originalSize = await screen.boundingBox();
  await page.evaluate(() => { window.originalCpcCanvas = document.querySelector('.emulator-window canvas'); });
  await page.getByRole('button', { name: 'Détacher les sorties', exact: true }).click();
  await expect(dock).toHaveAttribute('data-floating', 'true');
  await page.screenshot({ path: `out/cpc-inspection-${browserMode ? 'browser' : 'desktop'}.png` });
  await machine.getByText('Inspection CPC en pause', { exact: true }).click();
  await expect.poll(async () => (await screen.boundingBox()).height).toBeGreaterThan(originalSize.height + 150);
  const controls = await machine.locator('.emulator-command-column').boundingBox(), displayed = await screen.boundingBox();
  assert.ok(controls.x + controls.width < displayed.x, 'Controls are left of the CPC screen');
  await machine.getByRole('combobox', { name: 'Taille de l’écran CPC', exact: true }).selectOption('2');
  await expect.poll(async () => (await screen.boundingBox()).width).toBe(1536);
  await machine.getByRole('combobox', { name: 'Taille de l’écran CPC', exact: true }).selectOption('fit');
  await dock.getByRole('button', { name: 'Agrandir les sorties', exact: true }).click();
  await expect.poll(async () => (await screen.boundingBox()).height).toBeGreaterThan(600);
  await dock.getByRole('button', { name: 'Restaurer les sorties', exact: true }).click();
  await dock.getByRole('button', { name: 'Réancrer les sorties', exact: true }).click();
  assert.ok(await page.evaluate(() => window.originalCpcCanvas === document.querySelector('.emulator-window canvas')));
  assert.equal((await machine.innerText()).match(/([\d.]+) s émulées/)[1], clock, 'Docking preserves the paused machine');
  assert.equal(await screenPrefix(), reference.outputFramePrefix);

  let exported;
  if (browserMode) {
    const downloaded = page.waitForEvent('download'); await machine.getByRole('button', { name: 'Exporter la disquette de session', exact: true }).click(); exported = await (await downloaded).path();
  } else {
    exported = join(temporary, 'session-cpc.dsk');
    await desktop.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, exported);
    await machine.getByRole('button', { name: 'Exporter la disquette de session', exact: true }).click(); await expect(machine).toContainText('Disquette de session exportée');
    assert.ok((await page.evaluate(() => window.desktop.emulator.exportDisk(new Uint8Array(1)))).error);
  }
  const files = readDataDisk(new Uint8Array(await readFile(exported))); assert.equal(new TextDecoder().decode(decodeAsciiRecords(files[0].records)).replace(/\r\n/g, '\n').replace(/\x1a$/, ''), source);
  await machine.getByRole('button', { name: 'Reprendre le CPC', exact: true }).click(); await expect(machine).toContainText('Machine active');
  await machine.getByText('Inspection CPC en pause', { exact: true }).click();
  await expect(inspected).toHaveCount(0); await expect(inspect).toBeDisabled();
  // Relaunch uses edited buffers, disposes the prior worker and keeps the editor dirty.
  await editor.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 MODE 1:PRINT "SECOND RUN"\n20 END\n'); await page.keyboard.press('F5');
  await expect(machine).toContainText('Commande RUN"MAIN.BAS" envoyée', { timeout: 30000 }); await expect.poll(screenPrefix, { timeout: 15000 }).not.toBe(reference.outputFramePrefix);
  await machine.getByRole('button', { name: 'Arrêter et fermer le CPC', exact: true }).click(); await expect(machine).toHaveCount(0); await expect(page.locator('.tabs')).toContainText('modifié');
  if (!browserMode) {
    const projectRoot = join(temporary, 'project'); await mkdir(join(projectRoot, 'src'), { recursive: true });
    const manifest = newProject('Exécution multifichier', randomUUID()); manifest.sources.push({ id: 'other', path: 'src/other.bas', cpcName: 'OTHER.BAS' }); manifest.entryPoint = 'other';
    await writeFile(join(projectRoot, 'microide.project.json'), JSON.stringify(manifest)); await writeFile(join(projectRoot, 'src/main.bas'), '10 REM MAIN DISK\n20 END\n'); await writeFile(join(projectRoot, 'src/other.bas'), '10 REM OLD DISK\n20 END\n');
    await desktop.evaluate(({ dialog }, path) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, projectRoot);
    // Choose deliberate discard for the fixture switch; Electron native dialogs are covered by the desktop suite.
    await page.evaluate(() => { window.confirm = () => true; });
    await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click(); await page.getByRole('tab', { name: 'src/other.bas', exact: true }).click();
    await editor.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(source); await run.click(); await expect(machine).toContainText('Commande RUN"OTHER.BAS" envoyée', { timeout: 30000 }); await expect.poll(screenPrefix, { timeout: 30000 }).toBe(reference.outputFramePrefix);
    assert.equal(await readFile(join(projectRoot, 'src/other.bas'), 'utf8'), '10 REM OLD DISK\n20 END\n');
    await desktop.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, join(projectRoot, 'src/other.bas'));
    await machine.getByRole('button', { name: 'Exporter la disquette de session', exact: true }).click(); await expect(machine).toContainText('hors du dossier projet');
    assert.equal(await readFile(join(projectRoot, 'src/other.bas'), 'utf8'), '10 REM OLD DISK\n20 END\n');
    assert.ok((await page.evaluate(() => window.desktop.emulator.prepare({ sessionId: 'expired', sources: [] }))).error);
    await machine.getByRole('button', { name: 'Arrêter et fermer le CPC', exact: true }).click();
    const forbidden = await desktop.evaluate(async ({ net }) => [await net.fetch('cpceleste://app/../../package.json').then(r => r.status), await net.fetch('cpceleste://other/index.html').then(r => r.status)]); assert.deepEqual(forbidden, [403, 403]);
  }
  assert.deepEqual(errors, []); console.log(`Real CPC ${browserMode ? 'browser worker' : 'Electron'} run: missing ROM guidance, dirty F5 launch, recognised Ready, exact PRINT pixels, pause/resume, mutable disk export, relaunch/dispose${browserMode ? '' : ', multifile entry, unchanged sources and stale IPC/static boundary'} passed.`);
} catch (error) { await page?.screenshot({ path: 'out/emulator-failure.png' }).catch(() => undefined); throw error; }
finally { if (desktop) { await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => undefined); await desktop.close().catch(() => undefined); } await browser?.close(); server?.kill(); }
