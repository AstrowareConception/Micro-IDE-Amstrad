import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEditor, ANALYSIS_LIMITS } from '../packages/basic-language/src/syntax.ts';
import { AnalysisCoordinator, createAnalysisEngine, type AnalysisRequest } from '../packages/basic-language/src/analysis-service.ts';

test('expanded structural grammar preserves valid BASIC 1.1 forms including omitted graphics options', () => {
 const statements = ['BORDER 1', 'BORDER 1,2', 'INK 1,2,3', 'LOCATE #0,1,2', 'MOVE 1,2,,3', 'DRAW 1,2,3,0', 'SOUND 1,100,,15', 'ORIGIN 0,0,1,2,3,4', 'WAIT &F500,1,0', 'CALL &8000,@A', 'KEY 128,"X"', 'KEY DEF 1,0,65', 'LOAD "X",&8000', 'MERGE "X"', 'NEXT I,J', 'READ A(1),B$', 'DIM A(2,3),B$(10)', 'LET A(2,3)=MAX(1,2)', 'IF A THEN MODE 1:INK 0,0 ELSE MODE 2:END', 'IF A THEN REM MODE', "IF A THEN 'comment", 'IF A THEN REM ELSE MODE', 'IF A THEN PRINT "X":REM', 'FOR I=-2*3 TO MAX(4,5) STEP -1', 'ON A+1 GOTO 100,200', 'ON ERROR GOTO 0', 'ON BREAK CONT', 'ON SQ(1) GOSUB 100', 'AFTER 50 GOSUB 100', 'EVERY 50,2 GOSUB 100', 'SPEED INK 1,2', 'SPEED KEY 1,2', 'SPEED WRITE 1', 'WRITE "X",A', 'PRINT "A" A$;TAB(1);', 'PRINT USING "##";A', 'FRAME', 'GRAPHICS PEN ,1', 'MASK 255,1', 'CURSOR 1,1', 'SWAP A,B', 'A=TIME+PI+HIMEM+ERR+ERL+DERR', 'A$=COPYCHR$(#0)', 'INPUT #9,A$', 'LINE INPUT "X";A$', 'DEF FNx(A)=A+1', 'A=FN x(2)', '10MODE1'];
 for (const statement of statements) {
  const source = `${statement === '10MODE1' ? statement : `10 ${statement}`}\n100 RETURN\n200 END`;
  assert.deepEqual(analyzeEditor(source).diagnostics.filter(d => d.severity === 'error'), [], statement);
 }
});
test('negative corpus finds expression, assignment, branch and argument errors in exact ranges', () => {
 const statements = ['MODE 1 2','A=MODE','LET A B=1','A(1,)=2','DIM A','READ 2','NEXT 1','INK 1,','INK 1,2,3,4','ORIGIN 1,2,3','POKE &8000,1+*2','LOCATE #,1,2','LOAD','OPENIN','WAIT 1','SOUND 1','SPEED FOO 1','SPEED INK 1','IF A THEN MODE','IF A THEN ELSE END','IF A THEN END ELSE','IF A THEN X=','IF A THEN POKE 1,','FOR I= TO 3','FOR I=1 TO','FOR I=1 TO 3 STEP','ON A GOTO','ON ERROR GOSUB 100','AFTER 1 GOTO 100','EVERY 1, GOSUB 100','END 2','WRITE 1+*2','PRINT 1+'];
 for (const statement of statements) {
  const source = `10 ${statement}\n100 END`;
  const errors = analyzeEditor(source).diagnostics.filter(d => d.severity === 'error');
  assert.ok(errors.length, statement);
  assert.ok(errors.every(d => d.line === 1 && d.start >= 3 && d.end > d.start && d.end <= source.split('\n')[0]!.length), statement);
 }
});
test('opaque forms remain visible without inventing success or rejecting native output adjacency', () => {
 const result = analyzeEditor('10 DATA UNKNOWN,(,"A:B":|EXT,@A\n20 DEF FNx(A)=A+1\n30 PRINT "A" 2 "B";\n40 IF A THEN IF B THEN100 ELSE200\n100 END\n200 END');
 assert.deepEqual(result.diagnostics, []); assert.ok(result.coverage.opaque >= 5);
 assert.ok(result.inspections.some(item => item.reason.includes('imbriquées')));
});
test('resource and recursion limits give explicit partial coverage and bounded output', () => {
 for (const source of ['10 A=' + '('.repeat(400) + '1' + ')'.repeat(400), '10 A=' + '-'.repeat(800) + '1', '10 A=' + Array(500).fill('1').join('^')]) {
  const result = analyzeEditor(source); assert.equal(result.diagnostics.length, 0); assert.ok(result.coverage.opaque > 0);
 }
 assert.ok(analyzeEditor('10 REM ' + 'X'.repeat(8193)).coverage.limited);
 assert.equal(analyzeEditor('10 END\n'.repeat(10001)).diagnostics[0]?.code, 'analysis-limit');
 assert.equal(analyzeEditor('X'.repeat(ANALYSIS_LIMITS.characters + 1)).diagnostics[0]?.code, 'analysis-limit');
 const many = analyzeEditor(Array.from({ length: 1500 }, (_, i) => `${i + 1} PRONT`).join('\n'));
 assert.equal(many.diagnostics.length, 500); assert.equal(many.coverage.limited, true);
 const dense = analyzeEditor(Array.from({ length: 20 }, (_, i) => `${i + 1} ${Array(501).fill('GOTO 20').join(':')}`).join('\n'));
 assert.deepEqual(dense.diagnostics, []); assert.equal(dense.references.length, 10000); assert.equal(dense.coverage.limited, true);
});
test('lexical LRU preserves fresh semantic analysis through edits, insertion and target removal', () => {
 const inspect = createAnalysisEngine();
 const original = '10 GOTO 100\n100 A=1';
 const cold = inspect({ id: 'a', revision: 1, source: original }); assert.equal(cold.cacheMisses, 2);
 const warm = inspect({ id: 'a', revision: 2, source: original }); assert.equal(warm.cacheHits, 2); assert.equal(warm.cacheMisses, 0);
 for (const [i, source] of ['\n' + original, '10 GOTO 100\n200 A=1', '10 GOTO 100\n100 A=2'].entries()) assert.deepEqual(inspect({ id: 'a', revision: i + 3, source }).analysis, analyzeEditor(source));
 const large = Array.from({ length: 8000 }, (_, i) => `${i + 1} A=MAX(1,2)+B(3)*4`).join('\n');
 const bounded = inspect({ id: 'b', revision: 1, source: large }); assert.ok(bounded.cacheTokens <= 50000);
});

