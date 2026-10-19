// Real worker/CPC behind the real agent tools and controller; provider alone is scripted.
import assert from 'node:assert/strict';
import {readFile,writeFile,rm,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {AgentProjectTests,prepareProjectTest} from '../packages/agent/src/project-tests.ts';
import {ProjectTestStore} from '../apps/desktop/project-test-store.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {agentProjectTestRunner} from '../apps/desktop/agent-project-test-runner.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {readabilityWitnesses,runReadabilityMission} from '../tests/readability-pipeline-fixture.mjs';
import {projectRunner,literalOracle,displayScenario} from '../tests/project-test-fixture.mjs';
import {fixture,digest as hash} from '../tests/multifile-fixture.ts';
const runner=await projectRunner(),report={version:1,firmware:BASIC_TEST_FIRMWARE,engineSha256:hash(await readFile('out/cpc.wasm')),controlledProvider:true,realWorker:true,physicalCpc:false,independentEmulator:false,cases:[],negative:[],qualified:false};
for(const witness of readabilityWitnesses){
 const oracle=await literalOracle(runner,witness.oracle),scenario=displayScenario(oracle.screenSha256),f=await fixture(witness.source);
 try{
  const definitions=JSON.stringify({schemaVersion:1,scenarios:[scenario]},null,2)+'\n';await writeFile(join(f.root,'microide.project-tests.json'),definitions);
  const mission=await runReadabilityMission(f.root,runner),runs=mission.view.projectTestRuns;
  assert.equal(runs.length,2);assert.equal(runs[0].report.project.sources.length,1);assert.equal(runs[1].report.project.sources.length,2);
  assert.ok(runs.every(r=>r.report.result.outcome==='passed'));assert.equal(runs[0].report.scenarioSha256,runs[1].report.scenarioSha256);
  assert.equal(mission.view.projectTestAssessment.baselined,1);assert.equal(mission.view.projectTestAssessment.valid,true);
  const store=new ProjectTestStore(f.root,mission.store.manifest.projectId);assert.equal((await store.history()).length,2);
  assert.equal(await readFile(join(f.root,'microide.project-tests.json'),'utf8'),definitions);
  report.cases.push({name:witness.name,oracle,runs:runs.map(r=>r.report),assessment:mission.view.projectTestAssessment});
  console.log(witness.name+': true project before/after passed');
  if(witness.name==='while-3'){
   const {store:reopened,snapshot}=await ProjectStore.open(f.root),state=await reopened.agentState(snapshot.files);
   const part=state.files.find(s=>s.cpcName==='PART.BAS');part.source=part.source.replace('score%+i%','score%+i%+1');assert.match(part.source,/\+1/);
   const tests=new AgentProjectTests({load:()=>store.load(),run:runner,record:r=>store.record(r)},hash,()=> 'corrupt-part',()=>new AbortController().signal),read=await tests.list(state);
   const negative=await tests.run(state,'display',read.revision,read.projectSha256);assert.equal(negative.report.result.outcome,'failed');assert.equal(tests.assessment(state,state).valid,false);report.negative.push(negative.report);
   assert.equal(await readFile(join(f.root,'microide.project-tests.json'),'utf8'),definitions);
  }
 }finally{await rm(f.root,{recursive:true,force:true});}
}
// A genuine two-file program reads an immutable disk asset, accepts keyboard input and writes ASCII output.
const f=await fixture();
try{
 await cp('examples/project-tests',f.root,{recursive:true});
 const manifest=JSON.parse(await readFile(join(f.root,'microide.project.json'),'utf8'));
 const asset=await readFile(join(f.root,'assets/input.bin'));
 const definitions=await readFile(join(f.root,'microide.project-tests.json'),'utf8'),scenario=JSON.parse(definitions).scenarios[0];
 const {store,snapshot}=await ProjectStore.open(f.root),state=await store.agentState(snapshot.files),library=new ProjectTestStore(f.root,manifest.projectId);
 const tests=new AgentProjectTests({load:()=>library.load(),run:runner,record:r=>library.record(r)},hash,()=> 'io',()=>new AbortController().signal),read=await tests.list(state);
 const run=await tests.run(state,'io',read.revision,read.projectSha256);assert.equal(run.report.result.outcome,'passed',JSON.stringify(run));assert.equal(run.report.project.assets[0].sha256,hash(asset));
 assert.deepEqual(await readFile(join(f.root,'assets/input.bin')),asset);await assert.rejects(readFile(join(f.root,'OUT.TXT')),{code:'ENOENT'});assert.equal(await readFile(join(f.root,'microide.project-tests.json'),'utf8'),definitions);
 report.cases.push({name:'disk-resource-keyboard-output',runs:[run.report],isolatedOutput:true});
 const image=prepareProjectTest(state,hash),missing=agentProjectTestRunner({load:async()=>{throw Error('missing');}},resolve('out'));
 await assert.rejects(missing(image,scenario,new AbortController().signal),/ROM locales/);
 const abort=new AbortController(),pending=runner(image,scenario,abort.signal);setTimeout(()=>abort.abort(),30);await assert.rejects(pending,/arrêté/);
 report.missingFirmwareBlocked=true;report.workerCancellation=true;
 console.log('Real resource, keyboard and output passed; missing ROM and worker cancellation blocked.');
}finally{await rm(f.root,{recursive:true,force:true});}
report.qualified=true;await writeFile('out/agent-project-tests-qualification.json',JSON.stringify(report,null,2)+'\n');
console.log('6 literal oracles, 12 agent project before/after executions, 1 altered-module rejection and 1 resource/keyboard/output execution qualified.');
