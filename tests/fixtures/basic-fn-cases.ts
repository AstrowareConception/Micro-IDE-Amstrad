/** Small, independent witnesses for the identified 6128 English ROM.
 * Expectations are checked by the firmware runner, never by a BASIC simulation.
 * Scope conclusions and exclusions: docs/implementation/basic-fn-qualification.md.
 */
export interface BasicFnCase {
 name: string;
 body: string;
 expected: string;
 error?: number;
 errorLine?: number;
}

export const basicFnCases: readonly BasicFnCase[] = [
 { name: 'zero-arguments', body: '30 DEF FNanswer=42\n40 result=FNanswer', expected: 'result=42' },
 { name: 'one-argument', body: '30 DEF FNdouble(x)=x*2\n40 result=FNdouble(7)', expected: 'result=14' },
 { name: 'multiple-arguments', body: '30 DEF FNsum(x,y,z)=x+10*y+100*z\n40 result=FNsum(1,2,3)', expected: 'result=321' },
 { name: 'case-and-space', body: '30 DEF FN Double(x)=x*2\n40 result=fnDOUBLE(7)', expected: 'result=14' },
 { name: 'global-restored', body: '30 x=99:DEF FNdouble(x)=x*2\n40 result=FNdouble(7)', expected: 'result=14 AND x=99' },
 { name: 'free-variable-live', body: '30 base=10:DEF FNsum(x)=x+base\n40 first=FNsum(2):base=20:second=FNsum(2)', expected: 'first=12 AND second=22' },
 { name: 'nested-local', body: '30 x=99:DEF FNinner(x)=x*2\n40 DEF FNouter(x)=FNinner(x+1)+x\n50 result=FNouter(3)', expected: 'result=11 AND x=99' },
 { name: 'nested-free-variable', body: '30 x=99:DEF FNinner(y)=x+y\n40 DEF FNouter(x)=FNinner(2)+x\n50 result=FNouter(3)', expected: 'result=104 AND x=99' },
 { name: 'argument-before-binding', body: '30 x=10:y=20:DEF FNpair(x,y)=x*100+y\n40 result=FNpair(1,x)', expected: 'result=110 AND x=10 AND y=20' },
 { name: 'scalar-array', body: '30 DIM x(2):x=99:x(1)=7:DEF FNvalue(x)=x+x(1)\n40 result=FNvalue(3)', expected: 'result=10 AND x=99 AND x(1)=7' },
 { name: 'explicit-integer', body: '30 x%=99:DEF FNdouble%(x%)=x%*2\n40 result%=FNdouble%(7)', expected: 'result%=14 AND x%=99' },
 { name: 'explicit-real', body: '30 x!=99:DEF FNhalf!(x!)=x!/2\n40 result!=FNhalf!(3)', expected: 'result!=1.5 AND x!=99' },
 { name: 'explicit-string', body: '30 x$="global":DEF FNwrap$(x$)="["+x$+"]"\n40 result$=FNwrap$("local")', expected: 'result$="[local]" AND x$="global"' },
 { name: 'typed-homonyms', body: '30 x%=7:x!=99:DEF FNvalue(x!)=x!+x%\n40 result=FNvalue(3)', expected: 'result=10 AND x%=7 AND x!=99' },
 { name: 'implicit-real-alias', body: '30 x!=99:DEF FNvalue(x)=x!+x\n40 result=FNvalue(3)', expected: 'result=6 AND x!=99' },
 { name: 'implicit-integer-alias', body: '30 DEFINT x:x%=99:DEF FNvalue(x)=x%+x\n40 result=FNvalue(3)', expected: 'result=6 AND x%=99' },
 { name: 'implicit-string', body: '30 DEFSTR x,w:x="global":DEF FNwrap(x)="["+x+"]"\n40 result$=FNwrap("local")', expected: 'result$="[local]" AND x="global"' },
 { name: 'function-variable-distinct', body: '30 value=7:DEF FNvalue(x)=x*2\n40 result=FNvalue(3)', expected: 'result=6 AND value=7' },
 { name: 'function-suffixes', body: '30 DEF FNvalue%=7:DEF FNvalue!=1.5:DEF FNvalue$="ok"\n40 a%=FNvalue%:b!=FNvalue!:c$=FNvalue$', expected: 'a%=7 AND b!=1.5 AND c$="ok"' },
 { name: 'function-default-letter', body: '30 DEFSTR v:DEF FNvalue="ok"\n40 result$=FNvalue$', expected: 'result$="ok"' },
 { name: 'parameter-type-at-call', body: '30 x!=99:x%=7:DEF FNvalue!(x)=x\n40 DEFINT x:result!=FNvalue!(3)', expected: 'result!=3 AND x!=99 AND x%=7' },
 { name: 'parameter-alias-after-type-change', body: '30 x!=99:x%=7:DEF FNvalue!(x)=x+x!\n40 DEFINT x:result!=FNvalue!(3)', expected: 'result!=102 AND x!=99 AND x%=7' },
 { name: 'parameter-type-between-calls', body: '30 x!=99:x%=7:DEF FNvalue!(x)=x+x!\n40 first!=FNvalue!(3)\n50 DEFINT x:second!=FNvalue!(3)\n60 DEFREAL x:third!=FNvalue!(4)', expected: 'first!=6 AND second!=102 AND third!=103 AND x!=99 AND x%=7' },
 { name: 'parameter-type-same-call-site', body: '30 x!=99:x%=7:DEF FNvalue!(x)=x+x!\n40 FOR i=1 TO 2\n50 IF i=2 THEN DEFINT x\n60 a!(i)=FNvalue!(3)\n70 NEXT i', expected: 'a!(1)=6 AND a!(2)=102 AND x!=99 AND x%=7' },
 { name: 'function-type-at-call', body: '30 DEF FNvalue=42\n40 DEFINT v:result=FNvalue', expected: 'result=0', error: 18, errorLine: 40 },
 { name: 'explicit-call-after-type-change', body: '30 DEF FNvalue=42\n40 DEFINT v:result=FNvalue!', expected: 'result=42' },
 { name: 'redefinition', body: '30 DEF FNvalue(x)=x+1\n40 first=FNvalue(3)\n50 DEF FNvalue(x)=x+2\n60 second=FNvalue(3)', expected: 'first=4 AND second=5' },
 { name: 'skipped-redefinition', body: '30 DEF FNvalue(x)=x+1\n40 IF 0 THEN DEF FNvalue(x)=x+2\n50 result=FNvalue(3)', expected: 'result=4' },
 { name: 'definition-after-call-text', body: '30 GOSUB 100:GOTO 60\n40 result=FNvalue(3):GOTO 800\n60 GOTO 40\n100 DEF FNvalue(x)=x+1:RETURN', expected: 'result=4' },
 { name: 'undefined', body: '30 result=FNmissing(1)', expected: 'result=0', error: 18, errorLine: 30 },
 { name: 'skipped-definition', body: '30 IF 0 THEN DEF FNvalue(x)=x+1\n40 result=FNvalue(3)', expected: 'result=0', error: 18, errorLine: 40 },
 { name: 'too-few-arguments', body: '30 DEF FNsum(x,y)=x+y\n40 result=FNsum(1)', expected: 'result=0', error: 2, errorLine: 40 },
 { name: 'too-many-arguments', body: '30 DEF FNvalue(x)=x\n40 result=FNvalue(1,2)', expected: 'result=0', error: 2, errorLine: 40 },
 { name: 'argument-type-error', body: '30 x=99:DEF FNvalue(x)=x+1\n40 result=FNvalue("bad")', expected: 'result=0 AND x=99', error: 13, errorLine: 40 },
 { name: 'result-type-error', body: '30 DEF FNvalue$(x)=x+1\n40 result$=FNvalue$(3)', expected: 'result$=""', error: 13, errorLine: 40 },
 { name: 'empty-definition-not-called', body: '30 DEF FNvalue()=1', expected: '1=1' },
 { name: 'empty-parameter-list', body: '30 DEF FNvalue()=1\n40 result=FNvalue()', expected: 'result=0', error: 2, errorLine: 40 },
 { name: 'empty-call-list', body: '30 DEF FNvalue=1\n40 result=FNvalue()', expected: 'result=1', error: 2, errorLine: 40 },
 { name: 'body-error-restores-parameter', body: '30 x=99:DEF FNvalue(x)=x MOD 0\n40 result=FNvalue(3)', expected: 'result=0 AND x=99', error: 11, errorLine: 40 },
 { name: 'duplicate-parameters', body: '30 x=99:DEF FNvalue(x,x)=x\n40 result=FNvalue(3,7)', expected: 'result=7 AND x=99' },
 { name: 'changed-arity', body: '30 DEF FNvalue(x)=x+1\n40 first=FNvalue(3):DEF FNvalue(x,y)=x+y\n50 second=FNvalue(3,7)', expected: 'first=4 AND second=10' },
];

export function basicFnListing(specimen: BasicFnCase): string {
 return `10 REM @CPCTEST 1 FN behavior
20 MEMORY &7FFF:ON ERROR GOTO 2000:POKE &8100,0:POKE &8101,0:POKE &8102,0
${specimen.body}
800 ON ERROR GOTO 0
810 IF (${specimen.expected}) AND PEEK(&8100)=${specimen.error ?? 0} AND PEEK(&8101)+256*PEEK(&8102)=${specimen.errorLine ?? 0} THEN POKE &8004,1 ELSE POKE &8004,2
900 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
910 GOTO 910
2000 POKE &8100,ERR:POKE &8101,ERL MOD 256:POKE &8102,INT(ERL/256):RESUME 800
`;
}
