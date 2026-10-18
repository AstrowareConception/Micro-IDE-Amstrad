import {tokenize, type Token} from '../../basic-language/src/language.ts';
import {KEYWORDS} from '../../basic-language/src/catalog.ts';

export const EXPRESSION_EXTRACTION_PROFILE='terminal-expressions-chain-merge-v2';
export const CONDITIONAL_EXTRACTION_PROFILE='terminal-conditions-chain-merge-v3';
export const LOOP_EXTRACTION_PROFILE='terminal-loops-chain-merge-v4';
type Value=number|string;
const fail=(why:string):never=>{throw Error('Extraction simulée refusée : profil expressions/conditions/boucles — '+why);};
function bounded(value:Value):Value {
 if(typeof value==='number'&&(!Number.isInteger(value)||value< -32768||value>32767))fail('résultat entier hors de -32768..32767.');
 if(typeof value==='string'&&value.length>255)fail('chaîne de plus de 255 caractères.');
 return value;
}
function identity(token:Token|undefined):string {
 if(!token||token.kind!=='identifier'||!/^([A-Za-z][A-Za-z0-9]{0,39})[%$]$/.test(token.text))return fail('scalaire explicitement typé % ou $ requis.');
 const name=token.text.toUpperCase(),stem=name.slice(0,-1);
 if(KEYWORDS.has(stem)||KEYWORDS.has(stem+'$')||/^FN/.test(stem))fail('nom réservé ou préfixe FN.');
 return name;
}
/** A closed, bounded grammar, not JavaScript eval or the editor's tolerant parser.
 * Constant propagation checks types, initialization and ranges in one explicit state.
 */
function expression(tokens:Token[],values:Map<string,Value>):Value {
 if(!tokens.length||tokens.length>96)fail('expression vide ou trop longue.');
 let at=0,depth=0;
 function primary():Value {
  if(++depth>16)fail('imbrication supérieure à 16.');
  const token=tokens[at++];if(!token)return fail('opérande manquant.');
  let value:Value;
  if(token.text==='+'||token.text==='-'){
   const operand=primary();if(typeof operand!=='number')return fail('signe unaire sur une chaîne.');
   value=token.text==='-'?-operand:operand;
  }else if(token.text==='('){
   value=sum();if(tokens[at++]?.text!==')')fail('parenthèse fermante manquante.');
  }else if(token.kind==='number'&&/^\d{1,5}$/.test(token.text))value=Number(token.text);
  else if(token.kind==='string'&&/^"[\x20-\x21\x23-\x7e]*"$/.test(token.text))value=token.text.slice(1,-1);
  else {
   const name=identity(token),known=values.get(name);
   if(known===undefined)return fail('variable lue avant affectation : '+name+'.');
   value=known;
  }
  depth--;return bounded(value);
 }
 function product():Value {
  let left=primary();
  while(tokens[at]?.text==='*'){
   at++;const right=primary();if(typeof left!=='number'||typeof right!=='number')return fail('produit non numérique.');
   left=bounded(left*right);
  }
  return left;
 }
 function sum():Value {
  let left=product();
  while(tokens[at]?.text==='+'||tokens[at]?.text==='-'){
   const operator=tokens[at++]!.text,right=product();
   if(typeof left==='string'&&typeof right==='string'&&operator==='+')left=bounded(left+right);
   else if(typeof left==='number'&&typeof right==='number')left=bounded(operator==='+'?left+right:left-right);
   else return fail('types incompatibles dans une expression.');
  }
  return left;
 }
 const result=sum();if(at!==tokens.length)fail('forme non couverte ou expression incomplète.');
 return result;
}

/** One closed primitive. MEMORY, jumps and END are handled only by the outer structure. */
function primitive(body:string,tokens:Token[],values:Map<string,Value>,reserved:boolean):void {
 if(/^MODE\s+[012]$/i.test(body)||/^CLS$/i.test(body))return;
 if(tokens[0]?.text.toUpperCase()==='PRINT'){
  if(tokens.length===1)return;
  let group:Token[]=[];
  for(const token of tokens.slice(1)){
   if(token.text===';'){expression(group,values);group=[];}else group.push(token);
  }
  if(group.length)expression(group,values);
  return;
 }
 const poke=/^POKE\s+&800[0-3]\s*,/i.exec(body);
 if(poke){
  if(!reserved)fail('POKE exige MEMORY &7FFF en tête.');
  const value=expression(tokenize(body.slice(poke[0].length)),values);
  if(typeof value!=='number'||value<0||value>255)fail('POKE exige un octet de 0 à 255.');
  return;
 }
 const assignment=tokens[0]?.text.toUpperCase()==='LET'?tokens.slice(1):tokens;
 const name=identity(assignment[0]);
 if(assignment[1]?.text!=='=')fail('affectation simple attendue.');
 const value=expression(assignment.slice(2),values);
 if((name.endsWith('$'))!==(typeof value==='string'))fail('type du scalaire incompatible avec son affectation.');
 values.set(name,value);
}

