import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSymbolRename,planSymbolRename} from '../packages/basic-language/src/rename-symbol.ts';
import {basicFnRenameCases} from './fixtures/basic-fn-rename-cases.ts';
const at={line:1,column:9};
test('FN rename matches independent before/after firmware witnesses',()=>{
 for(const c of basicFnRenameCases){const p=planSymbolRename(c.before,c,c.newStem);assert.equal(p.after,c.after,c.name);assert.ok(['function','parameter'].includes(p.target.kind));}
});
test('FN prefix, suffix, CRLF, comments and DATA are preserved',()=>{
 const source='10 REM FNold x\r\n20 DEF FN old$(x$)=x$\r\n30 PRINT FNold$("FNold"):DATA FNold,x\r\n';
 const p=planSymbolRename(source,{line:2,column:11},'fresh');assert.equal(p.after,source.replace('FN old$','FN fresh$').replace('PRINT FNold$','PRINT FNfresh$'));assert.equal(p.edits.length,2);
 assert.equal(inspectSymbolRename(source,{line:2,column:15}).kind,'parameter');
});
test('FN rename rejects unknown, redefined, aliased, recursive or wrong-arity calls',()=>{
 for(const source of ['10 DEF FNold(x)=x\n20 DEF FNold(x)=x+1', '10 DEF FNold(x)=x\n20 PRINT FNold!', '10 DEF FNold(x)=x\n20 PRINT FNold(1,2)', '10 DEF FNold(x)=FNold(x)', '10 DEF FNold(x)=FNsecond(x)\n20 DEF FNsecond(x)=FNold(x)', '10 DEF FNold(x)=x\n20 PRINT FNmissing(1)', '10 DEF FNold(x)=x\n20 DIM a(FNold(1))','10 DEF FNold(x)=x\n20 MID$(a$,1)="x"'])assert.throws(()=>planSymbolRename(source,at,'fresh'),/refusé/);
});
test('FN definitions must form a simple initial prefix; dynamic types and opaque effects stay refused',()=>{
 for(const source of ['10 x=1\n20 DEF FNold(x)=x','10 IF 1 THEN DEF FNold(x)=x','10 DEF FNold(x)=x:PRINT 1','10 DEF FNold(x)=x\n20 DEFINT a-z','10 DEF FNold(x)=x\n20 CALL &BC00','10 DEF FNold(x)=x\n20 POKE 0,1'])assert.throws(()=>planSymbolRename(source,at,'fresh'),/refusé/);
});
test('parameter alias and duplicate binding cannot authorize a partial rename',()=>{
 for(const source of ['10 DEF FNold(x,x)=x','10 DEF FNold(x,x!)=x','10 DEF FNold(x)=x+x!','10 DEF FNold(x%)=x%+x'])assert.throws(()=>planSymbolRename(source,{line:1,column:13},'value'),/refusé/);
});
test('destination collision refuses capture in any source scope; globals in FN sources stay excluded',()=>{
 const source='10 DEF FNold(x)=x+base\n20 DEF FNother(y)=y\n30 x=99:result=FNold(2)';
 for(const name of ['base','other','y','result','FNnew','PRINT','a'.repeat(41),'x'])assert.throws(()=>planSymbolRename(source,{line:1,column:13},name));
 assert.throws(()=>planSymbolRename(source,{line:3,column:3},'global'),/globales/);
 assert.throws(()=>inspectSymbolRename(source,{line:1,column:7}),/placer/);
 assert.throws(()=>inspectSymbolRename(source,{line:NaN,column:9}),/position/);
});
test('FN plan budgets and original variable routing remain enforced',()=>{
 assert.equal(planSymbolRename('10 score=1',{line:1,column:3},'points').after,'10 points=1');
 assert.throws(()=>planSymbolRename('10 DEF FNold(x)=x\n20 REM '+'.'.repeat(256),at,'fresh'),/255/);
 assert.throws(()=>planSymbolRename('10 DEF FNold(x)=x\n20 REM '+'.'.repeat(65536),at,'fresh'),/64 Kio/);
 const many='10 DEF FNold=1\n'+Array.from({length:99},(_,i)=>`${i+20} PRINT ${Array.from({length:21},()=>"FNold").join(";")}`).join('\n');assert.throws(()=>planSymbolRename(many,at,'fresh'),/2000/);
});
