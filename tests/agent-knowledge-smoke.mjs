import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';

export async function verifyAgentKnowledge(browser) {
 const root=await mkdtemp(join(tmpdir(),'agent-knowledge-ui-'));
 const {store,snapshot}=await ProjectStore.create(root,'Mahjong · mémoire du projet');
 const note=await store.writeKnowledge({action:'create',title:'Roadmap',category:'progress',source:'# Roadmap Mahjong\n\n- [ ] Vérifier le démarrage sur CPC\n'});
 let turn=0;
 const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',async(url,init)=>{
  if(String(url).endsWith('/models'))return Response.json({data:[{id:'gpt-5.6-luna',created:100,owned_by:'openai'}]});
  if(!String(url).endsWith('/responses'))return new Response('Tarif indisponible dans cette fixture',{status:404});
  const call=(name,args)=>({type:'function_call',call_id:name,name,arguments:JSON.stringify(args)});
  const steps=[call('documents_read_text',{id:note.document.id,startLine:1,endLine:200}),call('documents_replace_note',{id:note.document.id,expectedRevision:note.document.revision,source:'# Roadmap Mahjong\n\n- [x] Décrire les contraintes\n- [ ] Vérifier le démarrage sur CPC\n\n## Décision\nUn écran fixe en MODE 1.\n'}),call('documents_create_note',{title:'Journal de conception',category:'progress',source:'# Journal de conception\n\n## Décisions\n- Écran fixe en MODE 1\n- Palette bleue et ivoire\n\n## Vérifications restantes\n- [ ] Lancer sur CPC\n\n> Aucun test du jeu exécuté par cette mission.\n'}),call('build_project',{}),{type:'message',content:[{type:'output_text',text:'Roadmap et journal enregistrés ; construction structurelle réussie. Aucun CPC exécuté.'}]}];
  return Response.json({status:'completed',output:[steps[turn++]],usage:{total_tokens:1}});
 });
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const guard=async fn=>{try{return await fn();}catch(e){return {error:e.message};}};
 await page.exposeFunction('noteOpen',()=>({...snapshot,manifest:store.manifest}));
 await page.exposeFunction('noteRead',id=>guard(()=>store.readDocument(id)));
 await page.exposeFunction('noteWrite',request=>guard(()=>store.writeKnowledge(request)));
 await page.exposeFunction('noteAgent',({action,args})=>guard(()=>{
  if(action==='start')return controller.start(store,args[1],args[2],args[3],args[4]);
  if(action==='restore')return controller.restore(args[0],args[1]);
  return controller[action](...args);
 }));
 await page.addInitScript(()=>{const agent={};for(const action of ['models','selectModel','configure','pricing','start','status','restore'])agent[action]=(...args)=>window.noteAgent({action,args});window.desktop={setDirty(){},open:async()=>null,save:async()=>null,exportDisk:async()=>null,project:{open:()=>window.noteOpen(),readDocument:(_session,id)=>window.noteRead(id)},knowledge:{write:(_session,request)=>window.noteWrite(request)},agent};});
 try{
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();await page.getByRole('button',{name:'Afficher Connaissances',exact:true}).click();
  const library=page.getByRole('region',{name:'Documents du projet',exact:true}),reader=page.getByRole('region',{name:'Document ouvert',exact:true});await library.getByRole('button',{name:'Roadmap.md',exact:true}).click();
  const agent=page.getByRole('region',{name:'Agent OpenAI',exact:true});await library.getByRole('button',{name:'Documenter avec l’IA',exact:true}).click();await expect(agent.getByLabel('Message à l’agent',{exact:true})).toHaveValue(/Documente ce projet/);assert.equal(turn,0);await agent.getByRole('button',{name:'Réglages IA',exact:true}).click();const settings=page.getByRole('dialog',{name:'Réglages de l’agent IA',exact:true});
  await settings.getByLabel('Clé API OpenAI',{exact:true}).fill('sk-fixture-not-real');await settings.getByRole('button',{name:'Configurer la clé',exact:true}).click();await settings.getByLabel('Modèle OpenAI',{exact:true}).selectOption('gpt-5.6-luna');await settings.getByRole('button',{name:'Fermer les réglages IA',exact:true}).click();
  await agent.getByLabel('Message à l’agent',{exact:true}).fill('Mets à jour la roadmap et crée un journal de conception Markdown, sans changer le code.');await agent.getByRole('button',{name:'Envoyer',exact:true}).click();await expect(agent.locator('.agent-result')).toContainText('Mission terminée');
  await expect(library.getByRole('button',{name:'Journal de conception.md',exact:true})).toBeVisible();await expect(reader).toContainText('Décrire les contraintes');
  const changes=agent.getByRole('region',{name:'Documents rédigés par l’agent'});await expect(changes).toContainText('2 note(s)');await changes.getByRole('button',{name:'Lire Journal de conception.md',exact:true}).click();await expect(reader.getByRole('heading',{name:'Journal de conception',exact:true})).toBeVisible();
  await expect(reader).toContainText('Palette bleue et ivoire');await changes.getByText('Comparer le Markdown',{exact:true}).first().click();await expect(changes).toContainText('Avant la mission');
  await reader.getByRole('button',{name:'Édition',exact:true}).click();await reader.getByLabel('Texte du document',{exact:true}).fill('# Brouillon humain');await expect(agent.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.confirm=()=>true);await reader.getByRole('button',{name:'Abandonner les modifications',exact:true}).click();await reader.getByRole('button',{name:'Lecture',exact:true}).click();
  await changes.getByText('Comparer le Markdown',{exact:true}).first().click();await agent.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'out/agent-knowledge-alpha.png'});
  await agent.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true}).click();await expect(agent).toContainText('Checkpoint initial restauré');await expect(library.getByRole('button',{name:'Journal de conception.md',exact:true})).toHaveCount(0);await expect(reader).toHaveCount(0);
  await library.getByRole('button',{name:'Roadmap.md',exact:true}).click();await expect(reader).not.toContainText('Décrire les contraintes');assert.equal(await readFile(join(root,note.document.path),'utf8'),'# Roadmap Mahjong\n\n- [ ] Vérifier le démarrage sur CPC\n');assert.deepEqual(errors,[]);
  console.log('Agent knowledge: real controller/store, automatic manifest adoption, Markdown reader refresh, comparisons, dirty guard and complete restore passed.');
 }catch(e){await page.screenshot({path:'out/agent-knowledge-failure.png'});throw e;}finally{await context.close();await rm(root,{recursive:true,force:true});}
}
