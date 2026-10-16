import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planBasicCommentInsert} from '../packages/basic-language/src/comment-insert.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {newProject} from '../packages/workspace/src/project.ts';
import type {AgentWorkspaceState} from '../packages/agent/src/types.ts';

const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const state=(source:string):AgentWorkspaceState=>({sessionId:'rem-test',manifest:newProject('Commentaires','647f023d-1272-4b66-8c47-b064b8de9512'),files:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source,saved:source}]});

test('numbered REM plan leaves original lines byte for byte and preserves entry point and line references',()=>{
 const source='10 GOTO 30\n20 PRINT "A"\n30 score=1\n40 PRINT score\n50 END\n';
 const plan=planBasicCommentInsert(source,40,'Score temporaire');
 assert.equal(plan.basicLine,39);
 assert.equal(plan.beforeBasicLine,40);
 assert.equal(plan.after,'10 GOTO 30\n20 PRINT "A"\n30 score=1\n39 REM Score temporaire\n40 PRINT score\n50 END\n');
 assert.equal(plan.before,source);
 assert.equal(plan.after.replace('39 REM Score temporaire\n',''),source);
 assert.ok(plan.warnings.some(x=>x.includes('mémoire')));
});
test('source with adjacent line numbers, missing anchor or changed initial entry refuses comments',()=>{
 for(const [source,line] of [['10 END\n',10],['10 END\n11 END\n',11],['10 END\n30 END\n',40]] as const)
  assert.throws(()=>planBasicCommentInsert(source,line,'Une remarque'));
});
test('opaque runtime, computed transfer, missing static branch and malformed listing fail closed',()=>{
 for(const source of ['10 RUN "OTHER"\n20 END\n','10 ON ERROR GOTO 20\n20 END\n','10 GOTO target\n20 END\n','10 GOTO 19\n20 END\n','10 PRINT "ouvert\n20 END\n']){
  assert.throws(()=>planBasicCommentInsert(source,20,'Une remarque'),{message:/.+/},'Un flux non couvert doit être refusé : '+source);
 }
});
test('comment content must be ASCII conservative and cannot inject executable BASIC',()=>{
 const source='10 score=1\n20 PRINT score\n30 END\n';
 for(const comment of ['ok','État du score','Valeur:PRINT "BOOM"','Ligne\n10 RUN','Trop   long '.repeat(10),' espace ','A|CPM','A"b']){
  assert.throws(()=>planBasicCommentInsert(source,20,comment));
 }
});
test('agent preview is a true no-op; an apply uses only the prepared plan and checkpoints',async()=>{
 const source='10 score=1\n20 PRINT score\n30 END\n';
 let writes=0;
 const tools=new WorkspaceTools(state(source),async candidate=>{
   writes++;assert.equal(candidate.files[0]!.source,'10 score=1\n19 REM Score courant\n20 PRINT score\n30 END\n');
 },hash,[]);
 const revision=hash(source);
 const p=await tools.execute('language_comment_preview',{id:'main',expectedHash:revision,beforeBasicLine:20,comment:'Score courant'}) as {previewId:string;newBasicLine:number;persisted:boolean};
 assert.equal(p.newBasicLine,19);assert.equal(p.persisted,false);assert.equal(writes,0);
 assert.equal(tools.commentOperations[0]!.status,'preview');
 await assert.rejects(tools.execute('language_comment_apply',{id:'main',expectedHash:revision,previewId:'not-the-token'}),/stale-preview/);
 await assert.rejects(tools.execute('language_comment_apply',{id:'main',expectedHash:revision,previewId:p.previewId}),/reference-required/);
 assert.equal(writes,0);
 await tools.execute('reference_read_many',{names:['PRINT','END']});
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 const result=await tools.execute('language_comment_apply',{id:'main',expectedHash:revision,previewId:p.previewId}) as {saved:boolean;newBasicLine:number};
 assert.equal(result.saved,true);assert.equal(result.newBasicLine,19);assert.equal(writes,1);
 assert.equal(tools.commentOperations[0]!.status,'applied');assert.equal(tools.buildVerified,false);
 await assert.rejects(tools.execute('language_comment_apply',{id:'main',expectedHash:revision,previewId:p.previewId}),/stale-preview/);
});
test('stale project revision, scope or superseded preview never authorizes an insertion',async()=>{
 const source='10 score=1\n20 PRINT score\n30 END\n';
 let writes=0;
 const tools=new WorkspaceTools(state(source),async()=>{writes++;},hash,[]);
 await assert.rejects(tools.execute('language_comment_preview',{id:'missing',expectedHash:hash(source),beforeBasicLine:20,comment:'Score courant'}),/scope-denied/);
 await assert.rejects(tools.execute('language_comment_preview',{id:'main',expectedHash:'wrong',beforeBasicLine:20,comment:'Score courant'}),/stale-read/);
 const p=await tools.execute('language_comment_preview',{id:'main',expectedHash:hash(source),beforeBasicLine:20,comment:'Score courant'}) as {previewId:string};
 const q=await tools.execute('language_comment_preview',{id:'main',expectedHash:hash(source),beforeBasicLine:30,comment:'Fin du score'}) as {previewId:string};
 assert.notEqual(p.previewId,q.previewId);assert.equal(tools.commentOperations[0]!.status,'obsolete');
 await assert.rejects(tools.execute('language_comment_apply',{id:'main',expectedHash:hash(source),previewId:p.previewId}),/stale-preview/);
 await tools.execute('reference_read_many',{names:['PRINT','END']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:hash(source),source:'10 score=2\n20 PRINT score\n30 END\n'});
 assert.equal(tools.commentOperations[1]!.status,'obsolete');
 await assert.rejects(tools.execute('language_comment_apply',{id:'main',expectedHash:hash(source),previewId:q.previewId}),/stale-preview/);
 assert.equal(writes,1);
});
