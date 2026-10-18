import type {ExpressionWitness} from './terminal-expression-fixtures.ts';

// Literal expectations include the counter after termination (or the skipped body).
const forCases=[
 {name:'up-zero',header:'2 TO 1',sum:0,after:2},
 {name:'up-one',header:'3 TO 3',sum:3,after:4},
 {name:'up-many-step-two',header:'1 TO 5 STEP 2',sum:9,after:7},
 {name:'down-zero',header:'1 TO 2 STEP -1',sum:0,after:1},
 {name:'down-one',header:'3 TO 3 STEP -2',sum:3,after:1},
 {name:'down-many-step-minus-two',header:'5 TO 1 STEP -2',sum:9,after:-1}
];
const whileCases=[
 {name:'up-zero',start:3,condition:'<3',update:'+1',sum:0,after:3},
 {name:'up-one',start:2,condition:'<3',update:'+1',sum:2,after:3},
 {name:'up-many-inclusive',start:1,condition:'<=5',update:'+2',sum:9,after:7},
 {name:'down-zero',start:1,condition:'>1',update:'-1',sum:0,after:1},
 {name:'down-one',start:2,condition:'>1',update:'-1',sum:2,after:1},
 {name:'down-many-inclusive',start:5,condition:'>=1',update:'-2',sum:9,after:-1}
];
export const loopWitnesses:ExpressionWitness[]=[
 ...forCases.map(c=>({name:'for-'+c.name,screenRows:0,oracle:null,expected:[c.sum,c.sum*2,c.after+20,205],
  source:`10 MEMORY &7FFF\n20 total%=0\n30 FOR index%=${c.header}\n40 total%=total%+index%\n50 NEXT index%\n60 POKE &8000,total%\n90 GOTO 100\n100 FOR index%=${c.header}\n110 total%=total%+index%\n120 NEXT index%\n130 POKE &8001,total%\n140 POKE &8002,index%+20\n150 POKE &8003,205\n160 END\n`
 })),
 ...whileCases.map(c=>({name:'while-'+c.name,screenRows:0,oracle:null,expected:[c.sum,c.sum*2,c.after+20,206],
  source:`10 MEMORY &7FFF\n20 total%=0\n30 index%=${c.start}\n40 WHILE index%${c.condition}\n50 total%=total%+index%\n60 index%=index%${c.update}\n70 WEND\n80 POKE &8000,total%\n90 GOTO 100\n100 index%=${c.start}\n110 WHILE index%${c.condition}\n120 total%=total%+index%\n130 index%=index%${c.update}\n140 WEND\n150 POKE &8001,total%\n160 POKE &8002,index%+20\n170 POKE &8003,206\n180 END\n`
 })),
 ...[0,1].map(flag=>({name:`sequential-for-while-display-${flag}`,screenRows:1,expected:[3,0,5+flag,207],
  source:`10 MEMORY &7FFF\n20 MODE 1\n25 text$=""\n30 flag%=${flag}\n35 IF flag%=0 THEN total%=0 ELSE total%=1\n40 FOR index%=1 TO 2\n50 text$=text$+"X"\n60 total%=total%+1\n70 NEXT index%\n80 POKE &8000,index%\n90 GOTO 100\n100 index%=3\n110 WHILE index%>0\n120 text$=text$+"Y"\n130 total%=total%+1\n140 index%=index%-1\n150 WEND\n160 IF total%>5 THEN PRINT "T ";text$;" ";total% ELSE PRINT "F ";text$;" ";total%\n170 POKE &8001,index%\n180 POKE &8002,total%\n190 POKE &8003,207\n200 END\n`,
  oracle:`10 MODE 1\n20 PRINT "${flag?'T':'F'} XXYYY";" ";${5+flag}\n30 END\n`
 }))
];
