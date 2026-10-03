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

  // Exercise the real main/preload/UI and actual Responses adapter with a controlled transport.
  // No OpenAI request, real key, paid generation or fixture-enabled production route.
  const checkpointBaseline = await readFile(join(moved, 'src/main.bas'), 'utf8');
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n40 REM USER DRAFT');
  const originalDraft = checkpointBaseline + '\n40 REM USER DRAFT';
  await desktop.evaluate(async () => {
    let step = 0;
    globalThis.fetch = async (url, init) => {
      if (url !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected endpoint');
      const body = JSON.parse(init.body);
      if (body.store !== false || body.parallel_tool_calls !== false || !body.tools.every(tool => tool.strict)) throw new Error('Wrong request contract');
      const call = (id, name, args) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
      const output = [];
      if (step === 0) {
        await new Promise((resolve, reject) => { globalThis.__agentTestRelease = resolve; init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }); });
        output.push(call('list', 'project_list_files', {}));
      } else if (step === 1) output.push(call('read', 'project_read_file', { id: 'main', startLine: 1, endLine: 200 }));
      else if (step === 2) { output.push(call('print', 'reference_read', { id: 'PRINT', startLine: 1, endLine: 1 }), call('end', 'reference_read', { id: 'END', startLine: 1, endLine: 1 })); }
      else if (step === 3) {
        const read = body.input.filter(item => item.type === 'function_call_output').map(item => JSON.parse(item.output)).find(item => item.id === 'main' && item.text);
        if (!read?.text.includes('USER DRAFT')) throw new Error('Initial dirty buffer was lost');
        output.push(call('replace', 'project_replace_source', { id: 'main', expectedHash: read.hash, source: '10 PRINT "AGENT"\n20 END\n' }),
          call('create', 'project_create_source', { name: 'HELP', source: '10 PRINT "HELPER"\n20 END\n' }));
      } else if (step === 4) output.push(call('analyze', 'language_analyze', {}));
      else if (step === 5) output.push(call('build', 'build_project', {}));
      else output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Mission contrôlée : sources créées, DSK construit et relu. Aucun CPC exécuté.' }] });
      step++;
      return Response.json({ status: 'completed', output, usage: { total_tokens: 5 } });
    };
  });
  await page.getByLabel('Clé API OpenAI', { exact: true }).fill('sk-test-fixture-not-real');
  await page.getByRole('button', { name: 'Configurer la clé', exact: true }).click();
  await expect(page.getByLabel('Clé API OpenAI', { exact: true })).toHaveValue('');
  await page.getByLabel('Mission de programmation', { exact: true }).fill('Crée un titre et un programme auxiliaire, puis construis le DSK.');
  await page.getByRole('button', { name: 'Lancer l’agent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Arrêter l’agent', exact: true })).toBeEnabled();
  const concurrent = await page.evaluate(() => window.desktop.save('10 END'));
  assert.match(concurrent.error, /mission agent/);
  await desktop.evaluate(() => globalThis.__agentTestRelease());
  await page.locator('.agent-result').getByText(/^completed ·/).waitFor();
  await page.getByRole('tab', { name: 'src/help.bas', exact: true }).waitFor();
  assert.equal(await readFile(join(moved, 'src/main.bas'), 'utf8'), '10 PRINT "AGENT"\n20 END\n');
  assert.equal(await readFile(join(moved, 'src/help.bas'), 'utf8'), '10 PRINT "HELPER"\n20 END\n');
  assert.equal(JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8')).sources.length, 3);
  const checkpoints = await desktop.evaluate(async ({ app }) => {
    const { readdir, readFile } = await import('node:fs/promises'); const { join } = await import('node:path');
    const directory = join(app.getPath('userData'), 'agent-checkpoints');
    return Promise.all((await readdir(directory)).map(id => readFile(join(directory, id, 'checkpoint.json'), 'utf8')));
  });
  assert.ok(checkpoints.some(text => text.includes('USER DRAFT')));
  assert.ok(checkpoints.every(text => !text.includes('sk-test-fixture-not-real')));
  await page.locator('.agent-result summary').click();
  await expect(page.locator('.agent-result')).toContainText('Avant');
  await page.screenshot({ path: 'out/agent-alpha.png' });
  // Do not overwrite a manual change made after the mission.
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).click();
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('X');
  await page.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true }).click();
  await page.locator('.agent-notice').filter({ hasText: /modifications manuelles postérieures/ }).waitFor();
  assert.equal(await readFile(join(moved, 'src/main.bas'), 'utf8'), '10 PRINT "AGENT"\n20 END\n');
  await input.focus(); await page.keyboard.press('Control+z');
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true }).click();
  await page.locator('.agent-notice').filter({ hasText: /Checkpoint initial restauré/ }).waitFor();
  assert.equal(await readFile(join(moved, 'src/main.bas'), 'utf8'), checkpointBaseline);
  await expect(page.getByRole('tab', { name: 'src/help.bas', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /src\/main.bas.*modifié/ }).click();
  // A native save proves the initial dirty buffer was restored alongside original disk contents.
  await page.getByRole('button', { name: /^Enregistrer Ctrl/ }).click();
  await page.getByRole('status').filter({ hasText: /Listing enregistré/ }).waitFor();
  assert.equal(await readFile(join(moved, 'src/main.bas'), 'utf8'), originalDraft);

  // Cancel a pending generation. The controlled fetch rejects on AbortSignal.
  await desktop.evaluate(() => { globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })); });
  // Reconfigure so the adapter captures the new controlled transport.
  await page.getByLabel('Clé API OpenAI', { exact: true }).fill('sk-test-fixture-not-real');
  await page.getByRole('button', { name: 'Configurer la clé', exact: true }).click();
  await page.getByRole('button', { name: 'Lancer l’agent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Arrêter l’agent', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Arrêter l’agent', exact: true }).click();
  await page.locator('.agent-result').getByText(/^cancelled ·/).waitFor();
  await page.getByRole('button', { name: 'Oublier la clé', exact: true }).click();
  await page.locator('.agent-notice').filter({ hasText: 'Clé oubliée.' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Electron smoke: projects plus OpenAI controlled transport, secret clearing, tools, dirty context, persisted edits/create, journal, structural build, before/after, conflict-safe checkpoint restoration and cancellation passed. No live API or CPC execution claimed.');
} catch (error) {
  await mkdir('out', { recursive: true });
  await page?.screenshot({ path: 'out/desktop-failure.png', timeout: 5000 }).catch(() => undefined);
  throw error;
} finally {
  // Only the test application is destroyed; fixture directory is intentionally retained for debugging.
  await desktop.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }).catch(() => undefined);
  await desktop.close();
}
