import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {newProject,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {previewTerminalExtraction,TERMINAL_EXTRACTION_PROFILE} from '../packages/workspace/src/multifile-dry-run.ts';
import {LOOP_EXTRACTION_PROFILE,EXPRESSION_EXTRACTION_PROFILE,CONDITIONAL_EXTRACTION_PROFILE} from '../packages/workspace/src/terminal-expressions.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare,digest,SOURCE} from './multifile-fixture.ts';
import {expressionWitnesses} from './terminal-expression-fixtures.ts';
import {conditionWitnesses} from './terminal-condition-fixtures.ts';
import {loopWitnesses} from './terminal-loop-fixtures.ts';
const preview=(source:string)=>previewTerminalExtraction({manifest:newProject('Boucles','647f023d-1272-4b66-8c47-b064b8de9512'),sources:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source}],sourceId:'main',entryLine:100,newFileName:'PART'});
const listing=(rows:string[],prefix='10 MEMORY &7FFF\n20 total%=0\n30 index%=1\n90 GOTO 100\n')=>prefix+rows.map((body,i)=>`${100+i*10} ${body}\n`).join('')+'400 END\n';
const forLoop=(header='FOR index%=1 TO 3',body='total%=total%+index%',close='NEXT index%')=>[header,body,close];
const whileLoop=(header='WHILE index%<4',body='total%=total%+index%',update='index%=index%+1',close='WEND')=>[header,body,update,close];

test('loop witnesses receive profile v4 with exact source preservation; earlier profiles retain their identities',()=>{
 assert.equal(preview(SOURCE).profile,TERMINAL_EXTRACTION_PROFILE);
 assert.equal(preview(expressionWitnesses[0]!.source).profile,EXPRESSION_EXTRACTION_PROFILE);
 assert.equal(preview(conditionWitnesses[0]!.source).profile,CONDITIONAL_EXTRACTION_PROFILE);
 for(const witness of loopWitnesses){
  const plan=preview(witness.source),boundary=witness.source.indexOf('100 ');
  assert.equal(plan.profile,LOOP_EXTRACTION_PROFILE);
  assert.equal(plan.proposed.sources[1]!.source,witness.source.slice(boundary));
  assert.equal(plan.proposed.sources[0]!.source,witness.source.slice(0,boundary).replace(/GOTO 100\n$/,'CHAIN MERGE "PART.BAS",100\n'));
 }
});

test('FOR bounds and WHILE counters accept ascending/descending signed integers, case and explicit updates',()=>{
 for(const rows of [forLoop('for INDEX%=-3 TO -1 STEP +1'),forLoop('FOR index%=1 TO -3 STEP -2'),
  whileLoop('while INDEX% <= 4','PRINT "NEXT WEND: IF"','LET INDEX%=index%+2','wend'),
  whileLoop('WHILE index%>=-3','total%=total%+1','index%=index%-2')])assert.equal(preview(listing(rows)).profile,LOOP_EXTRACTION_PROFILE);
});

test('no active FOR or WHILE can cross the extraction boundary',()=>{
 for(const [header,close,update]of [['FOR index%=1 TO 3','NEXT index%','total%=total%+1'],['WHILE index%<3','WEND','index%=index%+1']]){
  const source=`10 MEMORY &7FFF\n20 index%=1\n30 total%=0\n40 ${header}\n90 GOTO 100\n100 ${update}\n110 ${close}\n120 END\n`;
  assert.throws(()=>preview(source),/frontière CHAIN MERGE/);
 }
});

test('loop pairing, dynamic bounds, zero steps, non-progressing WHILE, nesting and counter mutations are refused',()=>{
 const invalid=[
  forLoop('FOR index=1 TO 3'),forLoop('FOR index$=1 TO 3'),forLoop('FOR index%=1 TO total%'),
  forLoop('FOR index%=1+1 TO 3'),forLoop('FOR index%=1 TO 3 STEP 0'),forLoop('FOR index%=1 TO 3 STEP total%'),
  forLoop('FOR index%=1 TO 3','index%=2'),forLoop('FOR index%=1 TO 3','LET INDEX%=2'),
  forLoop('FOR index%=1 TO 3','   index%=2'),forLoop('FOR index%=1 TO 3','\tLET INDEX%=2'),
  forLoop('FOR index%=1 TO 3','PRINT','NEXT'),forLoop('FOR index%=1 TO 3','PRINT','NEXT total%'),
  forLoop('FOR index%=1 TO 3','PRINT','NEXT index%,total%'),forLoop('FOR index%=1 TO 3','PRINT','WEND'),
  ['FOR index%=1 TO 3','FOR other%=1 TO 2','NEXT other%','NEXT index%'],
  ['FOR index%=1 TO 3','IF total%=0 THEN PRINT','NEXT index%'],
  ['FOR index%=1 TO 3','WHILE total%<3','total%=total%+1','WEND','NEXT index%'],
  ['FOR index%=1 TO 3','PRINT'],['NEXT index%'],['WEND'],
  whileLoop('WHILE index%<4','PRINT','index%=index%-1'),whileLoop('WHILE index%>0','PRINT','index%=index%+1'),
  whileLoop('WHILE index%=4'),whileLoop('WHILE index%<>4'),whileLoop('WHILE index%<total%'),
  whileLoop('WHILE index%<4','PRINT','index%=index%+0'),whileLoop('WHILE index%<4','PRINT','index%=index%+total%'),
  whileLoop('WHILE index%<4','index%=index%+1','index%=index%+1'),
  whileLoop('WHILE index%<4','   LET INDEX%=1','index%=index%+1'),whileLoop('WHILE index%<4','PRINT','total%=total%+1'),
  whileLoop('WHILE index%<4','PRINT','index%=index%+1','NEXT index%'),
  whileLoop('WHILE index%<4','IF total%=0 THEN PRINT'),
  forLoop('FOR index%=1 TO 3','PRINT:PRINT'),forLoop('FOR index%=1 TO 3','GOTO 100'),
  forLoop('FOR index%=1 TO 3','MEMORY &7FFF'),forLoop('FOR index%=1 TO 3','END')
 ];
 for(const rows of invalid)assert.throws(()=>preview(listing(rows)),/refusée/,rows.join(' / '));
});

