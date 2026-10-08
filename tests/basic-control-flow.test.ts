import { ERROR_FLOW_LIMITS } from '../packages/basic-language/src/error-flow.ts';
import test from 'node:test';
import { conditionalErrorCases } from './fixtures/conditional-error-cases.ts';
import assert from 'node:assert/strict';
import { analyzeQuality, qualityMarkdown } from '../packages/basic-language/src/quality.ts';
import { analyzeControlFlow, FLOW_LIMITS } from '../packages/basic-language/src/control-flow.ts';
const numbers = (source: string) => { const flow = analyzeControlFlow(source); return flow.unreachable.map(id => flow.nodes[id]!.basicLine); };
const main = (source: string) => analyzeControlFlow(source).entries[0]!;

test('glued keyword/number forms do not invent jumps, dead tails or renumbering targets', () => {
 for (const statement of ['GOTO100', 'GOSUB100', 'IF A THEN100', 'IF A THEN 100 ELSE200']) {
  const flow = analyzeControlFlow(`10 ${statement}\n100 END\n200 PRINT 1`);
  assert.equal(flow.complete, false, statement); assert.deepEqual(flow.unreachable, []);
 }
 const source = '10 GOTO100=1:PRINT GOTO100\n20 END';
 assert.equal(analyzeControlFlow(source).complete, true);
 const report = analyzeQuality([{id:'main',name:'main',source:'10 GOTO100:PRINT 1\n100 END'}]);
 assert.ok(!report.sources[0]!.findings.some(f=>f.code==='unreachable-tail'));
});