function harness() {
 let now = 0, next = 0; const timers = new Map<number, { at: number; fn(): void }>();
 const sent: AnalysisRequest[] = []; let restarts = 0;
 const service = new AnalysisCoordinator(request => sent.push(request), () => undefined, () => restarts++, { later(fn, ms) { const id = ++next; timers.set(id, { at: now + ms, fn }); return id; }, cancel(id) { timers.delete(id as number); } });
 const engine = createAnalysisEngine();
 return { service, sent, timers, restarts: () => restarts, reply: (request: AnalysisRequest) => service.receive(engine(request)), tick(ms: number) {
  now += ms;
  for (;;) { const due = [...timers].find(([, timer]) => timer.at <= now); if (!due) break; timers.delete(due[0]); due[1].fn(); }
 } };
}
test('scheduler coalesces typing, prioritizes active source, serializes work and stays idle', () => {
 const h = harness(); h.service.update([{ id: 'a', source: '10 MODE' }, { id: 'b', source: '10 END' }], 'b');
 h.tick(100); h.service.update([{ id: 'a', source: '10 MODE 1' }, { id: 'b', source: '10 END' }], 'b');
 h.tick(199); assert.equal(h.sent.length, 0); h.tick(1); assert.equal(h.sent[0]?.id, 'b');
 h.reply(h.sent[0]!); assert.equal(h.sent.length, 2); h.reply(h.sent[1]!);
 h.tick(60000); assert.equal(h.sent.length, 2); assert.equal(h.timers.size, 0);
 assert.equal(h.service.snapshot().accepted, 2); h.service.dispose();
});
test('late revisions, undo and removed documents cannot publish old diagnostics', () => {
 const h = harness(); h.service.update([{ id: 'a', source: '10 MODE' }], 'a'); h.tick(200); const old = h.sent[0]!;
 h.service.update([{ id: 'a', source: '10 MODE 1' }], 'a'); h.service.update([{ id: 'a', source: '10 MODE' }], 'a');
 h.reply(old); assert.equal(h.service.snapshot().accepted, 0); h.tick(200); const newer = h.sent[1]!;
 assert.notEqual(newer.revision, old.revision); h.service.update([{ id: 'b', source: '10 END' }], 'b'); h.reply(newer);
 assert.equal(h.service.snapshot().discarded, 2); h.tick(200); h.reply(h.sent[2]!); assert.deepEqual(h.service.snapshot().entries.map(entry => entry.id), ['b']);
 h.service.dispose();
});
test('hidden windows defer new work, timeout fails boundedly and retry is explicit', () => {
 const h = harness(); h.service.suspend(true); h.service.update([{ id: 'a', source: '10 MODE' }], 'a'); h.tick(200); assert.equal(h.sent.length, 0);
 h.service.suspend(false); const old = h.sent[0]!; h.tick(5000); assert.equal(h.restarts(), 1); assert.ok(h.service.snapshot().entries[0]?.error);
 h.tick(60000); assert.equal(h.sent.length, 1); h.service.retry(); assert.equal(h.sent.length, 2);
 h.reply(old); assert.equal(h.service.snapshot().running, true); h.reply(h.sent[1]!); assert.equal(h.service.snapshot().accepted, 1);
 h.service.dispose(); assert.equal(h.timers.size, 0);
});
test('worker exception fails every pending source without a restart storm', () => {
 const h = harness(); h.service.update([{ id: 'a', source: '10 END' }, { id: 'b', source: '10 END' }], 'a'); h.tick(200);
 h.service.fail('Indisponible', true); h.tick(60000); assert.equal(h.sent.length, 1); assert.equal(h.restarts(), 1);
 assert.ok(h.service.snapshot().entries.every(entry => entry.error)); h.service.dispose();
});
test('oversized buffers do not copy their full contents into the worker', () => {
 const h = harness(); const source = 'X'.repeat(ANALYSIS_LIMITS.characters * 3);
 h.service.update([{ id: 'a', source }], 'a'); h.tick(200);
 assert.equal(h.sent[0]!.source.length, ANALYSIS_LIMITS.characters + 1); h.reply(h.sent[0]!);
 assert.equal(h.service.snapshot().entries[0]?.source, source);
 assert.equal(h.service.snapshot().entries[0]?.result?.analysis.diagnostics[0]?.code, 'analysis-limit'); h.service.dispose();
});
