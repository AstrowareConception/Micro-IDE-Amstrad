import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {buildProjectDisk,newProject} from '../packages/workspace/src/project.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {fixture,prepare,SOURCE,digest} from './multifile-fixture.ts';

test('apply persists exact preview, reopen rebuilds the same DSK, durable undo restores original CRLF and manifest',async t=>{
 const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
 const {tools,preview,apply}=await prepare(f.root);
 assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original,'preview is read-only');
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 await apply();assert.equal(tools.buildVerified,false);
 assert.equal(tools.extractionSimulationViews()[0]!.record.status,'applied');
 await assert.rejects(apply,/stale-preview/,'an applied preview cannot be replayed');
 const reopened=await ProjectStore.open(f.root);
 assert.equal(reopened.snapshot.files.length,2);
 assert.equal(digest(buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files)),preview.proposedDiskSha256);
 const last=(await reopened.store.lastAgentMutation())!;assert.ok(last);
 await assert.rejects(reopened.store.restoreAgentMutation('bad',reopened.snapshot.files),/périmée/);
 const restored=await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
 assert.equal(restored.files.length,1);
 assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
 assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
 await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 assert.equal(await reopened.store.lastAgentMutation(),undefined);
 const again=await ProjectStore.open(f.root);assert.equal(again.snapshot.files[0]!.source,SOURCE);
});

test('persisted undo refuses dirty buffers, changed source or manifest and keeps unknown changes intact',async t=>{
 for(const conflict of ['dirty','source','manifest']) {
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));await (await prepare(f.root)).apply();
  const {store,snapshot}=await ProjectStore.open(f.root),last=(await store.lastAgentMutation())!;
  const buffers=structuredClone(snapshot.files);
  if(conflict==='dirty')buffers[1]!.source+='130 REM DRAFT\n';
  if(conflict==='source')await writeFile(join(f.root,'src/part.bas'),'EXTERNAL');
  if(conflict==='manifest')await writeFile(join(f.root,'microide.project.json'),JSON.stringify(snapshot.manifest)+' ');
  await assert.rejects(store.restoreAgentMutation(last.revision,buffers),/brouillons|changé|Conflit/);
  assert.ok((await readFile(join(f.root,'src/main.bas'),'utf8')).includes('CHAIN MERGE'));
  if(conflict==='source')assert.equal(await readFile(join(f.root,'src/part.bas'),'utf8'),'EXTERNAL');
 }
});

test('occupied or case-colliding destination and external revisions reject extraction before any journal or source write',async t=>{
 for(const conflict of ['part.bas','PART.BAS','source','manifest']) {
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));const p=await prepare(f.root);
  if(conflict.endsWith('.BAS')||conflict.endsWith('.bas'))await writeFile(join(f.root,'src',conflict),'EXTERNAL');
  else if(conflict==='source')await writeFile(join(f.root,'src/main.bas'),SOURCE+'130 END\n');
  else await writeFile(join(f.root,'microide.project.json'),Buffer.concat([f.manifest,Buffer.from(' ')]));
  const before=await readFile(join(f.root,'src/main.bas'));
  await assert.rejects(p.apply,/occupée|Collision|changé/);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),before);
  await assert.rejects(readFile(join(f.root,'.microide/agent-journal/current.json')),{code:'ENOENT'});
  assert.equal(p.tools.state.files.length,1);assert.equal(p.tools.extractionSimulationViews()[0]!.record.status,'failed');
 }
});

test('preview reference gate, replacement, ABA mutation, session change and failed persistence never apply a stale plan',async t=>{
 const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));const {initial}=await prepare(f.root);
 let writes=0;const tools=new WorkspaceTools(initial,async()=>{writes++;},digest,[]);
 const simulate=()=>tools.execute('language_extraction_simulate',{id:'main',expectedHash:digest(SOURCE),entryLine:100,newFileName:'PART'}) as Promise<{previewId:string}>;
 const apply=(previewId:string)=>tools.execute('language_extraction_apply',{id:'main',expectedHash:digest(SOURCE),previewId});
 const first=await simulate();await assert.rejects(apply(first.previewId),/reference-required/);assert.equal(writes,0);
 const second=await simulate();await assert.rejects(apply(first.previewId),/stale-preview/);
 await tools.execute('reference_read_many',{names:['MEMORY','POKE','GOTO','END','CHAIN','MERGE']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:digest(SOURCE),source:SOURCE.replace('42','43')});
 await tools.execute('project_replace_source',{id:'main',expectedHash:digest(SOURCE.replace('42','43')),source:SOURCE});
 await assert.rejects(apply(second.previewId),/stale-preview/);assert.equal(writes,2);
 const third=await simulate();tools.state.sessionId='different-session';await assert.rejects(apply(third.previewId),/stale-preview/);assert.equal(writes,2);
});

