import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeQuality, qualityMarkdown, QUALITY_LIMITS } from '../packages/basic-language/src/quality.ts';
const inspect = (source: string) => analyzeQuality([{ id: 'main', name: 'src/main.bas', source }]).sources[0]!;
test('quality metrics separate physical lines, BASIC code, comments and opaque values', () => {
 const source = '10 REM IF FOR WHILE GOTO\n20 PRINT "IF:FOR:GOTO"\n30 DATA IF,WHILE,"GOTO:FOR"\n40 IF A AND B THEN 50\n50 FOR I=1 TO 2:NEXT I\n60 WHILE A:WEND\n\n';
 const result = inspect(source), m = result.metrics!;
 assert.equal(m.physicalLines, 7); assert.equal(m.codeLines, 5); assert.equal(m.commentLines, 1); assert.equal(m.blankLines, 1);
 assert.equal(m.statements, 7); assert.equal(m.ifs, 1); assert.equal(m.fors, 1); assert.equal(m.whiles, 1); assert.equal(m.gotos, 0);
 assert.equal(m.estimatedCyclomatic, 4); assert.equal(m.characters, source.length); assert.equal(result.coverage.limited, false);
 assert.deepEqual(inspect('').metrics?.estimatedCyclomatic, 0);
});
test('selector outcomes include fall-through; event handlers and AND/OR add no lexical branches', () => {
 const result = inspect('10 ON X GOTO 100,200,300\n20 ON Y GOSUB 100,200\n30 ON ERROR GOTO 0\n40 ON BREAK GOSUB 100\n50 ON SQ(1) GOSUB 100\n60 IF A AND B OR C THEN 100');
 assert.equal(result.metrics!.selectorBranches, 5); assert.equal(result.metrics!.estimatedCyclomatic, 7);
 assert.equal(result.metrics!.gotos, 2); assert.equal(result.metrics!.gosubs, 3);
 const partial = inspect('10 ON X GOTO A+1\n20 IF A THEN ON X GOSUB 100,200');
 assert.equal(partial.metrics!.selectorBranches, 0); assert.equal(partial.coverage.limited, true); assert.equal(partial.coverage.reasons.length, 2);
});
test('readability observations ignore colon/keywords inside strings, comments and DATA', () => {
 const result = inspect('10 PRINT "a:b:c:d:e:f"\n20 DATA a:b:c:d:e:f\n30 REM A:B:C:D:E\n40 A=1:B=2:C=3:D=4:E=5\n50 IF A THEN IF B THEN IF C THEN PRINT 1\n60 PRINT "' + 'X'.repeat(130) + '"');
 // DATA is only opaque up to its next unquoted colon, so protect the values with quotes.
 const opaque = inspect('10 DATA "IF:IF:IF:A:B:C:D:E"\n20 PRINT "IF IF IF:a:b:c:d:e"');
 assert.equal(opaque.findings.length, 0);
 assert.ok(result.findings.some(f => f.code === 'dense-line' && f.basicLine === 40));
 assert.ok(result.findings.some(f => f.code === 'conditional-density' && f.basicLine === 50));
 const long = result.findings.find(f => f.code === 'long-line')!;
 assert.equal(long.basicLine, 60); assert.equal(long.line, 6); assert.equal(long.start, 3); assert.equal(long.confidence, 'observation');
});
test('unreachable-tail is restricted to unconditional literal GOTO/bare RETURN, preserving CONT and conditional cases', () => {
 const result = inspect('10 GOTO 100:PRINT 1\n20 RETURN:PRINT 2\n30 END:PRINT 3\n40 STOP:PRINT 4\n50 IF A THEN GOTO 100:PRINT 5\n60 ON X GOTO 100,200:PRINT 6\n70 GOTO X+1:PRINT 7\n80 GOTO 100:DATA 1,2');
 assert.deepEqual(result.findings.filter(f => f.code === 'unreachable-tail').map(f => [f.basicLine, f.start]), [[10, 12], [20, 10]]);
});
test('duplicate blocks ignore numbering, whitespace, keyword case and comments but preserve strings and targets', () => {
 const result = inspect('10 A=A+1:B=B+2\n20 PRINT "SCORE";A;B\n30 REM separator\n40 a = a + 1 : b = b + 2\n50 print "SCORE";a;b\n60 A=A+1:B=B+2\n70 PRINT "score";A;B');
 const f = result.findings.find(f => f.code === 'duplicate-block')!;
 assert.equal(f.basicLine, 10); assert.deepEqual(f.related.map(r => r.basicLine), [40]);
 assert.equal(inspect('10 DATA 1,2,3,4,5,6,7\n20 DATA 8,9,0,1,2,3\n30 DATA 1,2,3,4,5,6,7\n40 DATA 8,9,0,1,2,3').findings.length, 0);
});
test('quotas and malformed input expose incomplete coverage and never invent whole-program reachability', () => {
 const result = inspect('NO NUMBER\n10 PRINT "OPEN\n20 ' + 'A'.repeat(8193) + '\n30 END\n30 PRINT 1\n40 ' + 'A:'.repeat(2050) + '\n50 PRINT 2');
 assert.equal(result.coverage.limited, true); assert.equal(result.coverage.skippedLines, 5); assert.equal(result.metrics!.codeLines, 2);
 assert.equal(inspect('A'.repeat(QUALITY_LIMITS.characters + 1)).metrics, null);
 const limited = inspect(Array.from({ length: 10002 }, (_, i) => `${i + 1} A=1:B=2:C=3:D=4:E=5`).join('\n'));
 assert.equal(limited.metrics!.physicalLines, 10002); assert.equal(limited.coverage.skippedLines, 2); assert.equal(limited.findings.length, QUALITY_LIMITS.findings); assert.ok(limited.coverage.omittedFindings > 0);
 assert.throws(() => analyzeQuality(Array.from({ length: 101 }, () => ({ id: 'x', name: 'x', source: '' }))), /100 sources/);
 assert.throws(() => analyzeQuality(Array.from({ length: 5 }, () => ({ id: 'x', name: 'x', source: 'A'.repeat(QUALITY_LIMITS.characters) }))), /4 Mio/);
});
test('report exports metric method, thresholds, coverage and ranges without source code', () => {
 const report = analyzeQuality([{ id: 'x', name: 'evil<script>\n#name|', source: '10 RETURN:PRINT "PRIVATE"' }]), md = qualityMarkdown(report);
 assert.ok(md.includes('Estimation lexicale')); assert.ok(md.includes('Complexité cyclomatique estimée : 1')); assert.ok(md.includes('L1, C11')); assert.ok(md.includes('unreachable-tail'));
 assert.ok(md.includes('evil\\<script\\> \\#name\\|')); assert.ok(!md.includes('PRIVATE')); assert.ok(!JSON.stringify(report).includes('PRIVATE'));
 assert.deepEqual(report, analyzeQuality([{ id: 'x', name: 'evil<script>\n#name|', source: '10 RETURN:PRINT "PRIVATE"' }]));
});
