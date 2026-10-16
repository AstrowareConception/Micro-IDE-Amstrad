import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planBasicReadabilityFormat} from '../packages/basic-language/src/readability-format.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {newProject} from '../packages/workspace/src/project.ts';
import type {AgentWorkspaceState} from '../packages/agent/src/types.ts';

const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const state=(source:string):AgentWorkspaceState=>({
 sessionId:'format-test',manifest:newProject('Format','647f023d-1272-4b66-8c47-b064b8de9512'),
 files:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source,saved:source}]
});

test('conservative format normalizes only simple whitespace, preserving content and line targets',()=>{
 const source='10   score=  1  :  bonus=2  \n20 IF score=1 THEN PRINT "A:B" ELSE PRINT "X"\n30 DATA "red:blue",  A  :READ a$\n40 REM   keep  spaces : GOTO 10\n50 x=1  :  y=2\n60 END\n';
 const plan=planBasicReadabilityFormat(source);
 assert.ok(plan.edits.length>=2);
 assert.match(plan.after,/^10 score= 1 : bonus=2\n/);
 assert.match(plan.after,/^50 x=1 : y=2$/m);
 for(const fragment of source.split('\n').slice(1,4))assert.ok(plan.after.includes(fragment),'opaque source unchanged');
 assert.match(plan.after,/60 END/);
 assert.ok(plan.skipped>=3);
 assert.equal(planBasicReadabilityFormat(plan.after).edits.length,0,'format is idempotent');
});

test('formatter rejects malformed or CRLF input and never changes quoted/commented/data text',()=>{
 assert.throws(()=>planBasicReadabilityFormat('10 x=1\r\n20 END\r\n'),/CRLF/);
 assert.throws(()=>planBasicReadabilityFormat('10 PRINT "unclosed'),/chaîne non terminée|Listing BASIC/);
 const text='10 PRINT "A : B"  \n20 REM not: a =  b  \n30 DATA  1,  2  \n';
 const plan=planBasicReadabilityFormat(text);
 assert.equal(plan.after,text);assert.equal(plan.edits.length,0);
});

test('agent formatting preview, report and revision gated apply use mission journal',async()=>{
 const source='10   score=  1  :  bonus=2  \n20 END\n';
 let writes=0;
 const tools=new WorkspaceTools(state(source),async candidate=>{
   writes++;assert.equal(candidate.files[0]!.source,'10 score= 1 : bonus=2\n20 END\n');
 },hash,[]);
 const review=await tools.execute('language_readability_review',{id:'main'}) as {metrics:{physicalLines:number};commentIdeas:unknown[];commentsInserted:boolean};
 assert.equal(review.commentsInserted,false);assert.equal(review.metrics.physicalLines,2);
 const preview=await tools.execute('language_format_preview',{id:'main',expectedHash:hash(source)}) as {previewId:string;changedLines:number;qualityBefore:{maxLineLength:number};qualityAfter:{maxLineLength:number};persisted:boolean};
 assert.equal(writes,0);assert.equal(preview.persisted,false);assert.equal(preview.changedLines,1);
 assert.ok(preview.qualityAfter.maxLineLength<preview.qualityBefore.maxLineLength);
 await assert.rejects(tools.execute('language_format_apply',{id:'main',expectedHash:hash(source),previewId:'not-a-real-preview'}),/stale-preview/);
 await assert.rejects(tools.execute('language_format_apply',{id:'main',expectedHash:hash(source),previewId:preview.previewId}),/reference-required/);
 assert.equal(writes,0);
 await tools.execute('reference_read_many',{names:['END']});
 const apply=await tools.execute('language_format_apply',{id:'main',expectedHash:hash(source),previewId:preview.previewId}) as {saved:boolean;changedLines:number};
 assert.equal(apply.changedLines,1);assert.equal(apply.saved,true);assert.equal(writes,1);
 assert.equal(tools.formatOperations[0]!.status,'applied');
 assert.equal(tools.buildVerified,false);
 await assert.rejects(tools.execute('language_format_apply',{id:'main',expectedHash:hash(source),previewId:preview.previewId}),/stale-preview/);
});

test('preview is invalidated after source mutation and a stale hash refuses changes',async()=>{
 const source='10   score=  1\n20 END\n';
 let writes=0;const tools=new WorkspaceTools(state(source),async()=>{writes++;},hash,[]);
 const preview=await tools.execute('language_format_preview',{id:'main',expectedHash:hash(source)}) as {previewId:string};
 await tools.execute('reference_read_many',{names:['END']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:hash(source),source:'10 score=3\n20 END\n'});
 assert.equal(tools.formatOperations[0]!.status,'obsolete');
 await assert.rejects(tools.execute('language_format_apply',{id:'main',expectedHash:hash(source),previewId:preview.previewId}),/stale-preview/);
 await assert.rejects(tools.execute('language_format_preview',{id:'main',expectedHash:hash(source)}),/stale-read/);
 assert.equal(writes,1);
});
