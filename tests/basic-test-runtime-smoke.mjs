// Explicit test input only: never distribute the supplied ROMs or embed them in reports.
import assert from 'node:assert/strict';
import { conditionalErrorCases } from './fixtures/conditional-error-cases.ts';
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
async function recipe(name, source, outcome, seconds = 3, probes = {}) {
 const disk = buildListingDisk(source), image = { disk, entry: 'MAIN.BAS', label: name, sha256: await basicTestHash(disk), roms, firmware: BASIC_TEST_FIRMWARE };
 const before = disk.slice(), cpc = await createCpc({ wasmBinary });
 const observed = {}, dispose = cpc._cpc_bridge_dispose;
 cpc._cpc_bridge_dispose = () => { for (const address of Object.keys(probes)) observed[address] = cpc._cpc_bridge_peek(Number(address)); dispose(); };
 const result = await executeBasicTests(cpc, image, basicTestPlan({ id: name, name, source }), seconds, async () => {});
 assert.ok(validBasicTestResult(result, basicTestPlan({ id: name, name, source })), `${name}: invalid result`);
 if (result.outcome !== outcome) console.error(name, result.cases);
 assert.equal(result.outcome, outcome, `${name}: ${result.message}`); assert.deepEqual(image.disk, before, 'Immutable DSK input');
 assert.equal(result.sourceSha256, await basicTestHash(new TextEncoder().encode(source)));
 assert.equal(cpc._cpc_bridge_step(20000), -2, 'Machine disposed on completion');
 assert.deepEqual(observed, probes, `${name}: RAM checkpoints before disposal`);
 results.push(result); console.log(`${name}: ${result.outcome} (${result.emulatedSeconds.toFixed(3)} s)`); return result;
}
// 0.40.6: saved statement boundaries, including skipped colons in another arm.
for (const mode of ['next', 'retry']) for (const specimen of conditionalErrorCases) {
 const [x, n] = specimen[mode];
 await recipe(`conditional-error-${mode}-${specimen.name}`, `10 REM @CPCTEST 1 Saved statement resume
20 MEMORY &7FFF:ON ERROR GOTO 1000:x=0:n=0:${specimen.setup}
30 ${specimen.code}
40 IF x=${x} AND n=${n} THEN POKE &8004,1 ELSE POKE &8004,2
50 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
60 GOTO 60
1000 n=n+1:a=1-a:b=1-b:IF n>1 THEN RESUME 40
1010 RESUME ${mode === 'next' ? 'NEXT' : ''}
`, 'passed');
}
for (const [a,b] of [[1,1],[1,0],[0,1],[0,0]]) {
 await recipe(`conditional-error-target-${a}-${b}`, `10 REM @CPCTEST 1 Explicit target leaves nested IF
20 MEMORY &7FFF:a=${a}:b=${b}:x=0:n=0:ON ERROR GOTO 1000
30 IF a THEN IF b THEN ERROR 5:x=99 ELSE ERROR 6:x=98 ELSE IF b THEN ERROR 7:x=97 ELSE ERROR 8:x=96
40 IF x=0 AND n=1 THEN POKE &8004,1 ELSE POKE &8004,2
50 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
60 GOTO 60
1000 n=n+1:RESUME 40
`, 'passed');
}
const conditionalErrorExample = await readFile('examples/control-flow/conditional-errors.bas','utf8');
await recipe('conditional-error-example', conditionalErrorExample.replace('10 REM Reprises conditionnelles', '10 REM @CPCTEST 1 Conditional error example').replace('20 ON ERROR', '15 MEMORY &7FFF\n20 ON ERROR').replace('90 PRINT "Resultat";x;y;z', '90 IF x=1 AND y=0 AND z=98 THEN POKE &8004,1 ELSE POKE &8004,2\n95 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165'), 'passed');

