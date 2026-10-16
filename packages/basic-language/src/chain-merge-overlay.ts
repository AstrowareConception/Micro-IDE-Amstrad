import { analyze, tokenize } from './language.ts';

/** Conservative source-level review; does not execute or modify BASIC. */
export interface OverlaySource { id:string; path:string; cpcName:string; source:string }
export interface ChainMergeOverlayReport {
 version:1; hostId:string; overlayId:string;
 collisions:number[]; collisionsTruncated:boolean;
 sharedIdentifiers:string[]; sharedTruncated:boolean;
 hostDataLines:number[]; overlayDataLines:number[];
 referencesData:boolean; usesMemoryControl:boolean;
 hasDynamicFlow:boolean; hasErrors:boolean;
 arrayNames:string[]; stringNames:string[];
 hasDeleteClause:boolean; readWithoutRestore:boolean;
 blockers:string[]; warnings:string[];
 extractionPermitted:false; behavioralProof:'not-run';
}
const MEM=new Set('MEMORY HIMEM CLEAR PEEK POKE CALL LOAD SYMBOL FRE DEFINT DEFREAL DEFSTR DIM ERASE'.split(' '));
const UNCERTAIN=new Set('ON AFTER EVERY RESUME ERROR CHAIN MERGE RUN DELETE READ RESTORE DATA'.split(' '));
const IDENT=/^[A-Z][A-Z0-9]*[$%!]?$/
/** Inventories risks before attempting any CHAIN MERGE overlay; never attests equivalence. */
export function inspectChainMergeOverlay(host:OverlaySource,overlay:OverlaySource):ChainMergeOverlayReport {
 if(host.id===overlay.id||host.cpcName.toUpperCase()===overlay.cpcName.toUpperCase())throw Error('CHAIN MERGE : deux sources distinctes requises.');
 const blockers:string[]=[],warnings:string[]=[];
 const reason=(array:string[],value:string)=>{if(!array.includes(value))array.push(value);};
 const inspect=(file:OverlaySource)=>{
  const numbers:number[]=[], data:number[]=[];const identifiers=new Set<string>();const flags=new Set<string>();const arrayNames=new Set<string>(),stringNames=new Set<string>();
  if(file.source.length>65535){reason(blockers,file.path+' : plus de 65535 caractères.');return {numbers,data,identifiers,flags,arrayNames,stringNames};}
  let previous=0;
  for(const row of file.source.replace(/\r\n?/g,'\n').split('\n')){
   if(!row.trim())continue;
   const prefix=/^\s*(\d+)(?=\s|[A-Za-z?'&]|$)/.exec(row),number=Number(prefix?.[1]);
   if(!prefix||number<=previous||number>65535){reason(blockers,file.path+' : numérotation non valide ou non croissante.');break;}
   previous=number;numbers.push(number);
   const tokens=tokenize(row);
   for(const [i,token] of tokens.entries()){
    if(token.kind==='keyword'){
     const word=token.text.toUpperCase();
     if(MEM.has(word)||UNCERTAIN.has(word))flags.add(word);
     if(word==='DATA')data.push(number);
    }
    if(token.kind==='identifier'&&IDENT.test(token.text.toUpperCase())){
     const value=token.text.toUpperCase();
     identifiers.add(value);
     if(value.endsWith('$'))stringNames.add(value);
     if(tokens[i+1]?.text==='(')arrayNames.add(value);
    }
   }
  }
  if(analyze(file.source).diagnostics.some(d=>d.severity==='error'))reason(blockers,file.path+' : diagnostics de syntaxe ou de cibles non résolues.');
  return {numbers,data,identifiers,flags,arrayNames,stringNames};
 };
 const a=inspect(host),b=inspect(overlay);
 const collisions=a.numbers.filter(n=>b.numbers.includes(n));
 const shared=[...a.identifiers].filter(x=>b.identifiers.has(x)).sort();
 const has=(word:string)=>a.flags.has(word)||b.flags.has(word);
 const referencesData=has('READ')||has('RESTORE')||has('DATA');
 const usesMemoryControl=[...MEM].some(has);
 const arrayNames=[...new Set([...a.arrayNames,...b.arrayNames])].sort();
 const stringNames=[...new Set([...a.stringNames,...b.stringNames])].sort();
 const hasDeleteClause=has('DELETE');
 const readWithoutRestore=has('READ')&&!has('RESTORE');
 const hasDynamicFlow=[...UNCERTAIN].some(has);
 if(collisions.length)reason(warnings,'Numéros de lignes identiques : vérifier précisément les remplacements opérés par la ROM.');
 if(shared.length)reason(warnings,'Identifiants communs : leur portée et la persistance effective ne sont pas établies.');
 if(referencesData)reason(warnings,'DATA/READ/RESTORE : qualifier ordre et pointeur de lecture avant extraction.');
 if(usesMemoryControl)reason(warnings,'HIMEM, mémoire BASIC, état machine ou directives de type : risque non qualifié.');
 if(hasDynamicFlow)reason(warnings,'Flux/chargement dynamique : la reprise et la pile ne sont pas qualifiées.');
 if(arrayNames.length||has('DIM'))reason(warnings,'Tableaux détectés : dimensions, références et empreinte mémoire après chargement nécessitent des essais CPC.');
 if(stringNames.length)reason(warnings,'Chaînes détectées : contenu, durée de vie et allocations nécessitent des essais CPC.');
 if(readWithoutRestore)reason(warnings,'READ sans RESTORE explicite : le pointeur DATA peut être repositionné par CHAIN MERGE.');
 if(hasDeleteClause)reason(warnings,'Clause DELETE détectée : les lignes effacées et leurs références doivent être vérifiées sur firmware.');
 if(!collisions.length)reason(warnings,'Absence de collision ne prouve pas la sécurité du chargement.');
 return {version:1,hostId:host.id,overlayId:overlay.id,collisions:collisions.slice(0,80),
  collisionsTruncated:collisions.length>80,sharedIdentifiers:shared.slice(0,40),sharedTruncated:shared.length>40,
  hostDataLines:a.data.slice(0,40),overlayDataLines:b.data.slice(0,40),
  referencesData,usesMemoryControl,hasDynamicFlow,hasErrors:!!blockers.length,
  arrayNames:arrayNames.slice(0,20),stringNames:stringNames.slice(0,20),
  hasDeleteClause,readWithoutRestore,
  blockers,warnings,extractionPermitted:false,behavioralProof:'not-run'};
}