test('persistence errors invalidate the build and distinguish an uncommitted write from an adopted disk commit',async t=>{
 const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));const {initial}=await prepare(f.root);
 for(const committed of [false,true]){
  const tools=new WorkspaceTools(initial,async candidate=>{
   if(committed)tools.state=structuredClone(candidate); // Controller adoption precedes its mission-log write.
   throw Error(committed?'mission-log-failed':'disk-write-failed');
  },digest,[]);
  const preview=await tools.execute('language_extraction_simulate',{id:'main',expectedHash:digest(SOURCE),entryLine:100,newFileName:'PART'}) as {previewId:string};
  await tools.execute('reference_read_many',{names:['MEMORY','POKE','END','CHAIN','MERGE']});
  await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
  const apply=()=>tools.execute('language_extraction_apply',{id:'main',expectedHash:digest(SOURCE),previewId:preview.previewId});
  await assert.rejects(apply,/failed/);
  assert.equal(tools.buildVerified,false);assert.equal(tools.state.files.length,committed?2:1);
  assert.equal(tools.extractionSimulationViews()[0]!.record.status,committed?'applied':'failed');
  await assert.rejects(apply,/stale-preview/);
 }
});

test('a maximum-size accepted listing shows the entire longer loading instruction in its preview',async()=>{
 const rows=['1 MEMORY &7FFF'];for(let n=2;n<=17;n++)rows.push(n+' '+('v'.repeat(240))+'=1');
 const prefix=rows.join('\n')+'\n',tail='90 GOTO 100\n100 x=1\n110 END\n';
 const source=prefix+'18 '+('x'.repeat(4096-prefix.length-tail.length-6))+'=1\n'+tail;
 assert.equal(source.length,4096);
 const manifest=newProject('Aperçu complet','647f023d-1272-4b66-8c47-b064b8de9512');
 const tools=new WorkspaceTools({sessionId:'long-preview',manifest,files:[{...manifest.sources[0]!,source,saved:source}]},async()=>{throw Error('preview must never write');},digest,[]);
 const preview=await tools.execute('language_extraction_simulate',{id:'main',expectedHash:digest(source),entryLine:100,newFileName:'PART'}) as {afterMain:string;newMainSha256:string};
 assert.equal(preview.afterMain.length,4098);
 assert.ok(preview.afterMain.endsWith('90 CHAIN MERGE "PART.BAS",100\n'));
 assert.equal(digest(preview.afterMain),preview.newMainSha256,'visible preview must match the exact proposed source');
});

async function crash(root:string,stop:string) {
 const child=spawn(process.execPath,['tests/multifile-crash-fixture.ts',root,stop],{stdio:['ignore','ignore','pipe','ipc']});let errors='';
 child.stderr?.on('data',bytes=>{errors+=bytes;});
 try {
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Crash fixture timeout: '+errors)),15000);
   child.once('message',()=>{clearTimeout(timer);resolve();});child.once('error',e=>{clearTimeout(timer);reject(e);});
   child.once('exit',code=>{clearTimeout(timer);reject(Error('Crash fixture exit '+code+': '+errors));});
  });
  const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));child.kill('SIGKILL');await exited;
 }finally{if(child.exitCode===null)child.kill('SIGKILL');}
}
test('real extraction crashes at journal, both sources and manifest can finish or restore; interrupted undo can also recover',async t=>{
 for(const stop of ['prepared','main','part','manifest','removed'])for(const choice of ['finish','restore'] as const){
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));await crash(f.root,stop);
  await assert.rejects(ProjectStore.open(f.root),/Mutation agent interrompue/);
  const recovery=(await ProjectStore.agentRecoveryStatus(f.root))!;
  await ProjectStore.recoverAgent(f.root,recovery.id,choice,recovery.revision!);
  // Recovery choices always refer to the original transaction, including an interrupted undo.
  const expanded=choice==='finish';
  const {snapshot}=await ProjectStore.open(f.root);assert.equal(snapshot.files.length,expanded?2:1,stop+':'+choice);
  buildProjectDisk(snapshot.manifest,snapshot.files);
  if(!expanded){assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});}
  assert.equal(await ProjectStore.agentRecoveryStatus(f.root),undefined);
 }
});
