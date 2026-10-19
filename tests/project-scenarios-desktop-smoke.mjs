import assert from 'node:assert/strict';
import {_electron as electron,expect} from '@playwright/test';
import {cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fixture} from './multifile-fixture.ts';
const f=await fixture(),errors=[];await cp('examples/project-tests',f.root,{recursive:true});
const path=join(f.root,'microide.project-tests.json');await rm(path);
let desktop,page,panel;
async function launch(){
 desktop=await electron.launch({args:['.'],timeout:30000,env:{...process.env,XDG_CONFIG_HOME:join(f.root,'config')}});
 page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 await page.locator('.view-lines').first().waitFor();
 await desktop.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showMessageBox=async()=>({response:1});},f.root);
 await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await expect(page.getByRole('tab',{name:'src/main.bas',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tests projet',exact:true}).click();panel=page.getByRole('region',{name:'Tests projet',exact:true});await expect(panel.getByRole('button',{name:'Nouveau scénario',exact:true})).toBeEnabled();
}
async function close(){await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await desktop.close();desktop=undefined;}
const button=name=>panel.getByRole('button',{name,exact:true});
async function save(){await button('Enregistrer les scénarios').click();await expect(panel).toContainText('Scénarios enregistrés.');await expect(button('Exécuter le scénario')).toBeEnabled();}
async function run(outcome){await button('Exécuter le scénario').click();await expect(panel.getByRole('article',{name:'Rapport de test projet'}).getByRole('heading',{name:`${outcome} · Dialogue CPC`,exact:true})).toBeVisible({timeout:65000});await expect(button('Exécuter le scénario')).toBeEnabled();}
try{
 await launch();await button('Nouveau scénario').click();await panel.getByLabel('Nom du scénario',{exact:true}).fill('Dialogue CPC');await panel.getByLabel('Budget en secondes émulées',{exact:true}).fill('12');
 await button('Ajouter une saisie').click();await panel.getByLabel('Touches',{exact:true}).fill('CPC\\r');await panel.getByLabel('Texte ASCII attendu',{exact:true}).fill('BONJOUR CPC\\r\\n');await expect(button('Exécuter le scénario')).toBeDisabled();
 await desktop.evaluate(({dialog,BrowserWindow})=>{globalThis.closeGuard='';dialog.showMessageBoxSync=(_window,options)=>{globalThis.closeGuard=options.message;return 0;};BrowserWindow.getAllWindows()[0].close();});
 assert.match(await desktop.evaluate(()=>globalThis.closeGuard),/non enregistrées/);await expect(panel.getByLabel('Nom du scénario',{exact:true})).toHaveValue('Dialogue CPC');
 await save();const scenario=JSON.parse(await readFile(path,'utf8')).scenarios[0];assert.equal(scenario.inputs[0].text,'CPC\r');assert.equal(scenario.checks[0].text,'BONJOUR CPC\r\n');
 await run('Bloqué');
 await button('Configurer les ROM').click();
 for(const [role,label] of [['os','OS CPC'],['basic','BASIC 1.1'],['amsdos','AMSDOS']]){
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},resolve(process.env.CPC_TEST_ROM_DIR,`cpc6128_${role}.bin`));
  const importButton=page.getByRole('button',{name:`Importer ${label}`,exact:true});await importButton.click();await expect(importButton.locator('..')).toContainText('Disponible');
 }
 await run('Réussi');await expect(panel.getByRole('article')).toContainText('correspondant au projet et aux attentes');
 const downloadPromise=page.waitForEvent('download');await button('Exporter ce rapport JSON').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^rapport-projet-/);
 await panel.getByLabel('Texte ASCII attendu',{exact:true}).fill('MAUVAIS\\r\\n');await expect(panel.getByRole('article')).toContainText('Rapport historique');await save();await run('Échec');
 await close();await launch();await expect(panel.getByLabel('Texte ASCII attendu',{exact:true})).toHaveValue('MAUVAIS\\r\\n');await expect(panel.getByRole('article').getByRole('heading')).toContainText('Échec');await expect(panel.getByLabel('Rapport',{exact:true}).locator('option')).toHaveCount(3);
 await panel.getByLabel('Nom du scénario',{exact:true}).fill('Brouillon');const external=JSON.parse(await readFile(path,'utf8'));external.scenarios[0].name='Autre éditeur';await writeFile(path,JSON.stringify(external));
 await button('Enregistrer les scénarios').click();await expect(panel.getByRole('alert')).toContainText('changé sur disque');assert.equal(JSON.parse(await readFile(path,'utf8')).scenarios[0].name,'Autre éditeur');
 page.once('dialog',dialog=>dialog.accept());await button('Actualiser les scénarios et rapports').click();await expect(panel.getByLabel('Nom du scénario',{exact:true})).toHaveValue('Autre éditeur');
 await button('Nouveau scénario').click();await panel.getByLabel('Nom du scénario',{exact:true}).fill('Zone témoin');await button('Retirer l’attente 1').click();await button('Ajouter une attente écran').click();await panel.getByLabel('Empreinte SHA-256 attendue',{exact:true}).fill('a'.repeat(64));await save();
 await button('Actualiser les scénarios et rapports').click();await expect(panel.getByLabel('Empreinte SHA-256 attendue',{exact:true})).toHaveValue('a'.repeat(64));
 page.once('dialog',dialog=>dialog.accept());await button('Supprimer le scénario').click();await save();assert.equal(JSON.parse(await readFile(path,'utf8')).scenarios.length,1);
 await panel.getByLabel('Nom du scénario',{exact:true}).fill('Dialogue CPC');await panel.getByLabel('Texte ASCII attendu',{exact:true}).fill('BONJOUR CPC\\r\\n');await save();
 await button('Exécuter le scénario').click();await button('Arrêter l’essai').click();await expect(panel.getByRole('article').getByRole('heading')).toContainText('Arrêté',{timeout:65000});await expect(button('Exécuter le scénario')).toBeEnabled();
 await panel.getByRole('article').scrollIntoViewIfNeeded();await page.screenshot({path:'out/project-scenarios-desktop.png'});
 const history=JSON.parse(await readFile(join(f.root,'.microide/project-test-reports.json'),'utf8'));assert.equal(history.reports.length,4);assert.deepEqual(history.reports.map(r=>r.result.outcome),['cancelled','failed','passed','blocked']);
 assert.deepEqual(await readFile(join(f.root,'assets/input.bin')),await readFile('examples/project-tests/assets/input.bin'));assert.deepEqual(await readFile(join(f.root,'src/part.bas')),await readFile('examples/project-tests/src/part.bas'));await assert.rejects(readFile(join(f.root,'OUT.TXT')),{code:'ENOENT'});assert.deepEqual(errors,[]);
 console.log('Project scenarios desktop: human creation/edit/deletion, escaped keyboard/file text, screen form, dirty close guard, real CPC pass/failure, ROM block, cancellation, export, concurrent-edit guard and reopen history passed.');
}catch(error){await page?.screenshot({path:'out/project-scenarios-desktop-failure.png'}).catch(()=>undefined);throw error;}
finally{if(desktop)await close().catch(()=>undefined);await rm(f.root,{recursive:true,force:true});}
