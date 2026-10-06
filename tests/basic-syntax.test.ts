import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEditor } from '../packages/basic-language/src/syntax.ts';

test('editor syntax catches incomplete statements before executing and points at physical lines', () => {
 const result = analyzeEditor('10 PRONT "OK"\n20 MODE\n30 INK 1\n40 POKE &8000,\n50 IF A>0\n60 FOR I=1\n70 LET A\n80 PRINT (1+2\n90 A=1+\n100 MODE 3');
 for (const code of ['syntax-statement', 'syntax-operand', 'syntax-arguments', 'syntax-if', 'syntax-for', 'syntax-assignment', 'syntax-parenthesis', 'syntax-expression', 'mode-range']) assert.ok(result.diagnostics.some(item => item.code === code), code);
 assert.equal(result.diagnostics.find(item => item.code === 'syntax-statement')?.line, 1);
 assert.ok(result.diagnostics.every(item => item.end > item.start));
});

test('expression grammar checks ordinary assignments, MODE and IF without executing', () => {
 for (const statement of ['MODE 1 2', 'A=1+*2', 'A=', 'A=(1,)','IF A><2 THEN 20']) {
  assert.ok(analyzeEditor(`10 ${statement}\n20 END`).diagnostics.some(item => item.severity === 'error'), statement);
 }
 for (const statement of ['A=MAX(1,2)+B(3)^2', 'A=-2*3+4', 'A=NOT B AND C', 'A$="X"+CHR$(65)', 'IF A<=2 OR B<>3 THEN 20', 'A=1\\2 MOD 3']) {
  assert.equal(analyzeEditor(`10 ${statement}\n20 END`).diagnostics.filter(item => item.severity === 'error').length, 0, statement);
 }
});

test('native forms, comments, strings, DATA, RSX and optional branches do not acquire false syntax errors', () => {
 const programs = [
  '10 MODE 1:INK 0,0:INK 1,24\n20 PRINT "OK";\n30 FOR I=1 TO 5\n40 PRINT I\n50 NEXT I\n60 END',
  '10 DATA UNKNOWN,(,A+B,"X:Y":PRINT "OK"\n20 REM PRONT )\n30 \'MODE',
  '10 IF A THEN100 ELSE200\n100 RETURN\n200 END',
  '10 IF A GOTO 100\n100 END',
  '10 |DISC\n20 CHAIN "OTHER",500\n30 ON ERROR GOTO 0\n40 A(2)=1\n50 DEF FNtest(X)=X+1\n60 PRINT FNtest(2)',
  '10MODE1\n20 PRINT "OPEN\n30 PRINT MAX(1,2):POKE &8000,MAX(1,2)',
 ];
 for (const source of programs) assert.equal(analyzeEditor(source).diagnostics.filter(item => item.severity === 'error').length, 0, source);
});
