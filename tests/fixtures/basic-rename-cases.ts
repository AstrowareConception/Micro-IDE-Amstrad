/** Independent before/after witnesses, expectations evaluated by the CPC firmware. */
export const basicRenameCases = [
 {name:'scalar-case',before:'30 score=3:Score=score+2\n40 result=score',after:'30 points=3:points=points+2\n40 result=points',line:1,column:3,newStem:'points',expected:5},
 {name:'integer-loop',before:'30 total%=0\n40 FOR i%=1 TO 3:total%=total%+i%:NEXT i%\n50 result=total%',after:'30 total%=0\n40 FOR compteur%=1 TO 3:total%=total%+compteur%:NEXT compteur%\n50 result=total%',line:2,column:7,newStem:'compteur',expected:6},
 {name:'explicit-real',before:'30 measure!=1.5:result=measure!*2',after:'30 mesure!=1.5:result=mesure!*2',line:1,column:3,newStem:'mesure',expected:3},
 {name:'string',before:'30 name$="A":name$=name$+"B":result=LEN(name$)',after:'30 nom$="A":nom$=nom$+"B":result=LEN(nom$)',line:1,column:3,newStem:'nom',expected:2},
 {name:'array-scalar',before:'30 DIM score(2):score=5:score(1)=7\n40 result=score+score(1)',after:'30 DIM points(2):score=5:points(1)=7\n40 result=score+points(1)',line:1,column:7,newStem:'points',expected:12},
 {name:'erase-array',before:'30 DIM score(2):score(1)=7:ERASE score\n40 DIM score(3):score(1)=9:result=score(1)',after:'30 DIM points(2):points(1)=7:ERASE points\n40 DIM points(3):points(1)=9:result=points(1)',line:1,column:7,newStem:'points',expected:9},
 {name:'opaque-text',before:'30 READ score:DATA 7,score,"score"\n40 result=score:REM score',after:'30 READ points:DATA 7,score,"score"\n40 result=points:REM score',line:1,column:8,newStem:'points',expected:7},
 {name:'subroutine',before:'30 score=1:GOSUB 100:GOTO 200\n100 score=score+2:RETURN\n200 result=score',after:'30 points=1:GOSUB 100:GOTO 200\n100 points=points+2:RETURN\n200 result=points',line:1,column:3,newStem:'points',expected:3},
] as const;