test('skipped bodies are checked but cannot initialize variables after zero iterations',()=>{
 for(const rows of [
  [...forLoop('FOR index%=2 TO 1','fresh%=1'),'PRINT fresh%'],
  [...whileLoop('WHILE index%<1','fresh%=1'),'PRINT fresh%'],
  forLoop('FOR index%=2 TO 1','PRINT missing$'),
  forLoop('FOR index%=2 TO 1','total%=32767+1'),
  whileLoop('WHILE index%<1','CALL &BB00')
 ])assert.throws(()=>preview(listing(rows)),/refusée/);
 assert.equal(preview(listing([...forLoop('FOR index%=1 TO 1','fresh%=9'),'POKE &8000,fresh%'])).profile,LOOP_EXTRACTION_PROFILE);
 assert.throws(()=>preview(listing(whileLoop()).replace('30 index%=1\n','')),/non initialisé/);
});

test('all iterations and the final counter increment are checked for integer/string/POKE bounds',()=>{
 for(const rows of [
  forLoop('FOR index%=1 TO 3','total%=total%+20000'),
  forLoop('FOR index%=32767 TO 32767','PRINT'),
  forLoop('FOR index%=-32768 TO -32768 STEP -1','PRINT'),
  whileLoop('WHILE index%<=32767','PRINT','index%=index%+32767'),
  forLoop('FOR index%=1 TO 3','POKE &8000,index%*100'),
  ['text$="'+'x'.repeat(100)+'"',...forLoop('FOR index%=1 TO 2','text$=text$+text$')]
 ])assert.throws(()=>preview(listing(rows)),/refusée/);
});

test('conditions outside loops retain both states, including unsafe or zero-trip alternatives',()=>{
 assert.throws(()=>preview(listing(['IF total%=0 THEN index%=1 ELSE index%=5',...whileLoop('WHILE index%<4','fresh%=1'),'PRINT fresh%'])),/avant affectation/);
 assert.throws(()=>preview(listing(['IF total%=0 THEN total%=0 ELSE total%=32767',...forLoop('FOR index%=1 TO 1','total%=total%+1')])),/hors de/);
});

test('four loops, 32 turns and 8192 state/instruction visits bound validation cost',()=>{
 assert.equal(preview(listing(forLoop('FOR index%=1 TO 32','total%=total%+1'))).profile,LOOP_EXTRACTION_PROFILE);
 assert.equal(preview(listing(whileLoop('WHILE index%<33','total%=total%+1'))).profile,LOOP_EXTRACTION_PROFILE);
 assert.throws(()=>preview(listing(forLoop('FOR index%=1 TO 33','PRINT'))),/32 tours/);
 assert.throws(()=>preview(listing(whileLoop('WHILE index%<34','PRINT'))),/32 tours/);
 assert.equal(preview(listing(Array.from({length:4},()=>forLoop('FOR index%=1 TO 1','PRINT')).flat())).profile,LOOP_EXTRACTION_PROFILE);
 assert.throws(()=>preview(listing(Array.from({length:5},()=>forLoop('FOR index%=1 TO 1','PRINT')).flat())),/4 boucles/);
 const rows=[...Array(6).fill('IF 1=1 THEN total%=0 ELSE total%=1'),'FOR index%=1 TO 32',...Array(5).fill('total%=total%+1'),'NEXT index%'];
 assert.throws(()=>preview(listing(rows)),/8192 visites/);
});

test('FOR/NEXT and WHILE/WEND references gate journalized application, reopen and exact-byte restoration',async t=>{
 for(const witness of loopWitnesses){
  const f=await fixture(witness.source.replace(/\n/g,'\r\n'));t.after(()=>rm(f.root,{recursive:true,force:true}));
  const p=await prepare(f.root);
  await p.tools.execute('reference_read_many',{names:['MODE','CLS','LET','PRINT','IF']});
  await assert.rejects(p.apply,/reference-required/);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.equal(p.tools.extractionSimulationViews()[0]!.record.status,'preview');
  await p.tools.execute('reference_read_many',{names:['FOR','NEXT','WHILE','WEND']});
  await p.apply();const reopened=await ProjectStore.open(f.root);
  assert.equal(digest(buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files)),p.preview.proposedDiskSha256);
  const last=(await reopened.store.lastAgentMutation())!;
  await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 }
});
