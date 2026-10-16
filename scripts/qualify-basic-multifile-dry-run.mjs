// ROM-qualified observation of a single terminal GOTO converted to CHAIN MERGE.
// No program mutations, no ROM bytes in outputs. Exercises the exact dry-run DSKs.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import createCpc from '../out/cpc.mjs';
import {newProject} from '../packages/workspace/src/project.ts';
import {previewTerminalExtraction} from '../packages/workspace/src/multifile-dry-run.ts';
import {readDataDisk} from '../packages/cpc-disk/src/data-disk.ts';
import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY} from '../packages/emulator/src/basic-test-runtime.ts';

const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw Error('CPC_TEST_ROM_DIR required; ROM remains external.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const roms={};
for(const kind of ['os','basic','amsdos']){
 const bytes=new Uint8Array(await readFile(join(root,'cpc6128_'+kind+'.bin')));
 assert.equal(bytes.length,16384);
 assert.equal(sha(bytes),BASIC_TEST_FIRMWARE[kind]);
 roms[kind]=bytes;
}
const wasmBinary=await readFile('out/cpc.wasm');
const source='10 MEMORY &7FFF\n20 score%=42\n30 POKE &8000,11\n40 GOTO 100\n100 POKE &8001,score%\n110 POKE &8002,24\n120 END\n';
const manifest=newProject('Terminal transaction','647f023d-1272-4b66-8c47-b064b8de9512');
const plan=previewTerminalExtraction({manifest,sources:[{...manifest.sources[0],source}],sourceId:'main',entryLine:100,newFileName:'PART'});
assert.equal(plan.applicationEnabled,false);
assert.equal(plan.persistentWrites,0);
assert.deepEqual(readDataDisk(plan.original.disk).map(f=>f.name),['MAIN.BAS']);
assert.deepEqual(readDataDisk(plan.proposed.disk).map(f=>f.name),['MAIN.BAS','PART.BAS']);
const report={version:1,profile:plan.profile,firmware:BASIC_TEST_FIRMWARE,engineSha256:sha(wasmBinary),
 before:{diskSha256:sha(plan.original.disk),sourceSha256:sha(new TextEncoder().encode(source))},
 after:{diskSha256:sha(plan.proposed.disk),sources:Object.fromEntries(plan.proposed.sources.map(x=>[x.cpcName,sha(new TextEncoder().encode(x.source))]))},
 physicalCpc:false,independentEmulator:false,applicationEnabled:false,writes:0,results:[],qualified:false};
for(const [name,disk] of [['monolith',plan.original.disk],['simulated-two-files',plan.proposed.disk]]){
 const cpc=await createCpc({wasmBinary}),allocations=[];
 const put=bytes=>{const p=cpc._malloc(bytes.length);assert.ok(p);allocations.push(p);cpc.HEAPU8.set(bytes,p);return p;};
 let observed=[];
 try{
  assert.equal(cpc._cpc_bridge_init(put(roms.os),16384,put(roms.basic),16384,put(roms.amsdos),16384),0);
  for(let i=0;i<250;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  const width=cpc._cpc_bridge_width(),stride=cpc._cpc_bridge_stride(),frame=cpc._cpc_bridge_frame(),ready=Buffer.alloc(width*108);
  for(let y=0;y<108;y++)ready.set(cpc.HEAPU8.subarray(frame+y*stride,frame+y*stride+width),y*width);
  assert.equal(sha(ready),BASIC_TEST_READY);
  assert.equal(cpc._cpc_bridge_mount(put(disk),disk.length),0);
  for(const ch of 'RUN"MAIN.BAS"\r'){
   assert.ok(cpc._cpc_bridge_key(ch.charCodeAt(0),1)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
   assert.ok(cpc._cpc_bridge_key(ch.charCodeAt(0),0)>=0);
   for(let i=0;i<6;i++)assert.ok(cpc._cpc_bridge_step(10000)>=0);
  }
  for(let i=0;i<500;i++)assert.ok(cpc._cpc_bridge_step(20000)>=0);
  observed=[0x8000,0x8001,0x8002].map(address=>cpc._cpc_bridge_peek(address));
 }finally{
  cpc._cpc_bridge_release_keys();cpc._cpc_bridge_dispose();for(const p of allocations)cpc._free(p);
 }
 report.results.push({name,observed,expected:[11,42,24],passed:JSON.stringify(observed)===JSON.stringify([11,42,24])});
 console.log(name+': '+JSON.stringify(observed));
}
report.qualified=report.results.every(x=>x.passed)&&
 JSON.stringify(report.results[0].observed)===JSON.stringify(report.results[1].observed);
await writeFile('out/basic-multifile-dry-run-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.qualified,true,'Firmware diverged on narrow terminal transaction witness.');
console.log('Terminal extraction dry run: equivalent RAM markers on pinned CPC 6128 firmware only.');
