import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {previewTerminalExtraction,COMMENTED_EXTRACTION_PROFILE} from '../packages/workspace/src/multifile-dry-run.ts';
import {newProject,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {readabilityMission,DEFAULT_READABILITY} from '../packages/agent/src/readability.ts';
import {planSymbolRename} from '../packages/basic-language/src/rename-symbol.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {fixture,digest} from './multifile-fixture.ts';
import {readabilityWitnesses,runReadabilityMission} from './readability-pipeline-fixture.mjs';
const base='10 s%=0\n90 GOTO 100\n100 FOR i%=1 TO 3\n110 s%=s%+i%\n120 NEXT i%\n130 PRINT s%\n140 END\n';
const preview=source=>previewTerminalExtraction({manifest:newProject('REM','647f023d-1272-4b66-8c47-b064b8de9512'),sources:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source}],sourceId:'main',entryLine:100,newFileName:'PART'});

test('documentary REM lines survive extraction, including entry comments, loop bodies and trailing lines',()=>{
 const source='5 REM Initialisation\n'+base.replace('90 GOTO','89 REM Frontiere\n90 GOTO').replace('100 FOR','99 REM Somme des entiers\n100 FOR').replace('110 s%','109 REM Accumulation\n110 s%')+'150 REM Fin\n';
 const p=preview(source);assert.equal(p.profile,COMMENTED_EXTRACTION_PROFILE);
 assert.equal(p.proposed.sources[0].source,source.slice(0,source.indexOf('99 REM')).replace('GOTO 100','CHAIN MERGE "PART.BAS",100'));
 assert.equal(p.proposed.sources[1].source,source.slice(source.indexOf('99 REM')));
 assert.equal(p.linesMoved,8);
 for(const rem of ['REM','rem Note','REM FOR NEXT IF CHAIN POKE'])assert.equal(preview(base.replace('110 s%',`109 ${rem}\n110 s%`)).profile,COMMENTED_EXTRACTION_PROFILE);
});

test('REM extension never admits executable tails, test directives, opaque control, oversized text or a loop crossing the boundary',()=>{
 for(const comment of ['REM @CPCTEST x','REM "quoted"','REM x:POKE &8000,1',"' commentaire",'REM '+ 'x'.repeat(97),'REM café','REMARK=1'])
  assert.throws(()=>preview(base.replace('110 s%',`109 ${comment}\n110 s%`)),/refusée/);
 for(const body of ['IF s%=0 THEN s%=1','FOR j%=1 TO 3','GOSUB 500','POKE &8000,1','CALL 0','DATA 1','s=2','s%=32767+1'])
  assert.throws(()=>preview(base.replace('110 s%=s%+i%',`109 REM Corps\n110 ${body}`)),/refusée/);
 assert.throws(()=>preview(base.replace('90 GOTO','80 FOR j%=1 TO 3\n89 REM Frontiere\n90 GOTO')),/frontière|imbriquée/);
 assert.throws(()=>preview(base.replace('100 FOR i%=1 TO 3','100 REM Entree')),/entrée/);
});

test('readability composition invokes deterministic tools and states both test and restore limits',()=>{
 const mission=readabilityMission('MAIN',{...DEFAULT_READABILITY,splitPlan:true});
 for(const term of ['language_rename_preview','language_rename_apply','language_extraction_simulate','language_extraction_apply','project_replace_source','dernière mutation disque','projet après CHAIN MERGE'])assert.ok(mission.includes(term),term);
 assert.doesNotMatch(mission,/Ne déplace pas de code|conserve le code tant que les portées/);
 assert.ok(!readabilityMission('MAIN',DEFAULT_READABILITY).includes('language_extraction_apply'));
});

test('complete controlled missions persist six programs and restore the initial checkpoint with documents and sources',async t=>{
 for(const witness of readabilityWitnesses){
  const f=await fixture(witness.source.replace(/\n/g,'\r\n'));t.after(()=>rm(f.root,{recursive:true,force:true}));
  const p=await runReadabilityMission(f.root),reopened=await ProjectStore.open(f.root);
  assert.equal(reopened.snapshot.files.length,2);
  assert.match(reopened.snapshot.files[1].source,/^99 REM Suite du calcul/m);
  assert.ok(reopened.snapshot.files.every(file=>!/(?:^|\W)s%/.test(file.source)));
  assert.equal(p.view.testCoverage.directlyTested,0);
  assert.equal(p.view.extractionSimulations[0].record.status,'obsolete','note creation invalidates the first extraction preview');
  await assert.rejects(p.controller.restore(p.taskId,p.view.workspace.files.map(f=>({...f,source:f.source+'x'}))),/stale-read/);
  await p.controller.restore(p.taskId,p.view.workspace.files);
  const restored=await ProjectStore.open(f.root);
  assert.equal(digest(buildProjectDisk(restored.snapshot.manifest,restored.snapshot.files)),digest(buildProjectDisk(p.snapshot.manifest,p.snapshot.files)));
  assert.equal(restored.snapshot.files[0].source,witness.source);
  assert.equal(restored.snapshot.manifest.documents.length,0);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 }
});

test('restart undo reverts only extraction and preserves earlier rename, formatting, comment and documentation',async t=>{
 const f=await fixture(readabilityWitnesses[0].source.replace(/\n/g,'\r\n'));t.after(()=>rm(f.root,{recursive:true,force:true}));
 const p=await runReadabilityMission(f.root),reopened=await ProjectStore.open(f.root),last=await reopened.store.lastAgentMutation();
 await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
 const restored=await ProjectStore.open(f.root),source=restored.snapshot.files[0].source;
 assert.match(source,/score%/);assert.match(source,/99 REM/);assert.match(source,/GOTO 100/);assert.ok(!source.includes('30   '));
 assert.notEqual(source,readabilityWitnesses[0].source);assert.equal(restored.snapshot.manifest.documents.length,1);
 assert.equal(source,p.view.extractionSimulations.at(-1).record.beforeMain);
 await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
});

test('comment consultation is required before applying a commented extraction',async t=>{
 const f=await fixture(base.replace('100 FOR','99 REM Calcul\n100 FOR'));t.after(()=>rm(f.root,{recursive:true,force:true}));
 const {store,snapshot}=await ProjectStore.open(f.root),state=await store.agentState(snapshot.files),tools=new WorkspaceTools(state,(next,old)=>store.applyAgentState(next,old),digest,[]);
 const expectedHash=digest(state.files[0].source),p=await tools.execute('language_extraction_simulate',{id:'main',expectedHash,entryLine:100,newFileName:'PART'});
 await tools.execute('reference_read_many',{names:['GOTO','FOR','NEXT','PRINT','END','CHAIN','MERGE']});
 await assert.rejects(tools.execute('language_extraction_apply',{id:'main',expectedHash,previewId:p.previewId}),/reference-required/);
 assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
 await tools.execute('reference_read_many',{names:['REM']});
 await tools.execute('language_extraction_apply',{id:'main',expectedHash,previewId:p.previewId});
});

test('standalone CLS no longer prevents complete symbol indexing; stream variants stay outside this addition',()=>{
 const source='10 s%=1\n20 CLS\n30 PRINT s%\n40 END\n';
 assert.match(planSymbolRename(source,{line:1,column:3},'score').after,/PRINT score%/);
 assert.throws(()=>planSymbolRename(source.replace('20 CLS','20 CLS #s%'),{line:1,column:3},'score'),/incomplet/);
});
