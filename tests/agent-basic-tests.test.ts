import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentBasicTests } from '../packages/agent/src/basic-tests.ts';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { BASIC_TEST_EXAMPLE,basicTestPlan } from '../packages/emulator/src/basic-tests.ts';
import { parseBasicTestReport } from '../packages/emulator/src/basic-test-suites.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { BasicTestSuiteStore } from '../apps/desktop/basic-test-suite-store.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import type { AgentWorkspaceState } from '../packages/agent/src/types.ts';
const hash=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');
const state=():AgentWorkspaceState=>({sessionId:'test',manifest:newProject('Tests','647f023d-1272-4b66-8c47-b064b8de9512'),files:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source:BASIC_TEST_EXAMPLE,saved:BASIC_TEST_EXAMPLE}]});
const passed=(source:{id:string;name:string;source:string})=>({sourceId:source.id,name:source.name,outcome:'passed' as const,message:'Assertions observées',cases:basicTestPlan(source).cases.map(c=>({...c,outcome:'passed' as const,observed:1})),emulatedSeconds:1,sourceSha256:hash(source.source),diskSha256:hash('disk')});
test('agent suites enforce reads, revisions, quotas, report provenance and stale snapshots',async()=>{
 let revision=hash('suite'),count=0;const reports:unknown[]=[];
 const tests=new AgentBasicTests({load:async()=>({revision,suites:[{id:'suite',name:'Score',sourceIds:['main'],seconds:3}]}),run:async source=>{count++;return passed(source);},record:async report=>{reports.push(parseBasicTestReport(report));}},hash,()=>`run-${count}`,()=>new AbortController().signal);
 const workspace=state(),tools=new WorkspaceTools(workspace,async()=>{},hash,[],[],undefined,tests);
 await assert.rejects(tools.execute('basic_tests_run',{suiteId:'suite',expectedRevision:revision}),/stale/);
 await tools.execute('basic_tests_list',{});revision=hash('changed');await assert.rejects(tools.execute('basic_tests_run',{suiteId:'suite',expectedRevision:hash('suite')}),/stale/);
 await tools.execute('basic_tests_list',{});
 await assert.rejects(tools.execute('basic_tests_run',{suiteId:'other',expectedRevision:revision}),/scope/);
 for(let i=0;i<5;i++)await tools.execute('basic_tests_run',{suiteId:'suite',expectedRevision:revision});
 await assert.rejects(tools.execute('basic_tests_run',{suiteId:'suite',expectedRevision:revision}),/quota/);
 assert.equal(count,5);assert.equal(reports.length,5);assert.equal(tests.views(workspace)[0]!.stale,false);
 workspace.files[0]!.source+='100 REM edit\n';assert.equal(tests.views(workspace)[0]!.stale,true);
 assert.equal(tests.runs[0]!.report.sources[0]!.sha256,hash(BASIC_TEST_EXAMPLE));
 revision=hash('external suite');assert.ok((await tests.validate(state())).every(r=>r.stale));
});
test('invalid runtime data, abort and archive failure cannot produce success',async()=>{
 const abort=new AbortController();let mode='invalid';
 const tests=new AgentBasicTests({load:async()=>({revision:'r',suites:[{id:'s',name:'Tests',sourceIds:['main'],seconds:3}]}),run:async source=>({...passed(source),sourceSha256:hash('wrong')}),record:async()=>{if(mode==='invalid')throw Error('disk');}},hash,()=>mode,()=>abort.signal);
 const workspace=state();await tests.list(workspace);const invalid=await tests.run(workspace,'s','r');assert.equal(invalid.report.results[0]!.outcome,'blocked');assert.ok(invalid.archiveError);
 mode='cancelled';abort.abort();const cancelled=await tests.run(workspace,'s','r');assert.equal(cancelled.report.results[0]!.outcome,'cancelled');parseBasicTestReport(cancelled.report);
});
test('real controller runs suites, exposes reports, persists history and blocks a failed final suite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-tests-'));
 try{
  const {store,snapshot}=await ProjectStore.create(root,'Tests agent');
  const suites=new BasicTestSuiteStore(store.root,store.manifest.projectId),id=snapshot.files[0]!.id;
  const library=await suites.save(null,[{id:'score',name:'Score',sourceIds:[id],seconds:3}],[id]);
  for(const fail of [false,true]){
   let turn=0;const call=(name:string,args:unknown)=>({type:'function_call',call_id:String(++turn),name,arguments:JSON.stringify(args)});
   const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',async()=>{
    const step=turn;const output=step===0?call('basic_tests_list',{}):step===1?call('basic_tests_run',{suiteId:'score',expectedRevision:library.revision}):step===2?call('documents_create_note',{title:`Bilan ${fail}`,category:'progress',source:'# Résultats des tests'}):step===3?call('build_project',{}):{type:'message',content:[{type:'output_text',text:'Bilan'}]};
    return Response.json({status:'completed',output:[output],usage:{total_tokens:1}});
   },async source=>fail?{...passed(source),outcome:'blocked',cases:[],message:'ROM absente'}:passed(source));
   controller.configure('sk-fixture-not-real','gpt-5.6-luna');
   const {taskId}=await controller.start(store,'Exécute la suite',[{id,source:BASIC_TEST_EXAMPLE}]);
   let view=controller.status(taskId);for(let i=0;i<300&&view.running;i++){await new Promise(r=>setTimeout(r,10));view=controller.status(taskId);}
   assert.equal(view.running,false);assert.equal(view.status,fail?'blocked':'completed',JSON.stringify(view.events));assert.equal(view.testRuns!.length,1);assert.equal(view.testRuns![0]!.stale,false);
   assert.doesNotMatch(JSON.stringify(view),/"roms"/);
  }
  assert.equal((await suites.history()).length,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
