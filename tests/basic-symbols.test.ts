import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { indexSymbols, analyzeSymbols, symbolsMarkdown, SYMBOL_LIMITS } from '../packages/basic-language/src/symbols.ts';
const scan=(source:string,budget?:number)=>indexSymbols({id:'main',name:'main.bas',source},budget);
const names=(source:string)=>scan(source).symbols.map(s=>s.name);
test('case folds names while suffixes and scalar/array identities stay distinct',()=>{
 const r=scan('10 Score=score+1:score!=2:score%=3:score$="private":score(1)=score\n20 PRINT SCORE;score(1)');
 assert.equal(r.status,'indexed');assert.equal(r.symbols.length,5);
 assert.equal(r.symbols.find(s=>s.key==='scalar:SCORE')!.occurrences.length,4);
 assert.deepEqual(r.symbols.find(s=>s.key==='array:SCORE')!.occurrences.map(o=>o.role),['write','read']);
});
test('assignment indices read their own variables while the array is written',()=>{
 const r=scan('10 LET scores(i,j)=scores(j,i)+delta');
 assert.equal(r.status,'indexed');
 assert.deepEqual(r.symbols.find(s=>s.name==='SCORES')!.occurrences.map(o=>o.role),['write','read']);
 assert.deepEqual(r.symbols.find(s=>s.name==='I')!.occurrences.map(o=>o.role),['read','read']);
});
test('DIM READ NEXT ERASE and FOR distinguish dimension writes reads and removal',()=>{
 const r=scan('10 DIM a(n),b(m,2):FOR i=first TO last STEP stepper\n20 READ a(i),v:NEXT i:ERASE a,b');
 assert.equal(r.status,'indexed');
 assert.deepEqual(r.symbols.find(s=>s.name==='A')!.occurrences.map(o=>o.role),['dimension','write','erase']);
 assert.deepEqual(r.symbols.find(s=>s.name==='I')!.occurrences.map(o=>o.role),['write','read','read-write']);
 for(const name of ['N','M','FIRST','LAST','STEPPER']) assert.equal(r.symbols.find(s=>s.name===name)!.occurrences[0]!.role,'read');
 assert.deepEqual(names('10 NEXT\n20 END'),[]);
});
test('strings DATA and comments never leak identifiers including apparent branches',()=>{
 assert.deepEqual(names('10 DATA hidden,IF,THEN,ELSE,"x:y":a=1:REM ghost\n20 PRINT "hidden:name";a\n30 \' imaginary'),['A']);
});
test('nested branches and IF GOTO expose conditions and assignment roles',()=>{
 const r=scan('10 IF a THEN IF b THEN x=x+1 ELSE y=2 ELSE z=3\n20 IF c GOTO 100\n100 END');
 assert.equal(r.status,'indexed');assert.deepEqual(r.symbols.find(s=>s.name==='X')!.occurrences.map(o=>o.role),['write','read']);
 for(const name of ['A','B','C'])assert.equal(r.symbols.find(s=>s.name===name)!.occurrences[0]!.role,'read');
});
test('plain INPUT and LINE INPUT support prompts without indexing them',()=>{
 const r=scan('10 INPUT "Prive";a,b(i):LINE INPUT "Secret",nom$\n20 INPUT ;"Encore";c');
 assert.equal(r.status,'indexed');assert.deepEqual(r.symbols.map(s=>s.name),['A','B','C','I','NOM$']);
 assert.equal(r.symbols.find(s=>s.name==='I')!.occurrences[0]!.role,'read');
 const streams=scan('10 INPUT #canal,a\n20 ok=1');assert.equal(streams.status,'partial');assert.deepEqual(streams.symbols.map(s=>s.name),['OK']);
});
test('function scopes addresses RSX and opaque options are omitted explicitly',()=>{
 const r=scan('10 DEF FNlocal(x)=x+outside\n20 a=FNlocal(b):|disc,@c:CALL &1234,@d\n30 SAVE "file",A:MID$(text$,1,1)="x":ok=1');
 assert.equal(r.status,'partial');assert.deepEqual(r.symbols.map(s=>s.name),['OK']);assert.equal(r.skippedStatements,6);
 assert.ok(!JSON.stringify(r).includes('outside'));
});
test('DEF type ranges are not variables and untyped names are not falsely merged',()=>{
 const r=scan('10 DEFINT a-z:a=1:a%=2:a!=3\n20 DEFSTR b:DEFREAL c:b="s"');
 assert.equal(r.status,'partial');assert.deepEqual(r.symbols.map(s=>s.name),['A','A!','A%','B']);
 assert.equal(r.symbols.find(s=>s.name==='A')!.suffix,'');assert.ok(!r.symbols.some(s=>s.name==='Z'||s.name==='C'));
});
test('malformed targets parentheses long names and compact commands stay partial',()=>{
 for(const bad of ['a(1=2','DIM a','READ a+b','NEXT a(1)','a(1)(2)=3','GOTO100','PRINT "unfinished','x'.repeat(41)+'=1']) {
  const r=scan(`10 ${bad}\n20 ok=1`);assert.equal(r.status,'partial',bad);assert.deepEqual(r.symbols.map(s=>s.name),['OK'],bad);
 }
 assert.equal(scan('10 '+'x'.repeat(40)+'=1').symbols.length,1);
 assert.deepEqual(names('10 GOTO100=2:PRINT GOTO100'),['GOTO100']);
});
test('locations are physical one-based lines and exact UTF-16 spans including CRLF',()=>{
 const text='10 REM début\r\n\r\n20 PRINT "é";Score:score=2';const r=scan(text);
 const uses=r.symbols[0]!.occurrences;assert.equal(uses.length,2);
 for(const use of uses){assert.equal(use.line,3);assert.equal(use.basicLine,20);assert.equal(text.split('\n')[2]!.slice(use.start,use.end).toUpperCase(),'SCORE');}
});
test('source numbering and per-line quotas report omitted material',()=>{
 const r=scan('missing=1\n10 a=1\n10 duplicate=1\n5 unordered=1\n20 '+'x'.repeat(8193)+'\n30 '+Array(1030).fill('a').join('+')+'\n40 b=2');
 assert.equal(r.status,'partial');assert.deepEqual(r.symbols.map(s=>s.name),['A','B']);assert.equal(r.skippedStatements,5);
});
test('source and occurrence budgets remove partial indexes',()=>{
 const source='10 a=a+1:b=b+2';assert.equal(scan(source,4).status,'indexed');
 for(const budget of [0,1,3,NaN,-1]){const r=scan(source,budget);assert.equal(r.status,'limited');assert.deepEqual(r.symbols,[]);}
 assert.equal(scan('a'.repeat(SYMBOL_LIMITS.characters+1)).status,'limited');
 assert.equal(scan('\n'.repeat(SYMBOL_LIMITS.lines)).status,'limited');
 const huge=Array.from({length:4100},(_,i)=>`${i+1} v${i}=1`).join('\n');const r=scan(huge);assert.equal(r.status,'limited');assert.deepEqual(r.symbols,[]);
});
test('multi-source identities stay separate and global work is bounded',()=>{
 const r=analyzeSymbols([{id:'one',name:'one.bas',source:'10 a=1'},{id:'two',name:'two.bas',source:'10 a=2'}]);assert.equal(r.sources.length,2);assert.equal(r.sources[0]!.symbols[0]!.name,r.sources[1]!.symbols[0]!.name);
 const source=Array.from({length:100},(_,i)=>`${i+1} `+Array(100).fill('a=a').join(':')).join('\n');
 const report=analyzeSymbols(Array.from({length:3},(_,i)=>({id:String(i),name:'a.bas',source})));
 assert.equal(report.sources.reduce((n,s)=>n+s.inspectedOccurrences,0),SYMBOL_LIMITS.totalOccurrences);assert.equal(report.sources[2]!.status,'limited');assert.deepEqual(report.sources[2]!.symbols,[]);
 assert.throws(()=>analyzeSymbols(Array(101).fill({id:'x',name:'x',source:''})),/100 sources/);
 assert.throws(()=>analyzeSymbols([{id:'x',name:'x',source:'a'.repeat(SYMBOL_LIMITS.totalCharacters+1)}]),/4 Mio/);
});
test('reasons are bounded and explicitly counted',()=>{
 const r=scan(Array.from({length:120},(_,i)=>`${i+1} CALL &1234`).join('\n'));
 assert.equal(r.reasons.length,100);assert.equal(r.omittedReasons,20);assert.equal(r.skippedStatements,120);
});
test('exports contain names and locations but no source strings values or comments',()=>{
 const report=analyzeSymbols([{id:'x',name:'[unsafe]<file>.bas',source:'10 score=12345:PRINT "SECRET";score\n20 REM private text\n30 DATA treasure'}]);
 const text=symbolsMarkdown(report),json=JSON.stringify(report);
 for(const hidden of ['12345','SECRET','private text','treasure']){assert.ok(!text.includes(hidden));assert.ok(!json.includes(hidden));}
 assert.ok(text.includes('SCORE'));assert.ok(text.includes('BASIC 10'));assert.ok(text.includes('\\[unsafe\\]\\<file\\>'));
});
test('the shipped example indexes all six symbol spellings and isolates array indices',()=>{
 const r=scan(readFileSync('examples/symbols/main.bas','utf8'));assert.equal(r.status,'indexed');assert.equal(r.symbols.length,6);
 assert.deepEqual(r.symbols.find(s=>s.name==='JOUEUR')!.occurrences.map(o=>o.role),['write','read','read','read','read-write']);
});
