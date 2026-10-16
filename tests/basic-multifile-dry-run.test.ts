import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {previewTerminalExtraction} from '../packages/workspace/src/multifile-dry-run.ts';
import {newProject,addProjectSource,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {readDataDisk} from '../packages/cpc-disk/src/data-disk.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import type {AgentWorkspaceState} from '../packages/agent/src/types.ts';

const source='10 MEMORY &7FFF\n20 score%=42\n30 POKE &8000,11\n40 GOTO 100\n100 POKE &8001,score%\n110 POKE &8002,24\n120 END\n';
const manifest=()=>newProject('Extraction témoin','647f023d-1272-4b66-8c47-b064b8de9512');
const file=(s=source)=>({id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source:s});
const args=(s=source)=>({manifest:manifest(),sources:[file(s)],sourceId:'main',entryLine:100,newFileName:'PART'});
const hash=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');

test('dry run builds both AMSDOS disks and never alters inputs or their identifiers',()=>{
 const input=args(),copied=structuredClone(input);
 const plan=previewTerminalExtraction(input);
 assert.deepEqual(input,copied,'input must not be mutated');
 assert.equal(plan.applicationEnabled,false);
 assert.equal(plan.persistentWrites,0);
 assert.equal(plan.rollback,'no-write-required');
 assert.equal(plan.original.sources[0]!.source,source);
 assert.equal(plan.proposed.sources[0]!.source,'10 MEMORY &7FFF\n20 score%=42\n30 POKE &8000,11\n40 CHAIN MERGE "PART.BAS",100\n');
 assert.equal(plan.proposed.sources[1]!.source,'100 POKE &8001,score%\n110 POKE &8002,24\n120 END\n');
 assert.equal(plan.proposed.manifest.entryPoint,'main');
 assert.deepEqual(readDataDisk(plan.original.disk).map(x=>x.name),['MAIN.BAS']);
 assert.deepEqual(readDataDisk(plan.proposed.disk).map(x=>x.name),['MAIN.BAS','PART.BAS']);
 assert.notEqual(hash(plan.original.disk),hash(plan.proposed.disk));
});

test('unsupported GOSUB, conditional branches, DATA, RETURN, external flows and invalid sources fail closed',()=>{
 const forbidden=[
  source.replace('40 GOTO 100','40 GOSUB 100'),
  source.replace('40 GOTO 100','40 IF score%=42 THEN GOTO 100'),
  source.replace('100 POKE &8001,score%','100 READ value'),
  source.replace('110 POKE &8002,24','110 RETURN'),
  source.replace('100 POKE &8001,score%','100 ON ERROR GOTO 120'),
  source.replace('100 POKE &8001,score%','100 PRINT "OPAQUE"'),
  source.replace('20 score%=42','20 DIM score%(2)'),
  source.replace('40 GOTO 100','40 GOTO 110'),
  source.replace('30 POKE &8000,11','30 GOTO 100'),
  source.replace('120 END','120 GOTO 100'),
 ];
 for(const specimen of forbidden)assert.throws(()=>previewTerminalExtraction(args(specimen)),/Extraction simulée refusée|existe|format|ligne/,specimen);
 assert.throws(()=>previewTerminalExtraction({...args(),newFileName:'MAIN'}),/Collision/);
 assert.throws(()=>previewTerminalExtraction({...args(),newFileName:'EVIL.BAS'}),/nom/);
 const multi=addProjectSource(manifest(),'PART');
 assert.throws(()=>previewTerminalExtraction({...args(),manifest:multi,sources:[file(),{...multi.sources[1]!,source:'10 END\n'}]}),/seul listing/);
 assert.throws(()=>previewTerminalExtraction({...args(),entryLine:0}),/numéro/);
});

test('agent requires exact source hash, keeps build verified, writes nothing and invalidates old previews',async()=>{
 const state:AgentWorkspaceState={sessionId:'dry-run',manifest:manifest(),files:[{...file(),saved:source}]};
 let writes=0;
 const tools=new WorkspaceTools(state,async()=>{writes++;},hash,[]);
 assert.ok(tools.definitions.some(d=>d.name==='language_extraction_simulate'));
 await assert.rejects(tools.execute('language_extraction_simulate',{id:'unknown',expectedHash:hash(source),entryLine:100,newFileName:'PART'}),/scope-denied/);
 await assert.rejects(tools.execute('language_extraction_simulate',{id:'main',expectedHash:hash('stale'),entryLine:100,newFileName:'PART'}),/stale-read/);
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 const preview=await tools.execute('language_extraction_simulate',{id:'main',expectedHash:hash(source),entryLine:100,newFileName:'PART'}) as {persistentWrites:number;status:string;createdCpcName:string;proposedDiskSha256:string};
 assert.equal(preview.status,'simulated-only');
 assert.equal(preview.persistentWrites,0);
 assert.equal(preview.createdCpcName,'PART.BAS');
 assert.equal(preview.proposedDiskSha256.length,64);
 assert.equal(writes,0);
 assert.equal(tools.state.files.length,1);
 assert.equal(tools.state.files[0]!.source,source);
 assert.equal(tools.state.manifest.sources.length,1);
 assert.equal(tools.buildVerified,true,'read-only simulation cannot invalidate baseline build');
 assert.equal(tools.extractionSimulationViews()[0]!.stale,false);
 await tools.execute('reference_read_many',{names:['MEMORY','POKE','GOTO','END']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:hash(source),source:source.replace('score%=42','score%=43')});
 assert.equal(tools.extractionSimulationViews()[0]!.stale,true);
 assert.equal(writes,1,'only explicit project mutation should write');
 await assert.rejects(tools.execute('language_extraction_apply',{id:'main',expectedHash:hash(source),previewId:'unknown'}),/stale-preview/,'an invalid preview never authorizes application');
});