test('flow follows literal jumps from first line, preserves physical columns and excludes DATA/comments from unreachable statements', () => {
 const source = '10 GOTO 40:PRINT "PRIVATE"\n20 DATA "secret:GOTO 30",99\n30 REM unused label\n40 PRINT "ok"\n50 END\n60 PRINT "unused"';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(numbers(source), [10, 60]);
 const unreachable = flow.nodes[flow.unreachable[0]!]!;
 assert.equal(unreachable.line, 1); assert.equal(unreachable.start, 11); assert.equal(unreachable.operation, 'PRINT');
 assert.ok(!JSON.stringify(flow).includes('PRIVATE')); assert.ok(!JSON.stringify(flow).includes('secret'));
 assert.equal(main(source).complexity, 1);
});
test('IF false skips entire THEN colon sequence; ELSE arms and literal targets join correctly', () => {
 const flow = analyzeControlFlow('10 IF A THEN PRINT 1:PRINT 2 ELSE GOTO 40:PRINT 3\n20 PRINT 4\n30 END\n40 END');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 const condition = flow.nodes.find(n => n.operation === 'IF')!, arms = flow.edges.filter(e => e.from === condition.id);
 assert.deepEqual(arms.map(e => e.kind), ['true', 'false']);
 assert.equal(flow.nodes[arms[1]!.to!]!.operation, 'GOTO');
 assert.equal(flow.unreachable.length, 1); assert.equal(flow.nodes[flow.unreachable[0]!]!.start, 42);
 assert.equal(flow.entries[0]!.complexity, 2);
 const implicit = analyzeControlFlow('10 IF A GOTO 30\n20 END\n30 IF B THEN 10 ELSE 20');
 assert.equal(implicit.complete, true, implicit.reasons.join('\n')); assert.equal(implicit.entries[0]!.complexity, 3);
});
test('GOSUB uses continuation summaries and per-entry complexity without attributing callee decisions to main', () => {
 const flow = analyzeControlFlow('10 GOSUB 100:GOSUB 100\n20 END\n100 IF X THEN RETURN\n110 PRINT "hello"\n120 RETURN');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(flow.entries.map(e => [flow.nodes[e.node]!.basicLine, e.complexity]), [[10, 1], [100, 2]]);
 assert.equal(flow.calls.length, 2); assert.equal(flow.unreachable.length, 0);
 assert.ok(flow.edges.some(e => e.kind === 'resume'));
});
test('nested IF binds each ELSE to the nearest unmatched IF and preserves colon scopes', () => {
 const source = '10 IF A THEN IF B THEN PRINT 1:PRINT 2 ELSE PRINT 3 ELSE PRINT 4:PRINT 5\n20 END';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.complexity, 3);
 const [outer, inner] = flow.nodes.filter(n => n.operation === 'IF').sort((a,b) => a.start-b.start);
 const target = (id: number, kind: string) => flow.nodes[flow.edges.find(e => e.from === id && e.kind === kind)!.to!]!;
 assert.equal(target(outer!.id, 'true').id, inner!.id);
 assert.equal(target(outer!.id, 'false').start, source.indexOf('PRINT 4'));
 assert.equal(target(inner!.id, 'false').start, source.indexOf('PRINT 3'));
 assert.equal(target(target(inner!.id, 'false').id, 'next').basicLine, 20, 'inner ELSE must not run outer ELSE');
 assert.deepEqual(flow.unreachable, []);
});
test('ELSE IF chains, nested IF without outer ELSE and literal targets retain the right branches', () => {
 for (const [body, expected] of [
  ['IF A THEN IF B THEN 100 ELSE 200 ELSE 300', [300, 200]],
  ['IF A THEN 100 ELSE IF B THEN 200 ELSE 300', [null, 300]],
  ['IF A THEN IF B GOTO 100 ELSE 200', [20, 200]],
 ] as const) {
  const flow = analyzeControlFlow(`10 ${body}\n20 END\n100 RETURN\n200 RETURN\n300 RETURN`);
  assert.equal(flow.complete, true, flow.reasons.join('\n'));
  const conditions = flow.nodes.filter(n => n.operation === 'IF').sort((a,b)=>a.start-b.start);
  conditions.forEach((condition,i) => {
   const arm = flow.nodes[flow.edges.find(e=>e.from === condition.id && e.kind === 'false')!.to!]!;
   if (expected[i] === null) assert.equal(arm.operation,'IF');
   else if (arm.operation === 'GOTO') assert.equal(flow.nodes[flow.edges.find(e=>e.from === arm.id && e.kind === 'jump')!.to!]!.basicLine, expected[i]);
   else assert.equal(arm.basicLine, expected[i]);
  });
 }
});
test('strings DATA and comments cannot steal nested ELSE association or leak into exports', () => {
 const source = '10 IF A THEN DATA IF,ELSE,"THEN:ELSE":IF B THEN PRINT "IF ELSE" ELSE PRINT 2 ELSE PRINT 3\n20 IF C THEN IF D THEN PRINT 4 ELSE REM ELSE IF\n30 END';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.equal(flow.nodes.filter(n=>n.operation === 'IF').length, 4);
 assert.equal(flow.entries[0]!.complexity, 5);
 assert.ok(!JSON.stringify(flow).includes('THEN:ELSE'));
});
test('nested syntax errors and excessive IF depth suspend deductions with bounded construction', () => {
 for (const body of ['IF A THEN IF B THEN X=1+', 'IF A THEN PRINT 1 ELSE IF B THEN', 'IF A THEN IF B><2 THEN END', 'IF A THEN '.repeat(17)+'END']) {
  const flow = analyzeControlFlow(`10 ${body}\n20 END\n30 PRINT 1`);
  assert.equal(flow.complete, false, body); assert.deepEqual(flow.unreachable, []);
  assert.ok(flow.entries.every(e=>e.complexity === null));
 }
 assert.equal(analyzeControlFlow('10 '+'IF A THEN '.repeat(16)+'END').complete, true);
 const deep = analyzeControlFlow('10 '+'IF A THEN '.repeat(200)+'END');
 assert.equal(deep.complete, false); assert.ok(deep.nodes.length <= 20); assert.match(deep.reasons.join(' '), /16 niveaux/);
});
test('multiple NEXT expands in source order and pairs each named FOR once', () => {
 const source = '10 FOR I=1 TO 2:FOR J=3 TO 1 STEP -1:FOR K=1 TO 1\n20 PRINT I\n30 NEXT K,J,I\n40 END';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.complexity, 4);
 const closes = flow.nodes.filter(n=>n.operation === 'NEXT').sort((a,b)=>a.start-b.start);
 assert.equal(closes.length, 3); assert.deepEqual(closes.map(n=>n.start), [3,10,12]);
 const headers = closes.map(close=>flow.nodes[flow.edges.find(e=>e.from === close.id && e.kind === 'loop')!.to!]!);
 assert.deepEqual(headers.map(n=>n.start), [source.indexOf('FOR K'),source.indexOf('FOR J'),source.indexOf('FOR I')]);
 headers.forEach((header,i)=>assert.equal(flow.edges.find(e=>e.from === header.id && e.kind === 'false')!.to, closes[i+1]?.id ?? flow.nodes.find(n=>n.basicLine===40 && n.kind==='line')!.id));
 assert.deepEqual(flow.unreachable, []);
});
test('multiple NEXT refuses uncertain initial entry, malformed lists and non-structured pairing', () => {
 for (const [header, close] of [
  ['FOR I=1 TO 2:FOR J=2 TO 1', 'NEXT J,I'],
  ['FOR I=1 TO 2:FOR J=1 TO 3 STEP 0', 'NEXT J,I'],
  ['FOR I=1 TO 2:FOR J=1 TO 3', 'NEXT I,J'],
  ['FOR I=1 TO 2:FOR J=1 TO 3', 'NEXT J,,I'],
  ['FOR I=1 TO 2:FOR J=1 TO 3', 'NEXT J,J'],
  ['FOR I=1 TO 2:WHILE A', 'NEXT I,J'],
 ]) {
  const flow = analyzeControlFlow(`10 ${header}\n20 PRINT 1\n30 ${close}\n40 END`);
  assert.equal(flow.complete, false, header+' / '+close); assert.deepEqual(flow.unreachable, []);
  assert.ok(flow.entries.every(e=>e.complexity === null));
 }
});
test('complete loops in THEN and ELSE keep their own continuation without reevaluating the enclosing IF', () => {
 const source = '10 IF A THEN FOR I=1 TO N:A=0:NEXT I:PRINT 1 ELSE WHILE B:B=B-1:WEND:PRINT 2\n20 END';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.complexity, 4);
 const condition = flow.nodes.find(n=>n.operation==='IF')!;
 const loopHeaders = flow.edges.filter(e=>e.from===condition.id).map(e=>flow.nodes[e.to!]!.operation);
 assert.deepEqual(loopHeaders, ['FOR', 'WHILE']);
 for (const [closeName, openName, print] of [['NEXT','FOR','PRINT 1'],['WEND','WHILE','PRINT 2']]) {
  const close = flow.nodes.find(n=>n.operation===closeName)!, open = flow.nodes.find(n=>n.operation===openName)!;
  assert.equal(flow.edges.find(e=>e.from===close.id && e.kind==='loop')!.to, open.id);
  assert.equal(flow.nodes[flow.edges.find(e=>e.from===open.id && e.kind==='false')!.to!]!.start, source.indexOf(print!));
 }
 assert.equal(flow.cycles.length, 2); assert.ok(flow.cycles.every(c=>!c.nodes.includes(condition.id)));
});
test('nested conditional scopes support self-contained loops and repeated variables in alternative arms', () => {
 for (const source of [
  '10 IF A THEN FOR I=1 TO 2:NEXT I ELSE FOR I=3 TO 4:NEXT I\n20 END',
  '10 IF A THEN IF B THEN FOR I=1 TO 2:WHILE C:C=C-1:WEND:NEXT I ELSE FOR J=1 TO 3:NEXT J ELSE WHILE D:D=D-1:WEND\n20 END',
  '10 FOR I=1 TO 2\n20 IF A THEN WHILE B:B=B-1:WEND\n30 NEXT I\n40 END',
 ]) assert.equal(analyzeControlFlow(source).complete, true, source);
});
test('loop pairing cannot cross alternative arms, another IF or a physical line boundary of a branch', () => {
 for (const source of [
  '10 IF A THEN FOR I=1 TO 2 ELSE NEXT I\n20 END',
  '10 IF A THEN WHILE B ELSE WEND\n20 END',
  '10 IF A THEN FOR I=1 TO 2\n20 NEXT I\n30 END',
  '10 FOR I=1 TO 2\n20 IF A THEN NEXT I\n30 END',
  '10 IF A THEN FOR I=1 TO 2:IF B THEN NEXT I\n20 END',
  '10 IF A THEN WHILE B:IF C THEN WEND ELSE PRINT 1\n20 END',
  '10 IF A THEN FOR I=1 TO 2 ELSE IF B THEN NEXT I\n20 END',
 ]) {
  const flow = analyzeControlFlow(source);
  assert.equal(flow.complete, false, source); assert.deepEqual(flow.unreachable, []);
  assert.ok(flow.entries.every(e=>e.complexity===null)); assert.match(flow.reasons.join(' '), /branches IF/);
 }
});
test('last NEXT variable permits a skipped or dynamic outer FOR, intermediate closures still require guaranteed entry', () => {
 for (const header of ['FOR I=2 TO 1','FOR I=1 TO N','FOR I=A TO B STEP S']) {
  for (const prefix of ['', 'IF X THEN ']) {
   const flow = analyzeControlFlow(`10 ${prefix}${header}:FOR J=1 TO 3:PRINT I:NEXT J,I:PRINT 9\n20 END`);
   assert.equal(flow.complete, true, flow.reasons.join('\n'));
   assert.equal(flow.entries[0]!.complexity, prefix ? 4 : 3);
   const outer = flow.nodes.filter(n=>n.operation==='FOR').sort((a,b)=>a.start-b.start)[0]!;
   const exit = flow.nodes[flow.edges.find(e=>e.from===outer.id && e.kind==='false')!.to!]!;
   assert.equal(exit.operation,'PRINT'); assert.equal(exit.start, flow.nodes.filter(n=>n.operation==='PRINT').sort((a,b)=>b.start-a.start)[0]!.start);
  }
 }
 for (const code of ['FOR I=1 TO N:FOR J=1 TO N:NEXT J,I', 'FOR I=1 TO N:FOR J=1 TO N:FOR K=1 TO 2:NEXT K,J,I']) {
  const flow = analyzeControlFlow('10 '+code+'\n20 END');
  assert.equal(flow.complete,false); assert.match(flow.reasons.join(' '), /fermeture intermédiaire/);
 }
});
test('separate NEXT and WEND keep structural skip edges inside conditional loops', () => {
 const source = '10 IF A THEN FOR I=1 TO N:FOR J=2 TO 1:PRINT 1:NEXT J:NEXT I ELSE WHILE B:WHILE C:PRINT 2:WEND:WEND\n20 END';
 const flow=analyzeControlFlow(source); assert.equal(flow.complete,true,flow.reasons.join('\n'));
 assert.equal(flow.entries[0]!.complexity,6); assert.equal(flow.unreachable.length,0);
 const fors=flow.nodes.filter(n=>n.operation==='FOR').sort((a,b)=>a.start-b.start);
 const afterInner=flow.nodes[flow.edges.find(e=>e.from===fors[1]!.id && e.kind==='false')!.to!]!;
 assert.equal(afterInner.operation,'NEXT'); assert.equal(flow.edges.find(e=>e.from===afterInner.id && e.kind==='loop')!.to,fors[0]!.id);
});
test('ON GOTO and ON GOSUB include out-of-list continuation and all selector outcomes', () => {
 for (const instruction of ['GOTO', 'GOSUB']) {
  const flow = analyzeControlFlow(`10 ON X ${instruction} 100,200,100\n20 END\n100 RETURN\n200 RETURN`);
  assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.complexity, 4);
  assert.equal(flow.unreachable.length, 0);
 }
});
test('FOR and WHILE expose a header test, nested loops pair by statement location', () => {
 const flow = analyzeControlFlow('10 FOR I=2 TO 1:PRINT I:NEXT I\n20 WHILE A\n30 FOR J=1 TO 3\n40 A=A+1\n50 NEXT J\n60 WEND\n70 END');
 assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.complexity, 4);
 assert.equal(flow.cycles.length, 2); assert.ok(flow.cycles.every(c => c.hasExit));
 const forNode = flow.nodes.find(n => n.operation === 'FOR')!;
 assert.deepEqual(flow.edges.filter(e => e.from === forNode.id).map(e => e.kind), ['true', 'false'], 'FOR can skip its body before the first iteration');
 const whileNode = flow.nodes.find(n => n.operation === 'WHILE')!;
 assert.deepEqual(flow.edges.filter(e => e.from === whileNode.id).map(e => e.kind), ['true', 'false']);
});
test('recursive call groups and closed control cycles are reported separately', () => {
 const flow = analyzeControlFlow('10 GOSUB 100\n20 END\n100 GOSUB 200:RETURN\n200 GOSUB 100:RETURN\n300 GOTO 300');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(flow.entries.map(e => e.recursive), [false, true, true]);
 assert.equal(flow.cycles.length, 1); assert.equal(flow.cycles[0]!.hasExit, false); assert.equal(flow.cycles[0]!.reachable, false);
 assert.deepEqual(numbers('10 GOTO 10\n20 PRINT 1'), [20]);
});
test('opaque control, malformed source and ambiguous loops suppress dead-code and complexity conclusions', () => {
 for (const code of ['CALL &BD19', 'POKE &100,1', '|DISC', 'ON ERROR GOTO 100', 'ON BREAK GOSUB 100', 'EVERY 5 GOSUB 100', 'RUN 100', 'CHAIN "OTHER"', 'RESUME NEXT', 'GOTO X+1', 'NEXT I,J', 'FOR I=1 TO 2', 'WEND', 'CLEAR', 'PRINT (1+)', 'GOTO 200', 'PRINT "open']) {
  const flow = analyzeControlFlow(`10 ${code}\n20 END\n100 PRINT "potentially reached"`);
  assert.equal(flow.complete, false, code); assert.deepEqual(flow.unreachable, [], code);
  assert.ok(flow.entries.every(e => e.complexity === null), code); assert.ok(flow.reasons.length, code);
 }
 const reuse = analyzeControlFlow('10 FOR I=1 TO 2\n20 FOR I=1 TO 3\n30 NEXT I\n40 NEXT I');
 assert.equal(reuse.complete, false);
});
test('invalid numbering, oversize inputs and graph budgets remain bounded and never prove inaccessibility', () => {
 for (const source of ['20 END\n10 PRINT 1', '10 END\n10 GOTO 10', 'PRINT 1', '10 '+ 'A'.repeat(FLOW_LIMITS.lineCharacters), 'A'.repeat(FLOW_LIMITS.characters+1)]) {
  const flow = analyzeControlFlow(source); assert.equal(flow.complete, false); assert.deepEqual(flow.unreachable, []);
 }
 const many = analyzeControlFlow(Array.from({length:5000}, (_,i)=>`${i+1} PRINT 1`).join('\n'));
 assert.equal(many.complete, false); assert.ok(many.nodes.length <= FLOW_LIMITS.nodes); assert.ok(many.edges.length <= FLOW_LIMITS.edges);
 assert.deepEqual(many.unreachable, []); assert.ok(many.entries.every(e => e.complexity === null));
});
test('graph traversal is iterative over long listings, and empty/comment-only sources have no executable complexity', () => {
 assert.deepEqual(analyzeControlFlow('').entries, []);
 assert.equal(main('10 REM only\n20 DATA 1,2').complexity, 0);
 const flow = analyzeControlFlow(Array.from({length:3000}, (_,i)=>`${i+1} PRINT 1`).join('\n'));
 assert.equal(flow.complete, true, flow.reasons.join('\n')); assert.equal(flow.entries[0]!.nodes, 3000); assert.equal(flow.entries[0]!.complexity, 1);
});

