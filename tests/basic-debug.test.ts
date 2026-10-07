import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_DEBUG_PROFILE, basicDebuggerAvailable, firmwareKey, parseBreakpointLines, validBasicDebugSnapshot } from '../packages/emulator/src/basic-debug.ts';

const qualified = {
  os: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf',
  basic: '58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977',
  amsdos: 'ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d',
};

test('BASIC debugger is restricted to the firmware profile actually qualified', () => {
  assert.equal(firmwareKey(qualified), BASIC_DEBUG_PROFILE.firmwareKey);
  assert.equal(basicDebuggerAvailable(qualified), true);
  assert.equal(basicDebuggerAvailable({ ...qualified, basic: '0'.repeat(64) }), false);
});

test('breakpoint parser accepts bounded unique BASIC line numbers', () => {
  assert.deepEqual(parseBreakpointLines(''), []);
  assert.deepEqual(parseBreakpointLines('100, 10;100 20'), [10, 20, 100]);
  for (const invalid of ['0', '65536', '-10', '10.5', 'abc', Array.from({ length: 65 }, (_, i) => i + 1).join(',')]) {
    assert.equal(parseBreakpointLines(invalid), undefined);
  }
});

test('debug snapshots remain narrow and provenance-friendly', () => {
  assert.equal(validBasicDebugSnapshot({ line: 20, linePointer: 0x9000, statementPointer: 0x9006, ticks: 1234, reason: 'step' }), true);
  assert.equal(validBasicDebugSnapshot({ line: 0, linePointer: 0x9000, statementPointer: 0x9006, ticks: 1234, reason: 'step' }), false);
  assert.equal(validBasicDebugSnapshot({ line: 20, linePointer: 0x9000, statementPointer: 0x9006, ticks: -1, reason: 'breakpoint' }), false);
});
