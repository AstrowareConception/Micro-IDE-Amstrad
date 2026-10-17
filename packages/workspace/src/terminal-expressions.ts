import {tokenize, type Token} from '../../basic-language/src/language.ts';
import {KEYWORDS} from '../../basic-language/src/catalog.ts';

export const EXPRESSION_EXTRACTION_PROFILE='terminal-expressions-chain-merge-v2';
type Value=number|string;
const fail=(why:string):never=>{throw Error('Extraction simulée refusée : profil expressions — '+why);};
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
 * Constant propagation checks types, initialization and ranges on this straight path only.
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

/** Called only after the unique terminal jump and END have been validated and removed. */
export function validateTerminalExpressions(statements:{number:number;body:string}[]):void {
 const values=new Map<string,Value>();let reserved=false;
 for(const [index,row]of statements.entries()){
  const body=row.body,tokens=tokenize(body);
  if(tokens.length>96)fail('plus de 96 jetons sur une ligne.');
  if(/^MEMORY\s+&7FFF$/i.test(body)){
   if(index!==0)fail('MEMORY &7FFF doit être la première instruction.');
   reserved=true;continue;
  }
  if(/^MODE\s+[012]$/i.test(body)||/^CLS$/i.test(body))continue;
  if(tokens[0]?.text.toUpperCase()==='PRINT'){
   if(tokens.length===1)continue;
   let group:Token[]=[];
   for(const token of tokens.slice(1)){
    if(token.text===';'){expression(group,values);group=[];}else group.push(token);
   }
   if(group.length)expression(group,values);
   continue;
  }
  const poke=/^POKE\s+&800[0-3]\s*,/i.exec(body);
  if(poke){
   if(!reserved)fail('POKE exige MEMORY &7FFF en tête.');
   const value=expression(tokenize(body.slice(poke[0].length)),values);
   if(typeof value!=='number'||value<0||value>255)fail('POKE exige un octet de 0 à 255.');
   continue;
  }
  const assignment=tokens[0]?.text.toUpperCase()==='LET'?tokens.slice(1):tokens;
  const name=identity(assignment[0]);
  if(assignment[1]?.text!=='=')fail('affectation simple attendue.');
  const value=expression(assignment.slice(2),values);
  if((name.endsWith('$'))!==(typeof value==='string'))fail('type du scalaire incompatible avec son affectation.');
  values.set(name,value);
 }
}
