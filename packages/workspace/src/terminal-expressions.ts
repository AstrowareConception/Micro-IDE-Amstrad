import {tokenize, type Token} from '../../basic-language/src/language.ts';
import {KEYWORDS} from '../../basic-language/src/catalog.ts';

export const EXPRESSION_EXTRACTION_PROFILE='terminal-expressions-chain-merge-v2';
export const CONDITIONAL_EXTRACTION_PROFILE='terminal-conditions-chain-merge-v3';
type Value=number|string;
const fail=(why:string):never=>{throw Error('Extraction simulée refusée : profil expressions/conditions — '+why);};
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
function validate(statements:Statement[],conditions:boolean):void {
 let states=[new Map<string,Value>()],reserved=false,branches=0;
 for(const [index,row]of statements.entries()){
  const body=row.body,tokens=tokenize(body);
  if(tokens.length>96)fail('plus de 96 jetons sur une ligne.');
  if(/^MEMORY\s+&7FFF$/i.test(body)){
   if(index!==0)fail('MEMORY &7FFF doit être la première instruction.');
   reserved=true;continue;
  }
  if(conditions&&tokens[0]?.kind==='keyword'&&tokens[0].text.toUpperCase()==='IF'){
   if(++branches>6)fail('conditions : plus de 6 IF (64 chemins maximum).');
   const keyword=(name:string)=>tokens.flatMap((token,i)=>token.kind==='keyword'&&token.text.toUpperCase()===name?[i]:[]);
   const thens=keyword('THEN'),elses=keyword('ELSE');
   if(keyword('IF').length!==1||thens.length!==1||elses.length>1||elses[0]!==undefined&&elses[0]<thens[0]!)
    fail('conditions : IF simple, un THEN et au plus un ELSE requis ; imbrication refusée.');
   const then=thens[0]!,otherwise=elses[0]??tokens.length;
   const arms=[tokens.slice(then+1,otherwise),elses.length?tokens.slice(otherwise+1):null];
   if(arms.some(arm=>arm!==null&&!arm.length))fail('conditions : branche vide.');
   const next:Map<string,Value>[]=[];
   for(const state of states){
    comparison(tokens.slice(1,then),state);
    for(const arm of arms){
     const copy=new Map(state);
     if(arm){
      // Keep original spelling/spacing (not token joins), including quoted keywords.
      const text=body.slice(arm[0]!.start,arm.at(-1)!.end);
      primitive(text,arm,copy,reserved);
     }
     next.push(copy);
    }
   }
   states=next;
  }else for(const state of states)primitive(body,tokens,state,reserved);
 }
}

/** Called only after the unique terminal jump and END have been validated and removed. */
export function validateTerminalExpressions(statements:Statement[]):void {validate(statements,false);}
/** Conservative enumeration of both arms, including implicit ELSE and infeasible combinations. */
export function validateTerminalConditions(statements:Statement[]):void {validate(statements,true);}
