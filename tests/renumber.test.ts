import test from 'node:test';
import assert from 'node:assert/strict';
import { planRenumber, applyRenumber } from '../packages/basic-language/src/renumber.ts';
const options = { start: 1000, step: 10, from: 1, to: 65535 };

test('renumber preserves whitespace, blank lines, strings, DATA and comments while rewriting actual references', () => {
  const source = ' 10 IF A THEN100 ELSE200:PRINT "100":DATA 100,"A:B":GOTO 200\n\n100 REM GOTO 10\n200 PRINT "100":\' GOTO 100\n';
  const plan = planRenumber(source, options);
  assert.equal(plan.after, ' 1000 IF A THEN1010 ELSE1020:PRINT "100":DATA 100,"A:B":GOTO 1020\n\n1010 REM GOTO 10\n1020 PRINT "100":\' GOTO 100\n');
  assert.equal(plan.edits.filter(item => item.kind === 'reference').length, 3);
  assert.equal(source, plan.before);
  assert.equal(applyRenumber(plan, source), plan.after);
  assert.throws(() => applyRenumber(plan, source + '\n'), /changé/);
});

test('ON lists, timer/sound/break handlers, RESUME, RESTORE and numeric RUN are local; error-disable is statement scoped', () => {
  const source = '10 ON N GOTO 100,200:ON ERROR GOTO 0\n20 ON ERROR GOTO 100:ON M GOSUB 200,100\n30 AFTER 100,1 GOSUB 100:EVERY 200,2 GOSUB 200\n40 ON SQ(1) GOSUB 100:ON BREAK GOSUB 200\n50 RESTORE 100:RESUME 200:RUN 100\n60 RESUME NEXT:RESTORE:RUN\n100 RETURN\n200 END';
  const result = planRenumber(source, options).after;
  assert.match(result, /1000 ON N GOTO 1060,1070:ON ERROR GOTO 0/);
  assert.match(result, /ON ERROR GOTO 1060:ON M GOSUB 1070,1060/);
  assert.match(result, /AFTER 100,1 GOSUB 1060:EVERY 200,2 GOSUB 1070/);
  assert.match(result, /ON SQ\(1\) GOSUB 1060:ON BREAK GOSUB 1070/);
  assert.match(result, /RESTORE 1060:RESUME 1070:RUN 1060/);
  assert.match(result, /1050 RESUME NEXT:RESTORE:RUN/);
});

test('partial range rewrites references outside it and leaves external file numbers untouched', () => {
  const source = '10 GOTO 100\n20 RUN "OTHER.BAS":CHAIN "MORE.BAS",100\n100 GOSUB 200\n200 END';
  const plan = planRenumber(source, { ...options, from: 100, to: 200 });
  assert.equal(plan.after, '10 GOTO 1000\n20 RUN "OTHER.BAS":CHAIN "MORE.BAS",100\n1000 GOSUB 1010\n1010 END');
  assert.equal(plan.warnings.length, 1);
});

test('ambiguity, indirect targets, unsupported line operations and missing targets block without changing the source', () => {
  for (const statement of ['GOTO N+1', 'GOTO 100+0', 'ON N GOTO 100,N', 'IF A THEN N', 'IF A THEN (100)', 'RESTORE N',
    'RESUME 0', 'GOTO 0', 'GOTO 999', 'LIST 10-100', 'DELETE 100', 'EDIT 100', 'RENUM', 'AUTO', 'PRINT ERL',
    'CHAIN MERGE "OTHER",100', 'CHAIN F$,100', 'RUN N', '|UNKNOWN,100', 'GO TO 100', 'RESTORE100', 'UNKNOWN 100', 'IF A THEN ABS(100)']) {
    const source = `10 ${statement}\n100 END`;
    assert.throws(() => planRenumber(source, options), Error, statement);
  }
  assert.throws(() => planRenumber('10 PRINT "OPEN\n100 END', options), /ambiguë/);
  assert.throws(() => planRenumber('10 END\n10 END', options), /ambiguë/);
});

test('collisions, order, limits and invalid parameters are refused; numeric expressions in ordinary statements are untouched', () => {
  assert.throws(() => planRenumber('10 END\n20 END\n30 END', { start: 30, step: 10, from: 10, to: 20 }), /Collision/);
  assert.throws(() => planRenumber('10 END\n20 END', { ...options, start: 65535 }), /dépasse/);
  for (const value of [0, -1, 65536, 1.5, NaN]) assert.throws(() => planRenumber('10 END', { ...options, step: value }));
  assert.throws(() => planRenumber('10 END', { ...options, from: 20, to: 10 }), /inversée/);
  assert.throws(() => planRenumber('10 END', { ...options, from: 20 }), /Aucune/);
  assert.equal(planRenumber('10 A=100:IF A THEN PRINT 100 ELSE A=200\n100 END', options).after, '1000 A=100:IF A THEN PRINT 100 ELSE A=200\n1010 END');
  assert.equal(planRenumber('10 END', { ...options, start: 10 }).edits.length, 0);
});

test('refactoring budgets are checked before scanning a large source', () => {
  assert.throws(() => planRenumber('10 REM ' + 'X'.repeat(4096), options), /4096/);
  assert.throws(() => planRenumber('10 END' + '\n'.repeat(10001), options), /10 000/);
  assert.throws(() => planRenumber('10 REM ' + 'X'.repeat(1024 * 1024), options), /1 Mio/);
});
