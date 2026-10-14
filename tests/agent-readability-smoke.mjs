import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { BasicTestSuiteStore } from '../apps/desktop/basic-test-suite-store.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import { BASIC_TEST_EXAMPLE,basicTestPlan } from '../packages/emulator/src/basic-tests.ts';
export async function verifyAgentReadability(browser){
 const root=await mkdtemp(join(tmpdir(),'readability-ui-')),hash=s=>createHash('sha256').update(s).digest('hex');
 const {store,snapshot}=await ProjectStore.create(root,'Lisibilité · règles du jeu');
 snapshot.files[0].source=BASIC_TEST_EXAMPLE;
 const suite=await new BasicTestSuiteStore(root,store.manifest.projectId).save(null,[{id:'score',name:'Score',sourceIds:[snapshot.files[0].id],seconds:3}],[snapshot.files[0].id]);
 let step=0;
 const call=(name,args)=>({type:'function_call',call_id:String(step),name,arguments:JSON.stringify(args)});
 const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',async(url)=>{
  if(String(url).endsWith('/models'))return Response.json({data:[{id:'gpt-5.6-luna',created:100,owned_by:'openai'}]});
  if(!String(url).endsWith('/responses'))return new Response('',{status:404});
  const steps=[()=>call('basic_tests_list',{}),()=>call('basic_tests_run',{suiteId:'score',expectedRevision:suite.revision}),()=>call('reference_read_many',{names:['MEMORY','REM','GOSUB','IF','THEN','ELSE','POKE','END','RETURN']}),()=>call('project_replace_source',{id:snapshot.files[0].id,expectedHash:hash(BASIC_TEST_EXAMPLE),source:BASIC_TEST_EXAMPLE.replaceAll('score','points')}),()=>call('basic_tests_run',{suiteId:'score',expectedRevision:suite.revision}),()=>call('build_project',{}),()=>({type:'message',content:[{type:'output_text',text:'Noms clarifiés ; deux essais de la suite Score.'}]})];
  const output=steps[step++]();return Response.json({status:'completed',output:[output],usage:{total_tokens:1}});
 },async source=>({sourceId:source.id,name:source.name,outcome:'passed',message:'Transport de test contrôlé pour la recette UI.',cases:basicTestPlan(source).cases.map(c=>({...c,outcome:'passed',observed:1})),emulatedSeconds:1,sourceSha256:hash(source.source),diskSha256:hash('disk')}));
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('readabilityOpen',()=>snapshot);
 await page.exposeFunction('readabilityAgent',async({action,args})=>{try{if(action==='start')return await controller.start(store,args[1],args[2],args[3],args[4]);if(action==='restore')return await controller.restore(args[0],args[1]);return await controller[action](...args);}catch(e){return {error:e.message};}});
 await page.addInitScript(()=>{const agent={};for(const action of ['models','selectModel','configure','pricing','start','status','restore'])agent[action]=(...args)=>window.readabilityAgent({action,args});window.desktop={setDirty(){},open:async()=>null,save:async()=>null,exportDisk:async()=>null,project:{open:()=>window.readabilityOpen()},agent};});
 try{
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Ouvrir projet',exact:true}).click();
  if(!await page.getByRole('region',{name:'Agent OpenAI',exact:true}).isVisible())await page.getByRole('button',{name:'Afficher l’agent IA',exact:true}).click();
  const agent=page.getByRole('region',{name:'Agent OpenAI',exact:true}),objective=agent.getByLabel('Mission de programmation',{exact:true});
  await objective.fill('Mission précédente');await agent.getByText('Améliorer la lisibilité du code…',{exact:true}).click();
  await agent.getByLabel('Plan de découpage en fichiers (sans déplacement de code)',{exact:true}).check();await agent.getByRole('button',{name:'Préparer la mission de lisibilité',exact:true}).click();
  await expect(objective).toHaveValue(/Ne déplace pas de code/);await expect(objective).toHaveValue(/DEFINT/);assert.equal(step,0);
  await agent.getByRole('button',{name:'Rétablir la mission précédente',exact:true}).click();await expect(objective).toHaveValue('Mission précédente');await agent.getByRole('button',{name:'Préparer la mission de lisibilité',exact:true}).click();
  await agent.locator('.readability-panel').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:'out/agent-readability-alpha.png'});
  await agent.getByRole('button',{name:'Réglages IA',exact:true}).click();const settings=page.getByRole('dialog',{name:'Réglages de l’agent IA',exact:true});await settings.getByLabel('Clé API OpenAI',{exact:true}).fill('sk-fixture-not-real');await settings.getByRole('button',{name:'Configurer la clé',exact:true}).click();await settings.getByLabel('Modèle OpenAI',{exact:true}).selectOption('gpt-5.6-luna');await settings.getByRole('button',{name:'Fermer les réglages IA',exact:true}).click();
  await agent.getByRole('button',{name:'Lancer l’agent',exact:true}).click();await expect(agent.locator('.agent-result')).toContainText('Mission terminée');
  const reports=agent.getByRole('region',{name:'Vérifications CPC de la mission'});await expect(reports).toContainText('Essai 1 · Score · révision antérieure');await expect(reports).toContainText('Essai 2 · Score · révision courante');
  await expect(page.locator('.monaco-editor').first()).toContainText('points');
  await agent.getByRole('button',{name:'Restaurer le checkpoint initial',exact:true}).click();await expect(agent).toContainText('Checkpoint initial restauré');await expect(agent.locator('.agent-result')).toHaveCount(0);
  assert.deepEqual(errors,[]);console.log('Readability UI: options, editable mission, no implicit AI, before/after reports, source adoption and restoration passed.');
 }finally{await context.close();await rm(root,{recursive:true,force:true});}
}
