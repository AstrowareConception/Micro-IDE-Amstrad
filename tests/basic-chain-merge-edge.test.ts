import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectChainMergeOverlay} from '../packages/basic-language/src/chain-merge-overlay.ts';

const src=(id:string,source:string)=>({id,path:'src/'+id+'.bas',cpcName:id.toUpperCase()+'.BAS',source});
test('CHAIN MERGE overlay identifies DELETE, arrays, string identifiers and a DATA cursor risk',()=>{
 const host=src('main','10 DIM v%(4)\n20 label$="ok"\n30 READ x\n40 CHAIN MERGE "PART.BAS",100,DELETE 300-399\n100 END\n300 DATA 7,19\n');
 const overlay=src('part','100 POKE &8001,v%(2)\n110 PRINT label$\n120 READ y\n130 END\n');
 const r=inspectChainMergeOverlay(host,overlay);
 assert.equal(r.extractionPermitted,false);
 assert.equal(r.behavioralProof,'not-run');
 assert.equal(r.referencesData,true);
 assert.equal(r.usesMemoryControl,true);
 assert.equal(r.hasDeleteClause,true);
 assert.equal(r.readWithoutRestore,true);
 assert.ok(r.arrayNames.includes('V%'));
 assert.ok(r.stringNames.includes('LABEL$'));
 assert.ok(r.sharedIdentifiers.includes('LABEL$'));
 assert.ok(r.warnings.length>=4);
});
test('an unremarkable report never grants permission to extract code',()=>{
 const r=inspectChainMergeOverlay(src('main','10 PRINT "CHAIN MERGE DELETE"\n20 END'),src('part','100 END'));
 assert.equal(r.extractionPermitted,false);
 assert.equal(r.behavioralProof,'not-run');
 assert.equal(r.hasDeleteClause,false,'text in strings is not executable');
});
