// CPC 6128 ROM qualification: executes real CHAIN MERGE on two-file AMSDOS disks.
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
 {name:'variables-baseline',files:[file('MAIN','10 MEMORY &7FFF\n20 shared%=37\n30 POKE &8000,11\n40 GOTO 100\n100 POKE &8001,shared%\n110 POKE &8002,23\n120 END\n')],expected:[11,37,23,0]},
 {name:'variables-chain-merge',files:[
  file('MAIN','10 MEMORY &7FFF\n20 shared%=37\n30 POKE &8000,11\n40 CHAIN MERGE "PART.BAS",100\n50 POKE &8003,99\n60 END\n100 POKE &8001,99\n110 POKE &8002,99\n120 END\n'),
  file('PART','100 POKE &8001,shared%\n110 POKE &8002,23\n120 END\n')],expected:[11,37,23,0]},
 {name:'data-restore-baseline',files:[file('MAIN','10 MEMORY &7FFF\n20 POKE &8000,11\n40 RESTORE 500\n50 READ a,b\n60 POKE &8001,a\n70 POKE &8002,b\n80 END\n500 DATA 7,19\n')],expected:[11,7,19,0]},
 {name:'data-restore-chain-merge',files:[
  file('MAIN','10 MEMORY &7FFF\n20 POKE &8000,11\n30 CHAIN MERGE "PART.BAS",40\n40 RESTORE 500\n50 READ a,b\n60 POKE &8001,a\n70 POKE &8002,b\n80 END\n500 DATA 0,0\n'),
  file('PART','500 DATA 7,19\n')],expected:[11,7,19,0]},
 {name:'himem-baseline',files:[file('MAIN','10 MEMORY &7FFF\n20 POKE &8000,11\n30 POKE &8001,HIMEM AND 255\n40 POKE &8002,INT(HIMEM/256)\n50 END\n')],expected:[11,255,127,0]},
 {name:'himem-chain-merge',files:[
  file('MAIN','10 MEMORY &7FFF\n20 POKE &8000,11\n30 CHAIN MERGE "PART.BAS",100\n40 POKE &8003,99\n50 END\n100 POKE &8001,99\n110 POKE &8002,99\n120 END\n'),
  file('PART','100 POKE &8001,HIMEM AND 255\n110 POKE &8002,INT(HIMEM/256)\n120 END\n')],expected:[11,255,127,0]}
];
const report={version:1,profile:'cpc6128-classic-v1',dialect:'locomotive-1.1',
 firmware:BASIC_TEST_FIRMWARE,engineSha256:digest(wasmBinary),
 independentEmulator:false,physicalCpc:false,
 scope:'Bounded firmware observations only: scalar variable persistence, overlay line collision, DATA/RESTORE replacement and HIMEM; no automatic source extraction.',
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
for(const subject of ['variables','data-restore','himem']){
 const before=report.cases.find(x=>x.name===subject+'-baseline');
 const after=report.cases.find(x=>x.name===subject+'-chain-merge');
 report.comparisons[subject]=JSON.stringify(before.observed)===JSON.stringify(after.observed);
}
report.status=report.cases.every(x=>x.passed)&&Object.values(report.comparisons).every(Boolean)?'passed':'failed';
await writeFile('out/basic-chain-merge-state-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.status,'passed','CHAIN MERGE ROM observations differ from bounded expected witnesses. See report.');
console.log('CHAIN MERGE state witnesses qualified only for specific pinned ROM and fixtures.');
