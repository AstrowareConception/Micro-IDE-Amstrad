import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeQuality } from '../packages/basic-language/src/quality.ts';
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
  ['FOR I=1 TO N:FOR J=1 TO 3', 'NEXT J,I'],
  ['FOR I=1 TO 2:FOR J=2 TO 1', 'NEXT J,I'],
  ['FOR I=1 TO 2 STEP 0:FOR J=1 TO 3', 'NEXT J,I'],
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
