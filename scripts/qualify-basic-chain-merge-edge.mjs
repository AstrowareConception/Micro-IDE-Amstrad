// CPC 6128 firmware qualification for BASIC persistence and deliberately divergent behaviors.
// Firmware is external input only. The report contains hashes and mailbox values, no ROM bytes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import createCpc from '../out/cpc.mjs';
import {newProject,addProjectSource,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {readDataDisk} from '../packages/cpc-disk/src/data-disk.ts';
import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY} from '../packages/emulator/src/basic-test-runtime.ts';
import {inspectChainMergeOverlay} from '../packages/basic-language/src/chain-merge-overlay.ts';
import {inspectLoadContract} from '../packages/basic-language/src/load-contract.ts';

const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw Error('CPC_TEST_ROM_DIR required: pinned external CPC 6128 ROMs.');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const roms={};
for(const name of ['os','basic','amsdos']){
 const bytes=new Uint8Array(await readFile(join(root,'cpc6128_'+name+'.bin')));
 assert.equal(bytes.length,16384,name);
 assert.equal(digest(bytes),BASIC_TEST_FIRMWARE[name],name+' reference');
 roms[name]=bytes;
}
const wasmBinary=await readFile('out/cpc.wasm');
const file=(name,source)=>({name,source});
// The tests intentionally use a pre-existing placeholder at each overlay line
// so the independent source builder can validate the original GOSUB/RESTORE targets.
const fixtures=[
 {
  "name": "arrays-strings-monolith",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 DIM points%(2)\n30 points%(1)=42\n40 title$=\"MAHJONG\"\n50 POKE &8000,11\n60 GOTO 100\n100 POKE &8001,points%(1)\n110 POKE &8002,LEN(title$)\n120 POKE &8003,ASC(LEFT$(title$,1))\n130 END\n"
   }
  ],
  "expected": [
   11,
   42,
   7,
   77
  ],
  "group": "arrays-strings",
  "role": "baseline"
 },
 {
  "name": "arrays-strings-chain-merge",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 DIM points%(2)\n30 points%(1)=42\n40 title$=\"MAHJONG\"\n50 POKE &8000,11\n60 CHAIN MERGE \"PART.BAS\",100\n70 END\n100 POKE &8001,99\n110 POKE &8002,99\n120 POKE &8003,99\n130 END\n"
   },
   {
    "name": "PART",
    "source": "100 POKE &8001,points%(1)\n110 POKE &8002,LEN(title$)\n120 POKE &8003,ASC(LEFT$(title$,1))\n130 END\n"
   }
  ],
  "expected": [
   11,
   42,
   7,
   77
  ],
  "group": "arrays-strings",
  "role": "overlay"
 },
 {
  "name": "data-pointer-monolith",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 READ a\n30 POKE &8000,a\n40 READ b\n50 POKE &8001,b\n60 END\n500 DATA 7,19\n"
   }
  ],
  "expected": [
   7,
   19,
   0,
   0
  ],
  "group": "data-pointer",
  "role": "baseline"
 },
 {
  "name": "data-pointer-chain-merge",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 READ a\n30 POKE &8000,a\n40 CHAIN MERGE \"PART.BAS\",100\n50 END\n100 READ b\n110 POKE &8001,b\n120 END\n500 DATA 7,19\n"
   },
   {
    "name": "PART",
    "source": "100 READ b\n110 POKE &8001,b\n120 END\n"
   }
  ],
  "expected": [
   7,
   7,
   0,
   0
  ],
  "group": "data-pointer",
  "role": "overlay"
 },
 {
  "name": "delete-absent",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 dest=300\n30 POKE &8000,11\n40 CHAIN MERGE \"PART.BAS\",100\n50 END\n100 POKE &8001,99\n110 END\n300 POKE &8002,44\n310 END\n"
   },
   {
    "name": "PART",
    "source": "100 POKE &8001,55:ON ERROR GOTO 800\n110 GOTO dest\n120 END\n800 POKE &8002,77\n810 END\n"
   }
  ],
  "expected": [
   11,
   55,
   44,
   0
  ],
  "group": "delete-range",
  "role": "baseline"
 },
 {
  "name": "delete-present",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 dest=300\n30 POKE &8000,11\n40 CHAIN MERGE \"PART.BAS\",100,DELETE 300-399\n50 END\n100 POKE &8001,99\n110 END\n300 POKE &8002,44\n310 END\n"
   },
   {
    "name": "PART",
    "source": "100 POKE &8001,55:ON ERROR GOTO 800\n110 GOTO dest\n120 END\n800 POKE &8002,77\n810 END\n"
   }
  ],
  "expected": [
   11,
   55,
   77,
   0
  ],
  "group": "delete-range",
  "role": "overlay"
 },
 {
  "name": "memory-pressure-monolith",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 DIM values%(9000)\n30 values%(9000)=61\n40 POKE &8000,11\n50 GOTO 100\n100 POKE &8001,values%(9000)\n110 POKE &8002,HIMEM AND 255\n120 POKE &8003,INT(HIMEM/256)\n130 END\n"
   }
  ],
  "expected": [
   11,
   61,
   255,
   127
  ],
  "group": "memory-pressure",
  "role": "baseline"
 },
 {
  "name": "memory-pressure-chain-merge",
  "files": [
   {
    "name": "MAIN",
    "source": "10 MEMORY &7FFF\n20 DIM values%(9000)\n30 values%(9000)=61\n40 POKE &8000,11\n50 CHAIN MERGE \"PART.BAS\",100\n60 END\n100 POKE &8001,99\n110 POKE &8002,99\n120 POKE &8003,99\n130 END\n"
   },
   {
    "name": "PART",
    "source": "100 POKE &8001,values%(9000)\n110 POKE &8002,HIMEM AND 255\n120 POKE &8003,INT(HIMEM/256)\n130 END\n"
   }
  ],
  "expected": [
   11,
   61,
   255,
   127
  ],
  "group": "memory-pressure",
  "role": "overlay"
 }
];
const report={version:1,profile:'cpc6128-classic-v1',dialect:'locomotive-1.1',
 firmware:BASIC_TEST_FIRMWARE,engineSha256:digest(wasmBinary),
 independentEmulator:false,physicalCpc:false,
 scope:'Bounded ROM probes: array/string preservation, pointer reset, DELETE behavior and allocated memory. Only observed fixtures; no extraction or universal equivalence.',
 cases:[],comparisons:{},status:'incomplete'};