function comparison(tokens:Token[],values:Map<string,Value>):void {
 const first=tokens.findIndex(token=>token.kind==='operator'&&/^[=<>]$/.test(token.text));
 if(first<1)fail('condition : comparaison simple requise.');
 let end=first+1;
 while(tokens[end]?.kind==='operator'&&/^[=<>]$/.test(tokens[end]!.text))end++;
 const operator=tokens.slice(first,end).map(token=>token.text).join('');
 if(tokens.slice(first+1,end).some((token,i)=>token.start!==tokens[first+i]!.end))fail('condition : comparateur contigu requis.');
 if(!['=','<>','<','<=','>','>='].includes(operator))fail('condition : comparateur non couvert.');
 const left=expression(tokens.slice(0,first),values),right=expression(tokens.slice(end),values);
 if(typeof left!==typeof right)fail('condition : types incompatibles dans la comparaison.');
 // Deliberately do not prune constant branches: both outcomes must remain admissible.
}

type Statement={number:number;body:string};
type State=Map<string,Value>;
function step(body:string,states:State[],reserved:boolean,conditions:boolean):State[] {
 const tokens=tokenize(body);
 if(tokens.length>96)fail('plus de 96 jetons sur une ligne.');
 if(conditions&&tokens[0]?.kind==='keyword'&&tokens[0].text.toUpperCase()==='IF'){
  const keyword=(name:string)=>tokens.flatMap((token,i)=>token.kind==='keyword'&&token.text.toUpperCase()===name?[i]:[]);
  const thens=keyword('THEN'),elses=keyword('ELSE');
  if(keyword('IF').length!==1||thens.length!==1||elses.length>1||elses[0]!==undefined&&elses[0]<thens[0]!)
   fail('conditions : IF simple, un THEN et au plus un ELSE requis ; imbrication refusée.');
  const then=thens[0]!,otherwise=elses[0]??tokens.length;
  const arms=[tokens.slice(then+1,otherwise),elses.length?tokens.slice(otherwise+1):null];
  if(arms.some(arm=>arm!==null&&!arm.length))fail('conditions : branche vide.');
  const next:State[]=[];
  for(const state of states){
   comparison(tokens.slice(1,then),state);
   for(const arm of arms){
    const copy=new Map(state);
    if(arm){
     // Keep original spelling/spacing, including quoted keywords.
     const text=body.slice(arm[0]!.start,arm.at(-1)!.end);
     primitive(text,arm,copy,reserved);
    }
    next.push(copy);
   }
  }
  return next;
 }
 for(const state of states)primitive(body,tokens,state,reserved);
 return states;
}

