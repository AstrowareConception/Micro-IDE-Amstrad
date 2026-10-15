import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { analyzeSymbols, indexSymbols, symbolsMarkdown } from '../packages/basic-language/src/symbols.ts';
import { FN_LIMITS } from '../packages/basic-language/src/function-symbols.ts';
import { basicFnCases } from './fixtures/basic-fn-cases.ts';
const scan=(source:string,budget?:number)=>indexSymbols({id:'main',name:'main.bas',source},budget);
const witness=(name:string)=>scan(basicFnCases.find(c=>c.name===name)!.body).functions;
test('FN firmware witness separates a free global from caller parameter and links nested calls',()=>{
 const f=witness('nested-free-variable');assert.equal(f.definitions.length,2);
 const [inner,outer]=f.definitions;
 assert.deepEqual(inner!.reads.map(r=>[r.name,r.binding]),[['X','free'],['Y','parameter']]);
 assert.equal(outer!.reads.find(r=>r.name==='X')!.parameterKeys[0],outer!.parameters[0]!.key);
 assert.equal(f.calls.find(c=>c.name==='INNER')!.ownerKey,outer!.key);
 assert.equal(f.calls.find(c=>c.name==='INNER')!.definitionKeys[0],inner!.key);
 assert.ok(f.calls.every(c=>c.resolution==='candidate'));
});
test('FN parameters have definition-local identities; scalar and array do not alias',()=>{
 const f=witness('nested-local');assert.notEqual(f.definitions[0]!.parameters[0]!.key,f.definitions[1]!.parameters[0]!.key);
 const a=witness('scalar-array').definitions[0]!;
 assert.deepEqual(a.reads.filter(r=>r.name==='X').map(r=>[r.kind,r.binding]),[['scalar','parameter'],['array','free']]);
});
test('explicit and standalone real aliases resolve but implicit declarations stay ambiguous',()=>{
 for(const name of ['implicit-real-alias','explicit-integer','explicit-real','explicit-string'])assert.ok(witness(name).definitions[0]!.reads.filter(r=>r.name.startsWith('X')).every(r=>r.binding==='parameter'),name);
 for(const name of ['implicit-integer-alias','parameter-type-at-call','parameter-type-between-calls','parameter-type-same-call-site'])assert.ok(witness(name).definitions[0]!.reads.some(r=>r.binding==='ambiguous'),name);
 const typed=witness('typed-homonyms').definitions[0]!;assert.equal(typed.reads.find(r=>r.name==='X%')!.binding,'free');
 const duplicate=witness('duplicate-parameters').definitions[0]!.reads[0]!;assert.equal(duplicate.binding,'ambiguous');assert.equal(duplicate.parameterKeys.length,2);
});
test('redirections are candidates, never active definitions or proof of arity',()=>{
 const f=witness('redefinition');assert.equal(f.definitions.length,2);assert.ok(f.calls.every(c=>c.resolution==='ambiguous'&&c.definitionKeys.length===2));
 assert.equal(witness('too-few-arguments').calls[0]!.arity,1);
 assert.equal(witness('too-few-arguments').calls[0]!.resolution,'candidate');
 assert.equal(witness('undefined').calls[0]!.resolution,'missing');
 assert.equal(witness('function-type-at-call').calls[0]!.resolution,'ambiguous');
 const suffixes=witness('function-suffixes');assert.ok(suffixes.calls.every(c=>c.definitionKeys.length===1&&c.resolution==='candidate'));
});
test('spaced and joined FN names preserve exact UTF-16 spans, including CRLF',()=>{
 const text='10 REM é\r\n20 DEF FN Double(x)=x*2\r\n30 a=fnDOUBLE(7)';const f=scan(text).functions;
 const locations=[f.definitions[0]!.location,...f.definitions[0]!.parameters.map(p=>p.location),...f.definitions[0]!.reads.map(r=>r.location),...f.calls.map(c=>c.location)];
 assert.deepEqual(locations.map(l=>text.split('\n')[l.line-1]!.slice(l.start,l.end)),['Double','x','x','DOUBLE']);
 assert.equal(f.definitions[0]!.location.basicLine,20);
});
test('strings comments DATA and unsupported FN forms cannot produce phantom links',()=>{
 const r=scan('10 PRINT "FNsecret(1)":DATA FNhidden(2):REM DEF FNprivate(x)=x\n20 DEF FNbad()=1\n30 a=FNbad()\n40 CALL FNmachine(1)\n50 DEF FNunknown(x)=MIN(x,1)\n60 a=FNzero(1+):b=FNzero(,2)');
 assert.equal(r.functions.definitions.length,0);assert.equal(r.functions.calls.length,0);assert.equal(r.status,'partial');
});
test('unknown contexts and explicit type aliases are conservative without cross-source links',()=>{
 const r=scan('10 DEF FNf(x)=x+x!\n20 CALL &9000\n30 a=FNf(1)');assert.ok(r.functions.definitions[0]!.reads.every(x=>x.binding==='ambiguous'));assert.equal(r.functions.calls[0]!.resolution,'ambiguous');
 const reports=analyzeSymbols([{id:'a',name:'a',source:'10 DEF FNf(x)=x'},{id:'b',name:'b',source:'10 a=FNf(2)'}]);assert.equal(reports.sources[1]!.functions.calls[0]!.resolution,'missing');
});
test('FN quotas consume the common budget and withdraw all links on overflow',()=>{
 const exact=scan('10 DEF FNf(x)=x\n20 a=FNf(1)',4);assert.equal(exact.functions.calls.length,1);assert.equal(exact.inspectedOccurrences,4);
 for(const budget of [0,1,3]){const r=scan('10 DEF FNf(x)=x\n20 a=FNf(1)',budget);assert.equal(r.status,'limited');assert.deepEqual(r.functions.definitions,[]);assert.deepEqual(r.functions.calls,[]);assert.deepEqual(r.symbols,[]);}
 const definitions=Array.from({length:FN_LIMITS.definitions+1},(_,i)=>`${i+1} DEF FNf${i}(x)=x`).join('\n');assert.equal(scan(definitions).status,'limited');
 const params=Array.from({length:33},(_,i)=>'x'+i).join(',');assert.equal(scan(`10 DEF FNf(${params})=1`).status,'limited');
 const links=Array.from({length:128},(_,i)=>`${i+1} DEF FNf=1`).concat(Array.from({length:65},(_,i)=>`${i+200} a=FNf`)).join('\n');assert.equal(scan(links).status,'limited');
 const calls=Array.from({length:FN_LIMITS.occurrences+1},(_,i)=>`${i+1} a=FNf`).join('\n');assert.equal(scan(calls).status,'limited');
});
test('FN exports expose metadata and positions but never expressions strings or comments',()=>{
 const report=analyzeSymbols([{id:'a',name:'example',source:'10 DEF FNsecret$(x$)=x$+"PRIVATE_VALUE"\n20 a$=FNsecret$("PRIVATE_ARGUMENT"):REM PRIVATE_COMMENT'}]);
 const json=JSON.stringify(report),md=symbolsMarkdown(report);for(const secret of ['PRIVATE_VALUE','PRIVATE_ARGUMENT','PRIVATE_COMMENT','x$+'])assert.ok(!json.includes(secret)&&!md.includes(secret));assert.equal(report.version,3);assert.match(md,/FN SECRET/);
});
test('the shipped firmware example exposes two distinct function scopes',()=>{
 const r=scan(readFileSync('examples/symbols/functions.bas','utf8'));assert.equal(r.functions.definitions.length,2);assert.equal(r.functions.calls.length,2);assert.equal(r.functions.definitions[0]!.reads[0]!.binding,'free');assert.equal(r.functions.definitions[1]!.reads[0]!.binding,'parameter');
});

test('nested calls and array indices keep lexical positions and exact argument counts',()=>{
 const f=scan('10 DEF FNf(x,y)=x(y)+FNinner(y)+ABS(x)\n20 a=FNf(FNg(2),ABS(z))').functions;
 assert.deepEqual(f.definitions[0]!.reads.map(r=>r.name),['X','Y','Y','X']);
 assert.deepEqual(f.calls.map(c=>[c.name,c.arity]),[['INNER',1],['F',2],['G',1]]);
 const bad=scan('10 DEF FNf(x)=x>>1');assert.equal(bad.functions.definitions.length,0);
});
