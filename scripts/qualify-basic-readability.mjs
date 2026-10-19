// Run the real controller and disk transactions, then execute each saved project on CPC.
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {buildProjectDisk,newProject} from '../packages/workspace/src/project.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {fixture,digest as sha} from '../tests/multifile-fixture.ts';
import {readabilityWitnesses,runReadabilityMission} from '../tests/readability-pipeline-fixture.mjs';
import {observe,wasmBinary} from './cpc-project-observer.mjs';
const report={version:1,firmware:BASIC_TEST_FIRMWARE,engineSha256:sha(wasmBinary),controlledProvider:true,
 actualProjectWrites:true,physicalCpc:false,independentEmulator:false,
 proof:'External qualification of saved project DSKs; no CPC project-test tool is added to the agent.',cases:[],qualified:false};
const disk=snapshot=>buildProjectDisk(snapshot.manifest,snapshot.files);
for(const witness of readabilityWitnesses){
 const f=await fixture(witness.source.replace(/\n/g,'\r\n'));
 try{
  const p=await runReadabilityMission(f.root),applied=await ProjectStore.open(f.root);
  const originalDisk=disk(p.snapshot),appliedDisk=disk(applied.snapshot);
  await p.controller.restore(p.taskId,p.view.workspace.files);
  const restored=await ProjectStore.open(f.root),restoredDisk=disk(restored.snapshot);
  assert.equal(restored.snapshot.files[0].source,witness.source);
  assert.equal(restored.snapshot.manifest.documents.length,0);
  assert.equal(sha(restoredDisk),sha(originalDisk));
  // A second mission on the restored project isolates the restart-only undo path.
  const second=await runReadabilityMission(f.root),secondReopen=await ProjectStore.open(f.root);
  assert.equal(sha(disk(secondReopen.snapshot)),sha(appliedDisk));
  const last=await secondReopen.store.lastAgentMutation();assert.ok(last);
  const mono=second.view.extractionSimulations.at(-1).record.beforeMain;
  await secondReopen.store.restoreAgentMutation(last.revision,secondReopen.snapshot.files);
  const undone=await ProjectStore.open(f.root),undoneDisk=disk(undone.snapshot);
  assert.equal(undone.snapshot.files[0].source,mono);
  assert.equal(undone.snapshot.manifest.documents.length,1);
  assert.equal(await readFile(join(f.root,'src/main.bas'),'utf8'),mono);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
  const manifest=newProject('Oracle affichage','647f023d-1272-4b66-8c47-b064b8de9512');
  const oracleDisk=buildProjectDisk(manifest,[{...manifest.sources[0],source:witness.oracle}]);
  const oracle={sourceSha256:sha(witness.oracle),diskSha256:sha(oracleDisk),...(await observe(oracleDisk,witness.screenRows))};
  const specimen={name:witness.name,sourceSha256:sha(witness.source),oracle,
   sources:applied.snapshot.files.map(file=>({path:file.path,sha256:sha(file.source)})),
   rename:p.view.renameOperations[0].status,format:p.view.formatOperations[0].status,comment:p.view.commentOperations[0].status,
   extraction:p.view.extractionSimulations.at(-1).record.status,noteCreated:true,
   initialSourceAndDiskRestored:true,lastMutationOnlyAfterRestart:true,runs:[],passed:false};
  for(const [name,bytes] of [['original',originalDisk],['applied-reopened',appliedDisk],['last-mutation-restored',undoneDisk],['mission-restored',restoredDisk]]){
   const observed=await observe(bytes,witness.screenRows),passed=observed.screenSha256===oracle.screenSha256;
   specimen.runs.push({name,diskSha256:sha(bytes),screenSha256:observed.screenSha256,passed});
   console.log(witness.name+'/'+name+': '+JSON.stringify({screenMatchesOracle:passed}));
  }
  specimen.passed=specimen.runs.every(run=>run.passed);report.cases.push(specimen);
 }finally{await rm(f.root,{recursive:true,force:true});}
}
report.qualified=report.cases.length===6&&report.cases.every(c=>c.passed);
await writeFile('out/basic-readability-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.qualified,true,'Saved readability project differs from its literal display oracle.');
console.log('6 complete controlled missions, 24 actual project runs and 6 literal screen oracles passed on pinned CPC 6128 ROMs.');
