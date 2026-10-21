import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Uses the running native application and real CPC worker; no fixture injects captured pixels. */
export async function verifyScreenReference({page,panel,root}){
 const button=name=>panel.getByRole('button',{name,exact:true});
 const historyPath=join(root,'.microide/project-test-reports.json'),definitions=join(root,'microide.project-tests.json');
 const previousHistory=await readFile(historyPath),previousDefinitions=await readFile(definitions);
 const editor=page.locator('.listing .monaco-editor textarea');
 const source='10 MODE 1\n20 PRINT "REFERENCE CPC"\n30 END\n';
 await page.getByRole('button',{name:'Réancrer les sorties',exact:true}).click();
 await editor.focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(source);
 await button('Actualiser les scénarios et rapports').click();
 await button('Nouveau scénario').click();await panel.getByLabel('Nom du scénario',{exact:true}).fill('Capture visuelle');await button('Retirer l’attente 1').click();
 await expect(button('Enregistrer les scénarios')).toBeDisabled();
 await button('Capturer un écran de référence').click();
 const preview=panel.getByRole('region',{name:'Aperçu de référence écran',exact:true});
 await expect(preview).toBeVisible({timeout:65000});
 assert.deepEqual(await readFile(historyPath),previousHistory);assert.deepEqual(await readFile(definitions),previousDefinitions);
 const adopt=preview.getByRole('button',{name:'Adopter cette zone comme référence',exact:true});
 await panel.getByLabel('Budget en secondes émulées',{exact:true}).fill('9');await expect(adopt).toBeDisabled();await expect(preview).toContainText('Capture périmée');
 await panel.getByLabel('Budget en secondes émulées',{exact:true}).fill('8');await expect(adopt).toBeEnabled();
 // Actual pointer selection on a responsive canvas, followed by exact coordinate editing.
 const canvas=preview.locator('canvas').first();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();assert.ok(box);
 await page.mouse.move(box.x+box.width*64/768,box.y+box.height*36/272);await page.mouse.down();await page.mouse.move(box.x+box.width*703/768,box.y+box.height*43/272,{steps:5});await page.mouse.up();
 for(const [label,value] of [['X','64'],['Y','36'],['Largeur','640'],['Hauteur','8']])await preview.getByLabel(`Capture ${label}`,{exact:true}).fill(value);
 await preview.getByLabel('Capture Hauteur',{exact:true}).fill('26');await expect(adopt).toBeDisabled();await preview.getByLabel('Capture Hauteur',{exact:true}).fill('8');
 const expected=await canvas.evaluate(async element=>{
  const bytes=element.getContext('2d').getImageData(64,36,640,8).data;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 });
 await page.getByRole('button',{name:'Agrandir les sorties',exact:true}).click();await preview.scrollIntoViewIfNeeded();await page.screenshot({path:'out/project-screen-reference-desktop.png'});
 await adopt.click();await expect(preview).toHaveCount(0);await expect(panel.getByLabel('Empreinte SHA-256 attendue',{exact:true})).toHaveValue(expected);
 assert.deepEqual(await readFile(definitions),previousDefinitions);await expect(button('Exécuter le scénario')).toBeDisabled();
 await button('Enregistrer les scénarios').click();await expect(button('Exécuter le scénario')).toBeEnabled();await button('Exécuter le scénario').click();
 await expect(panel.getByRole('article').getByRole('heading')).toContainText('Réussi · Capture visuelle',{timeout:65000});await expect(button('Exécuter le scénario')).toBeEnabled();
 // An explicit replacement updates the draft only; discarding or cancelling a capture leaves it intact.
 await button('Capturer un écran de référence').click();await expect(preview).toBeVisible({timeout:65000});await expect(preview.getByLabel('Destination de la référence',{exact:true})).toHaveValue('0');
 await preview.getByRole('button',{name:'Écarter la capture',exact:true}).click();await expect(preview).toHaveCount(0);
 await button('Capturer un écran de référence').click();await button('Arrêter l’essai').click();await expect(button('Capturer un écran de référence')).toBeEnabled({timeout:65000});await expect(preview).toHaveCount(0);
 assert.equal(JSON.parse(await readFile(historyPath,'utf8')).reports.length,5);
 assert.equal(JSON.parse(await readFile(definitions,'utf8')).scenarios.at(-1).checks[0].sha256,expected);
 // Restore host-equivalent buffers before reopening; no write of the temporary program.
 await page.getByRole('button',{name:'Réancrer les sorties',exact:true}).click();await editor.focus();await page.keyboard.press('Control+a');await page.keyboard.insertText(await readFile(join(root,'src/main.bas'),'utf8'));
 console.log('Native screen reference: unsaved first scenario, genuine preview pixels, pointer/coordinate crop, stale/oversize rejection, explicit adoption, save, real CPC pass, discard and cancellation verified.');
 return expected;
}
