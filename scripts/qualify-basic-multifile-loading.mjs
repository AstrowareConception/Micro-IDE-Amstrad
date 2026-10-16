// Firmware qualification: ROMs are external inputs, never committed or emitted.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import createCpc from '../out/cpc.mjs';
import {newProject,addProjectSource,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {readDataDisk} from '../packages/cpc-disk/src/data-disk.ts';
import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY} from '../packages/emulator/src/basic-test-runtime.ts';
import {inspectLoadContract} from '../packages/basic-language/src/load-contract.ts';

const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw Error('CPC_TEST_ROM_DIR requis : ROM externes de référence.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const firmware={};
for(const role of ['os','basic','amsdos']){
 const bytes=new Uint8Array(await readFile(join(root,'cpc6128_'+role+'.bin')));
 assert.equal(bytes.length,16384,role+' ROM length');
 assert.equal(sha(bytes),BASIC_TEST_FIRMWARE[role],role+' ROM SHA-256');
 firmware[role]=bytes;
}
const wasmBinary=await readFile('out/cpc.wasm');
const fixtures=[
 {name:'chain-monolith',files:[{name:'MAIN',source:'10 MEMORY &7FFF\n20 POKE &8000,11\n30 POKE &8001,0\n40 POKE &8002,0\n50 POKE &8001,23\n60 POKE &8002,24\n70 END\n'}],expected:[11,23,24]},
 {name:'chain-two-files',files:[{name:'MAIN',source:'10 MEMORY &7FFF\n20 POKE &8000,11\n30 POKE &8001,0\n40 POKE &8002,0\n50 CHAIN "LEVEL.BAS"\n60 POKE &8001,99\n70 END\n'},{name:'LEVEL',source:'10 POKE &8001,23\n20 POKE &8002,24\n30 END\n'}],expected:[11,23,24]},
 {name:'merge-monolith',files:[{name:'MAIN',source:'10 MEMORY &7FFF\n20 POKE &8000,11\n30 POKE &8001,0\n40 POKE &8002,0\n50 GOSUB 100\n60 POKE &8001,PEEK(&8002)+1\n70 END\n100 POKE &8002,23\n110 RETURN\n'}],expected:[11,24,23]},
 {name:'merge-two-files',files:[{name:'MAIN',source:'10 MEMORY &7FFF\n20 POKE &8000,11\n30 POKE &8001,0\n40 POKE &8002,0\n50 MERGE "PART.BAS"\n60 GOSUB 100\n70 POKE &8001,PEEK(&8002)+1\n80 END\n100 REM PLACEHOLDER\n110 RETURN\n'},{name:'PART',source:'100 POKE &8002,23\n110 RETURN\n'}],expected:[11,24,23]}
];
const report={version:1,profile:'cpc6128-classic-v1',dialect:'locomotive-1.1',
 engineSha256:sha(wasmBinary),firmware:BASIC_TEST_FIRMWARE,
 independentEmulator:false,physicalCpc:false,
 scope:'Sample-specific RAM mailbox assertions; no global equivalence claim',
 cases:[],status:'incomplete'};
for(const item of fixtures){
 let project=newProject('Multifile firmware','647f023d-1272-4b66-8c47-b064b8de9512');
 for(const fixture of item.files.slice(1))project=addProjectSource(project,fixture.name);
 const sources=project.sources.map(file=>{
  const fixture=item.files.find(f=>f.name+'.BAS'===file.cpcName);
  assert.ok(fixture,'Missing fixture '+file.cpcName);
  return {...file,source:fixture.source};
 });
 const links=inspectLoadContract(sources);
 assert.equal(links.extractionPermitted,false);
 const disk=buildProjectDisk(project,sources.map(({id,source})=>({id,source})));
 const entries=readDataDisk(disk);
 assert.deepEqual(entries.map(f=>f.name),sources.map(f=>f.cpcName).sort());
 const cpc=await createCpc({wasmBinary}),allocated=[];
 const put=bytes=>{const p=cpc._malloc(bytes.length);assert.ok(p);allocated.push(p);cpc.HEAPU8.set(bytes,p);return p;};
 let observed=[];
 try{
  assert.equal(cpc._cpc_bridge_init(put(firmware.os),16384,put(firmware.basic),16384,put(firmware.amsdos),16384),0);
  for(let i=0;i<250;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  const width=cpc._cpc_bridge_width(),stride=cpc._cpc_bridge_stride(),frame=cpc._cpc_bridge_frame(),ready=Buffer.alloc(width*108);
  for(let y=0;y<108;y++)ready.set(cpc.HEAPU8.subarray(frame+y*stride,frame+y*stride+width),y*width);
  assert.equal(sha(ready),BASIC_TEST_READY,'Reference ROM ready fingerprint');
  assert.equal(cpc._cpc_bridge_mount(put(disk),disk.length),0);
  for(const char of 'RUN"MAIN.BAS"\r'){
   assert.ok(cpc._cpc_bridge_key(char.charCodeAt(0),1)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
   assert.ok(cpc._cpc_bridge_key(char.charCodeAt(0),0)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
  }
  for(let i=0;i<500;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  observed=[0x8000,0x8001,0x8002].map(address=>cpc._cpc_bridge_peek(address));
 }finally{
  cpc._cpc_bridge_release_keys();
  cpc._cpc_bridge_dispose();
  for(const p of allocated)cpc._free(p);
 }
 const outcome={name:item.name,diskSha256:sha(disk),
  sourceSha256:Object.fromEntries(sources.map(x=>[x.cpcName,sha(new TextEncoder().encode(x.source))])),
  files:entries.map(f=>f.name),links:links.links.map(l=>({line:l.basicLine,operation:l.operation,target:l.resolvedCpcName})),
  expected:item.expected,observed,passed:observed.every((value,i)=>value===item.expected[i])};
 report.cases.push(outcome);
 console.log(item.name+': '+JSON.stringify({observed,expected:item.expected,passed:outcome.passed}));
}
const byName=name=>report.cases.find(x=>x.name===name);
assert.deepEqual(byName('chain-monolith').observed,byName('chain-two-files').observed,'CHAIN vs monolith RAM marker');
assert.deepEqual(byName('merge-monolith').observed,byName('merge-two-files').observed,'MERGE vs monolith RAM marker');
report.status=report.cases.every(c=>c.passed)?'passed':'failed';
await writeFile('out/basic-multifile-loading-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.status,'passed','Actual CPC firmware multi-file scenario failed; see qualification log.');
console.log('CPC 6128 CHAIN/MERGE sample RAM markers matched monoliths; no generalized equivalence claim.');
