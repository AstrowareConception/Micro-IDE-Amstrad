// Pinned firmware observer shared by actual-project qualification recipes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import createCpc from '../out/cpc.mjs';
import {digest as sha} from '../tests/multifile-fixture.ts';
import {BASIC_TEST_FIRMWARE,BASIC_TEST_READY} from '../packages/emulator/src/basic-test-runtime.ts';
const root=process.env.CPC_TEST_ROM_DIR;
if(!root)throw Error('CPC_TEST_ROM_DIR required; ROM remains external.');
const roms={};
for(const kind of ['os','basic','amsdos']){
 const bytes=new Uint8Array(await readFile(join(root,'cpc6128_'+kind+'.bin')));
 assert.equal(bytes.length,16384);assert.equal(sha(bytes),BASIC_TEST_FIRMWARE[kind]);roms[kind]=bytes;
}
export const wasmBinary=await readFile('out/cpc.wasm');
export async function observe(disk,screenRows){
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
