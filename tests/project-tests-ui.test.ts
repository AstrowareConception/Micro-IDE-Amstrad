import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm,symlink,link} from 'node:fs/promises';
import {join} from 'node:path';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {ProjectTestsController} from '../apps/desktop/project-tests-controller.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {scenarioForForm,scenariosFromForm,escapeScenarioText,unescapeScenarioText} from '../apps/desktop/src/project-scenario-form.ts';
import {fixture,digest as hash} from './multifile-fixture.ts';
import type {ProjectScenario} from '../packages/emulator/src/project-tests.ts';
const scenario:ProjectScenario={id:'io',name:'Dialogue',seconds:8,inputs:[{atMs:4000,text:'CPC\r'}],checks:[{kind:'file',name:'OUT.TXT',text:'BONJOUR CPC\r\n'}]};
const blocked=()=>({outcome:'blocked' as const,message:'Fixture contrôleur, sans émulation.',emulatedSeconds:0,observations:[]});
async function finished(controller:ProjectTestsController,sessionId:string,id:string){const deadline=Date.now()+5000;while(controller.running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(controller.running,false);return controller.status(sessionId,id);}
test('human form preserves CR, CRLF, literal escapes and rejects invalid keyboard budgets',()=>{
 const input='hello\\r\r\n\t\\';assert.equal(unescapeScenarioText(escapeScenarioText(input)),input);
 assert.deepEqual(scenariosFromForm([scenarioForForm(scenario)]),[scenario]);
 for(const bad of ['\\','\\q','\\u001b'])assert.throws(()=>unescapeScenarioText(bad),/Échappement/);
 assert.throws(()=>scenariosFromForm([{...scenarioForForm(scenario),seconds:4}]),/budget/);
 assert.throws(()=>scenariosFromForm([{...scenarioForForm(scenario),inputs:[{atMs:4000,text:'é'}]}]),/ASCII/);
});
test('human save supports create, edit, delete and exact-revision reopen',async()=>{
 const f=await fixture();try{
  const tests=new ProjectTestStore(f.root,'p'),path=join(f.root,'microide.project-tests.json');
  const created=await tests.save(null,[scenario]);assert.equal(created.revision,hash(await readFile(path)));assert.deepEqual(await new ProjectTestStore(f.root,'p').load(),created);
  const edited=await tests.save(created.revision,[{...scenario,name:'Autre nom'}]);assert.notEqual(edited.revision,created.revision);
  await assert.rejects(tests.save(created.revision,[]),/changé/);assert.deepEqual(await tests.load(),edited);
  assert.deepEqual((await tests.save(edited.revision,[])).scenarios,[]);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('human save preserves corrupt, oversized, symbolic and hard-linked definitions',async()=>{
 const f=await fixture();try{
  const tests=new ProjectTestStore(f.root,'p'),path=join(f.root,'microide.project-tests.json');
  for(const content of ['{broken',JSON.stringify({schemaVersion:1,scenarios:[]})+' '.repeat(131072)]){await writeFile(path,content);await assert.rejects(tests.save(hash(content),[scenario]));assert.equal(await readFile(path,'utf8'),content);}
  await rm(path);
  if(process.platform!=='win32')for(const make of [symlink,link]){await make(join(f.root,'src/main.bas'),path);await assert.rejects(tests.save(null,[scenario]),/liens/);assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);await rm(path);}
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('human execution requires matching project and expectations and archives main-owned provenance',async()=>{
 const f=await fixture();try{
  const {store,snapshot}=await ProjectStore.open(f.root),tests=new ProjectTestStore(f.root,store.manifest.projectId);await tests.save(null,[scenario]);
  const controller=new ProjectTestsController(async()=>blocked()),view=await controller.inspect(store,snapshot.files);
  const changed=snapshot.files.map(file=>({...file,source:file.source+'500 REM buffer only\n'}));
  await assert.rejects(controller.start(store,changed,'io',view.library.revision,view.projectSha256),/changé/);
  await assert.rejects(controller.start(store,snapshot.files,'missing',view.library.revision,view.projectSha256),/enregistré/);
  await tests.save(view.library.revision,[{...scenario,name:'New'}]);await assert.rejects(controller.start(store,snapshot.files,'io',view.library.revision,view.projectSha256),/changé/);
  const fresh=await controller.inspect(store,changed),{id}=await controller.start(store,changed,'io',fresh.library.revision,fresh.projectSha256);
  assert.throws(()=>controller.status('wrong',id),/session/);assert.throws(()=>controller.cancel(store.sessionId,'wrong'),/session/);
  const done=await finished(controller,store.sessionId,id);assert.equal(done.report!.project.projectSha256,fresh.projectSha256);assert.equal(done.report!.project.sources[0]!.sha256,hash(changed[0]!.source));
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  const reopened=await ProjectStore.open(f.root),history=await controller.inspect(reopened.store,reopened.snapshot.files);assert.equal(history.reports.length,1);assert.notEqual(history.projectSha256,history.reports[0]!.project.projectSha256);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('active human job rejects overlap, cancels and preserves malformed history for export',async()=>{
 const f=await fixture();try{
  const {store,snapshot}=await ProjectStore.open(f.root),tests=new ProjectTestStore(f.root,store.manifest.projectId);await tests.save(null,[scenario]);
  const controller=new ProjectTestsController(async(_image,_scenario,signal)=>new Promise((resolve)=>{if(signal.aborted)resolve(blocked());else signal.addEventListener('abort',()=>resolve(blocked()),{once:true});}));
  const view=await controller.inspect(store,snapshot.files),job=await controller.start(store,snapshot.files,'io',view.library.revision,view.projectSha256);
  await assert.rejects(controller.start(store,snapshot.files,'io',view.library.revision,view.projectSha256),/actif/);
  assert.equal(controller.cancel(store.sessionId,job.id).stopped,true);assert.equal((await finished(controller,store.sessionId,job.id)).report!.result.outcome,'cancelled');
  const path=join(f.root,'.microide/project-test-reports.json');await writeFile(path,'broken history');
  const second=new ProjectTestsController(async()=>blocked()),broken=await second.inspect(store,snapshot.files);assert.ok(broken.historyError);
  const started=await second.start(store,snapshot.files,'io',broken.library.revision,broken.projectSha256),result=await finished(second,store.sessionId,started.id);assert.ok(result.archiveError);assert.ok(result.report);assert.equal(await readFile(path,'utf8'),'broken history');
 }finally{await rm(f.root,{recursive:true,force:true});}
});