test('routine quotas and global graph budget leave explicit partial reports', () => {
 const source = '1 END\n' + Array.from({length:129}, (_,i)=>`${i+10} GOSUB ${i+1000}`).join('\n') + '\n' + Array.from({length:129}, (_,i)=>`${i+1000} RETURN`).join('\n');
 const flow = analyzeControlFlow(source);
 assert.equal(flow.entries.length, 128); assert.equal(flow.complete, false); assert.deepEqual(flow.unreachable, []);
 assert.ok(flow.entries.every(e => e.complexity === null));
 assert.equal(analyzeControlFlow('10 END', 0).nodes.length, 0);
 assert.equal(analyzeControlFlow('10 END', 0).complete, false);
 const bounded = analyzeControlFlow('10 PRINT 1\n20 END', 3); assert.equal(bounded.nodes.length, 3); assert.equal(bounded.complete, false);
});

test('quality report shares one graph budget across sources while retaining lexical metrics', () => {
 const source = Array.from({length:2000}, (_,i)=>`${i+1} PRINT 1`).join('\n');
 const result = analyzeQuality(Array.from({length:10},(_,i)=>({id:String(i),name:`source-${i}`,source})));
 assert.equal(result.version, 2);
 assert.equal(result.sources.reduce((sum,s)=>sum+s.flow.nodes.length,0), FLOW_LIMITS.totalNodes);
 assert.equal(result.sources.at(-1)!.flow.complete, false);
 assert.ok(result.sources.every(s=>s.metrics?.codeLines === 2000));
 assert.ok(result.sources.filter(s=>!s.flow.complete).every(s=>!s.flow.unreachable.length));
});

