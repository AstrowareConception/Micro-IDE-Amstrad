import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeBasicModules} from '../packages/basic-language/src/module-review.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {newProject} from '../packages/workspace/src/project.ts';
import type {AgentWorkspaceState} from '../packages/agent/src/types.ts';

const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const primary=(source:string)=>({id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source});
const workspace=(source:string):AgentWorkspaceState=>({sessionId:'modules',manifest:newProject('Modules','647f023d-1272-4b66-8c47-b064b8de9512'),files:[{...primary(source),saved:source}]});

test('read-only analyzer identifies a GOSUB / RETURN review area and shared state, without claiming extraction',()=>{
 const source='10 counter=0\n20 GOSUB 100\n30 PRINT counter\n40 END\n100 counter=counter+1\n110 RETURN\n';
 const report=analyzeBasicModules(primary(source));
 assert.equal(report.hasMutations,false);
 assert.equal(report.flowComplete,true,report.flowReasons.join('\n'));
 const module=report.candidates.find(c=>c.entryLine===100);
 assert.ok(module,JSON.stringify(report));
 assert.equal(module.status,'review',JSON.stringify(module));
 assert.equal(module.endLine,110);
 assert.deepEqual(module.callSites,[20]);
 assert.ok(module.sharedNames.includes('COUNTER'));
 assert.match(module.excerpt,/100 counter=counter\+1/);
 assert.equal(report.loads.length,0);
 assert.ok(report.method.includes('aucune garantie'));
});

test('external CHAIN/MERGE/RUN references are reported without inventing a safe loading strategy',()=>{
 const source='10 CHAIN "LEVEL2"\n20 GOSUB 100\n30 END\n100 n=n+1\n110 RETURN\n';
 const report=analyzeBasicModules(primary(source),[{id:'level',path:'src/level2.bas',cpcName:'LEVEL2.BAS'}]);
 assert.equal(report.loads.length,1);
 assert.equal(report.loads[0]!.operation,'CHAIN');
 assert.equal(report.loads[0]!.literalName,'LEVEL2');
 assert.deepEqual(report.loads[0]!.matchingSourceIds,['level']);
 assert.ok(report.candidates.every(c=>c.status==='blocked'));
 assert.ok(report.risks.length>0);
 const embedded=analyzeBasicModules(primary('10 PRINT "CHAIN LEVEL2"\n20 GOSUB 100\n30 END\n100 RETURN\n'));
 assert.equal(embedded.loads.length,0,'quoted text is not a disk operation');
});

test('fallthrough, cross-boundary transfers and missing RETURN block module movement',()=>{
 const cases=[
  '10 GOSUB 100\n20 PRINT 1\n100 score=score+1\n110 RETURN',
  '10 GOSUB 100\n20 END\n100 GOTO 20\n110 RETURN',
  '10 GOSUB 100\n20 GOTO 110\n30 END\n100 score=1\n110 RETURN',
  '10 GOSUB 100\n20 END\n100 score=1\n110 PRINT score',
 ];
 for(const code of cases){
  const report=analyzeBasicModules(primary(code));
  assert.ok(report.candidates.length,code);
  assert.ok(report.candidates.every(c=>c.status==='blocked'),JSON.stringify({code,report}));
 }
});

test('large inputs abort bounded analysis; a non-GOSUB listing does not invent modules',()=>{
 const tooLarge='10 REM '+ 'x'.repeat(65536);
 const limited=analyzeBasicModules(primary(tooLarge));
 assert.equal(limited.candidates.length,0);assert.ok(limited.risks.length);
 const noModules=analyzeBasicModules(primary('10 PRINT 1\n20 END'));
 assert.equal(noModules.candidates.length,0);
 assert.match(noModules.risks.join(' '),/Aucune sous-routine/);
});

test('agent module review requires exact hash and leaves files, builds and source revisions unchanged',async()=>{
 const source='10 total=0\n20 GOSUB 100\n30 END\n100 total=total+1\n110 RETURN\n';
 let writes=0;
 const tools=new WorkspaceTools(workspace(source),async()=>{writes++;},digest,[]);
 assert.ok(tools.definitions.some(d=>d.name==='language_module_review'));
 await assert.rejects(tools.execute('language_module_review',{id:'unknown',expectedHash:digest(source)}),/scope-denied/);
 await assert.rejects(tools.execute('language_module_review',{id:'main',expectedHash:digest('other')}),/stale-read/);
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 const report=await tools.execute('language_module_review',{id:'main',expectedHash:digest(source)}) as {flowComplete:boolean;candidates:{entryLine:number}[];hasMutations:boolean};
 assert.equal(report.hasMutations,false);
 assert.equal(report.flowComplete,true);
 assert.ok(report.candidates.some(c=>c.entryLine===100));
 assert.equal(writes,0);
 assert.equal(tools.state.files[0]!.source,source);
 assert.equal(tools.buildVerified,true,'a read-only review must never invalidate a previous DSK build');
 assert.equal(tools.moduleReviewViews()[0]!.stale,false);
 await tools.execute('reference_read_many',{names:['END','GOSUB','RETURN']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:digest(source),source:'10 total=1\n20 GOSUB 100\n30 END\n100 total=total+1\n110 RETURN\n'});
 assert.equal(tools.moduleReviewViews()[0]!.stale,true,'a report attached to an old buffer must not be shown as current');
});
