import assert from 'node:assert/strict';
import {_electron as electron,expect} from '@playwright/test';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture} from './multifile-fixture.ts';
import {expressionWitnesses} from './terminal-expression-fixtures.ts';
const expressions=process.argv.includes('--expressions');
const f=await fixture(expressions?expressionWitnesses[2].source.replace(/\n/g,'\r\n'):undefined);
const evidence=expressions?'basic-multifile-expressions-desktop':'basic-multifile-apply-desktop';
let desktop,page;const errors=[];
async function launch(){
 desktop=await electron.launch({args:['.'],timeout:30000,env:{...process.env,XDG_CONFIG_HOME:join(f.root,'config')}});
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
    case 2:output=[call('refs','reference_read_many',{names:['MEMORY','POKE','END','CHAIN','MERGE','MODE','CLS','LET','PRINT']})];break;
    case 3:output=[call('preview','language_extraction_simulate',{id:'main',expectedHash:result('read').hash,entryLine:100,newFileName:'PART'})];break;
    case 4:output=[call('apply','language_extraction_apply',{id:'main',expectedHash:result('read').hash,previewId:result('preview').previewId})];break;
    case 5:output=[call('build','build_project',{})];break;
    default:output=[{type:'message',content:[{type:'output_text',text:'Découpage enregistré et DSK construit. Aucun essai CPC dans cette mission.'}]}];
   }
   return Response.json({model,status:'completed',output,usage:{input_tokens:100,output_tokens:20,total_tokens:120}});
  };
 });
 if(!await page.getByLabel('Mission de programmation',{exact:true}).isVisible())await page.getByRole('button',{name:'Afficher l’agent IA',exact:true}).click();
 await page.getByRole('button',{name:'Réglages IA',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Réglages de l’agent IA',exact:true});
 await settings.getByLabel('Clé API OpenAI',{exact:true}).fill('sk-test-fixture-not-real');
 await settings.getByRole('button',{name:'Configurer la clé',exact:true}).click();
 await settings.getByLabel('Modèle OpenAI',{exact:true}).selectOption('gpt-5.6-luna');
 await settings.getByLabel('Tours modèle maximum',{exact:true}).fill('10');
 await settings.getByRole('button',{name:'Fermer les réglages IA',exact:true}).click();
 await page.getByLabel('Mission de programmation',{exact:true}).fill('Découpe le bloc terminal en PART, puis construis le DSK.');
 await page.getByRole('button',{name:'Lancer l’agent',exact:true}).click();
 const result=page.locator('.agent-result');await expect(result).toContainText('Mission terminée',{timeout:30000});
 await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('appliqué');
 if(expressions)await expect(page.getByRole('region',{name:'Simulation du découpage BASIC'})).toContainText('Scalaires %/$ initialisés');
 await expect(page.getByRole('tab',{name:'src/part.bas',exact:true})).toBeVisible();
 assert.match(await readFile(join(f.root,'src/main.bas'),'utf8'),/CHAIN MERGE "PART.BAS",100/);
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
 assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
 assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
 await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 assert.deepEqual(errors,[]);
 console.log(`${expressions?'Expressions v2':'Original v1'}: native agent extraction, actual persistence, full restart, cancellation, dirty-buffer guard and durable exact-byte restoration passed.`);
}catch(error){console.error('Editor at failure:',await page?.locator('.view-lines').allTextContents().catch(()=>[]));await page?.screenshot({path:`out/${evidence}-failure.png`}).catch(()=>undefined);throw error;}
finally{if(desktop)await close().catch(()=>undefined);await rm(f.root,{recursive:true,force:true});}