test('non-returning callees remove only their own resume edges and refine local complexity', () => {
 for (const ending of ['END', 'STOP', 'GOTO 200', 'PRINT 1']) {
  const source = `10 GOSUB 100:IF A THEN PRINT 1\n20 END\n100 GOSUB 200:RETURN\n200 ${ending}`;
  const flow = analyzeControlFlow(source);
  assert.equal(flow.complete, true, flow.reasons.join('\n'));
  assert.ok(flow.entries.every(e=>e.returnStatus==='absent'));
  assert.ok(!flow.edges.some(e=>e.kind==='resume'));
  assert.equal(flow.entries[0]!.complexity, 1);
  assert.ok(flow.unreachable.some(id=>flow.nodes[id]!.operation==='IF'));
  assert.ok(flow.unreachable.some(id=>flow.nodes[id]!.operation==='RETURN'));
 }
});
test('finite return paths propagate through nested and mutually recursive calls, not through infinite recursion', () => {
 for (const base of [false,true]) {
  const flow = analyzeControlFlow(`10 GOSUB 100:END\n100 ${base ? 'IF A THEN RETURN ELSE ' : ''}GOSUB 200:RETURN\n200 GOSUB 100:RETURN`);
  assert.equal(flow.complete,true,flow.reasons.join('\n'));
  assert.deepEqual(flow.entries.slice(1).map(e=>e.returnStatus), [base?'possible':'absent',base?'possible':'absent']);
  assert.deepEqual(flow.entries.map(e=>e.recursive),[false,true,true]);
  assert.equal(flow.edges.filter(e=>e.kind==='resume').length,base?3:0);
 }
 const mixed = analyzeControlFlow('10 GOSUB 100:END\n100 IF A THEN END ELSE GOTO 200\n200 RETURN');
 assert.equal(mixed.entries[1]!.returnStatus,'possible');
 assert.ok(mixed.edges.some(e=>e.kind==='resume'));
});
test('ON GOSUB keeps its out-of-list path even when all selected routines stop', () => {
 const flow = analyzeControlFlow('10 GOSUB 100:PRINT 1:END\n100 ON X GOSUB 200,300:RETURN\n200 END\n300 STOP');
 assert.equal(flow.complete,true); assert.equal(flow.entries[1]!.returnStatus,'possible');
 assert.deepEqual(flow.entries.slice(2).map(e=>e.returnStatus),['absent','absent']);
 assert.deepEqual(flow.unreachable,[]); assert.equal(flow.entries[1]!.complexity,3);
});
test('return summaries protect shared continuations and distinguish missing caller stack from a path', () => {
 const flow = analyzeControlFlow('10 IF A THEN GOSUB 100 ELSE GOTO 20\n20 PRINT 1:END\n100 END');
 assert.equal(flow.complete,true); assert.deepEqual(flow.unreachable,[]);
 assert.ok(!flow.edges.some(e=>e.kind==='resume'));
 assert.equal(analyzeControlFlow('10 RETURN').entries[0]!.returnStatus,'possible', 'a structural RETURN is not proof of a valid call stack');
 const same = analyzeControlFlow('10 GOSUB 20\n20 RETURN');
 assert.equal(same.entries[0]!.returnStatus,'possible', 'callee and continuation may be the same node');
});
test('opaque construction never prunes a resume or concludes a return status', () => {
 for (const suffix of ['200 CALL &BD19','200 ON ERROR GOTO 100','200 GOTO 999']) {
  const flow=analyzeControlFlow('10 GOSUB 100:PRINT 1\n20 END\n100 END\n'+suffix);
  assert.equal(flow.complete,false); assert.ok(flow.entries.every(e=>e.returnStatus==='unknown'));
  assert.equal(flow.edges.filter(e=>e.kind==='resume').length,1); assert.deepEqual(flow.unreachable,[]);
 }
});
test('return propagation remains iterative across a long chain and independent of entry display quotas', () => {
 const source=Array.from({length:1000},(_,i)=>`${i+1} GOSUB ${i+2}:RETURN`).join('\n')+'\n1001 RETURN';
 const flow=analyzeControlFlow(source);
 assert.equal(flow.complete,false); assert.match(flow.reasons.join(' '),/128 points/);
 assert.equal(flow.entries.length,128); assert.ok(flow.entries.every(e=>e.returnStatus==='possible' && e.complexity===null));
 assert.equal(flow.edges.filter(e=>e.kind==='resume').length,1000);
});


test('Markdown and JSON export return summaries without source arguments', () => {
 const report=analyzeQuality([{id:'returns',name:'returns.bas',source:'10 GOSUB 100:PRINT "PRIVATE RETURN TEXT"\n20 END\n100 END'}]);
 assert.equal(report.sources[0]!.flow.version,5);
 assert.equal(report.sources[0]!.flow.entries[1]!.returnStatus,'absent');
 const markdown=qualityMarkdown(report);
 assert.match(markdown,/chemin vers RETURN : Aucun chemin/);
 assert.ok(!markdown.includes('PRIVATE RETURN TEXT')); assert.ok(!JSON.stringify(report).includes('PRIVATE RETURN TEXT'));
});