const operation=(row:Statement)=>tokenize(row.body)[0]?.text.toUpperCase();
function integer(value:number):number {bounded(value);return value;}
function counterValue(state:State,name:string):number {
 const value=state.get(name);
 if(typeof value!=='number')return fail('boucle : compteur % non initialisé.');
 return value;
}
interface Loop {
 name:string;start:number|null;increment:number;
 enters:(value:number)=>boolean;body:Statement[];end:number;
}
/** No live loop frame may cross the loading boundary. The body is straight-line v2. */
function loopAt(rows:Statement[],index:number,entryLine:number):Loop {
 const row=rows[index]!,forLoop=operation(row)==='FOR';
 const header=forLoop?/^FOR\s+([A-Za-z][A-Za-z0-9]{0,39}%)\s*=\s*([+-]?\d{1,5})\s+TO\s+([+-]?\d{1,5})(?:\s+STEP\s+([+-]?\d{1,5}))?$/i.exec(row.body):
  /^WHILE\s+([A-Za-z][A-Za-z0-9]{0,39}%)\s*(<=|>=|<|>)\s*([+-]?\d{1,5})$/i.exec(row.body);
 if(!header)return fail('boucle : en-tête simple à compteur % et bornes littérales requis.');
 const name=identity(tokenize(header[1]!)[0]);
 const start=forLoop?integer(Number(header[2])):null,limit=integer(Number(header[3]));
 const end=rows.findIndex((candidate,i)=>i>index&&['NEXT','WEND'].includes(operation(candidate)??''));
 if(end<0)return fail('boucle : fermeture absente.');
 if(row.number<entryLine&&rows[end]!.number>=entryLine)fail('boucle traversant la frontière CHAIN MERGE.');
 const close=rows[end]!.body;
 if(forLoop? !/^NEXT\s+[A-Za-z][A-Za-z0-9]{0,39}%$/i.test(close)||identity(tokenize(close)[1])!==name : !/^WEND$/i.test(close))
  fail('boucle : fermeture NEXT nommée ou WEND incohérente.');
 const body=rows.slice(index+1,end);
 if(body.some(candidate=>['FOR','WHILE','IF'].includes(operation(candidate)??'')))
  fail('boucle : imbrication et IF dans le corps non couverts.');
 let increment=forLoop?integer(Number(header[4]??1)):0;
 if(!forLoop){
  const update=/^(?:LET\s+)?([A-Za-z][A-Za-z0-9]{0,39}%)\s*=\s*([A-Za-z][A-Za-z0-9]{0,39}%)\s*([+-])\s*(\d{1,5})$/i.exec(body.at(-1)?.body??'');
  if(!update||update[1]!.toUpperCase()!==name||update[2]!.toUpperCase()!==name)
   return fail('WHILE : mise à jour simple du compteur en dernière instruction requise.');
  increment=integer(Number(update[4])*(update[3]==='-'?-1:1));
  if((header[2]!.startsWith('<')&&increment<=0)||(header[2]!.startsWith('>')&&increment>=0))
   fail('WHILE : pas strictement dirigé vers la sortie requis.');
 }
 if(increment===0)fail('boucle : pas nul refusé.');
 for(const [i,candidate]of body.entries()){
  const tokens=tokenize(candidate.body),at=tokens[0]?.text.toUpperCase()==='LET'?1:0;
  if(tokens[at]?.text.toUpperCase()===name&&tokens[at+1]?.text==='='&&(forLoop||i!==body.length-1))
   fail('boucle : modification du compteur hors mise à jour prévue.');
 }
 const enters=forLoop?(value:number)=>increment>0?value<=limit:value>=limit:
  (value:number)=>header[2]==='<'?value<limit:header[2]==='<='?value<=limit:header[2]==='>'?value>limit:value>=limit;
 return {name,start,increment,enters,body,end};
}

function validate(statements:Statement[],conditions:boolean,entryLine?:number):void {
 let states:State[]=[new Map()],reserved=false,branches=0,loops=0,work=0;
 const run=(body:string,inputs:State[],allowConditions:boolean):State[]=>{
  // Count state/instruction visits, including the discarded validation of a zero-trip body.
  if(entryLine!==undefined&&(work+=inputs.length)>8192)fail('boucles : budget de 8192 visites dépassé.');
  return step(body,inputs,reserved,allowConditions);
 };
 for(let index=0;index<statements.length;index++){
  const row=statements[index]!,body=row.body,op=operation(row);
  if(/^MEMORY\s+&7FFF$/i.test(body)){
   if(index!==0)fail('MEMORY &7FFF doit être la première instruction.');
   reserved=true;continue;
  }
  if(entryLine!==undefined&&(op==='FOR'||op==='WHILE')){
   if(++loops>4)fail('boucles : plus de 4 boucles.');
   const loop=loopAt(statements,index,entryLine),next:State[]=[];
   for(const state of states){
    if(loop.start!==null)state.set(loop.name,loop.start);
    let value=counterValue(state,loop.name),turns=0;
    if(!loop.enters(value)){
     // Reject opaque/unsafe dead bodies too, but do not adopt their assignments.
     const discarded=new Map(state);
     for(const line of loop.body)run(line.body,[discarded],false);
    }
    while(loop.enters(value)){
     if(++turns>32)fail('boucle : plus de 32 tours.');
     for(const line of loop.body)run(line.body,[state],false);
     if(loop.start!==null)state.set(loop.name,integer(value+loop.increment));
     value=counterValue(state,loop.name);
    }
    next.push(state);
   }
   states=next;index=loop.end;continue;
  }
  if(conditions&&op==='IF'&&++branches>6)fail('conditions : plus de 6 IF (64 chemins maximum).');
  states=run(body,states,conditions);
 }
}

/** Called only after the unique terminal jump and END have been validated and removed. */
export function validateTerminalExpressions(statements:Statement[]):void {validate(statements,false);}
/** Conservative enumeration of both arms, including implicit ELSE and infeasible combinations. */
export function validateTerminalConditions(statements:Statement[]):void {validate(statements,true);}
/** Closed loops on one side of entryLine; no loop stack persists through CHAIN MERGE. */
export function validateTerminalLoops(statements:Statement[],entryLine:number):void {validate(statements,true,entryLine);}
