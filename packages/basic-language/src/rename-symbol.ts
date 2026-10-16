import { tokenize } from './language.ts';
import { indexSymbols, type SymbolLocation, type BasicSymbol } from './symbols.ts';
import { FN_SEGMENT_OMISSION, type FnDefinition, type FnParameter } from './function-symbols.ts';
import { inspectVariableRename, planVariableRename, validateRenameSource, validateRenameName, validateListing, RENAME_LIMITS, type RenamePosition, type RenameTarget, type VariableRenamePlan } from './rename-variable.ts';

const stem = (name:string) => name.replace(/[$%!]$/, '');
const suffix = (name:string) => name.slice(stem(name).length) as BasicSymbol['suffix'];
const key = (p:SymbolLocation) => `${p.line}:${p.start}:${p.end}`;
const hit = (p:SymbolLocation, at:RenamePosition) => p.line===at.line && p.start<=at.column && at.column<p.end;
function fail(message:string):never { throw new Error('Renommage FN refusé : '+message); }

/** A dedicated complete FN profile; the general navigation index stays conservative. */
function inspectFunctions(source:string, at:RenamePosition) {
 validateRenameSource(source);
 if(!Number.isInteger(at.line)||!Number.isInteger(at.column)||at.line<1||at.column<0)fail('position invalide.');
 const index=indexSymbols({id:'rename',name:'rename',source});
 if(index.status==='limited'||index.omittedReasons||index.reasons.some(r=>!r.endsWith(FN_SEGMENT_OMISSION)))fail('listing partiellement couvert par l’index.');
 const {definitions,calls}=index.functions;
 if(!definitions.length)fail('aucune définition reconnue.');
 const definitionsByLine=new Map(definitions.map(d=>[d.location.line,d]));
 let prefix=true;
 const identifiers:string[]=[];
 const fnPositions=new Set([...definitions.map(d=>key(d.location)),...calls.map(c=>key(c.location))]);
 // Verify all FN lexemes, including glued/spaced forms, not just discovered candidates.
 source.split('\n').forEach((line,i)=>{
  const code=tokenize(line).filter(t=>t.kind!=='comment');
  const definition=definitionsByLine.get(i+1);
  if(code.length>1){
   if(definition){if(!prefix||code[1]?.text.toUpperCase()!=='DEF'||code.some(t=>t.text===':'))fail('définitions requises au début, une par ligne, avant les instructions exécutables.');}
   else prefix=false;
  }
  code.forEach((t,j)=>{
   if(t.kind==='identifier')identifiers.push(t.text.toUpperCase());
   const glued=t.kind==='identifier'&&/^FN/i.test(t.text), spaced=t.kind==='keyword'&&t.text.toUpperCase()==='FN';
   if(glued||spaced){const name=glued?{...t,start:t.start+2}:code[j+1];if(!name||!fnPositions.has(`${i+1}:${name.start}:${name.end}`))fail('occurrence FN non couverte.');}
  });
 });
 if(new Set(definitions.map(d=>stem(d.name))).size!==definitions.length)fail('redéfinition ou suffixes homonymes.');
 const byKey=new Map(definitions.map(d=>[d.key,d]));
 for(const definition of definitions){
  if(new Set(definition.parameters.map(p=>stem(p.name))).size!==definition.parameters.length)fail('paramètres homonymes ou alias.');
  for(const read of definition.reads){
   if(read.binding==='ambiguous')fail('liaison de paramètre ambiguë.');
   if(read.kind==='scalar'&&definition.parameters.some(p=>stem(p.name)===stem(read.name)&&p.name!==read.name))fail('alias suffixé d’un paramètre.');
  }
 }
 const edges=new Map(definitions.map(d=>[d.key,[] as string[]]));
 for(const call of calls){
  const definition=byKey.get(call.definitionKeys[0]??'');
  if(call.resolution!=='candidate'||call.definitionKeys.length!==1||!definition||call.name!==definition.name||call.arity!==definition.parameters.length)fail('appel absent, ambigu, suffixé différemment ou d’arité incorrecte.');
  if(call.ownerKey)edges.get(call.ownerKey)!.push(definition.key);
 }
 const visited=new Set<string>(), visiting=new Set<string>();
 function visit(id:string){if(visiting.has(id))fail('récursion non qualifiée.');if(visited.has(id))return;visiting.add(id);for(const next of edges.get(id)!)visit(next);visiting.delete(id);visited.add(id);}
 for(const d of definitions)visit(d.key);
 let definition:FnDefinition|undefined, parameter:FnParameter|undefined;
 definition=definitions.find(d=>hit(d.location,at));
 if(!definition){const call=calls.find(c=>hit(c.location,at));if(call)definition=byKey.get(call.definitionKeys[0]!);}
 if(!definition)for(const d of definitions){
  parameter=d.parameters.find(p=>hit(p.location,at)||d.reads.some(r=>r.binding==='parameter'&&r.parameterKeys[0]===p.key&&hit(r.location,at)));
  if(parameter){definition=d;break;}
 }
 if(!definition)fail('placer le curseur dans le nom FN ou un paramètre local couvert. Les globales des fichiers FN restent exclues.');
 const name=parameter?.name??definition.name;
 const locations=parameter?[parameter.location,...definition.reads.filter(r=>r.binding==='parameter'&&r.parameterKeys[0]===parameter.key).map(r=>r.location)]:[definition.location,...calls.filter(c=>c.definitionKeys[0]===definition.key).map(c=>c.location)];
 if(locations.length>RENAME_LIMITS.edits)fail('plus de 2000 substitutions.');
 const target:RenameTarget={name,stem:stem(name),suffix:suffix(name),kind:parameter?'parameter':'function',occurrences:locations.length,scope:parameter?`Paramètre local de FN ${definition.name}`:`Définition et appels de FN ${definition.name}`};
 return {target,locations:locations.sort((a,b)=>a.line-b.line||a.start-b.start),definitions,identifiers};
}
function hasFunctions(source:string):boolean {
 return source.split('\n').some(line=>tokenize(line).some(t=>t.kind==='keyword'&&t.text.toUpperCase()==='FN'||t.kind==='identifier'&&/^FN/i.test(t.text)));
}
export function inspectSymbolRename(source:string,at:RenamePosition):RenameTarget {
 // Cheap common budget before lexical routing.
 if(source.length>RENAME_LIMITS.characters)validateListing(source);
 return hasFunctions(source)?inspectFunctions(source,at).target:inspectVariableRename(source,at);
}
export function planSymbolRename(source:string,at:RenamePosition,newStem:string):VariableRenamePlan {
 if(source.length>RENAME_LIMITS.characters)validateListing(source);
 if(!hasFunctions(source))return planVariableRename(source,at,newStem);
 const selected=inspectFunctions(source,at);validateRenameName(newStem);
 if(newStem.toUpperCase()===selected.target.stem)fail('choisir un nom différent.');
 const destination=newStem.toUpperCase();
 // Fresh throughout the source: no capture of a free variable or another parameter.
 if(selected.identifiers.some(n=>stem(n)===destination)||selected.definitions.some(d=>stem(d.name)===destination))fail('collision : nom déjà présent dans le fichier.');
 const newName=newStem+selected.target.suffix, lines=source.split('\n');
 const edits=selected.locations.map(p=>({...p,before:lines[p.line-1]!.slice(p.start,p.end),after:newName}));
 for(const edit of [...edits].reverse())lines[edit.line-1]=lines[edit.line-1]!.slice(0,edit.start)+edit.after+lines[edit.line-1]!.slice(edit.end);
 const after=lines.join('\n');validateListing(after);
 const first=edits[0]!, next=inspectFunctions(after,{line:first.line,column:first.start});
 if(next.target.name!==newName.toUpperCase()||next.target.kind!==selected.target.kind||next.target.occurrences!==edits.length)fail('identité ou couverture modifiée après transformation.');
 return {before:source,after,target:selected.target,newName,edits,warnings:[
  'Profil autonome : définitions FN initiales uniques, types stables et appels couverts sans récursion.',
  selected.target.kind==='parameter'?'Seule cette portée locale change. Globales homonymes, tableaux et paramètres des autres fonctions conservés.':'Seuls le nom de cette définition et ses appels changent. Préfixes FN et suffixes conservés.',
  'Chaînes, DATA, commentaires et autres fichiers conservés. Mémoire et temps peuvent changer : testez après application.'
 ]};
}