test('event declarations have navigable targets without immediate calls, reachability or control cycles', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100:ON BREAK GOSUB 200:ON SQ(1) GOSUB 200\n20 AFTER 50 GOSUB 200:EVERY t,2 GOSUB 200\n30 END\n100 RESUME NEXT\n200 RETURN');
 assert.equal(flow.version,5); assert.equal(flow.complete,false);
 assert.deepEqual(flow.handlers.map(h=>[h.event,h.action,h.targetLine]),[['error','register',100],['break','register',200],['sound','register',200],['after','register',200],['every','register',200]]);
 assert.equal(flow.edges.filter(e=>e.kind==='handler').length,5); assert.deepEqual(flow.calls,[]); assert.deepEqual(flow.cycles,[]);
 assert.deepEqual(flow.entries.map(e=>[flow.nodes[e.node]!.basicLine,e.kind]),[[10,'main'],[100,'handler'],[200,'handler']]);
 assert.ok(flow.entries.every(e=>e.complexity===null && e.returnStatus==='unknown')); assert.deepEqual(flow.unreachable,[]);
 assert.ok(flow.handlers.every(h=>!flow.reachable.includes(h.target!)));
 for (const h of flow.handlers) { assert.equal(flow.nodes[h.site]!.kind,'statement'); assert.ok(flow.edges.some(e=>e.from===h.site && e.kind==='next')); }
 const self=analyzeControlFlow('10 AFTER 1 GOSUB 10:END'); assert.deepEqual(self.cycles,[], 'a self-registration is not a control loop');
});
test('handler mode changes and repeated registrations preserve source order, without claiming active state', () => {
 const source='10 ON ERROR GOTO 100:ON ERROR GOTO 0:ON BREAK CONT:ON BREAK STOP\n20 END\n30 ON ERROR GOTO 100\n100 RETURN';
 const flow=analyzeControlFlow(source);
 assert.deepEqual(flow.handlers.map(h=>h.action),['register','disable','continue','stop','register']);
 assert.deepEqual(flow.handlers.slice(1,4).map(h=>h.target),[null,null,null]);
 assert.equal(flow.handlers.at(-1)!.targetLine,100, 'declarations outside known paths are inventoried');
 assert.ok(flow.handlers.slice(0,4).every((h,i,all)=>!i || flow.nodes[h.site]!.start>flow.nodes[all[i-1]!.site]!.start));
});
test('ERROR and RESUME never fall through the handler; explicit resume targets remain contextual', () => {
 for (const command of ['RESUME','RESUME NEXT','RESUME 20','ERROR 5']) {
  const flow=analyzeControlFlow(`10 ${command}:PRINT 99\n20 END`), control=flow.nodes.find(n=>n.operation.startsWith('RESUME') || n.operation==='ERROR')!;
  const links=flow.edges.filter(e=>e.from===control.id);
  assert.equal(flow.complete,false); assert.equal(links.length,1); assert.ok(!links.some(e=>e.kind==='next'));
  if(command==='RESUME 20') assert.equal(flow.nodes[links[0]!.to!]!.basicLine,20); else assert.equal(links[0]!.to,null);
  assert.deepEqual(flow.unreachable,[]);
 }
 const zero=analyzeControlFlow('10 RESUME 0\n20 END'); assert.match(zero.reasons.join(' '),/cible RESUME/); assert.ok(!zero.edges.some(e=>e.kind==='recovery'));
});
test('malformed event declarations and computed targets do not invent handlers', () => {
 for (const code of ['ON ERROR GOSUB 100','ON ERROR GOTO x','ON BREAK GOTO 100','ON BREAK GOSUB 0','ON SQ() GOSUB 100','ON SQ(1,2) GOSUB 100','ON SQ(1+) GOSUB 100','ON SQ(1) GOSUB 100,200','AFTER GOSUB 100','AFTER 1, GOSUB 100','EVERY 1,2,3 GOSUB 100','AFTER 1 GOTO 100','EVERY t GOSUB x','AFTER 1 GOSUB 0']) {
  const flow=analyzeControlFlow(`10 ${code}\n100 RETURN\n200 END`);
  assert.equal(flow.complete,false,code); assert.deepEqual(flow.handlers,[],code); assert.deepEqual(flow.unreachable,[]);
 }
 const absent=analyzeControlFlow('10 AFTER 1 GOSUB 100:END');
 assert.equal(absent.handlers[0]!.targetLine,100); assert.equal(absent.handlers[0]!.target,null); assert.match(absent.reasons.join(' '),/cible de gestionnaire 100 absente/);
});
test('conditional handlers and nested expression commas preserve locations without exporting expressions', () => {
 const source='10 IF a THEN AFTER MAX(delay,2),timer GOSUB 100 ELSE ON SQ(channel) GOSUB 200\n20 PRINT "PRIVATE"\n30 END\n100 RETURN\n200 RETURN';
 const flow=analyzeControlFlow(source);
 assert.equal(flow.handlers.length,2); assert.equal(flow.nodes[flow.handlers[0]!.site]!.start,source.indexOf('AFTER'));
 assert.equal(flow.nodes[flow.handlers[1]!.site]!.start,source.indexOf('ON SQ'));
 const exported=JSON.stringify(flow); for(const text of ['delay','timer','channel','PRIVATE']) assert.ok(!exported.includes(text));
 const protectedFlow=analyzeControlFlow('10 DATA "AFTER 1 GOSUB 100",ON,ERROR\n20 PRINT "ON SQ(1) GOSUB 100"\n30 REM EVERY 1 GOSUB 100\n40 END');
 assert.deepEqual(protectedFlow.handlers,[]); assert.equal(protectedFlow.complete,true);
});
test('shared GOSUB and handler entries retain ordinary calls and bounded summaries', () => {
 const flow=analyzeControlFlow('10 ON BREAK GOSUB 100:GOSUB 100:END\n100 RETURN');
 assert.equal(flow.handlers.length,1); assert.equal(flow.calls.length,1); assert.equal(flow.entries[1]!.kind,'subroutine');
 assert.ok(flow.edges.some(e=>e.kind==='resume')); assert.ok(flow.entries.every(e=>e.returnStatus==='unknown'));
 const many=analyzeControlFlow('1 END\n'+Array.from({length:129},(_,i)=>`${i+10} AFTER 1 GOSUB ${i+1000}`).join('\n')+'\n'+Array.from({length:129},(_,i)=>`${i+1000} RETURN`).join('\n'));
 assert.equal(many.handlers.length,129); assert.equal(many.entries.length,128); assert.match(many.reasons.join(' '),/128 points/); assert.deepEqual(many.unreachable,[]);
});
test('event Markdown and JSON exports identify declarations and missing targets without code', () => {
 const report=analyzeQuality([{id:'events',name:'events.bas',source:'10 AFTER secretDelay GOSUB 100:ON ERROR GOTO 0\n20 END'}]);
 const text=qualityMarkdown(report); assert.match(text,/Minuteur unique · Déclaration/); assert.match(text,/cible BASIC 100 absente/); assert.match(text,/Erreur · Désactivation/);
 assert.ok(!text.includes('secretDelay')); assert.ok(!JSON.stringify(report).includes('secretDelay'));
});


test('a truncated graph keeps event targets already known and declarations in source order', () => {
 const source='10 ON ERROR GOTO 100:AFTER 1 GOSUB 100\n20 PRINT 1\n100 RETURN';
 const flow=analyzeControlFlow(source,5);
 assert.equal(flow.complete,false); assert.equal(flow.handlers.length,2);
 assert.deepEqual(flow.handlers.map(h=>h.event),['error','after']);
 assert.ok(flow.handlers.every(h=>h.target!==null && flow.nodes[h.target]!.basicLine===100));
 assert.ok(!flow.reasons.some(r=>r.includes('cible de gestionnaire'))); assert.deepEqual(flow.unreachable,[]);
});

