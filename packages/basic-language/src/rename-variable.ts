import { KEYWORDS } from './catalog.ts';
import { tokenize } from './language.ts';
import { indexSymbols, type BasicSymbol, type SymbolLocation } from './symbols.ts';
import { tokenizeBasic } from '../../cpc-disk/src/basic-codec.ts';

export const RENAME_LIMITS = Object.freeze({characters:65535, lineCharacters:255, edits:2000});
export interface RenamePosition { line:number; column:number }
export interface RenameTarget { name:string; stem:string; suffix:BasicSymbol['suffix']; kind:BasicSymbol['kind']|'function'|'parameter'; occurrences:number; scope?:string }
export interface RenameEdit extends SymbolLocation { before:string; after:string }
export interface VariableRenamePlan { before:string; after:string; target:RenameTarget; newName:string; edits:RenameEdit[]; warnings:string[] }
const forbidden=new Set('DEFINT DEFREAL DEFSTR CALL PEEK POKE MEMORY HIMEM FRE TIME WAIT INP OUT LOAD SAVE MERGE CHAIN RUN CONT NEW CLEAR SYMBOL AFTER EVERY REMAIN'.split(' '));
const stem=(name:string)=>name.replace(/[$%!]$/,'');
export function validateListing(source:string):void {
 if(source.length>RENAME_LIMITS.characters)throw new Error('Renommage limité à 64 Kio de source.');
 const normalized=source.replace(/\r\n/g,'\n');
 if(normalized.split('\n').some(line=>line.length>RENAME_LIMITS.lineCharacters))throw new Error('Une ligne dépasse 255 caractères ; raccourcissez le listing ou le nouveau nom.');
 try{tokenizeBasic(normalized.split('\n').filter(line=>line.trim()).join('\n'));}
 catch(error){throw new Error('Listing BASIC ASCII non validé : '+(error instanceof Error?error.message:'syntaxe non couverte.'));}
}
export function validateRenameSource(source:string):void {
 validateListing(source);
 for(const line of source.split('\n'))for(const token of tokenize(line)){
  if(token.kind==='keyword'&&forbidden.has(token.text.toUpperCase())||token.kind==='operator'&&['@','|'].includes(token.text))
   throw new Error(`Renommage refusé : ${token.text.toUpperCase()} dépend des types implicites, de la machine, du temps ou d’un programme externe.`);
 }
}
export function validateRenameName(newStem:string):void {
 if(!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(newStem)||/^FN/i.test(newStem)||KEYWORDS.has(newStem.toUpperCase()))throw new Error('Nouveau nom : 1 à 40 lettres/chiffres ASCII, première lettre obligatoire, sans suffixe, mot réservé ni préfixe FN.');
}
function inspect(source:string,position:RenamePosition){
 validateRenameSource(source);
 if(!Number.isInteger(position.line)||!Number.isInteger(position.column)||position.line<1||position.column<0)throw new Error('Position du curseur invalide.');
 const index=indexSymbols({id:'rename',name:'rename',source});
 if(index.status!=='indexed')throw new Error('Renommage refusé : index incomplet. '+index.reasons.slice(0,3).join(' '));
 const selected=index.symbols.find(s=>s.occurrences.some(p=>p.line===position.line&&p.start<=position.column&&position.column<p.end));
 if(!selected)throw new Error('Placez le curseur dans une variable ou un tableau couvert. Fonctions FN, chaînes, DATA et commentaires ne sont pas renommés.');
 const bare=stem(selected.name);
 if(index.symbols.some(s=>stem(s.name)===bare&&s.name!==selected.name))throw new Error('Plusieurs suffixes pour ce nom : alias de type non résolu, renommage refusé.');
 if(selected.occurrences.length>RENAME_LIMITS.edits)throw new Error('Plus de 2000 occurrences : renommage refusé.');
 // Every code identifier must have one indexed location. Never edit a partial census.
 const positions=new Set(index.symbols.flatMap(s=>s.occurrences.map(o=>`${o.line}:${o.start}:${o.end}`)));
 source.split('\n').forEach((line,i)=>{for(const token of tokenize(line))if(token.kind==='identifier'&&!positions.has(`${i+1}:${token.start}:${token.end}`))throw new Error('Identifiant non couvert par l’index : renommage refusé.');});
 const target:RenameTarget={name:selected.name,stem:bare,suffix:selected.suffix,kind:selected.kind,occurrences:selected.occurrences.length};
 return {index,selected,target};
}
export function inspectVariableRename(source:string,position:RenamePosition):RenameTarget {return inspect(source,position).target;}
export function planVariableRename(source:string,position:RenamePosition,newStem:string):VariableRenamePlan {
 const {index,selected,target}=inspect(source,position);
 validateRenameName(newStem);
 if(newStem.toUpperCase()===target.stem)throw new Error('Choisissez un nom différent (la casse seule ne change pas l’identité).');
 if(index.symbols.some(s=>stem(s.name)===newStem.toUpperCase()))throw new Error('Collision : ce nom existe déjà, éventuellement avec un autre suffixe ou comme tableau.');
 const newName=newStem+target.suffix, lines=source.split('\n');
 const edits=selected.occurrences.map(location=>({...location,before:lines[location.line-1]!.slice(location.start,location.end),after:newName}));
 for(const edit of [...edits].sort((a,b)=>b.line-a.line||b.start-a.start))lines[edit.line-1]=lines[edit.line-1]!.slice(0,edit.start)+edit.after+lines[edit.line-1]!.slice(edit.end);
 const after=lines.join('\n');validateListing(after);
 const next=indexSymbols({id:'rename',name:'rename',source:after}), replacement=next.symbols.find(s=>s.name===newName.toUpperCase()&&s.kind===selected.kind);
 if(next.status!=='indexed'||replacement?.occurrences.length!==edits.length)throw new Error('Le résultat ne conserve pas les occurrences attendues : renommage refusé.');
 return {before:source,after,target,newName,edits,warnings:['Profil : fichier autonome exécuté depuis le début, sans état BASIC antérieur.', 'Les chaînes, DATA, commentaires, numéros et autres fichiers sont conservés. Aucun renommage FN.', 'La taille mémoire et les temps d’exécution peuvent changer. Testez le programme après application.']};
}
export function applyVariableRename(plan:VariableRenamePlan,current:string):string {
 if(current!==plan.before)throw new Error('Le listing a changé depuis l’aperçu. Relancez le renommage.');
 return plan.after;
}
