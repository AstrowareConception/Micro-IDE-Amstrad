// Explicit test input only: never distribute the supplied ROMs or embed them in reports.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import createCpc from '../out/cpc.mjs';
import { buildListingDisk } from '../packages/basic-language/src/build.ts';
import { BASIC_TEST_EXAMPLE, basicTestPlan, validBasicTestResult } from '../packages/emulator/src/basic-tests.ts';
import { BASIC_TEST_FIRMWARE, basicTestHash, executeBasicTests } from '../packages/emulator/src/basic-test-runtime.ts';
const root = process.env.CPC_TEST_ROM_DIR;
if (!root) throw new Error('CPC_TEST_ROM_DIR requis : jeu 6128 anglais identifié hors dépôt.');
const roms = Object.fromEntries(await Promise.all(['os', 'basic', 'amsdos'].map(async role => [role, new Uint8Array(await readFile(join(root, `cpc6128_${role}.bin`)))])));
const wasmBinary = await readFile('out/cpc.wasm');
const results = [];
async function recipe(name, source, outcome, seconds = 3) {
 const disk = buildListingDisk(source), image = { disk, entry: 'MAIN.BAS', label: name, sha256: await basicTestHash(disk), roms, firmware: BASIC_TEST_FIRMWARE };
 const before = disk.slice(), cpc = await createCpc({ wasmBinary });
 const result = await executeBasicTests(cpc, image, basicTestPlan({ id: name, name, source }), seconds, async () => {});
 assert.ok(validBasicTestResult(result, basicTestPlan({ id: name, name, source })), `${name}: invalid result`);
 if (result.outcome !== outcome) console.error(name, result.cases);
 assert.equal(result.outcome, outcome, `${name}: ${result.message}`); assert.deepEqual(image.disk, before, 'Immutable DSK input');
 assert.equal(result.sourceSha256, await basicTestHash(new TextEncoder().encode(source)));
 assert.equal(cpc._cpc_bridge_step(20000), -2, 'Machine disposed on completion');
 results.push(result); console.log(`${name}: ${result.outcome} (${result.emulatedSeconds.toFixed(3)} s)`); return result;
}
const passed = await recipe('score-passed', BASIC_TEST_EXAMPLE, 'passed'); assert.deepEqual(passed.cases.map(test => test.outcome), ['passed', 'passed']);
// 0.40: qualify the control forms independently of the structural analyser.
await recipe('flow-control-forms', `10 REM @CPCTEST 1 FOR
11 REM @CPCTEST 2 IF ON GOSUB
12 REM @CPCTEST 3 WHILE
20 MEMORY &7FFF
30 c=0:FOR i=2 TO 1:c=c+1:NEXT i:n=c
40 x=0:IF 0 THEN x=99:x=98
50 IF 0 THEN x=97 ELSE x=x+1:x=x+2
60 ON 0 GOSUB 500,600
70 ON 3 GOTO 700,800
80 ON 1 GOSUB 500,600
90 GOSUB 600
100 WHILE c<3:c=c+1:WEND
110 WHILE 0:x=96:WEND
120 IF n=0 THEN 140
130 x=95
140 IF n=0 THEN POKE &8004,1 ELSE POKE &8004,2
141 IF x=14 THEN POKE &8005,1 ELSE POKE &8005,2
142 IF c=3 THEN POKE &8006,1 ELSE POKE &8006,2
150 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
160 GOTO 160
500 x=x+1:RETURN
600 x=x+10:RETURN
700 x=94:GOTO 140
800 x=93:GOTO 140
`, 'passed');
// 0.40.1: independent truth tables, not the analyser's own branch association.
// Generated here to avoid 27 separate boots; each slot is still a native BASIC assertion.
const branchCases = [];
for (const a of [0, 1]) for (const b of [0, 1]) {
 const setup = `a=${a}:b=${b}:x=0`;
 branchCases.push({ name: `nested-${a}-${b}`, code: [setup, 'IF a THEN IF b THEN x=1 ELSE x=2 ELSE x=3:x=x+10'], expected: a ? b ? 1 : 2 : 13 });
 branchCases.push({ name: `chain-${a}-${b}`, code: [setup, 'IF a THEN x=1 ELSE IF b THEN x=2 ELSE x=3:x=x+10'], expected: a ? 1 : b ? 2 : 13 });
 branchCases.push({ name: `missing-outer-else-${a}-${b}`, code: [setup, 'IF a THEN IF b THEN x=1 ELSE x=2'], expected: a ? b ? 1 : 2 : 0 });
 branchCases.push({ name: `literal-${a}-${b}`, code: [setup, 'GOSUB 5000'], expected: a ? b ? 1 : 2 : 3 });
 for (const c of [0, 1]) branchCases.push({ name: `triple-${a}-${b}-${c}`, code: [setup + `:c=${c}`, 'IF a THEN IF b THEN IF c THEN x=1 ELSE x=2 ELSE x=3 ELSE x=4'], expected: a ? b ? c ? 1 : 2 : 3 : 4 });
}
branchCases.push({ name: 'next-pair', code: ['x=0:FOR i=1 TO 2:FOR j=1 TO 3:x=x+1:NEXT j,i'], expected: 6 });
branchCases.push({ name: 'next-negative-step', code: ['x=0:FOR i=1 TO 2:FOR j=3 TO 1 STEP -1:FOR k=1 TO 1:x=x+1:NEXT k,j,i'], expected: 6 });
branchCases.push({ name: 'next-separate-lines', code: ['x=0:FOR i=-2 TO -1', 'FOR j=0 TO 0', 'x=x+1', 'NEXT j,i'], expected: 2 });
const branchLines = ['MEMORY &7FFF'];
for (const [index, item] of branchCases.entries()) branchLines.push(`REM @CPCTEST ${index + 1} ${item.name}`, ...item.code, `IF x=${item.expected} THEN POKE &${(0x8004 + index).toString(16)},1 ELSE POKE &${(0x8004 + index).toString(16)},2`);
branchLines.push('POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165', 'GOTO 4000');
await recipe('flow-nested-forms', branchLines.map((line,index)=>`${(index+1)*10} ${line}`).join('\n') + '\n4000 GOTO 4000\n5000 IF a THEN IF b THEN 6000 ELSE 7000 ELSE 8000\n6000 x=1:RETURN\n7000 x=2:RETURN\n8000 x=3:RETURN\n', 'passed', 8);
const nestedExample = await readFile('examples/control-flow/nested.bas', 'utf8');
await recipe('flow-nested-example', nestedExample.replace('70 END', '70 IF total=21 THEN POKE &8004,1 ELSE POKE &8004,2') + '80 REM @CPCTEST 1 Total\n90 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165\n100 GOTO 100\n', 'passed');
// Glued words are not equivalent to keyword + line number. In the false arm,
// ELSE100 is skipped rather than recognised as ELSE; do not mask fall-through.
for (const [index, form] of ['GOTO100', 'GOSUB100', 'IF 1 THEN100', 'IF 0 THEN 100 ELSE100', 'GOTO 100', 'GOSUB 100', 'IF 1 THEN 100', 'IF 0 THEN 100 ELSE 100'].entries()) {
 const expected = index < 3 ? 'error' : index === 3 ? 'fallthrough' : 'target';
 await recipe(`flow-spacing-${index}`, `10 REM @CPCTEST 1 Spacing
20 MEMORY &7FFF:ON ERROR GOTO 900
30 ${form}
40 POKE &8004,${expected === 'fallthrough' ? 1 : 2}:GOTO 910
100 POKE &8004,${expected === 'target' ? 1 : 2}:GOTO 910
900 IF ERR=2 AND ${expected === 'error' ? 1 : 0} THEN POKE &8004,1 ELSE POKE &8004,2
910 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
920 GOTO 920
`, 'passed', 5);
}
await recipe('flow-keyword-like-variables', `10 REM @CPCTEST 1 Identifiers
20 MEMORY &7FFF
30 GOTO100=7:THEN100=9:x=GOTO100+THEN100
40 IF x=16 THEN POKE &8004,1 ELSE POKE &8004,2
50 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
60 GOTO 60
`, 'passed');
// 0.40.2: qualify loop skip continuations and branch-contained loops on real ROM.
const loopCases = [
 ['skip-inner-separate', ['x=0:FOR i=1 TO 2:FOR j=2 TO 1:x=x+1:NEXT j:NEXT i:x=x+10'], 10],
 ['skip-inner-lines', ['x=0','FOR i=1 TO 2','FOR j=2 TO 1','x=x+1','NEXT j','NEXT i','x=x+10'], 10],
 ['skip-outer-list', ['x=0:FOR i=2 TO 1:FOR j=1 TO 2:x=x+1:NEXT j,i:x=x+10'], 10],
 ['skip-outer-triple', ['x=0:FOR i=2 TO 1:FOR j=1 TO 2:FOR k=1 TO 1:x=x+1:NEXT k,j,i:x=x+10'], 10],
 ['skip-outer-separate', ['x=0:FOR i=2 TO 1:FOR j=1 TO 2:x=x+1:NEXT j:NEXT i:x=x+10'], 10],
 ['then-for', ['x=0:a=1','IF a THEN FOR i=1 TO 2:x=x+1:a=0:NEXT i:x=x+10 ELSE x=99'], 12],
 ['then-skipped', ['x=0','IF 0 THEN FOR i=1 TO 2:x=x+1:NEXT i:x=x+10 ELSE x=x+20'], 20],
 ['then-for-skip', ['x=0','IF 1 THEN FOR i=2 TO 1:x=x+1:NEXT i:x=x+10 ELSE x=99'], 10],
 ['else-for', ['x=0','IF 0 THEN x=99 ELSE FOR i=1 TO 2:x=x+1:NEXT i:x=x+10'], 12],
 ['then-while', ['x=0:a=1','IF a THEN WHILE x<3:x=x+1:a=0:WEND:x=x+10 ELSE x=99'], 13],
 ['then-while-skip', ['x=0','IF 1 THEN WHILE 0:x=x+1:WEND:x=x+10 ELSE x=99'], 10],
 ['else-while', ['x=0','IF 0 THEN x=99 ELSE WHILE x<3:x=x+1:WEND:x=x+10'], 13],
 ['skip-for-around-while', ['x=0:FOR i=2 TO 1:WHILE 1:x=x+1:WEND:NEXT i:x=x+10'], 10],
 ['skip-while-around-for', ['x=0:WHILE 0:FOR i=1 TO 2:x=x+1:NEXT i:WEND:x=x+10'], 10],
 ['skip-while-around-while', ['x=0:WHILE 0:WHILE 1:x=x+1:WEND:WEND:x=x+10'], 10],
 ['for-skip-in-while', ['x=0:c=2:WHILE c>0:FOR i=2 TO 1:x=x+1:NEXT i:c=c-1:WEND:x=x+10'], 10],
 ['outer-negative-step', ['x=0:s=-1:FOR i=3 TO 1 STEP s:FOR j=1 TO 2:x=x+1:NEXT j,i:x=x+10'], 16],
 ['skip-outer-negative-step', ['x=0:s=-1:FOR i=1 TO 3 STEP s:FOR j=1 TO 2:x=x+1:NEXT j,i:x=x+10'], 10],
 ['nested-then-loops', ['x=0','IF 1 THEN IF 1 THEN FOR i=1 TO 2:WHILE x<3:x=x+1:WEND:NEXT i ELSE x=99 ELSE x=98'], 3],
];
for (const n of [0,2]) loopCases.push([`outer-bound-${n}`, [`x=0:n=${n}:FOR i=1 TO n:FOR j=1 TO 3:x=x+1:NEXT j,i:x=x+10`], 10+3*n]);
for (const a of [0,1]) {
 loopCases.push([`alternative-for-${a}`, [`x=0:a=${a}`, 'IF a THEN FOR i=1 TO 2:x=x+1:NEXT i ELSE FOR i=1 TO 3:x=x+1:NEXT i'], a ? 2 : 3]);
 loopCases.push([`conditional-list-${a}`, [`x=0:a=${a}:n=2`, 'IF a THEN FOR i=1 TO n:FOR j=1 TO 3:x=x+1:NEXT j,i:x=x+10 ELSE x=20'], a ? 16 : 20]);
}
const loopLines = ['MEMORY &7FFF'];
for (const [index, [name, code, expected]] of loopCases.entries()) loopLines.push(`REM @CPCTEST ${index+1} ${name}`, ...code, `IF x=${expected} THEN POKE &${(0x8004+index).toString(16)},1 ELSE POKE &${(0x8004+index).toString(16)},2`);
loopLines.push('POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165', 'GOTO 4000');
await recipe('flow-loop-scopes', loopLines.map((line,index)=>`${(index+1)*10} ${line}`).join('\n')+'\n4000 GOTO 4000\n', 'passed', 10);
const conditionalExample = await readFile('examples/control-flow/conditional-loops.bas', 'utf8');
await recipe('flow-loop-example', conditionalExample.replace('80 END','80 IF total=15 THEN POKE &8004,1 ELSE POKE &8004,2')+'90 REM @CPCTEST 1 Total\n100 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165\n110 GOTO 110\n', 'passed', 5);
const failed = await recipe('score-failed', BASIC_TEST_EXAMPLE.replace('score=150 THEN', 'score=151 THEN'), 'failed'); assert.deepEqual(failed.cases.map(test => test.outcome), ['failed', 'passed']);
await recipe('missing-assertion', BASIC_TEST_EXAMPLE.replace('70 IF score=100 THEN POKE &8005,1 ELSE POKE &8005,2', '70 REM assertion deliberately omitted'), 'incomplete');
await recipe('infinite-loop', '10 REM @CPCTEST 1 Loop\n20 GOTO 20\n', 'timeout');
await recipe('basic-error', '10 REM @CPCTEST 1 Error\n20 ERROR 33\n', 'timeout');
await recipe('input-wait', '10 REM @CPCTEST 1 Input\n20 INPUT a$\n', 'timeout');
for (const name of ['score', 'collision']) {
 const source = await readFile(`examples/basic-test-suite/src/tests-${name}.bas`, 'utf8');
 const example = await recipe(`suite-example-${name}`, source, 'passed');
 assert.equal(example.cases.length, 2);
}
const scenario = await readFile('examples/basic-test-suite/src/tests-scenario.bas', 'utf8');
const scenarioPass = await recipe('scenario-pass', scenario, 'passed', 8);
assert.deepEqual(scenarioPass.observations.map(item => item.outcome), ['passed', 'passed']);
const scenarioRepeat = await recipe('scenario-repeat', scenario, 'passed', 8);
assert.deepEqual(scenarioRepeat.observations, scenarioPass.observations); assert.equal(scenarioRepeat.emulatedSeconds, scenarioPass.emulatedSeconds);
const wrongFile = await recipe('scenario-wrong-file', scenario.replace('@CPCFILE RESULT.TXT "42', '@CPCFILE RESULT.TXT "43'), 'failed', 8);
assert.equal(wrongFile.cases[0].outcome, 'passed'); assert.equal(wrongFile.observations[0].outcome, 'failed');
const wrongScreen = await recipe('scenario-wrong-screen', scenario.replace(/(@CPCSCREEN bord 0 0 8 8 )[a-f0-9]{64}/, '$1' + '0'.repeat(64)), 'failed', 8);
assert.equal(wrongScreen.observations[1].outcome, 'failed'); assert.equal(wrongScreen.observations[0].outcome, 'passed');
await recipe('scenario-no-input', scenario.replace('40 REM @CPCINPUT 3000 "21\\r"', '40 REM no input'), 'timeout', 4);
const early = await recipe('scenario-premature-end', BASIC_TEST_EXAMPLE + '1020 REM @CPCINPUT 3000 "x"\n', 'blocked', 5);
assert.match(early.message, /avant la fin des saisies/);
await writeFile('out/basic-test-runtime.json', JSON.stringify({ results, independentEmulator: false, physicalCpc: false }, null, 2));
