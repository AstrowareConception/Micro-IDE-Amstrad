import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {newProject,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {previewTerminalExtraction} from '../packages/workspace/src/multifile-dry-run.ts';
import {CONDITIONAL_EXTRACTION_PROFILE,validateTerminalExpressions} from '../packages/workspace/src/terminal-expressions.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare,digest} from './multifile-fixture.ts';
import {conditionWitnesses} from './terminal-condition-fixtures.ts';
const preview=(source:string)=>previewTerminalExtraction({manifest:newProject('Conditions','647f023d-1272-4b66-8c47-b064b8de9512'),sources:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source}],sourceId:'main',entryLine:100,newFileName:'PART'});
const listing=(body:string,after='')=>`10 MEMORY &7FFF\n20 score%=7\n30 title$="CPC"\n40 GOTO 100\n100 ${body}\n${after}200 END\n`;

test('conditional witnesses have a distinct profile and preserve every branch on either side of the boundary',()=>{
 for(const witness of conditionWitnesses){
  const plan=preview(witness.source),boundary=witness.source.indexOf('100 ');
  assert.equal(plan.profile,CONDITIONAL_EXTRACTION_PROFILE);
  assert.equal(plan.proposed.sources[1]!.source,witness.source.slice(boundary));
  assert.equal(plan.proposed.sources[0]!.source,witness.source.slice(0,boundary).replace(/GOTO 100\n$/,'CHAIN MERGE "PART.BAS",100\n'));
 }
 assert.throws(()=>validateTerminalExpressions([{number:10,body:'IF 1=1 THEN PRINT'}]),/refusée/);
});

test('one typed comparison, case-insensitive syntax, quoted keywords and an optional ELSE are accepted',()=>{
 for(const body of ['if SCORE%+1 >= (2*4) then LET title$="THEN ELSE: IF" else title$="X"','IF title$+"!"<>"CPC" THEN PRINT title$;','IF score%=7 THEN fresh%=1 ELSE fresh%=2']){
  assert.equal(preview(listing(body)).profile,CONDITIONAL_EXTRACTION_PROFILE);
 }
 assert.equal(preview(listing('IF score%=7 THEN fresh%=1 ELSE fresh%=2','110 POKE &8000,fresh%\n')).profile,CONDITIONAL_EXTRACTION_PROFILE);
});

test('unselected arms and the fall-through of an absent ELSE cannot hide unsafe states',()=>{
 for(const [body,after]of [
  ['IF 1=1 THEN score%=8 ELSE PRINT missing$',''],
  ['IF 1=0 THEN score%=32767+1 ELSE PRINT',''],
  ['IF 1=1 THEN title$="OK" ELSE title$=2',''],
  ['IF 1=1 THEN fresh%=1','110 PRINT fresh%\n'],
  ['IF 1=1 THEN fresh%=1 ELSE other%=1','110 PRINT fresh%\n'],
  ['IF 1=1 THEN score%=1 ELSE score%=255','110 POKE &8000,score%+1\n'],
  ['IF score%=7 THEN score%=32767 ELSE score%=1','110 IF score%=1 THEN score%=score%+1\n'],
  ['IF 1=1 THEN title$="'+ 'a'.repeat(130)+'" ELSE title$="B"','110 title$=title$+title$\n']
 ])assert.throws(()=>preview(listing(body!,after)),/refusée/);
});

test('nested IF, jumps, implicit truth, mixed comparisons, multiple statements and dynamic forms remain refused',()=>{
 for(const body of [
  'IF score% THEN PRINT','IF score%=title$ THEN PRINT','IF score%=1=1 THEN PRINT','IF score%=>1 THEN PRINT','IF score%< >1 THEN PRINT',
  'IF (score%=7) THEN PRINT','IF score%=7 AND score%>0 THEN PRINT','IF PEEK(&8000)=7 THEN PRINT',
  'IF score%=7 THEN','IF score%=7 THEN PRINT ELSE','IF score%=7 ELSE PRINT THEN PRINT',
  'IF score%=7 THEN PRINT ELSE PRINT ELSE PRINT','IF score%=7 THEN IF score%=8 THEN PRINT ELSE PRINT',
  'IF score%=7 GOTO 100','IF score%=7 THEN 100','IF score%=7 THEN GOTO 100','IF score%=7 THEN END',
  'IF score%=7 THEN MEMORY &7FFF','IF score%=7 THEN PRINT:PRINT','IF score%=7 THEN PRINT ELSE PRINT:PRINT',
  'IF score%=7 THEN score=2','IF score%=7 THEN READ score%','IF score%=7 THEN PRINT #9,title$',
  'IF score%=7 THEN PRINT REM hidden','IF score%=7 THEN RETURN','IF score%=7 THEN FOR score%=1 TO 3'
 ])assert.throws(()=>preview(listing(body)),/refusée/,body);
});

test('six IFs are bounded to 64 conservative paths; a seventh is refused',()=>{
 const source=conditionWitnesses[0]!.source;
 assert.equal(preview(source).profile,CONDITIONAL_EXTRACTION_PROFILE);
 assert.throws(()=>preview(source.replace('150 POKE','145 IF 1=1 THEN PRINT\n150 POKE')),/6 IF/);
});

test('IF reference is required before real application; all conditional projects reopen and restore exact bytes',async t=>{
 for(const witness of conditionWitnesses){
  const f=await fixture(witness.source.replace(/\n/g,'\r\n'));t.after(()=>rm(f.root,{recursive:true,force:true}));
  const p=await prepare(f.root);
  await p.tools.execute('reference_read_many',{names:['MODE','CLS','LET','PRINT']});
  await assert.rejects(p.apply,/reference-required.*IF/);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.equal(p.tools.extractionSimulationViews()[0]!.record.status,'preview');
  await p.tools.execute('reference_read_many',{names:['IF']});
  await p.apply();const reopened=await ProjectStore.open(f.root);
  assert.equal(digest(buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files)),p.preview.proposedDiskSha256);
  const last=(await reopened.store.lastAgentMutation())!;
  await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 }
});