test('explicit error contexts track handler replacement and the exact next instruction', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 ERROR 5:ERROR 6:PRINT "PRIVATE"\n30 END\n100 ON ERROR GOTO 200:RESUME NEXT\n200 RESUME NEXT');
 const result=flow.errorFlow; assert.equal(result.status,'covered',result.reason ?? ''); assert.equal(flow.complete,false);
 const raises=result.transfers.filter(t=>t.kind==='raise'); assert.equal(raises.length,2);
 assert.deepEqual(raises.map(t=>flow.nodes[t.to!]!.basicLine),[100,200]);
 const resumes=result.transfers.filter(t=>t.kind==='next'); assert.equal(resumes.length,2);
 assert.equal(resumes[0]!.to,raises[1]!.node); assert.equal(resumes[0]!.fault,raises[0]!.node);
 assert.equal(flow.nodes[resumes[1]!.to!]!.operation,'PRINT');
 assert.ok(!JSON.stringify(result).includes('PRIVATE')); assert.deepEqual(flow.unreachable,[]);
});
test('branch joins retain distinct active handlers, including disabled traps', () => {
 const flow=analyzeControlFlow('10 IF A THEN ON ERROR GOTO 100 ELSE ON ERROR GOTO 200\n20 IF B THEN ON ERROR GOTO 0\n30 ERROR 5\n40 END\n100 RESUME 40\n200 RESUME 40');
 const result=flow.errorFlow; assert.equal(result.status,'covered',result.reason ?? '');
 const node=flow.nodes.find(n=>n.operation==='ERROR')!.id;
 assert.deepEqual(result.contexts.filter(c=>c.node===node).map(c=>c.handler===null?0:flow.nodes[c.handler]!.basicLine).sort((a,b)=>a-b),[0,100,200]);
 assert.equal(result.transfers.filter(t=>t.kind==='unhandled').length,1);
 assert.equal(result.transfers.filter(t=>t.kind==='line').length,2);
});
test('a shared RESUME keeps each interrupted ERROR and continuation correlated', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 IF A THEN 30 ELSE 40\n30 ERROR 5:GOTO 50\n40 ERROR 6:PRINT 1\n50 END\n100 RESUME NEXT');
 assert.equal(flow.errorFlow.status,'covered');
 const links=flow.errorFlow.transfers.filter(t=>t.kind==='next'); assert.equal(links.length,2);
 assert.deepEqual(links.map(t=>[flow.nodes[t.fault!]!.basicLine,flow.nodes[t.to!]!.basicLine]).sort((a,b)=>a[0]!-b[0]!),[[30,30],[40,40]]);
});
test('retry reaches a fixed point; rethrow and errors inside a handler do not reenter it', () => {
 const retry=analyzeControlFlow('10 ON ERROR GOTO 100\n20 ERROR 5\n30 END\n100 RESUME');
 assert.equal(retry.errorFlow.status,'covered'); assert.equal(retry.errorFlow.transfers.length,2);
 assert.equal(retry.errorFlow.transfers.find(t=>t.kind==='retry')!.to,retry.nodes.find(n=>n.operation==='ERROR')!.id);
 for(const [command,kind] of [['ON ERROR GOTO 0','rethrow'],['ERROR 6','nested'],['ON ERROR GOTO 200:ERROR 6','nested']] as const) {
  const flow=analyzeControlFlow(`10 ON ERROR GOTO 100\n20 ERROR 5\n30 END\n100 ${command}:RESUME NEXT\n200 RESUME NEXT`);
  assert.equal(flow.errorFlow.status,'covered'); assert.deepEqual(flow.errorFlow.transfers.map(t=>t.kind),['raise',kind]);
  assert.equal(flow.errorFlow.transfers[1]!.to,null);
 }
});
test('unsupported contexts discard deductions rather than publishing guessed states', () => {
 for (const source of [
  '10 ON ERROR GOTO 100:GOSUB 200\n20 ERROR 5\n30 END\n100 RESUME NEXT\n200 RETURN',
  '10 ON ERROR GOTO 100:AFTER 1 GOSUB 200\n20 ERROR 5\n30 END\n100 RESUME NEXT\n200 RETURN',
  '10 ON ERROR GOTO 100:FOR I=1 TO 2\n20 ERROR 5:NEXT I\n30 END\n100 RESUME NEXT',
  '10 ON ERROR GOTO 100\n20 ERROR n\n30 END\n100 RESUME NEXT',
  '10 ON ERROR GOTO 100\n20 ERROR 256\n30 END\n100 RESUME NEXT',
  '10 ON ERROR GOTO 100:CALL &BD19\n20 ERROR 5\n30 END\n100 RESUME NEXT',
  '10 RESUME NEXT',
 ]) {
  const flow=analyzeControlFlow(source); assert.equal(flow.errorFlow.status,'unsupported',source);
  assert.deepEqual(flow.errorFlow.transfers,[]); assert.deepEqual(flow.errorFlow.contexts,[]);
 }
 const normal=analyzeControlFlow('10 GOSUB 100:END\n100 RETURN'); assert.equal(normal.errorFlow.status,'not-needed'); assert.equal(normal.errorFlow.states,0);
});
test('state budgets remove partial contexts, preserve the graph and bound global work', () => {
 const source='10 ON ERROR GOTO 100\n20 ERROR 5:PRINT 1\n30 END\n100 RESUME NEXT';
 const bounded=analyzeControlFlow(source,FLOW_LIMITS.nodes,3);
 assert.equal(bounded.errorFlow.status,'limited'); assert.equal(bounded.errorFlow.states,3);
 assert.deepEqual(bounded.errorFlow.transfers,[]); assert.deepEqual(bounded.errorFlow.contexts,[]);
 assert.ok(bounded.nodes.length>3); assert.deepEqual(bounded.unreachable,[]);
 assert.equal(analyzeControlFlow(source,FLOW_LIMITS.nodes,NaN).errorFlow.status,'limited');
 const truncated=analyzeControlFlow(source,5); assert.equal(truncated.errorFlow.status,'unsupported');
});
test('error context exports state their restricted scope and retain precise destinations', () => {
 const report=analyzeQuality([{id:'errors',name:'errors.bas',source:'10 ON ERROR GOTO 100\n20 ERROR 5:PRINT "SECRET"\n30 END\n100 RESUME NEXT'}]);
 const text=qualityMarkdown(report); assert.match(text,/Contextes d’erreur/); assert.match(text,/erreurs implicites/); assert.match(text,/Suite de l’instruction mémorisée/);
 assert.ok(!text.includes('SECRET')); assert.ok(!JSON.stringify(report).includes('SECRET'));
});