// 0.40.5: explicit error contexts, state changes and guarded conditional resumes.
const contextFinish = '900 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165\n910 GOTO 910\n';
await recipe('error-context-replace', `10 REM @CPCTEST 1 Replacement in handler
20 MEMORY &7FFF:n=0:ON ERROR GOTO 1000
30 ERROR 5:ERROR 6
40 IF n=11 THEN POKE &8004,1 ELSE POKE &8004,2
50 GOTO 900
${contextFinish}1000 n=n+1:ON ERROR GOTO 1100:RESUME NEXT
1100 n=n+10:RESUME NEXT
`, 'passed');
await recipe('error-context-retry', `10 REM @CPCTEST 1 Retry same ERROR
20 MEMORY &7FFF:n=0:ON ERROR GOTO 1000
30 ERROR 5
40 IF n=2 THEN POKE &8004,1 ELSE POKE &8004,2
50 GOTO 900
${contextFinish}1000 n=n+1:IF n=1 THEN RESUME ELSE RESUME 40
`, 'passed');
for (const [name, setup, expression, expected] of [['then','a=1','IF a THEN ERROR 5:x=1 ELSE x=99',1],['else','a=0','IF a THEN x=99 ELSE ERROR 5:x=2',0]]) {
 await recipe('error-context-'+name, `10 REM @CPCTEST 1 Conditional continuation
20 MEMORY &7FFF:ON ERROR GOTO 1000:${setup}:x=0
30 ${expression}
40 IF x=${expected} THEN POKE &8004,1 ELSE POKE &8004,2
50 GOTO 900
${contextFinish}1000 RESUME NEXT
`, 'passed');
}
for (const [name, command] of [['disable','ON ERROR GOTO 0'],['nested-error','ERROR 6'],['nested-replaced','ON ERROR GOTO 1100:ERROR 6']]) {
 await recipe('error-context-'+name, `10 REM @CPCTEST 1 Handler stops on rethrow or nested error
20 MEMORY &7FFF:POKE &8100,0:POKE &8101,0:ON ERROR GOTO 1000
30 ERROR 5:POKE &8101,1
40 GOTO 40
1000 POKE &8100,PEEK(&8100)+1:${command}:POKE &8101,2:RESUME NEXT
1100 POKE &8101,3:RESUME NEXT
`, 'timeout',3,{[0x8100]:1,[0x8101]:0});
}

for (const a of [0,1]) {
 await recipe('error-context-branch-'+a, `10 REM @CPCTEST 1 Conditional handler registration
20 MEMORY &7FFF:a=${a}:n=0
30 IF a THEN ON ERROR GOTO 1000 ELSE ON ERROR GOTO 1100
40 ERROR 5
50 IF n=${a ? 1 : 10} THEN POKE &8004,1 ELSE POKE &8004,2
60 GOTO 900
${contextFinish}1000 n=1:RESUME NEXT
1100 n=10:RESUME NEXT
`, 'passed');
}
const contextExample=await readFile('examples/control-flow/error-contexts.bas','utf8');
await recipe('error-context-example',contextExample.replace('10 REM Deux erreurs et remplacement du gestionnaire','10 REM @CPCTEST 1 Error contexts example').replace('20 total=0','15 MEMORY &7FFF\n20 total=0').replace('40 PRINT "Total";total','40 IF total=11 THEN POKE &8004,1 ELSE POKE &8004,2\n45 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165'),'passed');

// 0.40.4: qualified error resumes and asynchronous declarations.
const eventFinish = '900 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165\n910 GOTO 910\n';
await recipe('flow-error-retry', `10 REM @CPCTEST 1 Retry statement
20 MEMORY &7FFF:ON ERROR GOTO 1000
30 a=0:x=0
40 x=x+1:y=10/a:x=x+10
50 IF x=11 AND y=5 AND e=11 AND l=40 THEN POKE &8004,1 ELSE POKE &8004,2
60 GOTO 900
${eventFinish}1000 e=ERR:l=ERL:a=2:RESUME
`, 'passed');
await recipe('flow-error-next', `10 REM @CPCTEST 1 Next statement
20 MEMORY &7FFF:ON ERROR GOTO 1000
30 x=0
40 ERROR 5:x=11
50 IF x=11 AND e=5 AND l=40 THEN POKE &8004,1 ELSE POKE &8004,2
60 GOTO 900
${eventFinish}1000 e=ERR:l=ERL:RESUME NEXT
`, 'passed');
await recipe('flow-error-target', `10 REM @CPCTEST 1 Explicit target
20 MEMORY &7FFF:ON ERROR GOTO 1000
30 x=0
40 ERROR 5:x=99
50 x=98
60 IF x=0 THEN POKE &8004,1 ELSE POKE &8004,2
70 GOTO 900
${eventFinish}1000 RESUME 60
`, 'passed');
await recipe('flow-timer-sound-events', `10 REM @CPCTEST 1 AFTER once
11 REM @CPCTEST 2 EVERY cancel
12 REM @CPCTEST 3 DI defers
13 REM @CPCTEST 4 EI resumes
14 REM @CPCTEST 5 SQ once
20 MEMORY &7FFF:n=0
30 AFTER 1 GOSUB 1000
40 WHILE n=0:WEND
50 t=TIME+30:WHILE TIME<t:WEND
60 IF n=1 THEN POKE &8004,1 ELSE POKE &8004,2
70 n=0:EVERY 1,1 GOSUB 1100
80 WHILE n<3:WEND
90 t=TIME+30:WHILE TIME<t:WEND
100 IF n=3 THEN POKE &8005,1 ELSE POKE &8005,2
110 n=0:DI:AFTER 1,2 GOSUB 1000
120 t=TIME+30:WHILE TIME<t:WEND
130 IF n=0 THEN POKE &8006,1 ELSE POKE &8006,2
140 EI:WHILE n=0:WEND
150 IF n=1 THEN POKE &8007,1 ELSE POKE &8007,2
160 n=0:ON SQ(1) GOSUB 1000
170 WHILE n=0:WEND
180 t=TIME+30:WHILE TIME<t:WEND
190 IF n=1 THEN POKE &8008,1 ELSE POKE &8008,2
200 GOTO 900
${eventFinish}1000 n=n+1:RETURN
1100 n=n+1:IF n=3 THEN r=REMAIN(1)
1110 RETURN
`, 'passed', 5);

