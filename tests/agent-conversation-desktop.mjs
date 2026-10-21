import assert from 'node:assert/strict';
import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {installAgentNetworkFixture} from './agent-network-fixture.mjs';

const root=await mkdtemp(join(tmpdir(),'cpc-chat-native-')),errors=[];
await mkdir(join(root,'project'));
const {snapshot}=await ProjectStore.create(join(root,'project'),'Conversation native');
const brief=join(root,'Brief.md');await writeFile(brief,'# Mon jeu\nUn titre bleu et ivoire.');
let desktop,page;
try {
 desktop=await electron.launch({args:['.'],timeout:30000,env:{...process.env,XDG_CONFIG_HOME:join(root,'config')}});
 await installAgentNetworkFixture(desktop);
 page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.view-lines').first().waitFor();
 await desktop.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},join(root,'project'));
 await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
 const agent=page.getByRole('region',{name:'Agent OpenAI',exact:true}),input=agent.getByLabel('Message à l’agent',{exact:true});
 await input.fill('Prépare le projet avec le fichier joint.');
 await expect(agent.getByText('Que souhaitez-vous créer ?',{exact:true})).toBeVisible();
 await expect(agent.getByText('Améliorer la lisibilité du code…',{exact:true})).toHaveCount(0);
 await agent.getByRole('button',{name:'Joindre des fichiers',exact:true}).click();const context=page.getByRole('dialog',{name:'Fichiers et contexte IA',exact:true});
 await desktop.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
 await context.getByRole('button',{name:'Importer un fichier…',exact:true}).click();await expect(context).toContainText('Import annulé.');
 await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},brief);
 await context.getByRole('button',{name:'Importer un fichier…',exact:true}).click();await expect(context.getByRole('checkbox',{name:'Joindre Brief.md',exact:true})).toBeChecked();
 await page.screenshot({path:'out/agent-context-desktop.png'});await context.getByRole('button',{name:'Terminé',exact:true}).click();
 await expect(input).toHaveValue('Prépare le projet avec le fichier joint.');
 await expect(agent.getByLabel('Fichiers accessibles à l’agent')).toContainText('Brief.md');
 assert.equal(JSON.parse(await readFile(join(root,'project/microide.project.json'),'utf8')).documents.length,1);
 await desktop.evaluate(()=>{
  globalThis.chatRequests=0;
  globalThis.fetch=async(url,init)=>{
   if(String(url).startsWith('https://developers.openai.com/'))return new Response('',{status:404});
   if(url==='https://api.openai.com/v1/models')return Response.json({data:[{id:'gpt-5.6-luna',created:1,owned_by:'openai'}]});
   if(url!=='https://api.openai.com/v1/responses')throw Error('Unexpected fixture endpoint');
   const body=JSON.parse(init.body),step=globalThis.chatRequests++;
   const call=(name,args)=>({type:'function_call',call_id:'chat-'+step,name,arguments:JSON.stringify(args)});
   const msg=text=>({type:'message',content:[{type:'output_text',text}]});let output;
   if(step===0){const docs=JSON.parse(body.input[0].content).project.documents;if(docs.length!==1||docs[0].originalName!=='Brief.md')throw Error('Attachment absent');await new Promise(resolve=>{globalThis.releaseChat=resolve;});output=call('documents_read_text',{id:docs[0].id,startLine:1,endLine:20});}
   else if(step===1){if(!JSON.stringify(body.input).includes('Garde une palette claire'))throw Error('Steering absent');output=call('build_project',{});}
   else if(step===2)output=msg('## Projet prêt\n\nLe **brief** a été consulté. Vous pouvez demander une modification.');
   else if(step===3){if(!JSON.stringify(body.input).includes('Projet prêt')||!JSON.stringify(body.input).includes('Ajoute DETAIL'))throw Error('Follow-up context missing');output=call('reference_read_many',{names:['PRINT','END']});}
   else if(step===4)output=call('project_create_source',{name:'DETAIL',source:'10 PRINT "DETAIL"\n20 END\n'});
   else if(step===5)output=call('build_project',{});
   else output=msg('Le fichier DETAIL est ajouté. DSK reconstruit ; aucun CPC exécuté.');
   return Response.json({status:'completed',output:[output],usage:{total_tokens:100},model:'gpt-5.6-luna'});
  };
 });
 await agent.getByRole('button',{name:'Réglages IA',exact:true}).click();const settings=page.getByRole('dialog',{name:'Réglages de l’agent IA',exact:true});
 await settings.getByLabel('Clé API OpenAI',{exact:true}).fill('sk-chat-native-fixture-not-real');await settings.getByRole('button',{name:'Configurer la clé',exact:true}).click();await settings.getByLabel('Modèle OpenAI',{exact:true}).selectOption('gpt-5.6-luna');await settings.getByRole('button',{name:'Fermer les réglages IA',exact:true}).click();
 await input.focus();await page.keyboard.press('Control+Enter');await expect(agent.getByRole('button',{name:'Arrêter l’agent',exact:true})).toBeEnabled();
 await expect(input).toBeEnabled();await input.fill('Garde une palette claire');await agent.getByRole('button',{name:'Envoyer la précision',exact:true}).click();await expect(input).toHaveValue('');
 await expect.poll(()=>desktop.evaluate(()=>typeof globalThis.releaseChat)).toBe('function');await desktop.evaluate(()=>globalThis.releaseChat());await expect(agent.locator('.agent-status')).toHaveText('Mission terminée');
 await expect(agent.getByRole('heading',{name:'Projet prêt',exact:true})).toBeVisible();await expect(agent.locator('.agent-message.user')).toHaveCount(2);
 await expect(agent.locator('.agent-advanced')).not.toHaveAttribute('open','');
 await input.fill('Ajoute DETAIL');await page.keyboard.press('Enter');assert.equal(await desktop.evaluate(()=>globalThis.chatRequests),3,'Plain Enter adds a line without sending');
 await page.keyboard.press('Control+Enter');await expect(page.getByRole('tab',{name:'src/detail.bas',exact:true})).toBeVisible();await expect(agent.locator('.agent-status')).toHaveText('Mission terminée');
 await expect(agent.locator('.agent-message.user')).toHaveCount(3);assert.equal(await readFile(join(root,'project/src/detail.bas'),'utf8'),'10 PRINT "DETAIL"\n20 END\n');
 await expect(input).toHaveValue('');await expect(agent.locator('.agent-message.assistant').last()).toBeInViewport();await page.screenshot({path:'out/agent-conversation-desktop.png'});
 await page.setViewportSize({width:1000,height:740});
 await expect(agent.locator('.agent-message.assistant').last()).toBeInViewport();const box=await input.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=740,'Composer remains in view');
 assert.equal(await agent.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:'out/agent-conversation-narrow.png'});
 await agent.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true}).click();await expect(agent).toContainText('Checkpoint initial restauré');await expect(page.getByRole('tab',{name:'src/detail.bas',exact:true})).toHaveCount(0);
 assert.equal(await readFile(join(root,'project/src/main.bas'),'utf8'),snapshot.files[0].source);
 await assert.rejects(readFile(join(root,'project/src/detail.bas')),{code:'ENOENT'});assert.deepEqual(errors,[]);
 console.log('Native chat: visible composer, attachment import/cancel and selection, running precision, Markdown reply, follow-up with retained context, actual file creation, cumulative checkpoint restoration and narrow layout passed.');
}catch(error){await page?.screenshot({path:'out/agent-conversation-failure.png'}).catch(()=>undefined);throw error;}
finally{if(desktop){await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await desktop.close();}await rm(root,{recursive:true,force:true});}
