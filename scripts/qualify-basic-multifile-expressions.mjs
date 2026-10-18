// Actual journalized projects, not pre-authored two-file equivalents. ROMs stay external.
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import createCpc from '../out/cpc.mjs';
import {buildProjectDisk,newProject} from '../packages/workspace/src/project.ts';
import {EXPRESSION_EXTRACTION_PROFILE,CONDITIONAL_EXTRACTION_PROFILE} from '../packages/workspace/src/terminal-expressions.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare,digest as sha} from '../tests/multifile-fixture.ts';
import {expressionWitnesses} from '../tests/terminal-expression-fixtures.ts';
import {conditionWitnesses} from '../tests/terminal-condition-fixtures.ts';
import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY} from '../packages/emulator/src/basic-test-runtime.ts';
const conditions=process.argv.includes('--conditions');
const witnesses=conditions?conditionWitnesses:expressionWitnesses;
const profile=conditions?CONDITIONAL_EXTRACTION_PROFILE:EXPRESSION_EXTRACTION_PROFILE;

const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw Error('CPC_TEST_ROM_DIR required; ROM remains external.');
const roms={};
for(const kind of ['os','basic','amsdos']){
 const bytes=new Uint8Array(await readFile(join(root,'cpc6128_'+kind+'.bin')));
 assert.equal(bytes.length,16384);assert.equal(sha(bytes),BASIC_TEST_FIRMWARE[kind]);roms[kind]=bytes;
}
const wasmBinary=await readFile('out/cpc.wasm');
async function observe(disk,screenRows){
 const cpc=await createCpc({wasmBinary}),allocations=[];
 const put=bytes=>{const pointer=cpc._malloc(bytes.length);assert.ok(pointer);allocations.push(pointer);cpc.HEAPU8.set(bytes,pointer);return pointer;};
 try{
  assert.equal(cpc._cpc_bridge_init(put(roms.os),16384,put(roms.basic),16384,put(roms.amsdos),16384),0);
  for(let i=0;i<250;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  const width=cpc._cpc_bridge_width(),stride=cpc._cpc_bridge_stride(),frame=cpc._cpc_bridge_frame(),ready=Buffer.alloc(width*108);
  for(let y=0;y<108;y++)ready.set(cpc.HEAPU8.subarray(frame+y*stride,frame+y*stride+width),y*width);
  assert.equal(sha(ready),BASIC_TEST_READY);
  assert.equal(cpc._cpc_bridge_mount(put(disk),disk.length),0);
  for(const character of 'RUN"MAIN.BAS"\r'){
   assert.ok(cpc._cpc_bridge_key(character.charCodeAt(0),1)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
   assert.ok(cpc._cpc_bridge_key(character.charCodeAt(0),0)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
  }
  for(let i=0;i<500;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  const ram=[0x8000,0x8001,0x8002,0x8003].map(address=>cpc._cpc_bridge_peek(address));
  // MODE resets the screen to &C000. Read only printed rows, excluding Ready/cursor blink.
  const screen=[];
  for(let y=0;y<screenRows*8;y++)for(let x=0;x<80;x++)screen.push(cpc._cpc_bridge_peek(0xc000+(y&7)*0x800+(y>>3)*80+x));
  return {ram,screenSha256:screen.length?sha(Uint8Array.from(screen)):null};
 }finally{cpc._cpc_bridge_release_keys();cpc._cpc_bridge_dispose();for(const pointer of allocations)cpc._free(pointer);}
}
const report={version:1,profile,firmware:BASIC_TEST_FIRMWARE,engineSha256:sha(wasmBinary),
 actualProjectWrites:true,reopened:true,physicalCpc:false,independentEmulator:false,
 screenObservation:'First printed text rows in video RAM after MODE; literal oracle, excludes Ready and cursor; no timing equivalence.',cases:[],qualified:false};
for(const witness of witnesses){
 const f=await fixture(witness.source.replace(/\n/g,'\r\n'));
 try{
  const p=await prepare(f.root),originalDisk=buildProjectDisk(p.snapshot.manifest,p.snapshot.files);
  await p.tools.execute('reference_read_many',{names:['MODE','CLS','LET','PRINT',...(conditions?['IF']:[])]});
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
await writeFile(`out/basic-multifile-${conditions?'conditions':'expressions'}-qualification.json`,JSON.stringify(report,null,2)+'\n');
assert.equal(report.qualified,true,'Expression/display extraction differs from its RAM or literal screen oracle.');
console.log(`${witnesses.length} persisted/reopened/restored witnesses and ${witnesses.filter(w=>w.oracle).length} literal display oracles passed on pinned CPC 6128 ROMs (${profile}).`);
