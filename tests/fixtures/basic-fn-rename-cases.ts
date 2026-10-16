/** Independent expected listings, executed before/after on the qualified firmware. */
export const basicFnRenameCases = [
 {name:'fn-constant',before:'30 DEF FNanswer=42\n40 result=FNanswer',after:'30 DEF FNresponse=42\n40 result=FNresponse',line:2,column:12,newStem:'response',expected:42},
 {name:'fn-spaced-case',before:'30 DEF FN Double(x)=x*2\n40 result=fnDOUBLE(7)',after:'30 DEF FN twice(x)=x*2\n40 result=fntwice(7)',line:1,column:10,newStem:'twice',expected:14},
 {name:'fn-integer',before:'30 DEF FNdouble%(x%)=x%*2\n40 result=FNdouble%(7)',after:'30 DEF FNtwice%(x%)=x%*2\n40 result=FNtwice%(7)',line:1,column:9,newStem:'twice',expected:14},
 {name:'fn-string',before:'30 DEF FNwrap$(x$)="["+x$+"]"\n40 result=LEN(FNwrap$("ok"))',after:'30 DEF FNencadre$(x$)="["+x$+"]"\n40 result=LEN(FNencadre$("ok"))',line:1,column:9,newStem:'encadre',expected:4},
 {name:'fn-real',before:'30 DEF FNhalf!(x!)=x!/2\n40 result=FNhalf!(3)',after:'30 DEF FNdivide!(x!)=x!/2\n40 result=FNdivide!(3)',line:1,column:9,newStem:'divide',expected:1.5},
 {name:'fn-nested',before:'30 DEF FNinner(x)=x*2\n40 DEF FNouter(x)=FNinner(x+1)+x\n50 result=FNouter(3)',after:'30 DEF FNtwice(x)=x*2\n40 DEF FNouter(x)=FNtwice(x+1)+x\n50 result=FNouter(3)',line:2,column:20,newStem:'twice',expected:11},
 {name:'parameter-global',before:'30 DEF FNdouble(x)=x*2\n40 x=99:result=FNdouble(7)+x',after:'30 DEF FNdouble(value)=value*2\n40 x=99:result=FNdouble(7)+x',line:1,column:16,newStem:'value',expected:113},
 {name:'parameter-array',before:'30 DEF FNvalue(x)=x+x(1)\n40 DIM x(2):x=99:x(1)=7:result=FNvalue(3)+x+x(1)',after:'30 DEF FNvalue(amount)=amount+x(1)\n40 DIM x(2):x=99:x(1)=7:result=FNvalue(3)+x+x(1)',line:1,column:18,newStem:'amount',expected:116},
 {name:'parameter-integer',before:'30 DEF FNdouble%(x%)=x%*2\n40 x%=99:result=FNdouble%(7)+x%',after:'30 DEF FNdouble%(value%)=value%*2\n40 x%=99:result=FNdouble%(7)+x%',line:1,column:17,newStem:'value',expected:113},
 {name:'parameter-string',before:'30 DEF FNwrap$(x$)="["+x$+"]"\n40 x$="global":result=LEN(FNwrap$("ok"))+LEN(x$)',after:'30 DEF FNwrap$(text$)="["+text$+"]"\n40 x$="global":result=LEN(FNwrap$("ok"))+LEN(x$)',line:1,column:15,newStem:'text',expected:10},
 {name:'parameter-nested-free',before:'30 DEF FNinner(y)=x+y\n40 DEF FNouter(x)=FNinner(2)+x\n50 x=99:result=FNouter(3)+x',after:'30 DEF FNinner(y)=x+y\n40 DEF FNouter(value)=FNinner(2)+value\n50 x=99:result=FNouter(3)+x',line:2,column:15,newStem:'value',expected:203},
 {name:'parameter-other-scope',before:'30 DEF FNinner(x)=x*2\n40 DEF FNouter(x)=FNinner(x+1)+x\n50 x=99:result=FNouter(3)+x',after:'30 DEF FNinner(x)=x*2\n40 DEF FNouter(value)=FNinner(value+1)+value\n50 x=99:result=FNouter(3)+x',line:2,column:15,newStem:'value',expected:110},
 {name:'parameter-argument-binding',before:'30 DEF FNpair(x,y)=x*100+y\n40 x=10:y=20:result=FNpair(1,x)+x+y',after:'30 DEF FNpair(firstValue,y)=firstValue*100+y\n40 x=10:y=20:result=FNpair(1,x)+x+y',line:1,column:14,newStem:'firstValue',expected:140},
 {name:'parameter-real',before:'30 DEF FNhalf!(x!)=x!/2\n40 x!=99:result=FNhalf!(3)+x!',after:'30 DEF FNhalf!(value!)=value!/2\n40 x!=99:result=FNhalf!(3)+x!',line:1,column:15,newStem:'value',expected:100.5},
 {name:'parameter-unused',before:'30 DEF FNconstant(x)=42\n40 result=FNconstant(7)',after:'30 DEF FNconstant(ignored)=42\n40 result=FNconstant(7)',line:1,column:18,newStem:'ignored',expected:42},
] as const;
