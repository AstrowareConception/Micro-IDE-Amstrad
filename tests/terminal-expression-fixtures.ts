export interface ExpressionWitness {name:string;source:string;expected:number[];screenRows:number;oracle:string|null}
export const expressionWitnesses:ExpressionWitness[]=[{
 name:'arithmetic-precedence-and-shared-integers',screenRows:0,oracle:null,expected:[34,69,12,201],
 source:'10 MEMORY &7FFF\n20 seed%=7\n30 score%=(seed%+5)*3-2\n40 POKE &8000,score%\n50 GOTO 100\n100 score%=score%*2+1\n110 POKE &8001,score%\n120 result%=-(seed%-10)*4\n130 POKE &8002,result%\n140 POKE &8003,201\n150 END\n'
},...[0,1,2].map(mode=>({
 name:'strings-and-print-mode-'+mode,expected:[11,50,24,202],screenRows:mode===2?1:2,
 source:`10 MEMORY &7FFF\n20 MODE ${mode===2?1:mode}\n30 CLS\n40 title$="CPC"+" IDE"\n50 LET score%=6*7\n60 PRINT "AVANT ";title$\n70 POKE &8000,11\n80 GOTO 100\n${mode===2?'100 MODE 2\n105 CLS\n110':'100'} title$=title$+"!"\n120 PRINT title$;" ";score%;\n130 PRINT " PTS"\n140 score%=score%+8\n150 POKE &8001,score%\n160 POKE &8002,24\n170 POKE &8003,202\n180 END\n`,
 // Independent literal rendering of the expected result, not produced by the extraction engine.
 oracle:`10 MODE ${mode}\n20 CLS\n${mode===2?'':'30 PRINT "AVANT CPC IDE"\n'}40 PRINT "CPC IDE!";" ";42;\n50 PRINT " PTS"\n60 END\n`
}))];
