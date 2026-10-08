import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeQuality } from '../packages/basic-language/src/quality.ts';
import { analyzeControlFlow, FLOW_LIMITS } from '../packages/basic-language/src/control-flow.ts';
const numbers = (source: string) => { const flow = analyzeControlFlow(source); return flow.unreachable.map(id => flow.nodes[id]!.basicLine); };
const main = (source: string) => analyzeControlFlow(source).entries[0]!;

test('flow follows literal jumps from first line, preserves physical columns and excludes DATA/comments from unreachable statements', () => {
 const source = '10 GOTO40:PRINT "PRIVATE"\n20 DATA "secret:GOTO30",99\n30 REM unused label\n40 PRINT "ok"\n50 END\n60 PRINT "unused"';
 const flow = analyzeControlFlow(source);
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(numbers(source), [10, 60]);
 const unreachable = flow.nodes[flow.unreachable[0]!]!;
 assert.equal(unreachable.line, 1); assert.equal(unreachable.start, 10); assert.equal(unreachable.operation, 'PRINT');
 assert.ok(!JSON.stringify(flow).includes('PRIVATE')); assert.ok(!JSON.stringify(flow).includes('secret'));
 assert.equal(main(source).complexity, 1);
});
test('IF false skips entire THEN colon sequence; ELSE arms and compact literal targets join correctly', () => {
 const flow = analyzeControlFlow('10 IF A THEN PRINT 1:PRINT 2 ELSE GOTO40:PRINT 3\n20 PRINT 4\n30 END\n40 END');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 const condition = flow.nodes.find(n => n.operation === 'IF')!, arms = flow.edges.filter(e => e.from === condition.id);
 assert.deepEqual(arms.map(e => e.kind), ['true', 'false']);
 assert.equal(flow.nodes[arms[1]!.to!]!.operation, 'GOTO');
 assert.equal(flow.unreachable.length, 1); assert.equal(flow.nodes[flow.unreachable[0]!]!.start, 41);
 assert.equal(flow.entries[0]!.complexity, 2);
 const implicit = analyzeControlFlow('10 IF A GOTO30\n20 END\n30 IF B THEN10 ELSE20');
 assert.equal(implicit.complete, true, implicit.reasons.join('\n')); assert.equal(implicit.entries[0]!.complexity, 3);
});
test('GOSUB uses continuation summaries and per-entry complexity without attributing callee decisions to main', () => {
 const flow = analyzeControlFlow('10 GOSUB100:GOSUB100\n20 END\n100 IF X THEN RETURN\n110 PRINT "hello"\n120 RETURN');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(flow.entries.map(e => [flow.nodes[e.node]!.basicLine, e.complexity]), [[10, 1], [100, 2]]);
 assert.equal(flow.calls.length, 2); assert.equal(flow.unreachable.length, 0);
 assert.ok(flow.edges.some(e => e.kind === 'resume'));
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
 const flow = analyzeControlFlow('10 GOSUB100\n20 END\n100 GOSUB200:RETURN\n200 GOSUB100:RETURN\n300 GOTO300');
 assert.equal(flow.complete, true, flow.reasons.join('\n'));
 assert.deepEqual(flow.entries.map(e => e.recursive), [false, true, true]);
 assert.equal(flow.cycles.length, 1); assert.equal(flow.cycles[0]!.hasExit, false); assert.equal(flow.cycles[0]!.reachable, false);
 assert.deepEqual(numbers('10 GOTO10\n20 PRINT 1'), [20]);
});
test('opaque control, malformed source and ambiguous loops suppress dead-code and complexity conclusions', () => {
 for (const code of ['CALL &BD19', 'POKE &100,1', '|DISC', 'ON ERROR GOTO100', 'ON BREAK GOSUB100', 'EVERY 5 GOSUB100', 'RUN 100', 'CHAIN "OTHER"', 'RESUME NEXT', 'GOTO X+1', 'IF A THEN IF B THEN GOTO100', 'NEXT I,J', 'FOR I=1 TO 2', 'WEND', 'CLEAR', 'PRINT (1+)', 'GOTO200', 'PRINT "open']) {
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