test('quality reports share a global error-state budget across sources', () => {
 const source='10 ON ERROR GOTO 1000\n20 IF A THEN ON ERROR GOTO 1010\n30 IF B THEN ON ERROR GOTO 1020\n35 IF C THEN ON ERROR GOTO 1030\n'+Array.from({length:60},(_,i)=>`${40+i} ERROR 5:PRINT 1`).join('\n')+'\n200 END\n1000 RESUME NEXT\n1010 RESUME NEXT\n1020 RESUME NEXT\n1030 RESUME NEXT';
 const report=analyzeQuality(Array.from({length:60},(_,i)=>({id:String(i),name:`errors-${i}`,source})));
 assert.equal(report.sources.reduce((total,s)=>total+s.flow.errorFlow.states,0),ERROR_FLOW_LIMITS.totalStates);
 assert.ok(report.sources.some(s=>s.flow.errorFlow.status==='limited'));
 assert.ok(report.sources.filter(s=>s.flow.errorFlow.status==='limited').every(s=>!s.flow.errorFlow.contexts.length && !s.flow.errorFlow.transfers.length));
});

test('transfer and transition budgets also remove incomplete error-context results', () => {
 const manyErrors='1 ON ERROR GOTO 5000\n'+Array.from({length:21},(_,i)=>`${10+i} `+Array(100).fill('ERROR 5').join(':')).join('\n')+'\n100 END\n5000 RESUME NEXT';
 const links=analyzeControlFlow(manyErrors).errorFlow;
 assert.equal(links.status,'limited'); assert.match(links.reason!,/4096 transferts/); assert.deepEqual(links.contexts,[]); assert.deepEqual(links.transfers,[]);
 const wide='1 ON ERROR GOTO 5000\n'+Array.from({length:150},(_,i)=>`${10+i} ERROR 5`).join('\n')+'\n1000 END\n5000 ON X GOTO '+Array(1000).fill('6000').join(',')+'\n6000 RESUME NEXT';
 const steps=analyzeControlFlow(wide).errorFlow;
 assert.equal(steps.status,'limited'); assert.match(steps.reason!,/131072 transitions/); assert.deepEqual(steps.contexts,[]); assert.deepEqual(steps.transfers,[]);
});

test('conditional ERROR resumes use firmware-qualified saved starts and scan destinations', () => {
 for (const specimen of conditionalErrorCases) for (const mode of ['next','retry'] as const) {
  const line=`30 ${specimen.code}`;
  const flow=analyzeControlFlow(`10 ON ERROR GOTO 1000\n${line}\n40 END\n1000 RESUME ${mode==='next'?'NEXT':''}`);
  assert.equal(flow.errorFlow.status,'covered',specimen.name+': '+flow.errorFlow.reason);
  const fault=flow.nodes.find(n=>n.basicLine===30 && n.start===line.indexOf('ERROR 5'))!;
  const transfer=flow.errorFlow.transfers.find(t=>t.kind===mode && t.fault===fault.id)!;
  assert.ok(transfer,specimen.name+' '+mode);
  const at=mode==='next'?specimen.nextAt:specimen.retryAt;
  const destination=flow.nodes[transfer.to!]!;
  assert.equal(destination.basicLine,at===null?40:30,specimen.name+' '+mode);
  if(at!==null) assert.equal(destination.start,mode==='next'?line.lastIndexOf(at):line.indexOf(at),specimen.name+' '+mode);
  assert.equal(flow.complete,false); assert.deepEqual(flow.unreachable,[]);
 }
});
test('one handler preserves different conditional retry boundaries and targets', () => {
 const line='20 IF A THEN ERROR 5:x=1:ERROR 6 ELSE x=2:ERROR 7';
 const flow=analyzeControlFlow(`10 ON ERROR GOTO 100\n${line}\n30 END\n100 IF B THEN RESUME ELSE RESUME NEXT`);
 assert.equal(flow.errorFlow.status,'covered');
 const retries=flow.errorFlow.transfers.filter(t=>t.kind==='retry'); assert.equal(retries.length,3);
 for(const transfer of retries) {
  const fault=flow.nodes[transfer.fault!]!, target=flow.nodes[transfer.to!]!;
  assert.equal(target.start,fault.start===line.indexOf('ERROR 5')?line.indexOf('IF'):fault.start);
 }
 const explicit=analyzeControlFlow('10 ON ERROR GOTO 100\n20 IF A THEN IF B THEN ERROR 5 ELSE ERROR 6 ELSE ERROR 7\n30 END\n100 RESUME 30');
 assert.equal(explicit.errorFlow.status,'covered');
 assert.equal(explicit.errorFlow.transfers.filter(t=>t.kind==='line').length,3);
 assert.ok(explicit.errorFlow.transfers.filter(t=>t.kind==='line').every(t=>explicit.nodes[t.to!]!.basicLine===30));
});
test('conditional resumption scanning protects strings, DATA, comments and empty separators', () => {
 for(const prefix of ['PRINT "ELSE:IF"','DATA "ELSE:IF",4']) {
  const line=`20 IF A THEN ${prefix}:x=98 ELSE ERROR 5:x=2`;
  const flow=analyzeControlFlow(`10 ON ERROR GOTO 100\n${line}\n30 END\n100 RESUME NEXT`);
  assert.equal(flow.errorFlow.status,'covered');
  assert.equal(flow.nodes[flow.errorFlow.transfers.find(t=>t.kind==='next')!.to!]!.start,line.indexOf('x=98'));
  assert.ok(!JSON.stringify(flow).includes('ELSE:IF'));
 }
 for(const tail of ["REM : ELSE IF", "' : ELSE IF", '']) {
  const flow=analyzeControlFlow(`10 ON ERROR GOTO 100\n20 IF A THEN ERROR 5:${tail}\n30 END\n100 RESUME NEXT`);
  assert.equal(flow.errorFlow.status,'covered');
  assert.equal(flow.nodes[flow.errorFlow.transfers.find(t=>t.kind==='next')!.to!]!.basicLine,30);
 }
 const empty=analyzeControlFlow('10 ON ERROR GOTO 100\n20 IF A THEN ::ERROR 5::x=1\n30 END\n100 IF B THEN RESUME ELSE RESUME NEXT');
 assert.equal(empty.errorFlow.status,'covered');
 assert.equal(empty.nodes[empty.errorFlow.transfers.find(t=>t.kind==='retry')!.to!]!.operation,'ERROR');
 assert.equal(empty.nodes[empty.errorFlow.transfers.find(t=>t.kind==='next')!.to!]!.operation,'AFFECTATION');
});

