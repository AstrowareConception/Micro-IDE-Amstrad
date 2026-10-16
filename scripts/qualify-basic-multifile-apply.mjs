// ROM-qualified observation of a single terminal GOTO converted to CHAIN MERGE.
// Exercise actual project writes, reopen and durable undo. No ROM bytes in outputs.
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import createCpc from '../out/cpc.mjs';
import {buildProjectDisk} from '../packages/workspace/src/project.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare} from '../tests/multifile-fixture.ts';
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
const f=await fixture(),p=await prepare(f.root);
const originalDisk=buildProjectDisk(p.snapshot.manifest,p.snapshot.files);
await p.apply();
const reopened=await ProjectStore.open(f.root);
const appliedDisk=buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files);
assert.equal(sha(appliedDisk),p.preview.proposedDiskSha256);
assert.deepEqual(readDataDisk(appliedDisk).map(f=>f.name),['MAIN.BAS','PART.BAS']);
const last=await reopened.store.lastAgentMutation();assert.ok(last);
await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
const restored=await ProjectStore.open(f.root);
const restoredDisk=buildProjectDisk(restored.snapshot.manifest,restored.snapshot.files);
assert.equal(sha(restoredDisk),sha(originalDisk));
assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
const report={version:1,profile:'terminal-goto-chain-merge-v1',firmware:BASIC_TEST_FIRMWARE,engineSha256:sha(wasmBinary),
 originalDiskSha256:sha(originalDisk),appliedDiskSha256:sha(appliedDisk),restoredDiskSha256:sha(restoredDisk),
 sources:reopened.snapshot.files.map(f=>({id:f.id,path:f.path,sha256:sha(Buffer.from(f.source))})),
 physicalCpc:false,independentEmulator:false,actualProjectWrites:true,reopened:true,exactByteRestoration:true,results:[],qualified:false};
for(const [name,disk] of [['original',originalDisk],['applied-reopened',appliedDisk],['restored-reopened',restoredDisk]]){
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
await writeFile('out/basic-multifile-apply-qualification.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.qualified,true,'Firmware diverged on narrow terminal transaction witness.');
await rm(f.root,{recursive:true,force:true});
console.log('Persisted extraction, reopened project and durable restoration: three equal RAM observations on pinned CPC 6128 firmware only.');
