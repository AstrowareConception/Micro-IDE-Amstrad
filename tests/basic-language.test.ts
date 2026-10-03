import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COMMANDS, REFERENCE } from '../packages/basic-language/src/catalog.ts';
import { tokenize, analyze, completionContext, commandAt } from '../packages/basic-language/src/language.ts';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { readDataDisk, decodeAsciiRecords } from '../packages/cpc-disk/src/data-disk.ts';

test('editorial cards retain the exact source digest and valid source locations', () => {
  const bytes = readFileSync('knowledge/locomotive-basic/originals/command-reference.txt');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), REFERENCE.sha256);
  const lines = bytes.toString().split('\n');
  for (const card of COMMANDS) assert.ok(lines[card.line - 1]?.startsWith(card.name), `${card.name}:${card.line}`);
  assert.ok(!COMMANDS.some(c => ['INTRS', 'GET', 'PUT'].includes(c.name)));
});
test('CPC literals, variables, case and compact targets are tokenized', () => {
  const tokens = tokenize('10 if score%= &X101 THEN100:print "GOTO 999":x!=&hFF:a$="OK"');
  assert.ok(tokens.some(t => t.text === 'score%' && t.kind === 'identifier'));
  assert.ok(tokens.some(t => t.text === '&X101' && t.kind === 'number'));
  assert.ok(tokens.some(t => t.text === '&hFF' && t.kind === 'number'));
  assert.ok(tokens.some(t => t.text.toUpperCase() === 'THEN' && t.kind === 'keyword'));
  assert.equal(analyze('10 IF A THEN100\n100 END').diagnostics.length, 0);
});
test('DATA, REM, apostrophes and strings are opaque to reference analysis', () => {
  const source = '10 DATA GOTO 999,"A:B",REM\n20 REM GOTO 888:PRINT "\n30 PRINT "GOTO 777":\' GOTO 666\n40 DATA "GOTO 555":GOTO 50\n50 END';
  const result = analyze(source);
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.references.map(r => r.number), [50]);
  assert.equal(commandAt('10 REM MODE', 8), undefined);
  assert.equal(commandAt('10 PRINT "MODE"', 12), undefined);
  assert.equal(commandAt('10 print "OK"', 5)?.name, 'PRINT');
});
test('diagnostics are limited to certain errors and export constraints', () => {
  const result = analyze('0 PRINT "\n10 GOTO 999\n10 END\nPRINT "BONJOUR"\n65536 END\n20 PRINT "é"');
  for (const code of ['line-range', 'unclosed-string', 'missing-target', 'line-order', 'line-number', 'export-ascii'])
    assert.ok(result.diagnostics.some(d => d.code === code), code);
  assert.equal(analyze('10 UNKNOWN X\n20 GOTO N+1\n30 ON ERROR GOTO 0\n40 CHAIN "OTHER",500').diagnostics.length, 0);
});
test('ON lists and THEN/ELSE targets navigate physical lines, not numeric positions', () => {
  const result = analyze('10 ON N GOTO 100,200\n20 IF A THEN100 ELSE200\n\n100 RETURN\n200 END');
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.references.map(r => r.number), [100, 200, 100, 200]);
  assert.equal(result.targets.find(t => t.number === 100)?.line, 4);
});
test('completion excludes non-code and proposes target context', () => {
  for (const line of ['10 REM PRINT', "10 'PRINT", '10 DATA PRINT', '10 PRINT "GOTO']) assert.equal(completionContext(line, line.length), 'none');
  assert.equal(completionContext('10 GOTO 10', 10), 'target');
  assert.equal(completionContext('10 DATA "A:B":PRI', 17), 'code');
  assert.equal(completionContext('10 PRINT "OK":PRI', 17), 'code');
});
test('DSK export preserves source and removes blank lines only from the artifact', () => {
  const source = '10 PRINT "OK"\n\n20 END\n';
  const disk = buildListingDisk(source);
  const files = readDataDisk(disk);
  assert.equal(files[0]?.name, 'MAIN.BAS');
  assert.equal(new TextDecoder().decode(decodeAsciiRecords(files[0]!.records)), '10 PRINT "OK"\r\n20 END\r\n\x1a');
  assert.equal(source, '10 PRINT "OK"\n\n20 END\n');
  assert.throws(() => buildListingDisk('10 GOTO 999'), /n’existe pas/);
});
test('uncertain string termination warns without blocking export; transport spacing is explicit', () => {
  const source = ' 10PRINT "OPEN\n20 END';
  const result = analyze(source);
  assert.equal(result.diagnostics[0]?.severity, 'warning');
  const bytes = buildListingDisk(source);
  assert.equal(new TextDecoder().decode(decodeAsciiRecords(readDataDisk(bytes)[0]!.records)), '10 PRINT "OPEN\r\n20 END\r\n\x1a');
  assert.equal(completionContext('10 DATA', 7), 'none');
});