test('simple scalar divisions have typed sites without evaluating or exporting operands', () => {
 for(const statement of ['q=secretNumerator/secretDivisor','LET q=10/d','q%=10\\d%','q!=10 MOD d!','q=-32767/+0','q=0/2']) {
  const flow=analyzeControlFlow(`10 ${statement}\n20 END`);
  assert.equal(flow.errorFlow.status,'covered',statement);
  assert.equal(flow.errorFlow.version,2); assert.equal(flow.errorFlow.scope,'explicit-and-simple-division');
  assert.deepEqual(flow.errorFlow.sites.map(s=>s.kind),['division-zero']);
  assert.equal(flow.errorFlow.transfers[0]!.kind,statement.includes('/')?'warning':'unhandled');
  assert.equal(flow.complete,false); assert.deepEqual(flow.unreachable,[]);
  assert.ok(!JSON.stringify(flow).includes('secret'));
 }
 for(const statement of ['q$=a/b','q=a$/b','q=a/b$','q(1)=a/b','q=a(1)/b','q=(a/b)','q=a/b+1','q=ABS(a)/b','q=1.5/b','q=&10/b','q=32768/b','q=-a/b','PRINT a/b','IF a/b THEN PRINT 1','DATA a/b','PRINT "q=a/b"','REM q=a/b']) {
  assert.deepEqual(analyzeControlFlow(`10 ${statement}\n20 END`).errorFlow.sites,[],statement);
 }
});
test('a possible division preserves the normal path and the correlated error path', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 q=n/d:ERROR 5\n30 END\n100 RESUME NEXT');
 const result=flow.errorFlow; assert.equal(result.status,'covered');
 assert.deepEqual(result.sites.map(s=>s.kind),['division-zero','explicit']);
 const division=result.sites[0]!.node, explicit=result.sites[1]!.node;
 assert.ok(result.transfers.some(t=>t.kind==='raise' && t.node===division));
 assert.ok(result.transfers.some(t=>t.kind==='next' && t.fault===division && t.to===explicit));
 assert.ok(result.transfers.some(t=>t.kind==='raise' && t.node===explicit));
 const normal=analyzeControlFlow('10 q=n/d\n20 ON ERROR GOTO 100\n30 ERROR 5\n40 END\n100 RESUME NEXT');
 assert.deepEqual(normal.errorFlow.transfers.filter(t=>t.kind==='raise'||t.kind==='warning').map(t=>t.kind),['warning','raise']);
});
test('implicit retry reaches a fixed point and keeps a normal continuation after repair', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 q=10/d:ON ERROR GOTO 200\n30 ERROR 5\n40 END\n100 d=2:RESUME\n200 RESUME NEXT');
 assert.equal(flow.errorFlow.status,'covered');
 const division=flow.errorFlow.sites.find(s=>s.kind==='division-zero')!.node;
 assert.ok(flow.errorFlow.transfers.some(t=>t.kind==='retry' && t.fault===division && t.to===division));
 assert.ok(flow.errorFlow.transfers.some(t=>t.kind==='raise' && flow.nodes[t.to!]!.basicLine===200));
 assert.ok(flow.errorFlow.states<40);
});
test('division in a handler may stop for nested error or continue normally to RESUME', () => {
 const flow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 ERROR 5\n30 END\n100 q=n/d:RESUME NEXT');
 assert.equal(flow.errorFlow.status,'covered');
 assert.ok(flow.errorFlow.transfers.some(t=>t.kind==='nested' && t.to===null));
 assert.ok(flow.errorFlow.transfers.some(t=>t.kind==='next' && flow.nodes[t.to!]!.basicLine===30));
 const rethrow=analyzeControlFlow('10 ON ERROR GOTO 100\n20 q=n/d\n30 END\n100 ON ERROR GOTO 0');
 assert.equal(rethrow.errorFlow.status,'covered'); assert.ok(rethrow.errorFlow.transfers.some(t=>t.kind==='rethrow'));
});
test('implicit conditional sites preserve the qualified saved instruction boundaries', () => {
 for(const [line,retryAt,nextAt,nextLine] of [
  ['20 IF A THEN q=10/d:x=1 ELSE x=99','IF','x=1',20],
  ['20 IF A THEN x=99 ELSE q=10/d:x=2','IF','',30],
  ['20 IF A THEN x=99:x=98 ELSE q=10/d:x=2','IF','x=98',20],
  ['20 IF A THEN x=10:q=10/d:x=1 ELSE x=99','q=10/d','x=1',20],
  ['20 IF A THEN x=10:IF B THEN q=10/d:x=1 ELSE x=99','IF B','x=1',20],
 ] as const) {
  const flow=analyzeControlFlow(`10 ON ERROR GOTO 100\n${line}\n30 END\n100 IF B THEN RESUME ELSE RESUME NEXT`);
  assert.equal(flow.errorFlow.status,'covered');
  const retry=flow.nodes[flow.errorFlow.transfers.find(t=>t.kind==='retry')!.to!]!;
  const next=flow.nodes[flow.errorFlow.transfers.find(t=>t.kind==='next')!.to!]!;
  assert.equal(retry.start,line.indexOf(retryAt)); assert.equal(next.basicLine,nextLine);
  if(nextAt) assert.equal(next.start,line.lastIndexOf(nextAt));
 }
});
test('implicit error results discard all deductions on unsupported or exhausted analysis', () => {
 const source='10 ON ERROR GOTO 100\n20 q=n/d\n30 END\n100 RESUME NEXT';
 for(const flow of [analyzeControlFlow(source,FLOW_LIMITS.nodes,3), analyzeControlFlow(source,5),analyzeControlFlow(source+'\n200 RETURN')]) {
  assert.ok(['limited','unsupported'].includes(flow.errorFlow.status));
  assert.deepEqual(flow.errorFlow.sites,[]); assert.deepEqual(flow.errorFlow.contexts,[]); assert.deepEqual(flow.errorFlow.transfers,[]);
 }
 const unpaired=analyzeControlFlow('10 q=n/d:RESUME NEXT');
 assert.equal(unpaired.errorFlow.status,'unsupported'); assert.deepEqual(unpaired.errorFlow.sites,[]);
});
test('implicit error exports distinguish possible origins and keep all private expressions out', () => {
 const report=analyzeQuality([{id:'divisions',name:'divisions.bas',source:'10 ON ERROR GOTO 100\n20 privateResult=privateNumerator/privateDivisor\n30 END\n100 RESUME NEXT'}]);
 const markdown=qualityMarkdown(report); assert.match(markdown,/Division par zéro possible/); assert.match(markdown,/sans calculer son diviseur/);
 assert.ok(!markdown.includes('private')); assert.ok(!JSON.stringify(report).includes('private'));
 assert.equal(report.sources[0]!.flow.version,5);
});

test('untrapped real division warns and continues in its own arm; integer division stops', () => {
 for(const operator of ['/','\\','MOD']) {
  const line=`10 IF A THEN x=99 ELSE q=10 ${operator} d:x=2`;
  const flow=analyzeControlFlow(`${line}\n20 END`), result=flow.errorFlow;
  assert.equal(result.status,'covered'); assert.equal(result.sites[0]!.operator,operator);
  const transfer=result.transfers[0]!;
  assert.equal(transfer.kind,operator==='/'?'warning':'unhandled');
  if(operator==='/') assert.equal(flow.nodes[transfer.to!]!.start,line.indexOf('x=2'));
  else assert.equal(transfer.to,null);
 }
});
