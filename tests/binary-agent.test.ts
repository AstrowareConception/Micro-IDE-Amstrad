import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BinaryWorkspaceTools } from '../packages/agent/src/binary-tools.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import { BinaryWorkbench } from '../apps/desktop/binary-workbench.ts';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { createDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function fixture(length = 6) {
  const parent = await mkdtemp(join(tmpdir(),'binary-agent-')), path = join(parent,'original.dsk');
  const payload = length === 6 ? Uint8Array.of(0x3e,77,0x32,0,0x90,0xc9) : new Uint8Array(length).fill(1);
  const original = createDataDisk([{name:'BOOT.BIN',bytes:encodeAmsdosBinary('BOOT.BIN',payload,0x8000,0x8000)}]);
  await writeFile(path,original); const session = await DiskImportSession.prepare(path), id = session.preview.files[0]!.id;
  const root = await session.create(parent,{id:session.preview.id,name:'Z80 agent',sourceIds:[],entryId:id,kind:'binary'});
  const {store} = await ProjectStore.open(root), workbench = new BinaryWorkbench(store);
  const view = await workbench.inspect(id), listing = (await workbench.generate(id,0,length,0x8000,'code')).listing;
  const region = {id:'routine',assetId:id,sha256:view.sha256,offset:0,length,origin:0x8000,kind:'code' as const,note:'Notes humaines',listing};
  await workbench.save(null,[region]); const state = await store.agentState([]);
  const tools = new BinaryWorkspaceTools(state, candidate => store.applyAgentState(candidate),hash);
  return {parent,path,original,root,store,workbench,region,state,tools};
}
test('Z80 tools enforce scope, read hashes, dialect, quotas, fixed size and original immutability', async () => {
  const {tools,region,workbench,path,original,state} = await fixture();
  const request = {id:region.id,expectedHash:hash(JSON.stringify(region)),note:region.note+'\nAnalyse IA : fait : écrit A à $9000.',listing:region.listing.replace('$4D','$4E')};
  await assert.rejects(tools.execute('project_replace_source',{}),/scope/);
  await assert.rejects(tools.execute('binary_read_region',{id:'outside',startLine:1,endLine:2}),/scope/);
  await assert.rejects(tools.execute('binary_replace_region',request),/stale/);
  await assert.rejects(tools.execute('binary_read_region',{id:region.id,startLine:1,endLine:201}),/range/);
  await tools.execute('binary_read_region',{id:region.id,startLine:1,endLine:200});
  await assert.rejects(tools.execute('binary_replace_region',request),/reference/);
  await tools.execute('binary_dialect',{});
  for (const invalid of [{...request,listing:request.listing+'NOP'},{...request,listing:request.listing.replace('$8000','$8001')},{...request,expectedHash:'old'},{...request,note:'x'.repeat(4001)},{...request,listing:'ORG 0\nINCLUDE "x"'},{...request,assetId:'outside'}]) await assert.rejects(tools.execute('binary_replace_region',invalid));
  await tools.execute('binary_build',{});assert.equal(tools.buildVerified,true);
  await tools.execute('binary_replace_region',request);assert.equal(tools.buildVerified,false);
  await assert.rejects(tools.execute('binary_replace_region',request),/stale/);
  const build = await tools.execute('binary_build',{}) as {changedBytes:number;runtime:string};assert.equal(build.changedBytes,1);assert.equal(build.runtime,'not-run');
  const report = await workbench.compile(tools.state.binaryAnalysis!.revision);assert.deepEqual(report.changes,[{assetId:region.assetId,offset:1,address:0x8001,before:77,after:78}]);
  assert.deepEqual(await readFile(path),Buffer.from(original));assert.notEqual(state.binaryAnalysis!.revision,tools.state.binaryAnalysis!.revision);
});
test('Z80 persistence refuses external annotation edits without losing either version', async () => {
  const {tools,workbench,region,state} = await fixture();
  await tools.execute('binary_read_region',{id:region.id,startLine:1,endLine:200});await tools.execute('binary_dialect',{});
  const manual = await workbench.save(state.binaryAnalysis!.revision,[{...region,note:'Modification extérieure'}]);
  await assert.rejects(tools.execute('binary_replace_region',{id:region.id,expectedHash:hash(JSON.stringify(region)),note:'Analyse IA',listing:region.listing}),/modifiée/);
  assert.deepEqual(await workbench.load(),manual);assert.deepEqual(tools.state,state);
});
const call = (name:string,args:unknown) => ({type:'function_call',call_id:name,name,arguments:JSON.stringify(args)});
const message = {type:'message',content:[{type:'output_text',text:'Zone modifiée ; assemblage vérifié. Aucun CPC exécuté.'}]};
async function settle(controller:AgentController,id:string) { const end=Date.now()+10000;while(controller.running&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.equal(controller.running,false);return controller.status(id); }
test('controller uses Z80 instructions/tools, resumes, checkpoints, builds and restores exact initial analysis', async () => {
  const {store,parent,region,workbench,state} = await fixture();let step=0;
  const output = [call('binary_read_region',{id:region.id,startLine:1,endLine:200}),call('binary_dialect',{}),call('binary_replace_region',{id:region.id,expectedHash:hash(JSON.stringify(region)),note:region.note+'\nAnalyse IA : valeur 78.',listing:region.listing.replace('$4D','$4E')}),call('binary_build',{}),message];
  const controller = new AgentController(join(parent,'checkpoints'),'absent-basic-corpus',async (_url,init)=>{const request=JSON.parse(String(init!.body));assert.match(request.instructions,/atelier Z80/);assert.ok(request.tools.every((tool:{name:string})=>tool.name.startsWith('binary_') || tool.name.startsWith('documents_')));assert.doesNotMatch(JSON.stringify(request.input[0]),/listing|Notes humaines/);return Response.json({status:'completed',output:[output[step++]],usage:{total_tokens:1}});});
  controller.configure('sk-fixture-not-real','gpt-5.6-luna');
  const {taskId}=await controller.start(store,'Passe la valeur à 78',[],false,{maxTurns:2,maxCalls:20,maxTokens:1000});assert.equal((await settle(controller,taskId)).status,'paused-limit');
  await controller.resume(taskId,store,[]);assert.equal((await settle(controller,taskId)).status,'paused-limit');
  await controller.resume(taskId,store,[]);const final=await settle(controller,taskId);assert.equal(final.status,'completed');assert.equal(final.buildVerified,true);assert.deepEqual(final.changed,['binary-z80.json']);
  const checkpoint=JSON.parse(await readFile(join(parent,'checkpoints',taskId,'checkpoint.json'),'utf8'));assert.deepEqual(checkpoint.initial.binaryAnalysis,state.binaryAnalysis);
  const restored=await controller.restore(taskId,[]);assert.deepEqual(restored.binaryAnalysis!.regions,[region]);assert.deepEqual(await workbench.load(),restored.binaryAnalysis);assert.equal((await workbench.compile(restored.binaryAnalysis!.revision)).changedBytes,0);
});
test('controller restore refuses a later manual edit and completion requires a final build',async()=>{
  const {store,parent,region,workbench,state}=await fixture();
  const controller=new AgentController(join(parent,'checkpoints'),'absent',async()=>Response.json({status:'completed',output:[message],usage:{total_tokens:1}}));controller.configure('sk-fixture-not-real','gpt-5.6-luna');
  const {taskId}=await controller.start(store,'Explique',[]);assert.equal((await settle(controller,taskId)).status,'blocked');
  const manual=await workbench.save(state.binaryAnalysis!.revision,[{...region,note:'Notes postérieures'}]);
  await assert.rejects(controller.restore(taskId,[]),/modifi/);assert.deepEqual(await workbench.load(),manual);
});
test('comparison reports exact addresses and total for a modified payload',async()=>{
  const {workbench,region,state}=await fixture();const saved=await workbench.save(state.binaryAnalysis!.revision,[{...region,listing:'ORG $8000\nDEFB 0,0,0,0,0,0'}]);const result=await workbench.compile(saved.revision);assert.equal(result.changedBytes,5);assert.equal(result.truncated,false);assert.equal(result.changes.length,5);
});

test('byte comparison caps rows at 128 while retaining total and header/padding bytes',async()=>{
  const {workbench,region,state,store}=await fixture(256);
  const original=(await store.readAssets())[0]!.bytes;
  const saved=await workbench.save(state.binaryAnalysis!.revision,[{...region,listing:'ORG $8000\nDEFB '+Array(256).fill('0').join(',')}]);
  const result=await workbench.compile(saved.revision);assert.equal(result.changedBytes,256);assert.equal(result.changes.length,128);assert.equal(result.truncated,true);
  assert.deepEqual(result.assets[0]!.bytes.subarray(0,128),original.subarray(0,128));assert.deepEqual(result.assets[0]!.bytes.subarray(384),original.subarray(384));
});
