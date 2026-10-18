import type {ExpressionWitness} from './terminal-expression-fixtures.ts';

// All six comparisons, each true and false across the three inputs. Expected masks
// are literal, independently chosen; the validator deliberately never evaluates IF.
const comparisons=['=','<>','<','<=','>','>='];
export const conditionWitnesses:ExpressionWitness[]=[
 ...(['integer','string'] as const).flatMap(kind=>[0,1,2].map(index=>{
  const values=kind==='integer'?['1','2','3']:['"A"','"B"','"C"'];
  const left=kind==='integer'?'probe%':'probe$',right=values[1]!;
  const operand=kind==='integer'?'(probe%+0)':'probe$+""';
  const masks=[[6,1,14],[1,5,41],[2,6,50]][index]!;
  const rows=comparisons.map((operator,i)=>`${i<3?30+i*10:100+(i-3)*10} IF ${operand}${operator}${right} THEN v${i}%=1 ELSE v${i}%=0`);
  return {name:`${kind}-comparisons-${index===0?'less':index===1?'equal':'greater'}`,screenRows:0,oracle:null,expected:[...masks,203],
   source:`10 MEMORY &7FFF\n20 ${left}=${values[index]}\n${rows.slice(0,3).join('\n')}\n60 POKE &8000,v0%+v1%*2+v2%*4\n90 GOTO 100\n${rows.slice(3).join('\n')}\n130 POKE &8001,v3%+v4%*2+v5%*4\n140 POKE &8002,v0%+v1%*2+v2%*4+v3%*8+v4%*16+v5%*32\n150 POKE &8003,203\n160 END\n`};
 })),
 ...[0,1].map(flag=>({
  name:`optional-else-and-display-${flag?'true':'false'}`,screenRows:1,expected:flag?[11,47,24,204]:[12,40,24,204],
  source:`10 MEMORY &7FFF\n20 flag%=${flag}\n30 MODE 1\n35 PRINT "BEFORE"\n40 title$="BEFORE"\n50 score%=40\n60 IF flag%=1 THEN LET title$="THEN ELSE" ELSE title$="FALSE"\n70 IF flag%<>0 THEN POKE &8000,11 ELSE POKE &8000,12\n80 GOTO 100\n100 IF flag%=1 THEN score%=score%+7\n110 IF flag%=0 THEN CLS ELSE MODE 2\n120 IF flag%=1 THEN PRINT "T ";title$;" ";score% ELSE PRINT "F ";title$;" ";score%\n130 POKE &8001,score%\n140 POKE &8002,24\n150 POKE &8003,204\n160 END\n`,
  oracle:`10 MODE ${flag?2:1}\n20 CLS\n30 PRINT "${flag?'T ':'F '}";"${flag?'THEN ELSE':'FALSE'}";" ";${flag?47:40}\n40 END\n`
 }))
];
