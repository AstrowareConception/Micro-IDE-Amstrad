import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {newProject,buildProjectDisk} from '../packages/workspace/src/project.ts';
import {previewTerminalExtraction,TERMINAL_EXTRACTION_PROFILE} from '../packages/workspace/src/multifile-dry-run.ts';
import {EXPRESSION_EXTRACTION_PROFILE} from '../packages/workspace/src/terminal-expressions.ts';
import {ProjectStore} from '../apps/desktop/project-store.ts';
import {fixture,prepare,SOURCE,digest} from './multifile-fixture.ts';
import {expressionWitnesses} from './terminal-expression-fixtures.ts';
const preview=(source:string)=>previewTerminalExtraction({manifest:newProject('Expressions','647f023d-1272-4b66-8c47-b064b8de9512'),sources:[{id:'main',path:'src/main.bas',cpcName:'MAIN.BAS',source}],sourceId:'main',entryLine:100,newFileName:'PART'});
const listing=(body:string)=>`10 MEMORY &7FFF\n20 score%=7\n30 title$="CPC"\n40 GOTO 100\n100 ${body}\n110 END\n`;

test('the original extraction profile keeps its identity; expression witnesses receive a distinct version',()=>{
 assert.equal(preview(SOURCE).profile,TERMINAL_EXTRACTION_PROFILE);
 for(const witness of expressionWitnesses){
  const plan=preview(witness.source);assert.equal(plan.profile,EXPRESSION_EXTRACTION_PROFILE);
  const boundary=witness.source.indexOf('100 ');
  assert.equal(plan.proposed.sources[1]!.source,witness.source.slice(boundary));
  assert.equal(plan.proposed.sources[0]!.source,witness.source.slice(0,boundary).replace(/GOTO 100\n$/,'CHAIN MERGE "PART.BAS",100\n'));
 }
});

test('closed expressions preserve quoted punctuation, case-insensitive typed scalars and explicit PRINT separators',()=>{
 for(const body of ['score%=(SCORE%+5)*2-3','title$=title$+": REM GOTO 900; \'"','PRINT title$;" ";score%;','PRINT','CLS','MODE 2','LET score%=+score%','POKE &8000,score%*2'])assert.equal(preview(listing(body)).profile,EXPRESSION_EXTRACTION_PROFILE,body);
});

test('uninitialized variables, implicit types, type mismatches and arithmetic or POKE overflow are refused',()=>{
 for(const body of ['score%=missing%+1','PRINT missing$','score=score%+1','score!=score%+1','title$=score%','score%=title$','PRINT title$+score%','score%=32767+1','score%=200*200','score%=-(32767)-2','POKE &8000,256','POKE &8000,-1','POKE &8000,title$'])assert.throws(()=>preview(listing(body)),/Extraction simulée refusée/,body);
});

test('opaque syntax, dynamic state, extra statements and unsupported PRINT forms never enter the widened profile',()=>{
 for(const body of ['PRINT #9,title$','PRINT USING "##";score%','PRINT title$,score%','PRINT title$ score%','PRINT ;score%','PRINT score%;;','PRINT "unterminated','PRINT CHR$(7)','score%=RND*3','score%=TIME','score%=PEEK(&8000)','score%=score%(1)','score%=FNvalue(1)','score%=1/2','score%=1\\2','score%=2^3','score%=7 MOD 3','score%=1.5','score%=1e2','score%=&FF','score%=1:POKE &0000,1','score%=1 REM comment','IF score% THEN PRINT title$','FOR score%=1 TO 4','READ score%','END','MEMORY &7FFF','CALL &BB00','PRINT% = 1'])assert.throws(()=>preview(listing(body)),/Extraction simulée refusée/,body);
});

test('expression budgets, initialized memory and scalar/string limits are enforced before a candidate is built',()=>{
 assert.throws(()=>preview(listing('PRINT '+'('.repeat(17)+'score%'+')'.repeat(17))),/imbrication/);
 assert.throws(()=>preview(listing('PRINT '+Array(50).fill('1').join('+'))),/96 jetons/);
 assert.throws(()=>preview(listing('POKE &8000,score%+1').replace('10 MEMORY &7FFF','10 MODE 1')),/MEMORY/);
 assert.throws(()=>preview(listing('x'.repeat(41)+'%=1')),/scalaire/);
 const long=listing('title$=title$+title$').replace('30 title$="CPC"','30 title$="'+'a'.repeat(130)+'"');
 assert.throws(()=>preview(long),/255 caractères/);
});

test('new command references gate application; all witnesses persist, reopen and restore their original bytes',async t=>{
 for(const witness of expressionWitnesses){
  const f=await fixture(witness.source.replace(/\n/g,'\r\n'));t.after(()=>rm(f.root,{recursive:true,force:true}));
  const p=await prepare(f.root);
  if(witness.oracle){
   await assert.rejects(p.apply,/reference-required/);
   assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
   assert.equal(p.tools.extractionSimulationViews()[0]!.record.status,'preview');
   await p.tools.execute('reference_read_many',{names:['MODE','CLS','LET','PRINT']});
  }
  await p.apply();const reopened=await ProjectStore.open(f.root);
  assert.equal(digest(buildProjectDisk(reopened.snapshot.manifest,reopened.snapshot.files)),p.preview.proposedDiskSha256);
  const last=(await reopened.store.lastAgentMutation())!;
  await reopened.store.restoreAgentMutation(last.revision,reopened.snapshot.files);
  assert.deepEqual(await readFile(join(f.root,'src/main.bas')),f.original);
  assert.deepEqual(await readFile(join(f.root,'microide.project.json')),f.manifest);
  await assert.rejects(readFile(join(f.root,'src/part.bas')),{code:'ENOENT'});
 }
});
