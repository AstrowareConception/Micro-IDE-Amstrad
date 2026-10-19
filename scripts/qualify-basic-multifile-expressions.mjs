// Actual journalized projects, not pre-authored two-file equivalents. ROMs stay external.
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {buildProjectDisk,newProject} from '../packages/workspace/src/project.ts';
import {EXPRESSION_EXTRACTION_PROFILE,CONDITIONAL_EXTRACTION_PROFILE,LOOP_EXTRACTION_PROFILE} from '../packages/workspace/src/terminal-expressions.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare,digest as sha} from '../tests/multifile-fixture.ts';
import {expressionWitnesses} from '../tests/terminal-expression-fixtures.ts';
import {conditionWitnesses} from '../tests/terminal-condition-fixtures.ts';
import {loopWitnesses} from '../tests/terminal-loop-fixtures.ts';
import {BASIC_TEST_FIRMWARE} from '../packages/emulator/src/basic-test-runtime.ts';
import {observe,wasmBinary} from './cpc-project-observer.mjs';
const loops=process.argv.includes('--loops');
const conditions=process.argv.includes('--conditions');
const witnesses=loops?loopWitnesses:conditions?conditionWitnesses:expressionWitnesses;
const profile=loops?LOOP_EXTRACTION_PROFILE:conditions?CONDITIONAL_EXTRACTION_PROFILE:EXPRESSION_EXTRACTION_PROFILE;

const report={version:1,profile,firmware:BASIC_TEST_FIRMWARE,engineSha256:sha(wasmBinary),
 actualProjectWrites:true,reopened:true,physicalCpc:false,independentEmulator:false,
 screenObservation:'First printed text rows in video RAM after MODE; literal oracle, excludes Ready and cursor; no timing equivalence.',cases:[],qualified:false};
for(const witness of witnesses){
 const f=await fixture(witness.source.replace(/\n/g,'\r\n'));
 try{
  const p=await prepare(f.root),originalDisk=buildProjectDisk(p.snapshot.manifest,p.snapshot.files);
  await p.tools.execute('reference_read_many',{names:['MODE','CLS','LET','PRINT',...((conditions||loops)?['IF']:[]),...(loops?['FOR','NEXT','WHILE','WEND']:[])]});
  assert.equal(p.tools.extractionSimulationViews()[0].record.profile,profile);
  await p.apply();
  const reopened=await ProjectStore.open(f.root),appliedDisk=buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files);
  assert.equal(sha(appliedDisk),p.preview.proposedDiskSha256);
  const last=await reopened.store.lastAgentMutation();assert.ok(last);
  await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
  const restored=await ProjectStore.open(f.root),restoredDisk=buildProjectDisk(restored.snapshot.manifest,restored.snapshot.files);
  assert.equal(sha(restoredDisk),sha(originalDisk));
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
  let oracle=null;
  if(witness.oracle){
   const manifest=newProject('Literal display oracle','647f023d-1272-4b66-8c47-b064b8de9512');
   const disk=buildProjectDisk(manifest,[{...manifest.sources[0],source:witness.oracle}]);
   oracle={sourceSha256:sha(witness.oracle),diskSha256:sha(disk),...(await observe(disk,witness.screenRows))};
  }
  const specimen={name:witness.name,sourceSha256:sha(witness.source),expectedRam:witness.expected,screenRows:witness.screenRows,oracle,
   exactByteRestoration:true,sources:reopened.snapshot.files.map(file=>({path:file.path,sha256:sha(file.source)})),runs:[],passed:false};
  for(const [name,disk]of [['original',originalDisk],['applied-reopened',appliedDisk],['restored-reopened',restoredDisk]]){
   const observed=await observe(disk,witness.screenRows);
   const passed=JSON.stringify(observed.ram)===JSON.stringify(witness.expected)&&(!oracle||observed.screenSha256===oracle.screenSha256);
   specimen.runs.push({name,diskSha256:sha(disk),...observed,passed});
   console.log(witness.name+'/'+name+': '+JSON.stringify({ram:observed.ram,screenMatchesOracle:!oracle||observed.screenSha256===oracle.screenSha256,passed}));
  }
  specimen.passed=specimen.runs.every(run=>run.passed);
  report.cases.push(specimen);
 }finally{await rm(f.root,{recursive:true,force:true});}
}
report.qualified=report.cases.length===witnesses.length&&report.cases.every(specimen=>specimen.passed);
await writeFile(`out/basic-multifile-${loops?'loops':conditions?'conditions':'expressions'}-qualification.json`,JSON.stringify(report,null,2)+'\n');
assert.equal(report.qualified,true,'Expression/display extraction differs from its RAM or literal screen oracle.');
console.log(`${witnesses.length} persisted/reopened/restored witnesses and ${witnesses.filter(w=>w.oracle).length} literal display oracles passed on pinned CPC 6128 ROMs (${profile}).`);
