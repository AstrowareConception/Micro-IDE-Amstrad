import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { AgentController } from '../apps/desktop/agent-controller.ts';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { AgentJournal } from '../apps/desktop/agent-journal.ts';
import { BinaryWorkbench } from '../apps/desktop/binary-workbench.ts';
import { DiskImportSession } from '../apps/desktop/disk-import.ts';
import { createDataDisk } from '../packages/cpc-disk/src/data-disk.ts';
import { encodeAmsdosBinary } from '../packages/cpc-disk/src/amsdos-binary.ts';
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const call=(name:string,args:unknown)=>({type:'function_call',call_id:name,name,arguments:JSON.stringify(args)});
const done={type:'message',content:[{type:'output_text',text:'Documentation enregistrée. DSK structurel uniquement ; aucun CPC exécuté.'}]};
async function settle(controller:AgentController,id:string){const end=Date.now()+10000;while(controller.running&&Date.now()<end)await new Promise(r=>setTimeout(r,5));assert.equal(controller.running,false);return controller.status(id);}

test('notes require real reads, exact revisions, editable scope and valid Markdown; imports stay immutable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-notes-'));
 try {
  const {store,snapshot}=await ProjectStore.create(root,'Notes');
  const first=await store.writeKnowledge({action:'create',title:'Plan',source:'# Plan\nHumain.',category:'progress'});
  const reference=join(root,'reference.md');await writeFile(reference,'# Reference originale');await store.importDocument(reference);
  const state=await store.agentState(snapshot.files),docs=await store.agentDocuments();
  const tools=new WorkspaceTools(state,async()=>{},hash,[],docs,request=>store.writeKnowledge(request));
  const args={id:first.document.id,expectedRevision:first.document.revision,source:'# Plan\nHumain.\nAnalyse IA : à tester.'};
  await assert.rejects(tools.execute('documents_replace_note',args),/stale-read/);
  const read=await tools.execute('documents_read_text',{id:first.document.id,startLine:1,endLine:200}) as {revision:string};assert.equal(read.revision,first.document.revision);
  await tools.execute('documents_replace_note',args);
  await assert.rejects(tools.execute('documents_replace_note',args),/stale-read/);
  const imported=docs.find(d=>!d.knowledge)!;
  await tools.execute('documents_read_text',{id:imported.id,startLine:1,endLine:1});
  await assert.rejects(tools.execute('documents_replace_note',{id:imported.id,expectedRevision:imported.revision,source:'x'}),/scope-denied/);
  for(const source of ['\0','\x1b','é'.repeat(40000)])await assert.rejects(tools.execute('documents_create_note',{title:'Bad',category:'design',source}));
  await assert.rejects(tools.execute('documents_create_note',{title:'Plan.md',category:'progress',source:'duplicate'}),/existe|déjà/);
  await assert.rejects(tools.execute('documents_create_note',{title:'../escape',category:'design',source:'x'}));
  await assert.rejects(tools.execute('documents_create_note',{title:'New',category:'design',source:'x',access:'essential'}),/arguments/);
  await assert.rejects(tools.execute('documents_configure',{}),/scope-denied/);
  assert.equal(await readFile(join(root,first.document.path),'utf8'),'# Plan\nHumain.');assert.equal(await readFile(reference,'utf8'),'# Reference originale');
  const catalog=await tools.execute('documents_list',{}) as {documents:{id:string;editable:boolean}[]};assert.equal(catalog.documents.find(d=>d.id===imported.id)?.editable,false);
 }finally{await rm(root,{recursive:true,force:true});}
});

