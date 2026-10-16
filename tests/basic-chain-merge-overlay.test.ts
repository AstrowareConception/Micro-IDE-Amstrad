import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectChainMergeOverlay} from '../packages/basic-language/src/chain-merge-overlay.ts';
import {WorkspaceTools} from '../packages/agent/src/workspace-tools.ts';
import {newProject,addProjectSource} from '../packages/workspace/src/project.ts';

const file=(id:string,source:string)=>({id,path:'src/'+id+'.bas',cpcName:id.toUpperCase()+'.BAS',source});
const hash=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');

test('overlay contract identifies replaced lines, shared identifiers and DATA / memory risks',()=>{
 const host=file('main','10 MEMORY &7FFF\n20 SHARED%=37\n30 CHAIN MERGE "PART.BAS",100\n100 POKE &8001,99\n200 DATA 0,0\n');
 const overlay=file('part','100 POKE &8001,SHARED%\n200 DATA 7,19\n');
 const report=inspectChainMergeOverlay(host,overlay);
 assert.deepEqual(report.collisions,[100,200]);
 assert.ok(report.sharedIdentifiers.includes('SHARED%'));
 assert.deepEqual(report.hostDataLines,[200]);assert.deepEqual(report.overlayDataLines,[200]);
 assert.equal(report.referencesData,true);assert.equal(report.usesMemoryControl,true);
 assert.equal(report.extractionPermitted,false);assert.equal(report.behavioralProof,'not-run');
 assert.ok(report.warnings.some(x=>x.includes('remplacements')));
});
test('no collisions cannot establish safety; malformed or duplicate input is refused',()=>{
 const report=inspectChainMergeOverlay(file('main','10 PRINT 1\n'),file('part','100 END\n'));
 assert.deepEqual(report.collisions,[]);
 assert.equal(report.extractionPermitted,false);
 assert.ok(report.warnings.some(x=>x.includes('Absence de collision')));
 assert.throws(()=>inspectChainMergeOverlay(file('main','10 END'),file('main','20 END')),/distinctes/);
 const corrupt=inspectChainMergeOverlay(file('main','20 PRINT 1\n10 END\n'),file('part','100 END\n'));
 assert.equal(corrupt.hasErrors,true);
 assert.equal(corrupt.extractionPermitted,false);
});
test('agent contract requires both source revisions, performs no writes and becomes stale',async()=>{
 const main='10 shared%=37\n20 CHAIN MERGE "PART.BAS",100\n100 END\n';
 const part='100 PRINT shared%\n110 END\n';
 const manifest=addProjectSource(newProject('Overlay test','647f023d-1272-4b66-8c47-b064b8de9512'),'PART');
 const state={sessionId:'overlay',manifest,files:manifest.sources.map(f=>({...f,source:f.id==='main'?main:part,saved:f.id==='main'?main:part}))};
 let writes=0;const tools=new WorkspaceTools(state,async()=>{writes++;},hash,[]);
 await assert.rejects(tools.execute('language_chain_merge_review',{id:'foreign',expectedHash:hash(main),overlayId:'part',overlayHash:hash(part)}),/scope-denied/);
 await assert.rejects(tools.execute('language_chain_merge_review',{id:'main',expectedHash:hash('stale'),overlayId:'part',overlayHash:hash(part)}),/stale-read/);
 await assert.rejects(tools.execute('language_chain_merge_review',{id:'main',expectedHash:hash(main),overlayId:'part',overlayHash:hash('old')}),/stale-read/);
 await tools.execute('build_project',{});assert.equal(tools.buildVerified,true);
 const report=await tools.execute('language_chain_merge_review',{id:'main',expectedHash:hash(main),overlayId:'part',overlayHash:hash(part)}) as {collisions:number[];extractionPermitted:boolean};
 assert.deepEqual(report.collisions,[100]);assert.equal(report.extractionPermitted,false);
 assert.equal(writes,0);assert.equal(tools.buildVerified,true);
 assert.equal(tools.chainMergeViews()[0]!.stale,false);
 await tools.execute('reference_read_many',{names:['PRINT','END','CHAIN','MERGE']});
 await tools.execute('project_replace_source',{id:'part',expectedHash:hash(part),source:'100 PRINT shared%\n110 REM changed\n120 END\n'});
 assert.equal(writes,1);assert.equal(tools.chainMergeViews()[0]!.stale,true);
});
