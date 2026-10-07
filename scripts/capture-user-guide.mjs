// Captures réelles de l'aperçu d'édition : aucun faux port desktop ni appel IA.
// Prérequis : npm ci --ignore-scripts ; npx playwright install chromium.
// npm run build:renderer ; puis node scripts/capture-user-guide.mjs.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const destination = 'docs/images/guide-utilisateur';
await mkdir(destination, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'apps/desktop/vite.config.ts', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { server.kill(); reject(new Error('Preview timeout')); }, 15000);
  server.stdout.on('data', data => { if (String(data).includes('127.0.0.1')) { clearTimeout(timer); resolve(); } });
  server.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited ${code}`)); });
});
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch (error) { server.kill(); throw error; }
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const capture = name => page.screenshot({ path: `${destination}/${name}.png`, animations: 'disabled' });
const menus = page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true });
async function menu(group, label) {
  await menus.getByRole('button', { name: group, exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
try {
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.view-lines').first().waitFor();
  const editor = page.locator('.listing .monaco-editor textarea');
  await editor.focus(); await page.keyboard.press('Control+a');
  const sample = '10 REM CPC ELESTE - VOYAGE EN MODE 1\n20 MODE 1:BORDER 0\n30 INK 0,0:INK 1,24:INK 2,15:INK 3,6\n40 PAPER 0:PEN 1:CLS\n50 LOCATE 9,3:PRINT "C P C E L E S T E"\n60 LOCATE 8,5:PRINT "VOS IDEES PRENNENT VIE"\n70 FOR I=1 TO 80\n80 X=INT(RND*640):Y=INT(RND*270)\n90 PLOT X,Y,1+INT(RND*3)\n100 NEXT I\n110 ORIGIN 320,160\n120 FOR A=0 TO 360 STEP 4\n130 X=120*COS(A*PI/180)\n140 Y=50*SIN(A*PI/180)\n150 PLOT X,Y,2\n160 NEXT A\n170 ORIGIN 0,0\n180 LOCATE 8,24:PRINT "A VOUS DE CREER LA SUITE !"\n190 END\n';
  await page.keyboard.insertText(sample);
  await expect(page.getByRole('region', { name: 'Diagnostics BASIC', exact: true })).toContainText('Aucun problème détecté');
  await capture('01-atelier');
  await page.keyboard.press('Control+Shift+p');
  await capture('02-palette'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Renuméroter', exact: true }).click();
  const renumber = page.getByRole('region', { name: 'Renumérotation BASIC' });
  await renumber.getByLabel('Premier nouveau numéro', { exact: true }).fill('1000');
  await renumber.getByRole('button', { name: 'Prévisualiser la renumérotation', exact: true }).click();
  await capture('03-renumerotation');
  await renumber.getByRole('button', { name: 'Fermer la renumérotation', exact: true }).click();
  await editor.focus(); await page.keyboard.press('Control+End');
  await page.keyboard.insertText('200 REM EXEMPLE DE PASSAGES A RELIRE\n210 A=1:B=2:C=3:D=4:E=5\n220 GOTO 240:PRINT \"CE TEXTE NE SERA PAS AFFICHE\"\n240 END\n');
  await menu('BASIC', 'Rapport de qualité BASIC…');
  await page.getByRole('button', { name: 'Générer le rapport', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Qualité du code BASIC' })).toContainText('Rapport sur les sources inchangées.');
  await page.getByRole('button', { name: 'Agrandir les sorties', exact: true }).click();
  await capture('04-qualite');
  await page.getByRole('button', { name: 'Restaurer les sorties', exact: true }).click();
  await page.getByRole('button', { name: 'Réancrer les sorties', exact: true }).click();
  await editor.focus(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(sample);
  await page.keyboard.press('Control+,');
  const settings = page.getByRole('dialog', { name: 'Paramètres de CPCéleste' });
  await settings.getByRole('button', { name: 'Apparence', exact: true }).click();
  await capture('05-personnalisation');
  await settings.getByRole('button', { name: 'Raccourcis', exact: true }).click();
  await capture('06-raccourcis');
  await settings.getByRole('button', { name: 'Apparence', exact: true }).click();
  await settings.getByLabel('Thème', { exact: true }).selectOption('light');
  await settings.getByRole('button', { name: 'Appliquer les paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Problèmes/ }).click();
  await capture('07-theme-clair');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('7 captures de l’interface réelle, sans service simulé ni erreur renderer.');
} finally { await browser.close(); server.kill(); }
