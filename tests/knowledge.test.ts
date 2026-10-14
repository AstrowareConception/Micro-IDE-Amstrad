import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../apps/desktop/project-store.ts';
import { documentAllowed, knowledgeContext, parseKnowledge } from '../packages/workspace/src/knowledge.ts';
import { buildProjectDisk } from '../packages/workspace/src/project.ts';

test('knowledge revisions preserve originals, stale edits, settings, restore and project portability', async () => {
 const root=await mkdtemp(join(tmpdir(),'cpc-knowledge-'));
 try {
 const {store,snapshot}=await ProjectStore.create(root,'Connaissances');
 const disk=buildProjectDisk(snapshot.manifest,snapshot.files);
 const first=await store.writeKnowledge({action:'create',title:'Roadmap',source:'# Plan\n- [ ] Tester\n',category:'progress'});
 assert.equal(first.document.knowledge?.access,'available');
 assert.equal(documentAllowed(first.document,false),true);
 const old=first.document;
 const next=await store.writeKnowledge({action:'save',id:old.id,revision:old.revision,source:'# Plan\n- [x] Tester\n'});
 assert.equal(await readFile(join(root,old.path),'utf8'),'# Plan\n- [ ] Tester\n');
 assert.equal(next.document.knowledge?.versions.length,1);
 await assert.rejects(store.writeKnowledge({action:'save',id:old.id,revision:old.revision,source:'STALE'}),/modifié/);
 const excluded=await store.writeKnowledge({action:'configure',id:old.id,revision:next.document.revision,category:'progress',access:'excluded'});
 assert.equal(documentAllowed(excluded.document,true),false);
 await assert.rejects(store.writeKnowledge({action:'configure',id:old.id,revision:next.document.revision,category:'design',access:'available'}),/modifié/);
 const restored=await store.writeKnowledge({action:'restore',id:old.id,revision:excluded.document.revision,path:old.path});
 assert.ok('text' in restored.document);assert.equal(restored.document.text,'# Plan\n- [ ] Tester\n');
 assert.equal(restored.document.knowledge?.access,'excluded');
 assert.deepEqual(buildProjectDisk(store.manifest,snapshot.files),disk);
 const moved=root+'-moved';await rename(root,moved);
 try {const reopened=await ProjectStore.open(moved);assert.deepEqual(await reopened.store.readDocument(old.id),restored.document);}finally{await rm(moved,{recursive:true,force:true});}
 } finally {await rm(root,{recursive:true,force:true});}
});

test('invalid notes and read-only imports cannot mutate stored documents',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cpc-knowledge-'));
 try {
 const {store}=await ProjectStore.create(root,'Ref');const external=join(root,'reference.md');await writeFile(external,'# Original');
 const manifest=await store.importDocument(external),doc=await store.readDocument(manifest.documents[0]!.id);
 await assert.rejects(store.writeKnowledge({action:'save',id:doc.id,revision:doc.revision,source:'Changed'}),/lecture seule/);
 const before=await readFile(join(root,'microide.project.json'));
 for (const source of ['\0','\x1b','\ufeffBOM','é'.repeat(40000)])await assert.rejects(store.writeKnowledge({action:'create',title:'bad',source,category:'design'}));
 await assert.rejects(store.writeKnowledge({action:'create',title:'../bad',source:'x',category:'design'}));
 await assert.rejects(store.writeKnowledge({action:'create',title:'bad',source:'x',category:'unknown'}));
 assert.deepEqual(await readFile(join(root,'microide.project.json')),before);
 assert.equal(await readFile(external,'utf8'),'# Original');
 assert.equal(documentAllowed(doc,false),false);assert.equal(documentAllowed(doc,true),true);
 const note=await store.writeKnowledge({action:'create',title:'Note',source:'old',category:'design'});
 const next=await store.writeKnowledge({action:'save',id:note.document.id,revision:note.document.revision,source:'new'});
 await writeFile(join(root,note.document.path),'tampered');
 await assert.rejects(store.writeKnowledge({action:'restore',id:note.document.id,revision:next.document.revision,path:note.document.path}),/altérée/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('essential bootstrap is bounded and cannot promote arbitrary document permissions',()=>{
 const metadata=parseKnowledge({category:'design',editable:false,access:'essential',versions:[]},'text/markdown');
 assert.throws(()=>parseKnowledge({...metadata,editable:true},'application/pdf'));
 assert.throws(()=>parseKnowledge({...metadata,access:'shell'},'text/markdown'));
 const docs=Array.from({length:5},(_,i)=>({id:`doc${i}`,path:`documents/doc${i}.md`,originalName:`Doc ${i}`,sha256:'a'.repeat(64),mediaType:'text/markdown' as const,role:'context' as const,knowledge:metadata,text:'x'.repeat(5000),bytes:5000}));
 const context=knowledgeContext(docs);assert.equal(context.reduce((n,d)=>n+d.text.length,0),12000);assert.equal(context[0]?.text.length,4000);assert.equal(context[4]?.text,'');assert.ok(context.every(d=>d.truncated));
});

test('controller bootstraps essential notes without legacy consent, excludes private notes and permits bounded reads',async()=>{
 const {AgentController}=await import('../apps/desktop/agent-controller.ts');
 const root=await mkdtemp(join(tmpdir(),'cpc-knowledge-agent-'));
 try {
 const {store,snapshot}=await ProjectStore.create(root,'Contexte');
 const note=await store.writeKnowledge({action:'create',title:'Contraintes',source:'ESSENTIAL HEADER\n'+'x'.repeat(4500)+'\nUNREAD TAIL',category:'design'});
 await store.writeKnowledge({action:'configure',id:note.document.id,revision:note.document.revision,category:'design',access:'essential'});
 const hidden=await store.writeKnowledge({action:'create',title:'Secret',source:'PRIVATE NEVER SEND',category:'resource'});
 await store.writeKnowledge({action:'configure',id:hidden.document.id,revision:hidden.document.revision,category:'resource',access:'excluded'});
 const requests: Record<string,unknown>[]=[];let step=0;
 const controller=new AgentController(join(root,'checkpoints'),'knowledge/locomotive-basic',async(_url,init)=>{
 const request=JSON.parse(String(init!.body));requests.push(request);
 const output=step++===0?[{type:'function_call',call_id:'doc',name:'documents_read_text',arguments:JSON.stringify({id:note.document.id,startLine:3,endLine:3})},{type:'function_call',call_id:'build',name:'build_project',arguments:'{}'}]:[{type:'message',content:[{type:'output_text',text:'Bilan.'}]}];
 return Response.json({status:'completed',output,usage:{total_tokens:1}});
 });
 controller.configure('sk-fixture-not-real','gpt-5.6-luna');
 const {taskId}=await controller.start(store,'Consulte le contexte et construis.',snapshot.files,false);
 const until=Date.now()+10000;while(controller.running && Date.now()<until)await new Promise(r=>setTimeout(r,10));
 assert.equal(controller.status(taskId).status,'completed');
 assert.match(JSON.stringify(requests[0]),/ESSENTIAL HEADER/);assert.doesNotMatch(JSON.stringify(requests[0]),/UNREAD TAIL|PRIVATE NEVER SEND|Secret.md/);
 assert.match(JSON.stringify(requests[1]),/UNREAD TAIL/);assert.doesNotMatch(JSON.stringify(requests[1]),/PRIVATE NEVER SEND/);
 }finally{await rm(root,{recursive:true,force:true});}
});
