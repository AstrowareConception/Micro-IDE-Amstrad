import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {AgentProjectTests,prepareProjectTest,projectTestFingerprint,type AgentProjectTestPort} from '../packages/agent/src/project-tests.ts';
import {parseProjectTests,parseProjectTestReport,validProjectTestResult,projectScenarioPlan,type ProjectScenario,type ProjectTestImage,type ProjectTestResult} from '../packages/emulator/src/project-tests.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {AgentController} from '../apps/desktop/agent-controller.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {newProject} from '../packages/workspace/src/project.ts';
import type {AgentWorkspaceState} from '../packages/agent/src/types.ts';
import {fixture,digest as hash} from './multifile-fixture.ts';
const scenario:ProjectScenario={id:'display',name:'Résultat',seconds:3,inputs:[],checks:[{kind:'file',name:'OUT.TXT',text:'42\r\n'}]};
const state=():AgentWorkspaceState=>({sessionId:'test',manifest:newProject('Projet',randomUUID()),files:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source:'10 END\n',saved:'10 END\n'}]});
const passed=(image:ProjectTestImage,s:ProjectScenario):ProjectTestResult=>({outcome:'passed',message:'Transport simulé, pas une preuve firmware',emulatedSeconds:10,diskSha256:image.diskSha256,firmware:{...BASIC_TEST_FIRMWARE},observations:projectScenarioPlan(s).checks.map(c=>({kind:c.kind,name:c.name,line:c.line,outcome:'passed',expectedSha256:c.kind==='screen'?c.sha256:hash(c.text),actualSha256:c.kind==='screen'?c.sha256:hash(c.text),message:'fixture'}))});
function rig(run:AgentProjectTestPort['run']=async(image,s)=>passed(image,s)){
 const library={revision:hash('library'),scenarios:[structuredClone(scenario)]},reports:unknown[]=[];let n=0;
 const tests=new AgentProjectTests({load:async()=>library,run,record:async r=>{reports.push(r);}},hash,()=>`run-${++n}`,()=>new AbortController().signal);
 const execute=async(s:AgentWorkspaceState)=>{const l=await tests.list(s);return tests.run(s,'display',l.revision,l.projectSha256);};
 return {tests,library,reports,execute};
}
test('project scenarios reject malformed, unbounded and instrumentation requests',()=>{
 assert.deepEqual(parseProjectTests({schemaVersion:1,scenarios:[scenario]}).scenarios,[scenario]);
 for(const bad of [{...scenario,seconds:16},{...scenario,checks:[]},{...scenario,inputs:[{atMs:0,text:'a'},{atMs:20,text:'b'}]},{...scenario,inputs:[{atMs:2900,text:'abc'}]},{...scenario,fixtures:[]},{...scenario,sourceIds:['main']},{...scenario,checks:[{kind:'file',name:'../x',text:''}]},{...scenario,checks:[{kind:'screen',name:'x',x:0,y:0,width:768,height:272,sha256:hash('x')}]}])assert.throws(()=>parseProjectTests({schemaVersion:1,scenarios:[bad]}));
 assert.throws(()=>parseProjectTests({schemaVersion:1,scenarios:[scenario,scenario]}));
});
test('tools require exact scenario and project reads, retain quotas and never expose expectation writes',async()=>{
 const r=rig(),s=state(),tools=new WorkspaceTools(s,async()=>{},hash,[],[],undefined,undefined,r.tests);
 const names=tools.definitions.map(d=>d.name);assert.ok(names.includes('project_tests_run'));assert.ok(!names.some(n=>/project_tests_(save|write|create)/.test(n)));
 await assert.rejects(r.tests.run(s,'display',r.library.revision,projectTestFingerprint(s,hash)),/stale-read/);
 const read=await r.tests.list(s);s.files[0]!.source+='20 REM edit\n';await assert.rejects(r.tests.run(s,'display',read.revision,read.projectSha256),/stale-read/);
 const fresh=await r.tests.list(s);r.library.revision=hash('changed');await assert.rejects(r.tests.run(s,'display',fresh.revision,fresh.projectSha256),/stale-read/);
 for(let n=0;n<5;n++)await r.execute(s);
 await assert.rejects(r.execute(s),/quota-exceeded/);assert.equal(r.reports.length,5);
});
test('whole-project identity binds sources, asset bytes and entry, excluding documentary notes',async()=>{
 const s=state(),before=projectTestFingerprint(s,hash);
 const documented=structuredClone(s);documented.manifest.documents.push({id:'note',path:'documents/note.md',sha256:hash('note'),mediaType:'text/markdown',role:'context',originalName:'note.md'});
 assert.equal(projectTestFingerprint(documented,hash),before);
 const r=rig();await r.execute(s);const modified=structuredClone(s);modified.files[0]!.source+='20 REM changed\n';assert.ok(r.tests.views(modified)[0]!.stale);
 assert.equal(r.tests.assessment(s,modified).valid,false);await r.execute(modified);assert.equal(r.tests.assessment(s,modified).baselined,1);
 const assets=structuredClone(s);assets.manifest.assets=[{id:'asset',path:'assets/data.bin',cpcName:'DATA.BIN',sha256:hash('a'),byteLength:1}];assets.assets=[{id:'asset',bytes:Uint8Array.of(1)}];const assetHash=projectTestFingerprint(assets,hash);assets.assets[0]!.bytes[0]=2;assert.notEqual(projectTestFingerprint(assets,hash),assetHash);
 const image=prepareProjectTest(assets,hash);assert.equal(image.assets[0]!.sha256,hash(Uint8Array.of(2)));
});
test('last failed test and changed expectations invalidate final success and before/after pairing',async()=>{
 let fail=false;const r=rig(async(image,s)=>{const result=passed(image,s);if(fail){result.outcome='failed';result.observations[0]!.outcome='failed';result.observations[0]!.actualSha256=hash('wrong');}return result;});
 const s=state();await r.execute(s);assert.ok(r.tests.assessment(s,s).valid);fail=true;await r.execute(s);assert.equal(r.tests.assessment(s,s).valid,false);
 fail=false;await r.execute(s);r.library.revision=hash('new expectations');await r.tests.validate(s);assert.ok(r.tests.views(s).every(r=>r.definitionStale));
 r.library.revision=hash('library');await r.tests.validate(s);assert.equal(r.tests.assessment(s,s).valid,false,'reverting definitions must not revive old evidence');
 const changed=structuredClone(s);changed.files[0]!.source+='20 REM new\n';await r.execute(changed);assert.equal(r.tests.assessment(s,changed).baselined,0);
});
test('forged disk, ROM, file expectation and partial observations cannot pass',async()=>{
 const image=prepareProjectTest(state(),hash),good=passed(image,scenario);
 for(const mutate of [(r:ProjectTestResult)=>r.diskSha256=hash('wrong'),(r:ProjectTestResult)=>r.firmware!.os=hash('wrong'),(r:ProjectTestResult)=>r.observations=[],(r:ProjectTestResult)=>r.observations[0]!.expectedSha256=hash('wrong'),(r:ProjectTestResult)=>r.emulatedSeconds=1]){const bad=structuredClone(good);mutate(bad);assert.equal(validProjectTestResult(bad,scenario,image.diskSha256,hash),false);}
 const r=rig(async()=>({...good,diskSha256:hash('wrong')}));const run=await r.execute(state());assert.equal(run.report.result.outcome,'blocked');parseProjectTestReport(run.report,hash);
});
test('abort, missing runtime, archival failure and expectation edits during a run remain visible',async()=>{
 const abort=new AbortController();let revision=hash('library');
 const tests=new AgentProjectTests({load:async()=>({revision,scenarios:[scenario]}),run:async(image,s)=>{revision=hash('changed during execution');return passed(image,s);},record:async()=>{throw Error('disk');}},hash,randomUUID,()=>abort.signal);
 const s=state();let l=await tests.list(s),run=await tests.run(s,'display',l.revision,l.projectSha256);assert.ok(run.definitionStale);assert.ok(run.stale);assert.ok(run.archiveError);
 abort.abort();l=await tests.list(s);run=await tests.run(s,'display',l.revision,l.projectSha256);assert.equal(run.report.result.outcome,'cancelled');
 const unavailable=rig(async()=>{throw Error('ROM absentes');});assert.equal((await unavailable.execute(s)).report.result.outcome,'blocked');
});
test('expectations remain readonly; reports survive reopen, reject tampering and links',async()=>{
 const f=await fixture();try{
  const store=new ProjectTestStore(f.root,'test'),path=join(f.root,'microide.project-tests.json');assert.deepEqual(await store.load(),{revision:null,scenarios:[]});
  const bytes=JSON.stringify({schemaVersion:1,scenarios:[scenario]});await writeFile(path,bytes);const original=await readFile(path);
  const r=rig();r.library.revision=(await store.load()).revision!;const report=(await r.execute(state())).report;await store.record(report);assert.deepEqual((await new ProjectTestStore(f.root,'test').history())[0],report);await store.record(report);assert.equal((await store.history()).length,1);assert.deepEqual(await readFile(path),original);
  const wrong=structuredClone(report);wrong.project.diskSha256=hash('wrong');await assert.rejects(store.record(wrong),/incohérent/);assert.deepEqual(await readFile(path),original);
  await writeFile(path,'{"schemaVersion":2}');await assert.rejects(store.load());await rm(path);
  if(process.platform!=='win32'){await symlink('src/main.bas',path);await assert.rejects(store.load(),/liens/);}
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('real controller exposes project evidence and blocks wrong final expectations',async()=>{
 const f=await fixture('10 END\n');try{
  await writeFile(join(f.root,'microide.project-tests.json'),JSON.stringify({schemaVersion:1,scenarios:[scenario]}));
  for(const failure of [false,true]){
   const {store,snapshot}=await ProjectStore.open(f.root);let step=0;
   const controller=new AgentController(join(f.root,'checkpoints'),'knowledge/locomotive-basic',async(_url,init)=>{
    const input=JSON.parse(init!.body as string).input,read=()=>JSON.parse(input.find((i:{call_id:string;type:string})=>i.type==='function_call_output'&&i.call_id==='list')!.output);
    const call=(id:string,name:string,args:unknown)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
    const output=++step===1?call('list','project_tests_list',{}):step===2?call('run','project_tests_run',{scenarioId:'display',expectedRevision:read().revision,expectedProjectSha256:read().projectSha256}):step===3?call('build','build_project',{}):{type:'message',content:[{type:'output_text',text:'Bilan'}]};
    return Response.json({status:'completed',output:[output],usage:{total_tokens:1}});
   },undefined,async(image,s)=>failure?{outcome:'blocked',message:'ROM absentes',emulatedSeconds:0,observations:[]}:passed(image,s));
   controller.configure('sk-fixture-not-real','gpt-5.6-luna');const {taskId}=await controller.start(store,'Teste le projet',snapshot.files);
   const deadline=Date.now()+10000;while(controller.running&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
   const view=controller.status(taskId);assert.equal(view.running,false);assert.equal(view.status,failure?'blocked':'completed',JSON.stringify(view.events));assert.equal(view.projectTestRuns!.length,1);assert.equal(view.projectTestAssessment!.valid,!failure);assert.doesNotMatch(JSON.stringify(view),/"roms"/);
  }
  const {store}=await ProjectStore.open(f.root);assert.equal((await new ProjectTestStore(f.root,store.manifest.projectId).history()).length,2);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