async function basicMission(root:string, pause=false){
 const {store,snapshot}=await ProjectStore.create(root,'Documentation IA');
 const note=await store.writeKnowledge({action:'create',title:'Roadmap',category:'progress',source:'# Roadmap\n\n- [ ] Tester sur CPC\n'});
 const secret=await store.writeKnowledge({action:'create',title:'Secret',category:'resource',source:'NEVER_SEND_PRIVATE_TEXT'});
 await store.writeKnowledge({action:'configure',id:secret.document.id,revision:secret.document.revision!,category:'resource',access:'excluded'});
 const initial=await store.agentState(snapshot.files);let step=0;
 const steps=[call('documents_read_text',{id:note.document.id,startLine:1,endLine:200}),call('documents_replace_note',{id:note.document.id,expectedRevision:note.document.revision,source:'# Roadmap\n\n- [ ] Tester sur CPC\n- [x] Documenter les contraintes\n'}),call('documents_create_note',{title:'Journal IA',category:'progress',source:'# Journal IA\n\n## Vérifications\nConstruction structurelle seulement.\n'}),call('reference_read_many',{names:['END']}),call('project_replace_source',{id:snapshot.files[0]!.id,expectedHash:hash(snapshot.files[0]!.source),source:'10 END\n'}),call('build_project',{}),done];
 const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',async(_url,init)=>{
  const request=JSON.parse(String(init!.body));assert.doesNotMatch(JSON.stringify(request),/NEVER_SEND_PRIVATE_TEXT|Secret.md/);
  return Response.json({status:'completed',output:[steps[step++]],usage:{total_tokens:1}});
 });controller.configure('sk-fixture-not-real','gpt-5.6-luna');
 const {taskId}=await controller.start(store,'Documente et prépare le projet',snapshot.files,false,pause?{maxTurns:2,maxCalls:20,maxTokens:1000}:undefined);
 let view=await settle(controller,taskId);
 while(view.resumable){await controller.resume(taskId,store,view.workspace.files);view=await settle(controller,taskId);}assert.equal(view.status,'completed',JSON.stringify(view.events));
 return {store,initial,note,controller,taskId,view};
}
test('controller saves BASIC and Markdown in one mission, exposes comparisons, then restores the complete checkpoint',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-notes-mission-'));
 try{
  const {store,initial,note,controller,taskId,view}=await basicMission(root,true);
  assert.equal(view.documentChanges?.length,2);assert.equal(view.documentChanges?.find(d=>d.title==='Journal IA.md')?.created,true);
  const created=store.manifest.documents.find(d=>d.originalName==='Journal IA.md')!;const edited=store.manifest.documents.find(d=>d.id===note.document.id)!;
  assert.equal(edited.knowledge?.versions[0]?.path,note.document.path);assert.equal(created.knowledge?.access,'available');
  assert.equal((await ProjectStore.open(root)).snapshot.manifest.documents.length,3);
  const restored=await controller.restore(taskId,view.workspace.files);assert.deepEqual(restored,initial);
  assert.deepEqual((await ProjectStore.open(root)).snapshot.manifest,initial.manifest);
  assert.equal(await readFile(join(root,note.document.path),'utf8'),'# Roadmap\n\n- [ ] Tester sur CPC\n');
  assert.match(await readFile(join(root,created.path),'utf8'),/Journal IA/);assert.match(await readFile(join(root,edited.path),'utf8'),/Documenter les contraintes/);
  assert.equal(controller.status(taskId).documentChanges?.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('later manual document edits block whole-mission restore before any BASIC write',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-notes-conflict-'));
 try{
  const {store,note,controller,taskId,view}=await basicMission(root);
  const current=await store.readDocument(note.document.id);await store.writeKnowledge({action:'save',id:current.id,revision:current.revision!,source:'# Modification manuelle'});
  const manifest=await readFile(join(root,'microide.project.json'));const source=await readFile(join(root,view.workspace.files[0]!.path));
  await assert.rejects(controller.restore(taskId,view.workspace.files),/stale-read/);
  assert.deepEqual(await readFile(join(root,'microide.project.json')),manifest);assert.deepEqual(await readFile(join(root,view.workspace.files[0]!.path)),source);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('pending document/source restoration recovers on reopen; altered immutable versions block it',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-notes-recovery-'));
 try{
  const {store,initial,note,view}=await basicMission(root),before=await readFile(join(root,'microide.project.json'));
  const after=Buffer.from(JSON.stringify(initial.manifest,null,2)+'\n');
  const entries=await Promise.all(initial.files.map(async f=>({id:f.id,path:f.path,before:await readFile(join(root,f.path)),after:Buffer.from(f.saved)})));
  const journal=new AgentJournal(root);const pending=await journal.prepare(before,after,entries);
  await assert.rejects(ProjectStore.open(root),/interrompue|récupérer/);
  await writeFile(join(root,note.document.path),'external corruption');
  await assert.rejects(journal.recover(pending.id,'finish',pending.revision!),/documentaire/);
  assert.deepEqual(await readFile(join(root,view.workspace.files[0]!.path)),entries[0]!.before);
  await writeFile(join(root,note.document.path),'# Roadmap\n\n- [ ] Tester sur CPC\n');
  await journal.recover(pending.id,'finish',pending.revision!);
  assert.deepEqual((await ProjectStore.open(root)).snapshot.manifest,initial.manifest);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Z80 and Markdown share checkpoint restoration without mutating original binary resources',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'agent-notes-z80-'));
 try{
  const disk=createDataDisk([{name:'BOOT.BIN',bytes:encodeAmsdosBinary('BOOT.BIN',Uint8Array.of(0x3e,77,0xc9),0x8000,0x8000)}]);
  const path=join(parent,'original.dsk');await writeFile(path,disk);const session=await DiskImportSession.prepare(path),id=session.preview.files[0]!.id;
  const root=await session.create(parent,{id:session.preview.id,name:'Z80 docs',sourceIds:[],entryId:id,kind:'binary'});const {store}=await ProjectStore.open(root),workbench=new BinaryWorkbench(store);
  const asset=await workbench.inspect(id),listing=(await workbench.generate(id,0,3,0x8000,'code')).listing;
  const region={id:'routine',assetId:id,sha256:asset.sha256,offset:0,length:3,origin:0x8000,kind:'code' as const,note:'Humain',listing};await workbench.save(null,[region]);
  const initial=await store.agentState([]);let step=0;
  const steps=[call('documents_create_note',{title:'Analyse routine',category:'design',source:'# Analyse IA\n\nFait : charge A, puis retourne.\nHypothèse : rôle inconnu.'}),call('binary_read_region',{id:region.id,startLine:1,endLine:200}),call('binary_dialect',{}),call('binary_replace_region',{id:region.id,expectedHash:hash(JSON.stringify(region)),note:'Humain\nAnalyse IA : valeur 78.',listing:listing.replace('$4D','$4E')}),call('binary_build',{}),done];
  const controller=new AgentController(join(parent,'checkpoints'),'unused',async()=>Response.json({status:'completed',output:[steps[step++]],usage:{total_tokens:1}}));controller.configure('sk-fixture-not-real','gpt-5.6-luna');
  const {taskId}=await controller.start(store,'Documente et modifie la routine',[],false);const view=await settle(controller,taskId);assert.equal(view.status,'completed',JSON.stringify(view.events));assert.equal(view.documentChanges?.length,1);
  assert.equal((await workbench.compile(view.workspace.binaryAnalysis!.revision)).changedBytes,1);
  const restored=await controller.restore(taskId,[]);assert.deepEqual(restored,initial);assert.deepEqual(await store.agentState([]),initial);assert.deepEqual(await readFile(path),Buffer.from(disk));
 }finally{await rm(parent,{recursive:true,force:true});}
});
