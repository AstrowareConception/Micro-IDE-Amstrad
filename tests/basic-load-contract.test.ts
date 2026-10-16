import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLoadContract} from '../packages/basic-language/src/load-contract.ts';

const file=(id:string,source:string)=>({id,path:'src/'+id+'.bas',cpcName:id.toUpperCase()+'.BAS',source});
test('CHAIN and MERGE references resolve same-disk CPC files, not string literals or line-number RUN',()=>{
 const report=inspectLoadContract([
  file('main','10 PRINT "CHAIN FAKE.BAS"\n20 CHAIN "LEVEL.BAS"\n30 REM MERGE "FAKE"\n40 RUN 20'),
  file('level','10 MERGE "LIB"\n20 END'),
  file('lib','100 RETURN')]);
 assert.deepEqual(report.links.map(x=>[x.operation,x.rawTarget,x.targetId,x.status]),
 [['CHAIN','LEVEL.BAS','level','local-literal'],['MERGE','LIB','lib','local-literal']]);
 assert.equal(report.extractionPermitted,false);
 assert.equal(report.executableProof,'not-run');
 assert.equal(report.truncated,false);
});
test('CHAIN MERGE and literal RUN filename are distinct; runtime state must be qualified',()=>{
 const report=inspectLoadContract([
  file('main','10 CHAIN MERGE "LIB.BAS",100\n20 RUN "LEVEL.BAS"'),
  file('lib','100 RETURN'),
  file('level','10 END')
 ]);
 assert.deepEqual(report.links.map(l=>l.operation),['CHAIN MERGE','RUN FILE']);
 assert.equal(report.links[0]!.targetId,'lib');
 assert.equal(report.links[1]!.targetId,'level');
 assert.ok(report.risks.some(x=>x.includes('firmware')));
});
test('dynamic, external, conditional and binary LOAD preserve uncertainty instead of inventing safe modules',()=>{
 const report=inspectLoadContract([
  file('main','10 CHAIN target$\n20 IF ok THEN CHAIN "NOFILE.BAS"\n30 LOAD "SPRITE.BIN"\n40 PRINT "MERGE DATA"\n50 DATA CHAIN,MEMORY\n60 REM RUN "BASIC"')]);
 assert.equal(report.links.length,3);
 assert.deepEqual(report.links.map(x=>x.status),['dynamic','external-literal','external-literal']);
 assert.ok(report.links[0]!.blockers.length);
 assert.ok(report.links[1]!.blockers.some(x=>x.includes('conditionnel')));
 assert.ok(report.links[2]!.blockers.some(x=>x.includes('binaire')));
});
test('bounded report refuses duplicate source IDs and detects circular CHAIN',()=>{
 assert.throws(()=>inspectLoadContract([file('a','10 END'),file('a','10 END')]),/dupliquées/);
 const report=inspectLoadContract([file('a','10 CHAIN "B"'),file('b','10 CHAIN "A"')]);
 assert.equal(report.cycles.length,1);
 assert.deepEqual(new Set(report.cycles[0]),new Set(['a','b']));
 const limited=inspectLoadContract([file('huge','10 REM '+'.'.repeat(65535))]);
 assert.equal(limited.truncated,true);
 assert.equal(limited.links.length,0);
});

test('agent loading contract requires a real source SHA and remains read-only, stale only after mutation',async()=>{
 const {createHash}=await import('node:crypto');
 const {WorkspaceTools}=await import('../packages/agent/src/workspace-tools.ts');
 const {newProject,addProjectSource}=await import('../packages/workspace/src/project.ts');
 const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
 const main='10 CHAIN "LEVEL.BAS"\n20 END\n',second='10 END\n';
 const manifest=addProjectSource(newProject('Chain','647f023d-1272-4b66-8c47-b064b8de9512'),'LEVEL');
 const state={sessionId:'loading',manifest,files:manifest.sources.map(f=>({...f,source:f.id==='main'?main:second,saved:f.id==='main'?main:second}))};
 let writes=0;
 const tools=new WorkspaceTools(state,async()=>{writes++;},hash,[]);
 await assert.rejects(tools.execute('language_loading_contract',{id:'invalid',expectedHash:hash(main)}),/scope-denied/);
 await assert.rejects(tools.execute('language_loading_contract',{id:'main',expectedHash:hash('wrong')}),/stale-read/);
 const build=await tools.execute('build_project',{});
 assert.ok(build);
 assert.equal(tools.buildVerified,true);
 const report=await tools.execute('language_loading_contract',{id:'main',expectedHash:hash(main)}) as {links:{targetId:string|null}[];extractionPermitted:boolean;executableProof:string};
 assert.equal(report.links[0]!.targetId,'level');
 assert.equal(report.extractionPermitted,false);
 assert.equal(report.executableProof,'not-run');
 assert.equal(writes,0);
 assert.equal(tools.buildVerified,true);
 assert.equal(tools.loadingReportViews()[0]!.stale,false);
 await tools.execute('reference_read_many',{names:['CHAIN','END']});
 await tools.execute('project_replace_source',{id:'main',expectedHash:hash(main),source:'10 CHAIN "LEVEL.BAS"\n20 REM changed\n30 END\n'});
 assert.equal(writes,1);
 assert.equal(tools.loadingReportViews()[0]!.stale,true);
});
