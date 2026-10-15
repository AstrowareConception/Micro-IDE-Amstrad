import type { Token } from './language.ts';
import type { SymbolLocation, TypeDeclaration } from './symbols.ts';

export const FN_LIMITS = Object.freeze({ definitions: 256, parameters: 32, occurrences: 4096, links: 8192 });
export interface FnParameter { key: string; name: string; location: SymbolLocation }
export interface FnRead { name: string; kind: 'scalar' | 'array'; location: SymbolLocation; binding: 'parameter' | 'free' | 'ambiguous'; parameterKeys: string[] }
export interface FnDefinition { key: string; name: string; location: SymbolLocation; parameters: FnParameter[]; reads: FnRead[] }
export interface FnCall { name: string; location: SymbolLocation; arity: number; ownerKey: string | null; definitionKeys: string[]; resolution: 'candidate' | 'ambiguous' | 'missing' }
export interface FnIndex { definitions: FnDefinition[]; calls: FnCall[]; inspectedOccurrences: number }
export const FN_BINDING_LABELS = {parameter:'Paramètre local',free:'Variable libre (globale)',ambiguous:'Liaison ambiguë'};
export const FN_CALL_LABELS = {candidate:'Déclaration possible',ambiguous:'Déclarations ou types ambigus',missing:'Aucune déclaration couverte'};
export const FN_METHOD = 'FN : déclarations et appels textuels, paramètres propres à chaque définition et variables libres dans son corps. Les liens d’appel désignent des déclarations possibles, jamais une preuve de définition active ou d’arité correcte. Types implicites non résolus en présence de directives pertinentes ou de contexte incomplet ; doublons/alias ambigus conservés. Aucun renommage.';
const upper = (t: Token | undefined) => t?.text.toUpperCase() ?? '';
const stem = (name: string) => name.replace(/[$%!]$/, '');
const suffix = (name: string) => /[$%!]$/.test(name) ? name.at(-1)! : '';
const unary = new Set(['+', '-', 'NOT']);
const binary = new Set(['+', '-', '*', '/', '\\', '^', '=', '<', '>', 'AND', 'OR', 'XOR', 'MOD']);
// Deliberately small expression subset; signatures of builtins are not inferred.
const builtins = new Set('ABS ASC ATN CINT COS CREAL EXP FIX INT LEN LOG LOG10 LOWER$ SGN SIN SQR STR$ TAN UPPER$ VAL'.split(' '));
const constants = new Set(['PI', 'TIME', 'RND']);
interface Expression { reads: { token: Token; array: boolean }[]; calls: { token: Token; arity: number }[] }
function fnName(items: Token[], at: number): { token: Token; next: number } | null {
 const item=items[at]; if(!item)return null;
 if(item.kind==='identifier' && /^FN[A-Z]/i.test(item.text)) return {token:{...item,text:item.text.slice(2),start:item.start+2},next:at+1};
 if(upper(item)==='FN' && items[at+1]?.kind==='identifier') return {token:items[at+1]!,next:at+2};
 return null;
}
/** Full consumption avoids inventing bindings in unknown or malformed expressions. */
function expression(items: Token[]): Expression | null {
 let at=0, depth=0; const result:Expression={reads:[],calls:[]};
 function args(): number | null {
  at++; if(++depth>64)return null;
  let count=0;
  do { if(!expr())return null; count++; if(items[at]?.text!==',')break;at++; } while(at<items.length);
  if(items[at]?.text!==')')return null;at++;depth--;return count;
 }
 function atom(): boolean {
  if(unary.has(upper(items[at]))) { at++; if(++depth>64)return false;const ok=atom();depth--;return ok; }
  const token=items[at];if(!token)return false;
  if(token.text==='('){at++;if(++depth>64)return false;if(!expr()||items[at]?.text!==')')return false;at++;depth--;return true;}
  const fn=fnName(items,at);
  if(fn){at=fn.next;const count=items[at]?.text==='('?args():0;if(count===null)return false;result.calls.push({token:fn.token,arity:count});return true;}
  if(builtins.has(upper(token))){at++;return items[at]?.text==='('&&args()===1;}
  if(token.kind==='identifier'){at++;const array=items[at]?.text==='(';if(array&&args()===null)return false;result.reads.push({token,array});return true;}
  if(token.kind==='number'||token.kind==='string'){at++;return true;}
  if(constants.has(upper(token))){at++;return true;}
  return false;
 }
 function expr(): boolean {
  if(!atom())return false;
  while(binary.has(upper(items[at]))){const op=items[at++]!.text;if(op==='<'&&['=','>'].includes(items[at]?.text??'')||op==='>'&&items[at]?.text==='=')at++;if(!atom())return false;}
  return true;
 }
 return expr()&&at===items.length?result:null;
}
function groups(items:Token[],separators:Set<string>):Token[][] {
 const result:Token[][]=[[]];let depth=0;
 for(const token of items){if(token.text==='(')depth++;if(token.text===')')depth--;if(!depth&&separators.has(token.text))result.push([]);else result.at(-1)!.push(token);}
 return result;
}
export function createFnCollector(consume: () => boolean, limit: (message:string)=>void) {
 const index:FnIndex={definitions:[],calls:[],inspectedOccurrences:0};
 function debit(n:number):boolean {
  for(let i=0;i<n;i++){if(index.inspectedOccurrences>=FN_LIMITS.occurrences){limit('Budget FN de 4096 occurrences atteint : index de cette source retiré.');return false;}if(!consume())return false;index.inspectedOccurrences++;}return true;
 }
 return {
  index,
  collect(items:Token[],line:number,basicLine:number):boolean {
   const loc=(token:Token):SymbolLocation=>({line,basicLine,start:token.start,end:token.end});
   let definition:FnDefinition|undefined, body:Token[][]=[];
   if(upper(items[0])==='DEF'){
    const fn=fnName(items,1);if(!fn)return false;let at=fn.next;const parameters:Token[]=[];
    if(items[at]?.text==='('){at++;do {const p=items[at++];if(p?.kind!=='identifier'||/^FN/i.test(p.text))return false;parameters.push(p);if(parameters.length>FN_LIMITS.parameters){limit('Plus de 32 paramètres FN : index de cette source retiré.');return false;}if(items[at]?.text!==',')break;at++;}while(at<items.length);if(items[at++]?.text!==')')return false;}
    if(items[at++]?.text!=='=')return false;
    if(index.definitions.length>=FN_LIMITS.definitions){limit('Plus de 256 définitions FN : index de cette source retiré.');return false;}
    const key=`fn:${line}:${fn.token.start}`;
    definition={key,name:upper(fn.token),location:loc(fn.token),parameters:parameters.map(p=>({key:`${key}:parameter:${p.start}`,name:upper(p),location:loc(p)})),reads:[]};
    body=[items.slice(at)];
   }else{
    const command=upper(items[0]);const assignment=command==='LET'?items.slice(1):items;
    if(assignment[0]?.kind==='identifier'){
     const parts=groups(assignment,new Set(['=']));if(parts.length<2)return false;
     const left=parts[0]!;if(left.length!==1||/^FN/i.test(left[0]!.text))return false;
     body=[assignment.slice(left.length+1)];
    }else if(['PRINT','WRITE'].includes(command))body=groups(items.slice(1),new Set([',',';'])).filter(g=>g.length);
    else if(['IF','WHILE'].includes(command))body=[items.slice(1)];
    else return false;
   }
   const parsed=body.map(expression);if(!parsed.length||parsed.some(p=>!p))return false;
   const reads=parsed.flatMap(p=>p!.reads),calls=parsed.flatMap(p=>p!.calls);
   if(!definition&&!calls.length)return false;
   if(!debit((definition?1+definition.parameters.length+reads.length:0)+calls.length))return false;
   if(definition){definition.reads=reads.sort((a,b)=>a.token.start-b.token.start).map(r=>({name:upper(r.token),kind:r.array?'array':'scalar',location:loc(r.token),binding:'ambiguous',parameterKeys:[]}));index.definitions.push(definition);}
   index.calls.push(...calls.map(c=>({name:upper(c.token),location:loc(c.token),arity:c.arity,ownerKey:definition?.key??null,definitionKeys:[],resolution:'missing' as const})));
   return true;
  },
  finish(declarations:TypeDeclaration[],incomplete:boolean):FnIndex {
   const affected=new Set(declarations.flatMap(d=>[...d.letters]));
   const type=(name:string)=>suffix(name)||(!incomplete&&!affected.has(name[0]!)?'!':null);
   const compatible=(a:string,b:string)=>stem(a)===stem(b)&&(!type(a)||!type(b)||type(a)===type(b));
   let links=0;const linked=(n:number)=>{links+=n;if(links>FN_LIMITS.links){limit('Plus de 8192 liens FN : index de cette source retiré.');return false;}return true;};
   for(const definition of index.definitions)for(const read of definition.reads){
    const candidates=read.kind==='array'?[]:definition.parameters.filter(p=>compatible(p.name,read.name));
    if(!linked(candidates.length))return index;
    read.parameterKeys=candidates.map(p=>p.key);
    read.binding=!candidates.length?'free':candidates.length===1&&type(read.name)&&type(candidates[0]!.name)?'parameter':'ambiguous';
   }
   for(const call of index.calls){const candidates=index.definitions.filter(d=>compatible(d.name,call.name));if(!linked(candidates.length))return index;call.definitionKeys=candidates.map(d=>d.key);call.resolution=!candidates.length?'missing':candidates.length===1&&type(call.name)&&type(candidates[0]!.name)?'candidate':'ambiguous';}
   index.calls.sort((a,b)=>a.location.line-b.location.line||a.location.start-b.location.start);
   return index;
  }
 };
}
