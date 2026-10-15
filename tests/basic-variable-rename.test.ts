import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectVariableRename, planVariableRename, applyVariableRename } from '../packages/basic-language/src/rename-variable.ts';
import { basicRenameCases } from './fixtures/basic-rename-cases.ts';
const pos={line:1,column:3};
test('rename matches independent firmware witnesses, including suffixes, loops, arrays and opaque text',()=>{
 for(const specimen of basicRenameCases){const plan=planVariableRename(specimen.before,specimen,specimen.newStem);assert.equal(plan.after,specimen.after,specimen.name);assert.equal(applyVariableRename(plan,specimen.before),specimen.after);assert.ok(plan.edits.every(e=>e.after.endsWith(plan.target.suffix)));}
});
test('rename does not merge scalar/array and preserves all other spans, cases, blank lines and CRLF',()=>{
 const source='10 score=2:DIM score(2)\r\n\r\n20 score(1)=score:PRINT "score"\r\n30 REM score\r\n';const p=planVariableRename(source,pos,'points');assert.equal(p.after,'10 points=2:DIM score(2)\r\n\r\n20 score(1)=points:PRINT "score"\r\n30 REM score\r\n');assert.equal(p.edits.length,2);assert.equal(inspectVariableRename(source,pos).kind,'scalar');
 assert.throws(()=>applyVariableRename(p,source+'40 END'),/changé/);
});
test('rename rejects existing destination names in every suffix or array namespace',()=>{
 for(const addition of ['other=1','other%=1','other$="ok"','DIM other(2)','DIM other!(2)'])assert.throws(()=>planVariableRename('10 score=1\n20 '+addition,pos,'other'),/Collision/);
 for(const alias of ['score!','score%','score$'])assert.throws(()=>planVariableRename(`10 score=1\n20 ${alias}=${alias.endsWith('$')?'"ok"':'2'}`,pos,'points'),/alias/);
 for(const name of ['score','SCORE','PRINT','FNtotal','x_y','1score','étoile','points%','a'.repeat(41),'','left$'])assert.throws(()=>planVariableRename('10 score=1',pos,name));
 assert.throws(()=>planVariableRename('10 score$="ok"',pos,'LEFT'));
 const long=planVariableRename('10 score=1:PRINT score',pos,'a'.repeat(40));assert.equal(long.newName.length,40);
});
test('rename rejects FN and dynamic defaults even if their branch is never executed',()=>{
 for(const tail of ['DEF FNvalue(x)=x+1','PRINT FNvalue(1)','DEFINT a-z','IF 0 THEN DEFSTR a-z','DEFREAL a-z'])assert.throws(()=>planVariableRename('10 score=1\n20 '+tail,pos,'points'));
});
test('machine, memory, timing, external code and unresolved syntax cannot authorize a rename',()=>{
 for(const tail of ['POKE &8000,1','a=PEEK(0)','a=FRE(0)','a=TIME','MEMORY &7FFF','CALL &BC00','RUN','CHAIN "other"','CLEAR','|CPM','a=@score','AFTER 10 GOSUB 10','MID$(a$,1)="x"','WHATEVER score'])assert.throws(()=>planVariableRename('10 score=1\n20 '+tail,pos,'points'),tail);
 assert.throws(()=>planVariableRename('10 score=1\n20 PRINT (score+',pos,'points'),/validé/);
 const safe=planVariableRename('10 score=1:PRINT "CALL TIME FN DEFINT":REM @score',pos,'points');assert.match(safe.after,/"CALL TIME FN DEFINT":REM @score$/);
});
test('cursor requires an exact covered variable and resource limits refuse incomplete edits',()=>{
 for(const source of ['10 PRINT "score"','10 DATA score','10 REM score'])assert.throws(()=>inspectVariableRename(source,{line:1,column:10}));
 for(const point of [{line:0,column:3},{line:1,column:-1},{line:1,column:NaN},{line:1,column:8}])assert.throws(()=>inspectVariableRename('10 score=1',point));
 const nearLimit='10 score=1:REM '+'.'.repeat(241);assert.equal(nearLimit.length,256);assert.throws(()=>planVariableRename(nearLimit,pos,'points'),/255/);
 const expansion='10 score=1:REM '+'.'.repeat(239);assert.throws(()=>planVariableRename(expansion,pos,'pointsTotal'),/255/);
 const many=Array.from({length:2100},(_,i)=>`${i+1} score=1`).join('\n');assert.throws(()=>planVariableRename(many,{line:1,column:2},'points'),/2000/);
 assert.throws(()=>planVariableRename('10 REM '+'.'.repeat(65536),pos,'points'),/64 Kio/);
});
