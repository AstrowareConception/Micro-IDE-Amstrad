import test from 'node:test';
import assert from 'node:assert/strict';
import { indexSymbols, type SymbolIndex } from '../packages/basic-language/src/symbols.ts';
import { navigateSymbol, SYMBOL_NAVIGATION_LIMIT, type SymbolNavigationMode } from '../packages/basic-language/src/symbol-navigation.ts';
const scan=(source:string)=>indexSymbols({id:'a',name:'main.bas',source});
const lookup=(index:SymbolIndex,line:number,column:number,mode:SymbolNavigationMode='usages')=>navigateSymbol(index,{sourceId:'a',line,column,mode});
test('cursor globals preserve suffix/array identities and include only free FN reads',()=>{
 const index=scan('10 score=1:score%=2:DIM score(3)\n20 DEF FNinner(y)=score+y\n30 DEF FNouter(score)=FNinner(2)+score\n40 PRINT score:PRINT score(1)');
 const score=index.symbols.find(s=>s.name==='SCORE'&&s.kind==='scalar')!;
 const r=lookup(index,1,score.occurrences[0]!.start);assert.equal(r.name,'SCORE');assert.deepEqual(r.targets.map(t=>t.location.line),[1,2,4]);
 const fromFree=lookup(index,2,index.functions.definitions[0]!.reads[0]!.location.start);assert.deepEqual(fromFree.targets,r.targets);
 const array=index.symbols.find(s=>s.kind==='array')!;assert.equal(lookup(index,1,array.occurrences[0]!.start).total,2);
 const d=lookup(index,4,score.occurrences[1]!.start,'declarations');assert.equal(d.total,1);assert.equal(d.targets[0]!.label,'Écriture');assert.equal(d.targets[0]!.possible,true);assert.match(d.notes.join(' '),/sans preuve d’initialisation/);
});
test('cursor parameter usages remain scoped to their definition and ambiguous reads stay possible',()=>{
 const index=scan('10 x=99\n20 DEF FNfirst(x)=x+1\n30 DEF FNsecond(x)=x+2');
 for(const d of index.functions.definitions){const p=d.parameters[0]!;const r=lookup(index,p.location.line,p.location.start);assert.equal(r.total,2);assert.ok(r.targets.every(t=>t.location.line===p.location.line));assert.ok(r.targets.every(t=>!t.possible));}
 const duplicate=scan('10 DEF FNvalue(x,x)=x+1'),d=duplicate.functions.definitions[0]!;
 const r=lookup(duplicate,1,d.reads[0]!.location.start,'declarations');assert.equal(r.total,2);assert.ok(r.targets.every(t=>t.possible));
 const typed=scan('10 DEFINT x\n20 DEF FNvalue(x)=x%+1'),td=typed.functions.definitions[0]!;
 assert.equal(lookup(typed,2,td.reads[0]!.location.start,'declarations').targets[0]!.possible,true);
});
test('FN calls navigate all textual candidates and never infer active definitions',()=>{
 const index=scan('10 DEF FNvalue(x)=x+1\n20 a=FNvalue(2)\n30 DEF FNvalue(x)=x+2\n40 b=FNvalue(3)');
 const call=index.functions.calls[0]!;const r=lookup(index,2,call.location.start,'declarations');assert.deepEqual(r.targets.map(t=>t.location.line),[1,3]);assert.ok(r.targets.every(t=>t.possible));
 assert.deepEqual(lookup(index,1,index.functions.definitions[0]!.location.start).targets.map(t=>t.location.line),[2,4]);
 const missing=scan('10 a=FNmissing(1)\n20 b=FNmissing(2)');assert.equal(lookup(missing,1,missing.functions.calls[0]!.location.start,'declarations').total,0);assert.equal(lookup(missing,1,missing.functions.calls[0]!.location.start).total,1);
});
test('cursor coordinates use UTF-16, exclude token ends and do not search arbitrary text',()=>{
 const source='10 PRINT "😀":x=1\r\n20 PRINT "x"\r\n30 DATA x\r\n40 REM x\r\n50 CALL x\r\n60 DEF FN f(y)=y';const index=scan(source),first=source.split('\r\n')[0]!,start=first.indexOf('x=');
 assert.equal(lookup(index,1,start).name,'X');assert.equal(lookup(index,1,start+1).status,'uncovered');
 for(const line of [2,3,4,5])assert.equal(lookup(index,line,source.split('\r\n')[line-1]!.indexOf('x')).status,'uncovered');
 const fn=index.functions.definitions[0]!;assert.equal(lookup(index,6,fn.location.start).name,'FN F');assert.equal(lookup(index,6,fn.location.start-2).status,'uncovered');
 for(const [line,column] of [[0,0],[1,-1],[1,NaN],[1,1.5]])assert.equal(lookup(index,line!,column!).status,'uncovered');
 assert.equal(navigateSymbol(index,{sourceId:'other',line:1,column:start,mode:'usages'}).status,'uncovered');
});
test('withdrawn indexes yield no links and result lists are bounded without changing the index',()=>{
 const limited=indexSymbols({id:'a',name:'main.bas',source:'10 x=1:PRINT x'},1);assert.equal(lookup(limited,1,3).status,'limited');assert.equal(lookup(limited,1,3).total,0);
 const index=scan(Array.from({length:250},(_,i)=>`${i+1} x=x+1`).join('\n')),before=JSON.stringify(index);const r=lookup(index,1,2);
 assert.equal(r.total,500);assert.equal(r.targets.length,SYMBOL_NAVIGATION_LIMIT);assert.equal(JSON.stringify(index),before);
});
