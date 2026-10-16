import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WorkspaceTools } from '../packages/agent/src/workspace-tools.ts';
import { newProject } from '../packages/workspace/src/project.ts';
import type { AgentWorkspaceState } from '../packages/agent/src/types.ts';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const state=(source:string):AgentWorkspaceState=>({
 sessionId:'rename-session',manifest:newProject('Refactorisation','647f023d-1272-4b66-8c47-b064b8de9512'),
 files:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source,saved:source}]
});

test('preview is non-mutating; guarded agent apply uses exactly the F2 rename plan and invalidates the build',async()=>{
 const input='10 score=1:PRINT score\n20 END\n';
 let writes=0;
 const tools=new WorkspaceTools(state(input),async candidate=>{
  writes++;assert.equal(candidate.files[0]!.source,'10 points=1:PRINT points\n20 END\n');
 },hash,[]);
 const expectedHash=hash(input);
 const preview=await tools.execute('language_rename_preview',{id:'main',expectedHash,line:1,column:3,newStem:'points'}) as {previewId:string;after:string;before:string;occurrences:number;persisted:boolean};
 assert.equal(preview.before,input);assert.equal(preview.after,'10 points=1:PRINT points\n20 END\n');
 assert.equal(preview.occurrences,2);assert.equal(preview.persisted,false);
 assert.equal(writes,0);assert.equal(tools.state.files[0]!.source,input);
 assert.equal(tools.renameOperations[0]!.status,'preview');
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 await assert.rejects(tools.execute('language_rename_apply',{id:'main',expectedHash,previewId:preview.previewId}),/reference-required/);
 assert.equal(writes,0);assert.equal(tools.renameOperations[0]!.status,'preview');
 await tools.execute('reference_read_many',{names:['PRINT','END']});
 const applied=await tools.execute('language_rename_apply',{id:'main',expectedHash,previewId:preview.previewId}) as {newName:string;substitutions:number;saved:boolean};
 assert.equal(applied.newName,'points');assert.equal(applied.substitutions,2);assert.equal(applied.saved,true);
 assert.equal(writes,1);assert.equal(tools.buildVerified,false);assert.equal(tools.renameOperations[0]!.status,'applied');
 await assert.rejects(tools.execute('language_rename_apply',{id:'main',expectedHash,previewId:preview.previewId}),/stale-preview/);
});

test('previews expire after another source mutation, and an old ID never authorizes rewriting',async()=>{
 const input='10 score=1:PRINT score\n20 END\n';
 let writes=0;const tools=new WorkspaceTools(state(input),async()=>{writes++;},hash,[]);
 const first=await tools.execute('language_rename_preview',{id:'main',expectedHash:hash(input),line:1,column:3,newStem:'points'}) as {previewId:string};
 await tools.execute('reference_read_many',{names:['PRINT','END']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:hash(input),source:'10 score=2:PRINT score\n20 END\n'});
 assert.equal(tools.renameOperations[0]!.status,'obsolete');
 await assert.rejects(tools.execute('language_rename_apply',{id:'main',expectedHash:hash(input),previewId:first.previewId}),/stale-preview/);
 assert.equal(writes,1);
 await assert.rejects(tools.execute('language_rename_preview',{id:'other',expectedHash:hash(input),line:1,column:3,newStem:'points'}),/scope-denied/);
 await assert.rejects(tools.execute('language_rename_preview',{id:'main',expectedHash:'wrong',line:1,column:3,newStem:'points'}),/stale-read/);
 await assert.rejects(tools.execute('language_rename_preview',{id:'main',expectedHash:hash(tools.state.files[0]!.source),line:1,column:3,newStem:'PRINT'}));
 assert.equal(writes,1);
});

test('FN names and parameters use the existing conservative F2 analysis; unknown globals are refused',async()=>{
 const input='10 DEF FNold(x)=x+1\n20 result=FNold(2):PRINT result\n30 END\n';
 let writes=0;const tools=new WorkspaceTools(state(input),async()=>{writes++;},hash,[]);
 const startHash=hash(input);
 await assert.rejects(tools.execute('language_rename_preview',{id:'main',expectedHash:startHash,line:2,column:4,newStem:'out'}),/globales/);
 const preview=await tools.execute('language_rename_preview',{id:'main',expectedHash:startHash,line:1,column:9,newStem:'calc'}) as {previewId:string;after:string;target:{kind:string}};
 assert.equal(preview.target.kind,'function');assert.match(preview.after,/DEF FNcalc\(x\)/);assert.match(preview.after,/FNcalc\(2\)/);
 await tools.execute('reference_read_many',{names:['DEF','FN','PRINT','END']});
 await tools.execute('language_rename_apply',{id:'main',expectedHash:startHash,previewId:preview.previewId});
 assert.equal(writes,1);assert.match(tools.state.files[0]!.source,/FNcalc\(2\)/);
 const current=tools.state.files[0]!.source;
 const parameter=await tools.execute('language_rename_preview',{id:'main',expectedHash:hash(current),line:1,column:14,newStem:'value'}) as {after:string;target:{kind:string}};
 assert.equal(parameter.target.kind,'parameter');assert.match(parameter.after,/FNcalc\(value\)=value\+1/);
 assert.equal(writes,1,'second preview must not persist anything');
});

test('preview planning rejects ambiguous aliases and never mutates, even when the agent requests it',async()=>{
 const source='10 score=1\n20 score$="x"\n30 END\n';
 let writes=0;const tools=new WorkspaceTools(state(source),async()=>{writes++;},hash,[]);
 await assert.rejects(tools.execute('language_rename_preview',{id:'main',expectedHash:hash(source),line:1,column:3,newStem:'points'}),/alias/);
 assert.equal(writes,0);assert.equal(tools.renameOperations.length,0);
 await assert.rejects(tools.execute('language_rename_apply',{id:'main',expectedHash:hash(source),previewId:hash('fake')}),/stale-preview/);
});

test('agent rename refuses CRLF sources rather than silently applying a different newline format',async()=>{
 const source='10 score=1:PRINT score\\r\\n20 END\\r\\n';
 const tools=new WorkspaceTools(state(source),async()=>assert.fail('CRLF preview must not write'),hash,[]);
 await assert.rejects(tools.execute('language_rename_preview',{id:'main',expectedHash:hash(source),line:1,column:3,newStem:'points'}),/CRLF/);
 assert.equal(tools.renameOperations.length,0);
});
