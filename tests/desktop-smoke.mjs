import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { png, chunk } from './image-fixtures.ts';
import { pdfFixture } from './pdf-fixtures.ts';
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
  // The native editor refactors its buffer only, with one undo element and revision guard.
  await input.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 GOTO 100\n100 END');
  await page.getByRole('button', { name: 'Renuméroter', exact: true }).click();
  const renumber = page.getByRole('region', { name: 'Renumérotation BASIC' });
  await renumber.getByLabel('Premier nouveau numéro', { exact: true }).fill('1000');
  await renumber.getByRole('button', { name: 'Prévisualiser la renumérotation', exact: true }).click();
  await renumber.getByRole('button', { name: 'Appliquer la renumérotation', exact: true }).click();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('1000 GOTO 1010');
  assert.equal(await readFile(listing, 'utf8'), '10 REM EXTERNAL\n20 END\n');
  await input.focus(); await page.keyboard.press('Control+z');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('10 GOTO 100');
  await renumber.getByRole('button', { name: 'Prévisualiser la renumérotation', exact: true }).click();
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText(':REM CHANGED');
  await renumber.getByRole('button', { name: 'Appliquer la renumérotation', exact: true }).click();
  await expect(renumber).toContainText('révision modifié depuis l’aperçu');
  await renumber.getByRole('button', { name: 'Fermer la renumérotation', exact: true }).click();
  await input.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('10 PRINT "MODIFIED"\n20 END\n');
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

  await page.getByRole('tab', { name: 'src/main.bas', exact: true }).click();
  await page.getByRole('button', { name: 'Renuméroter', exact: true }).click();
  await renumber.getByLabel('Premier nouveau numéro', { exact: true }).fill('1000');
  await renumber.getByRole('button', { name: 'Prévisualiser la renumérotation', exact: true }).click();
  await page.getByRole('tab', { name: 'src/util.bas', exact: true }).click();
  await renumber.getByRole('button', { name: 'Appliquer la renumérotation', exact: true }).click();
  await expect(renumber).toContainText('Document ou révision modifié');
  await renumber.getByRole('button', { name: 'Fermer la renumérotation', exact: true }).click();

  // Exercise the real main/preload/UI and actual Responses adapter with a controlled transport.
  // No OpenAI request, real key, paid generation or fixture-enabled production route.
  const checkpointBaseline = await readFile(join(moved, 'src/main.bas'), 'utf8');
  await page.getByRole('tab', { name: 'src/main.bas', exact: true }).click();
  await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('\n40 REM USER DRAFT');
  const originalDraft = checkpointBaseline + '\n40 REM USER DRAFT';
  // Import through the native selector, preserve the dirty buffer and show Markdown as inert text.
  const briefPath = join(temporary, 'Cahier-jeu.md');
  const brief = '# TITRE DU JEU\r\n<script>window.documentInjected=true</script>\r\nTitre en MODE 1\r\nPRIVATE UNREAD LAST LINE';
  await writeFile(briefPath, brief);
  const documentsPanel = page.getByRole('region', { name: 'Documents du projet' });
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, briefPath);
  await documentsPanel.getByRole('button', { name: 'Importer TXT / Markdown', exact: true }).click();
  await expect(documentsPanel).toContainText('Original copié et vérifié');
  await expect(page.getByRole('tab', { name: /src\/main.bas.*modifié/ })).toBeVisible();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('USER DRAFT');
  await documentsPanel.getByRole('button', { name: 'Cahier-jeu.md', exact: true }).click();
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue(brief.replace(/\r\n/g, '\n'));
  assert.equal(await page.evaluate(() => window.documentInjected), undefined);
  let importedManifest = JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8'));
  const imported = importedManifest.documents[0];
  assert.equal(imported.sha256, createHash('sha256').update(brief).digest('hex'));
  assert.equal(await readFile(join(moved, imported.path), 'utf8'), brief);
  await writeFile(briefPath, 'EXTERNAL ORIGINAL CHANGED');
  await documentsPanel.getByRole('button', { name: 'Cahier-jeu.md', exact: true }).click();
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue(brief.replace(/\r\n/g, '\n'));
  const forbiddenDocument = await page.evaluate(() => window.desktop.project.readDocument('stale-session', '../../secret'));
  assert.match(forbiddenDocument.error, /périmée/);
  await documentsPanel.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'out/documents-alpha.png' });
  const imageBytes = png(), imagePath = join(temporary, 'Titre.png');
  await writeFile(imagePath, imageBytes);
  const jpegBytes = Buffer.from(await desktop.evaluate(({ nativeImage }, raw) => [...nativeImage.createFromBuffer(Buffer.from(raw)).toJPEG(85)], [...imageBytes]));
  const jpegPath = join(temporary, 'Titre.jpg'); await writeFile(jpegPath, jpegBytes);
  for (const path of [imagePath, jpegPath]) {
    await desktop.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, path);
    await documentsPanel.getByRole('button', { name: 'Importer image PNG / JPEG', exact: true }).click();
    const name = path.split(/[\\/]/).at(-1);
    await documentsPanel.getByRole('button', { name, exact: true }).click();
    const preview = documentsPanel.getByRole('img', { name: `Aperçu de ${name}`, exact: true });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveJSProperty('naturalWidth', 320);
    const src = await preview.getAttribute('src');
    assert.ok(src.startsWith('data:image/png;base64,'));
    assert.ok(!Buffer.from(src.split(',')[1], 'base64').includes(Buffer.from('PRIVATE_IMAGE_METADATA')));
    await expect(documentsPanel).toContainText('320 × 200 pixels');
  }
  await documentsPanel.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'out/images-alpha.png' });
  importedManifest = JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8'));
  assert.equal(importedManifest.documents.length, 3);
  assert.deepEqual(await readFile(join(moved, importedManifest.documents[1].path)), imageBytes);
  // A structurally valid PNG with corrupt compressed pixels reaches and fails the real decoder.
  const brokenPath = join(temporary, 'Broken.png');
  await writeFile(brokenPath, Buffer.concat([imageBytes.subarray(0, 33), chunk('IDAT', Buffer.from('NOT ZLIB')), chunk('IEND', Buffer.alloc(0))]));
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, brokenPath);
  await documentsPanel.getByRole('button', { name: 'Importer image PNG / JPEG', exact: true }).click();
  await expect(documentsPanel).toContainText('Image non décodable');
  assert.deepEqual(JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8')), importedManifest);
  const pdfBytes = pdfFixture(), pdfPath = join(temporary, 'Regles.pdf'); await writeFile(pdfPath, pdfBytes);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, pdfPath);
  await documentsPanel.getByRole('button', { name: 'Importer PDF', exact: true }).click();
  await expect(documentsPanel).toContainText('Original copié et vérifié');
  await documentsPanel.getByRole('button', { name: 'Regles.pdf', exact: true }).click();
  await expect(documentsPanel).toContainText('Page 1 sur 2');
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue('TITRE PDF\nRegles originales');
  await documentsPanel.getByRole('button', { name: 'Page suivante', exact: true }).click();
  await expect(documentsPanel).toContainText('Page 2 sur 2');
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue('PRIVATE UNREAD PDF PAGE');
  await documentsPanel.getByRole('button', { name: 'Page précédente', exact: true }).click();
  await documentsPanel.locator('.document-preview').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'out/pdf-alpha.png' });
  importedManifest = JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8'));
  assert.equal(importedManifest.documents.length, 4);
  assert.deepEqual(await readFile(join(moved, importedManifest.documents[3].path)), pdfBytes);
  const invalidPdf = join(temporary, 'Invalid.pdf'); await writeFile(invalidPdf, Buffer.from('%PDF-1.7\nINVALID'));
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, invalidPdf);
  await documentsPanel.getByRole('button', { name: 'Importer PDF', exact: true }).click();
  await expect(documentsPanel).toContainText('PDF invalide');
  assert.deepEqual(JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8')), importedManifest);
  const consent = page.getByRole('checkbox', { name: /^Autoriser les documents du projet/ });
  await expect(consent).not.toBeChecked(); await consent.check();
  await desktop.evaluate(async () => {
    let step = 0;
    globalThis.fetch = async (url, init) => {
      if (url !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected endpoint');
      const body = JSON.parse(init.body);
      if (body.store !== false || body.parallel_tool_calls !== false || !body.tools.every(tool => tool.strict)) throw new Error('Wrong request contract');
      const call = (id, name, args) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
      const output = [];
      if (step === 0) {
        const context = JSON.parse(body.input[0].content).project;
        if (context.documents?.[0]?.originalName !== 'Cahier-jeu.md' || context.documents.length !== 4 || JSON.stringify(body).includes('data:image/png;base64,') || JSON.stringify(body).includes('PRIVATE UNREAD LAST LINE') || JSON.stringify(body).includes('window.documentInjected') || JSON.stringify(body).includes('TITRE PDF') || JSON.stringify(body).includes('PRIVATE UNREAD PDF PAGE')) throw new Error('Wrong document scope or eager content transmission');
        await new Promise((resolve, reject) => { globalThis.__agentTestRelease = resolve; init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }); });
        output.push(call('list', 'project_list_files', {}), call('docs', 'documents_list', {}), call('searchdocs', 'documents_search', { query: 'TITRE' }), call('readdocs', 'documents_read_text', { id: context.documents[0].id, startLine: 1, endLine: 3 }), call('image', 'documents_inspect_image', { id: context.documents[1].id }), call('pdf', 'documents_read_pdf_page', { id: context.documents[3].id, page: 1, startLine: 1, endLine: 1 }));
      } else if (step === 1) output.push(call('read', 'project_read_file', { id: 'main', startLine: 1, endLine: 200 }));
      else if (step === 2) { output.push(call('print', 'reference_read', { id: 'PRINT', startLine: 1, endLine: 1 }), call('end', 'reference_read', { id: 'END', startLine: 1, endLine: 1 })); }
      else if (step === 3) {
        const imageOutput = body.input.find(item => item.type === 'function_call_output' && item.call_id === 'image');
        if (!Array.isArray(imageOutput?.output) || imageOutput.output[1]?.type !== 'input_image' || !imageOutput.output[1].image_url.startsWith('data:image/png;base64,') || JSON.parse(imageOutput.output[0].text).sha256 !== JSON.parse(body.input[0].content).project.documents[1].sha256) throw new Error('Image not transmitted as bounded content with provenance');
        const pdfRead = JSON.parse(body.input.find(item => item.type === 'function_call_output' && item.call_id === 'pdf').output);
        if (pdfRead.text !== 'TITRE PDF' || pdfRead.page !== 1 || !pdfRead.truncated || pdfRead.trust !== 'untrusted-document-data' || JSON.stringify(body).includes('PRIVATE UNREAD PDF PAGE')) throw new Error('PDF excerpt/provenance or progressive transmission violated');
        const documentRead = body.input.filter(item => item.type === 'function_call_output' && typeof item.output === 'string').map(item => JSON.parse(item.output)).find(item => item.originalName === 'Cahier-jeu.md' && item.text);
        if (!documentRead?.text.includes('window.documentInjected') || !documentRead.truncated || documentRead.trust !== 'untrusted-document-data' || JSON.stringify(body).includes('PRIVATE UNREAD LAST LINE')) throw new Error('Document read was not bounded/inert');
        const read = body.input.filter(item => item.type === 'function_call_output' && typeof item.output === 'string').map(item => JSON.parse(item.output)).find(item => item.id === 'main' && item.text);
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
  assert.deepEqual(JSON.parse(await readFile(join(moved, 'microide.project.json'), 'utf8')).documents, importedManifest.documents);
  await page.getByRole('button', { name: 'Exporter DSK', exact: true }).click();
  await page.getByRole('status').filter({ hasText: /DSK DATA construit/ }).waitFor();
  assert.deepEqual(readDataDisk(new Uint8Array(await readFile(exported))).map(file => file.name), ['HELP.BAS', 'MAIN.BAS', 'UTIL.BAS']);
  const checkpointDirectory = join(await desktop.evaluate(({ app }) => app.getPath('userData')), 'agent-checkpoints');
  const { readdir } = await import('node:fs/promises');
  const checkpoints = await Promise.all((await readdir(checkpointDirectory)).map(id => readFile(join(checkpointDirectory, id, 'checkpoint.json'), 'utf8')));
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
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, moved);
  await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
  await documentsPanel.getByRole('button', { name: 'Cahier-jeu.md', exact: true }).click();
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue(brief.replace(/\r\n/g, '\n'));
  await documentsPanel.getByRole('button', { name: 'Regles.pdf', exact: true }).click();
  await expect(documentsPanel).toContainText('Page 1 sur 2');
  await expect(documentsPanel.getByLabel('Texte du document', { exact: true })).toHaveValue('TITRE PDF\nRegles originales');
  await expect(consent).not.toBeChecked();

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
  // ROM configuration exercises native selectors and real storage, using original synthetic bytes.
  const romPanel = page.getByRole('region', { name: 'Configuration ROM CPC' });
  await romPanel.getByRole('button', { name: 'Retirer la sélection ROM', exact: true }).click();
  await expect(romPanel).toContainText('Sélection retirée.');
  const firmwareRoot = join(await desktop.evaluate(({ app }) => app.getPath('userData')), 'firmware');
  let osHash;
  for (const [index, label] of ['OS CPC', 'BASIC 1.1', 'AMSDOS'].entries()) {
    const path = join(temporary, `synthetic-${index}.rom`), bytes = Buffer.alloc(16384, index + 1);
    await writeFile(path, bytes);
    if (index === 0) osHash = createHash('sha256').update(bytes).digest('hex');
    await desktop.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, path);
    await romPanel.getByRole('button', { name: `Importer ${label}`, exact: true }).click();
    await expect(romPanel.getByRole('button', { name: `Importer ${label}`, exact: true })).toBeEnabled();
    await expect(romPanel).toContainText(createHash('sha256').update(bytes).digest('hex'));
  }
  await expect(romPanel).toContainText('Jeu complet · expérimental');
  const configuration = await readFile(join(firmwareRoot, 'configuration.json'), 'utf8');
  assert.ok(!configuration.includes(temporary));
  // Renderer receives metadata only; unknown role cannot open a host path.
  const badRole = await page.evaluate(() => window.desktop.firmware.importRom('../../private'));
  assert.match(badRole.error, /Rôle ROM invalide/);
  await page.reload();
  await expect(romPanel).toContainText('Jeu complet · expérimental');
  await romPanel.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'out/firmware-alpha.png' });
  await writeFile(join(firmwareRoot, 'roms', osHash + '.rom'), Buffer.alloc(16384, 9));
  await romPanel.getByRole('button', { name: 'Vérifier les ROM', exact: true }).click();
  await expect(romPanel).toContainText('Fichier absent ou corrompu');
  const short = join(temporary, 'short.rom'); await writeFile(short, Buffer.alloc(16383));
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, short);
  await romPanel.getByRole('button', { name: 'Importer OS CPC', exact: true }).click();
  await expect(romPanel).toContainText('exactement 16 384 octets');
  assert.equal(await readFile(join(firmwareRoot, 'configuration.json'), 'utf8'), configuration);
  await desktop.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await romPanel.getByRole('button', { name: 'Importer OS CPC', exact: true }).click();
  await expect(romPanel).toContainText('Import annulé');
  await romPanel.getByRole('button', { name: 'Retirer la sélection ROM', exact: true }).click();
  await expect(romPanel).toContainText('Sélection retirée.');
  await expect(romPanel).toContainText('Jeu incomplet ou invalide');
  assert.deepEqual(errors, []);
  console.log('Electron smoke: TXT/MD, real PNG/JPEG decode and PDF.js worker import/pagination/reopen/corrupt-file rejection, scoped PDF page excerpts and progressive multimodal agent outputs, projects and firmware checks passed. No live API, real vision or CPC execution claimed.');
} catch (error) {
  await mkdir('out', { recursive: true });
  await page?.screenshot({ path: 'out/desktop-failure.png', timeout: 5000 }).catch(() => undefined);
  throw error;
} finally {
  // Only the test application is destroyed; fixture directory is intentionally retained for debugging.
  await desktop.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }).catch(() => undefined);
  await desktop.close();
}