for(const specimen of fixtures){
 let manifest=newProject('Overlay specimen','647f023d-1272-4b66-8c47-b064b8de9512');
 for(const f of specimen.files.slice(1))manifest=addProjectSource(manifest,f.name);
 const sources=manifest.sources.map(f=>{
  const fixture=specimen.files.find(x=>x.name+'.BAS'===f.cpcName);
  assert.ok(fixture);
  return {...f,source:fixture.source};
 });
 const contract=inspectLoadContract(sources);
 assert.equal(contract.extractionPermitted,false);
 const overlay=sources.length>1?inspectChainMergeOverlay(sources[0],sources[1]):undefined;
 if(overlay)assert.equal(overlay.extractionPermitted,false);
 const disk=buildProjectDisk(manifest,sources.map(({id,source})=>({id,source})));
 const directory=readDataDisk(disk).map(x=>x.name);
 assert.deepEqual(directory,[...sources.map(x=>x.cpcName)].sort());
 const cpc=await createCpc({wasmBinary}),allocations=[];
 const put=bytes=>{const ptr=cpc._malloc(bytes.length);assert.ok(ptr);allocations.push(ptr);cpc.HEAPU8.set(bytes,ptr);return ptr;};
 let observed=[];
 try{
  assert.equal(cpc._cpc_bridge_init(put(roms.os),16384,put(roms.basic),16384,put(roms.amsdos),16384),0);
  for(let i=0;i<250;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  const width=cpc._cpc_bridge_width(),stride=cpc._cpc_bridge_stride(),frame=cpc._cpc_bridge_frame(),image=Buffer.alloc(width*108);
  for(let y=0;y<108;y++)image.set(cpc.HEAPU8.subarray(frame+y*stride,frame+y*stride+width),y*width);
  assert.equal(digest(image),BASIC_TEST_READY,'BASIC ready fingerprint mismatch');
  assert.equal(cpc._cpc_bridge_mount(put(disk),disk.length),0);
  for(const ch of 'RUN"MAIN.BAS"\r'){
   assert.ok(cpc._cpc_bridge_key(ch.charCodeAt(0),1)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
   assert.ok(cpc._cpc_bridge_key(ch.charCodeAt(0),0)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
  }
  for(let i=0;i<500;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  observed=[0x8000,0x8001,0x8002,0x8003].map(address=>cpc._cpc_bridge_peek(address));
 }finally{
  cpc._cpc_bridge_release_keys();cpc._cpc_bridge_dispose();
  for(const ptr of allocations)cpc._free(ptr);
 }
 const passed=observed.every((value,i)=>value===specimen.expected[i]);
 report.cases.push({name:specimen.name,files:directory,diskSha256:digest(disk),
  sources:Object.fromEntries(sources.map(x=>[x.cpcName,digest(new TextEncoder().encode(x.source))])),
  expected:specimen.expected,observed,passed,
  overlay:overlay?{collisions:overlay.collisions,sharedIdentifiers:overlay.sharedIdentifiers,warnings:overlay.warnings}:null,
  loads:contract.links.map(l=>({operation:l.operation,target:l.resolvedCpcName,sourceId:l.sourceId}))});
 console.log(specimen.name+': '+JSON.stringify({expected:specimen.expected,observed,passed}));
}
for(const [group,expectEqual] of [['arrays-strings',true],['data-pointer',false],['delete-range',false],['memory-pressure',true]]){
 const before=report.cases.find(x=>x.name===fixtures.find(f=>f.group===group&&f.role==='baseline').name);
 const after=report.cases.find(x=>x.name===fixtures.find(f=>f.group===group&&f.role==='overlay').name);
 report.comparisons[group]={expectEqual,actuallyEqual:JSON.stringify(before.observed)===JSON.stringify(after.observed)};
}
report.status=report.cases.every(x=>x.passed)&&Object.values(report.comparisons).every(x=>x.expectEqual===x.actuallyEqual)?'passed':'failed';
await writeFile('out/basic-chain-merge-edge-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.status,'passed','CHAIN MERGE edge behaviors differ from specified witnesses. See report.');
console.log('CHAIN MERGE edge witnesses: equalities and expected divergences qualified on pinned ROM only.');