await recipe('flow-break-declarations', `10 REM @CPCTEST 1 Break modes are declarations
20 MEMORY &7FFF:n=0
30 ON BREAK GOSUB 1000
40 ON BREAK CONT
50 ON BREAK STOP
60 IF n=0 THEN POKE &8004,1 ELSE POKE &8004,2
70 GOTO 900
${eventFinish}1000 n=n+1:RETURN
`, 'passed');
await recipe('flow-error-disabled', `10 REM @CPCTEST 1 Disabled trap
20 MEMORY &7FFF:POKE &8100,0:POKE &8101,0
30 ON ERROR GOTO 1000
40 ON ERROR GOTO 0:POKE &8100,165
50 ERROR 5
60 GOTO 60
1000 POKE &8101,1:RESUME NEXT
`, 'timeout', 3, { [0x8100]: 165, [0x8101]: 0 });
await recipe('flow-resume-zero-unqualified', `10 REM @CPCTEST 1 Zero is not assumed to retry
20 MEMORY &7FFF:POKE &8100,0:POKE &8101,0:ON ERROR GOTO 1000
30 a=0
40 x=10/a:POKE &8101,1
50 GOTO 50
1000 POKE &8100,165:a=2:RESUME 0
`, 'timeout', 3, { [0x8100]: 165, [0x8101]: 0 });

const eventExample = await readFile('examples/control-flow/events.bas', 'utf8');
await recipe('flow-event-example', eventExample.replace("10 REM Gestion d'erreur et minuteur unique", '10 REM @CPCTEST 1 Event example').replace('20 ON ERROR', '15 MEMORY &7FFF\n20 ON ERROR').replace('70 PRINT "Minuteur";ticks;"Suite";suite', '70 IF ticks=1 AND suite=1 THEN POKE &8004,1 ELSE POKE &8004,2\n75 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165'), 'passed');

// 0.40.3: execute real nested/recursive calls and selectors, independently of the graph.
await recipe('flow-returns', `10 REM @CPCTEST 1 Nested returns
11 REM @CPCTEST 2 Mutual recursion
12 REM @CPCTEST 3 ON zero
13 REM @CPCTEST 4 ON past list
14 REM @CPCTEST 5 ON selected return
15 REM @CPCTEST 6 Conditional return
20 MEMORY &7FFF
30 x=0:GOSUB 1000
40 IF x=11 THEN POKE &8004,1 ELSE POKE &8004,2
50 n=3:x=0:GOSUB 2000
60 IF x=6 THEN POKE &8005,1 ELSE POKE &8005,2
70 ON 0 GOSUB 4000,4100:POKE &8006,1
80 ON 3 GOSUB 4000,4100:POKE &8007,1
90 x=0:ON 1 GOSUB 1000,4000
100 IF x=11 THEN POKE &8008,1 ELSE POKE &8008,2
110 a=0:GOSUB 3000:POKE &8009,1
120 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
130 GOTO 130
1000 x=x+1:GOSUB 1100:RETURN
1100 x=x+10:RETURN
2000 IF n=0 THEN RETURN
2010 x=x+n:n=n-1:GOSUB 2100:RETURN
2100 GOSUB 2000:RETURN
3000 IF a THEN END ELSE RETURN
4000 END
4100 STOP
`, 'passed', 5);
for (const [name, ending] of [['end','END'],['stop','STOP'],['cycle','GOTO 210']]) {
 await recipe(`flow-no-return-${name}`, `10 REM @CPCTEST 1 Continuation must not run
20 MEMORY &7FFF:POKE &8100,0:POKE &8101,0
30 GOSUB 100:POKE &8101,1
40 POKE &8004,1:POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
50 GOTO 50
100 GOSUB 200:RETURN
200 POKE &8100,165
210 ${ending}
`, 'timeout', 3, { [0x8100]: 165, [0x8101]: 0 });
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
