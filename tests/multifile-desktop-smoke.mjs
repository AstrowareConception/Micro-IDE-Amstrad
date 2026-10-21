import {installAgentNetworkFixture} from './agent-network-fixture.mjs';
import assert from 'node:assert/strict';
import {_electron as electron,expect} from '@playwright/test';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fixture} from './multifile-fixture.ts';
import {expressionWitnesses} from './terminal-expression-fixtures.ts';
import {conditionWitnesses} from './terminal-condition-fixtures.ts';
import {loopWitnesses} from './terminal-loop-fixtures.ts';
import {readabilityWitnesses} from './readability-pipeline-fixture.mjs';
import {createReadabilityTransport} from './readability-pipeline-transport.mjs';
const projectTests=process.argv.includes('--project-tests');
const readability=projectTests||process.argv.includes('--readability');
const loops=process.argv.includes('--loops');
const conditions=process.argv.includes('--conditions');
const expressions=process.argv.includes('--expressions');
const f=await fixture(readability?readabilityWitnesses.at(-1).source.replace(/\n/g,'\r\n'):loops?loopWitnesses[13].source.replace(/\n/g,'\r\n'):conditions?conditionWitnesses[7].source.replace(/\n/g,'\r\n'):expressions?expressionWitnesses[2].source.replace(/\n/g,'\r\n'):undefined);
const evidence=projectTests?'agent-project-tests-desktop':readability?'basic-readability-desktop':loops?'basic-multifile-loops-desktop':conditions?'basic-multifile-conditions-desktop':expressions?'basic-multifile-expressions-desktop':'basic-multifile-apply-desktop';
if(projectTests){
 const {projectRunner,literalOracle,displayScenario}=await import('./project-test-fixture.mjs');
 const oracle=await literalOracle(await projectRunner(),readabilityWitnesses.at(-1).oracle);
 await writeFile(join(f.root,'microide.project-tests.json'),JSON.stringify({schemaVersion:1,scenarios:[displayScenario(oracle.screenSha256)]}));
}
let desktop,page;const errors=[];
async function launch(){
 desktop=await electron.launch({args:['.'],timeout:30000,env:{...process.env,XDG_CONFIG_HOME:join(f.root,'config')}});
 await installAgentNetworkFixture(desktop);
 page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 await page.locator('.view-lines').first().waitFor();
 await desktop.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showMessageBox=async()=>({response:1});},f.root);
 await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
 await expect(page.getByRole('tab',{name:'src/main.bas',exact:true})).toBeVisible();
}
async function close(){await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await desktop.close();desktop=undefined;}
async function restoreMenu(){await page.getByRole('button',{name:'Projet',exact:true}).click();return page.getByRole('menuitem',{name:'Rétablir la dernière modification IA…',exact:true});}
try{
 await launch();
 if(projectTests){
  await page.keyboard.press('Control+Alt+r');
  for(const [role,label] of [['os','OS CPC'],['basic','BASIC 1.1'],['amsdos','AMSDOS']]){
   await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},resolve(process.env.CPC_TEST_ROM_DIR,`cpc6128_${role}.bin`));
   const button=page.getByRole('button',{name:`Importer ${label}`,exact:true});await button.click();await expect(button.locator('..')).toContainText('Disponible');
  }
 }
 await desktop.evaluate(()=>{
  let step=0;const model='gpt-5.6-luna';
  globalThis.fetch=async(url,init)=>{
   if(url==='https://api.openai.com/v1/models')return Response.json({data:[{id:model,created:100,owned_by:'openai'}]});
   if(url===`https://developers.openai.com/api/docs/models/${model}.md`)return new Response('Model ID: `gpt-5.6-luna`\n\n## Pricing\n\n| Input | $0.2 | 1M tokens |\n| Cached input | $0.02 | 1M tokens |\n| Output | $1.2 | 1M tokens |\n\n## Endpoints\n');
   if(url!=='https://api.openai.com/v1/responses')throw Error('Unexpected endpoint');
   const body=JSON.parse(init.body),call=(id,name,args)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
   const result=id=>JSON.parse(body.input.find(x=>x.type==='function_call_output'&&x.call_id===id).output);
   let output;
   switch(++step){
    case 1:output=[call('read','project_read_file',{id:'main',startLine:1,endLine:200})];break;
    case 2:output=[call('refs','reference_read_many',{names:['MEMORY','POKE','END','CHAIN','MERGE','MODE','CLS','LET','PRINT','IF','FOR','NEXT','WHILE','WEND']})];break;
    case 3:output=[call('preview','language_extraction_simulate',{id:'main',expectedHash:result('read').hash,entryLine:100,newFileName:'PART'})];break;
    case 4:output=[call('apply','language_extraction_apply',{id:'main',expectedHash:result('read').hash,previewId:result('preview').previewId})];break;
    case 5:output=[call('build','build_project',{})];break;
    default:output=[{type:'message',content:[{type:'output_text',text:'Découpage enregistré et DSK construit. Aucun essai CPC dans cette mission.'}]}];
   }
   return Response.json({model,status:'completed',output,usage:{input_tokens:100,output_tokens:20,total_tokens:120}});
  };
 });
 if(readability)await desktop.evaluate(createReadabilityTransport,projectTests?{projectTests:true}:true);
 if(!await page.getByLabel('Mission de programmation',{exact:true}).isVisible())await page.getByRole('button',{name:'Afficher l’agent IA',exact:true}).click();
 await page.getByRole('button',{name:'Réglages IA',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Réglages de l’agent IA',exact:true});
 await settings.getByLabel('Clé API OpenAI',{exact:true}).fill('sk-test-fixture-not-real');
 await settings.getByRole('button',{name:'Configurer la clé',exact:true}).click();
 await settings.getByLabel('Modèle OpenAI',{exact:true}).selectOption('gpt-5.6-luna');
 await settings.getByLabel('Tours modèle maximum',{exact:true}).fill(readability?'25':'10');
 await settings.getByRole('button',{name:'Fermer les réglages IA',exact:true}).click();
 await page.getByLabel('Mission de programmation',{exact:true}).fill('Découpe le bloc terminal en PART, puis construis le DSK.');
 if(readability){
  await page.getByText('Améliorer la lisibilité du code…',{exact:true}).click();
  await page.getByLabel('Découpage en fichiers des blocs admissibles',{exact:true}).check();
  await page.getByRole('button',{name:'Préparer la mission de lisibilité',exact:true}).click();
 }
 await page.getByRole('button',{name:'Lancer l’agent',exact:true}).click();
 const result=page.locator('.agent-result');await expect(result).toContainText('Mission terminée',{timeout:30000});
 await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('appliqué');
 if(loops)await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('Boucles bornées — FOR/NEXT et WHILE/WEND');
 if(conditions)await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('Conditions simples — deux branches contrôlées');
 if(expressions)await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('Scalaires %/$ initialisés');
 await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toBeVisible();
 assert.match(await readFile(join(f.root,'src/main.bas'),'utf8'),/CHAIN MERGE "PART.BAS",100/);
 let expectedRestored=f.original;
 if(readability){
  await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('Code commenté');
  if(projectTests){
   const tests=page.getByRole('region',{name:'Tests du projet CPC',exact:true});
   await expect(tests).toContainText('1 avec référence initiale');await expect(tests).toContainText('révision antérieure');await expect(tests).toContainText('révision courante');
   const history=JSON.parse(await readFile(join(f.root,'.microide/project-test-reports.json'),'utf8'));assert.equal(history.reports.length,2);assert.ok(history.reports.every(r=>r.result.outcome==='passed'));assert.equal(history.reports[0].project.sources.length,2);
  }else await expect(result).toContainText('Aucun test CPC exécuté');
  const main=await readFile(join(f.root,'src/main.bas'),'utf8'),part=await readFile(join(f.root,'src/part.bas'),'utf8');
  expectedRestored=Buffer.from(main.replace('CHAIN MERGE "PART.BAS",100','GOTO 100')+part);
  assert.match(expectedRestored.toString(),/99 REM Suite du calcul/);assert.match(expectedRestored.toString(),/score%/);
  // Restore the complete mission in the live controller, then run it again for restart undo.
  await page.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true}).click();
  await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toHaveCount(0);
  assert.equal(await readFile(join(f.root,'src/main.bas'),'utf8'),readabilityWitnesses.at(-1).source);
  assert.equal(JSON.parse(await readFile(join(f.root,'microide.project.json'),'utf8')).documents.length,0);
  await desktop.evaluate(createReadabilityTransport,projectTests?{projectTests:true}:true);
  await page.getByRole('button',{name:'Lancer l’agent',exact:true}).click();
  await expect(result).toContainText('Mission terminée',{timeout:30000});
  await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toBeVisible();
 }
 await page.screenshot({path:`out/${evidence}.png`});
 await close();await launch(); // A new controller has no mission in memory.
 await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toBeVisible();
 await desktop.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});
 await (await restoreMenu()).click();await expect(page.getByRole('status').filter({hasText:'Restauration annulée.'})).toBeVisible();
 assert.match(await readFile(join(f.root,'src/main.bas'),'utf8'),/CHAIN MERGE/);
 // One character is one Monaco undo element; a sentence can span word-level elements.
 const input=page.locator('.listing .monaco-editor textarea');await input.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('x');
 await expect(page.getByRole('tab',{name:/^src\/main\.bas • modifié/})).toBeVisible();
 await expect(await restoreMenu()).toBeDisabled();await page.keyboard.press('Escape');await input.focus();await page.keyboard.press('Control+z');
 await expect(page.getByRole('tab',{name:'src/main.bas',exact:true})).toBeVisible();
 await desktop.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
 await (await restoreMenu()).click();
 await expect(page.getByRole('status').filter({hasText:'Dernière modification IA rétablie'})).toBeVisible();
 await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toHaveCount(0);
 await expect(page.locator('.view-lines')).toContainText('GOTO 100');
 assert.deepEqual(await readFile(join(f.root,'src/main.bas')),expectedRestored);
 if(readability){const manifest=JSON.parse(await readFile(join(f.root,'microide.project.json'),'utf8'));assert.equal(manifest.sources.length,1);assert.equal(manifest.documents.length,1);}
 else assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
 await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 if(projectTests){const history=JSON.parse(await readFile(join(f.root,'.microide/project-test-reports.json'),'utf8'));assert.equal(history.reports.length,4);}
 assert.deepEqual(errors,[]);
 console.log(`${readability?'Readability pipeline v5':loops?'Loops v4':conditions?'Conditions v3':expressions?'Expressions v2':'Original v1'}: native agent extraction, actual persistence, full restart, cancellation, dirty-buffer guard and durable exact-byte restoration passed.`);
}catch(error){console.error('Editor at failure:',await page?.locator('.view-lines').allTextContents().catch(()=>[]));await page?.screenshot({path:`out/${evidence}-failure.png`}).catch(()=>undefined);throw error;}
finally{if(desktop)await close().catch(()=>undefined);await rm(f.root,{recursive:true,force:true});}
