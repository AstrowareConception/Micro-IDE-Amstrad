import { SYMBOL_ROLE_LABELS, type SymbolIndex, type SymbolLocation } from './symbols.ts';

export type SymbolNavigationMode = 'usages' | 'declarations';
export interface SymbolNavigationQuery { sourceId: string; line: number; column: number; mode: SymbolNavigationMode }
export interface SymbolNavigationTarget { location: SymbolLocation; label: string; possible: boolean }
export interface SymbolNavigationResult extends SymbolNavigationQuery {
 sourceName: string; status: 'found' | 'uncovered' | 'limited'; name?: string;
 targets: SymbolNavigationTarget[]; total: number; notes: string[];
}
export const SYMBOL_NAVIGATION_LIMIT = 200;
/** Coordinates are physical lines (1-based) and UTF-16 columns (0-based), end excluded. */
export function navigateSymbol(index: SymbolIndex, query: SymbolNavigationQuery): SymbolNavigationResult {
 const result: SymbolNavigationResult = {...query, sourceName:index.name, status:'uncovered', targets:[], total:0,
  notes:['Recherche dans cette source uniquement, sur les occurrences couvertes. Aucun lien ne prouve un chemin exécuté.']};
 if(query.sourceId!==index.id || !Number.isInteger(query.line) || !Number.isInteger(query.column) || query.line<1 || query.column<0)return result;
 if(index.status==='limited'){result.status='limited';result.notes.push('Budget atteint : index de la source retiré.');return result;}
 const hit=(location:SymbolLocation)=>location.line===query.line&&location.start<=query.column&&query.column<location.end;
 const targets=new Map<string,SymbolNavigationTarget>();
 const add=(location:SymbolLocation,label:string,possible=false)=>{
  const key=`${location.line}:${location.start}:${location.end}`, previous=targets.get(key);
  targets.set(key,{location,label:previous?.label??label,possible:possible||!!previous?.possible});
 };
 const definitions=index.functions.definitions, calls=index.functions.calls;
 const definition=definitions.find(d=>hit(d.location)), call=calls.find(c=>hit(c.location));
 if(definition||call){
  result.name=`FN ${(definition??call)!.name}`;result.status='found';
  const keys=new Set(definition?[definition.key]:call!.definitionKeys);
  result.notes.push('Déclarations et appels possibles : ni définition active ni validité des arguments garanties. Les appels sans déclaration couverte ne sont pas rapprochés par leur nom.');
  if(query.mode==='declarations')for(const d of definitions){if(keys.has(d.key))add(d.location,'Déclaration FN possible',true);}
  else for(const c of calls){if(c===call||c.definitionKeys.some(key=>keys.has(key)))add(c.location,'Appel FN possible',true);}
 }else{
  const owner=definitions.find(d=>d.parameters.some(p=>hit(p.location))||d.reads.some(r=>hit(r.location)));
  const parameter=owner?.parameters.find(p=>hit(p.location)), read=owner?.reads.find(r=>hit(r.location));
  const symbol=index.symbols.find(s=>s.occurrences.some(hit));
  if(parameter||read?.binding==='parameter'||read?.binding==='ambiguous'){
   result.name=(parameter??read)!.name;result.status='found';
   const keys=new Set(parameter?[parameter.key]:read!.parameterKeys);
   result.notes.push('Paramètres de cette définition FN uniquement. Les liaisons de type ou les homonymes non résolus restent possibles.');
   for(const p of owner!.parameters)if(keys.has(p.key))add(p.location,'Paramètre local',!!read&&read.binding==='ambiguous');
   if(query.mode==='usages')for(const r of owner!.reads)if(r.parameterKeys.some(key=>keys.has(key)))add(r.location,'Lecture du paramètre',r.binding==='ambiguous');
  }else if(symbol||read){
   const name=(symbol??read)!.name, kind=(symbol??read)!.kind;
   result.name=name+(kind==='array'?'(…)':'');result.status='found';
   result.notes.push('Rapprochement textuel : casse ignorée, suffixes et scalaires/tableaux séparés. Les alias implicites ne sont pas fusionnés.');
   if(query.mode==='declarations')result.notes.push('Le BASIC n’exige pas de déclaration de variable : seules les affectations et dimensions couvertes sont proposées, sans preuve d’initialisation.');
   const global=symbol??index.symbols.find(s=>s.name===name&&s.kind===kind);
   for(const occurrence of global?.occurrences??[])if(query.mode==='usages'||['write','read-write','dimension'].includes(occurrence.role))add(occurrence,SYMBOL_ROLE_LABELS[occurrence.role],query.mode==='declarations');
   if(query.mode==='usages')for(const d of definitions)for(const r of d.reads)if(r.binding==='free'&&r.name===name&&r.kind===kind)add(r.location,'Lecture libre dans FN');
  }
 }
 if(result.status==='uncovered')result.notes.push('Aucun symbole couvert à cette position. Placez le curseur dans le nom ; chaînes, DATA, commentaires et formes omises ne sont pas recherchés.');
 const sorted=[...targets.values()].sort((a,b)=>a.location.line-b.location.line||a.location.start-b.location.start);
 result.total=sorted.length;result.targets=sorted.slice(0,SYMBOL_NAVIGATION_LIMIT);return result;
}
