import {analyze, tokenize, type Token} from './language.ts';
import {analyzeControlFlow} from './control-flow.ts';

export const MODULE_REVIEW_LIMITS=Object.freeze({characters:65535,lines:2000,perLine:255,candidates:16,links:24,sharedNames:20,excerptCharacters:1200});
export type ModuleCandidateStatus='review'|'blocked';
export interface BasicModuleCandidate {
 entryLine:number; endLine:number|null; physicalStart:number; physicalEnd:number|null;
 sourceLines:number; callSites:number[]; sharedNames:string[]; sharedNamesTruncated:boolean;
 status:ModuleCandidateStatus; blockers:string[]; checks:string[];
 excerpt:string; excerptTruncated:boolean;
}
export interface BasicModuleLoad {
 basicLine:number; operation:string; literalName:string|null; matchingSourceIds:string[];
}
export interface BasicModuleReview {
 version:1; method:string; sourceId:string; sourcePath:string;
 projectSources:{id:string;path:string;cpcName:string}[];
 flowComplete:boolean; flowReasons:string[];
 candidates:BasicModuleCandidate[]; omittedCandidates:number;
 loads:BasicModuleLoad[]; omittedLoads:number; risks:string[];
 sourceLineCount:number; hasMutations:false;
}
export interface BasicModuleSource {id:string;path:string;cpcName:string;source:string}
export type BasicModuleSibling=Pick<BasicModuleSource,'id'|'path'|'cpcName'>;
export const MODULE_REVIEW_METHOD=
 'Audit de découpage sans mutation ni création de fichier : points GOSUB reconnus, régions numérotées et RETURN autonomes, appels/entrées de flux et variables textuellement communes. Les variables communes ne sont PAS forcément des paramètres ou globals qualifiés. Le graphe BASIC est une approximation, pas un exécuteur. Les lignes proposées sont des aperçus pour revue uniquement. CHAIN, MERGE, RUN, LOAD, DATA, READ, événements, mémoire et flux dynamiques exigent une architecture de chargement CPC, non prise en charge ici. Un statut review ne signifie pas extraction sûre ; aucune garantie de préservation de l’état, des noms, des chargements, du timing ou du firmware.';
const highRisk=new Set('CHAIN MERGE LOAD SAVE RUN CALL POKE PEEK MEMORY HIMEM CLEAR FRE DEFINT DEFREAL DEFSTR ON AFTER EVERY RESUME ERROR READ RESTORE DATA DEF AUTO DELETE RENUM EDIT NEW CONT'.split(' '));
function clipped(values:string[],maximum:number):string[]{return values.slice(0,maximum);}
const ops=new Set(['CHAIN','MERGE','LOAD','RUN']);
function relevant(tokens:Token[]):Token[]{return tokens.filter(t=>t.kind!=='comment'&&t.kind!=='data'&&t.kind!=='string');}
export function analyzeBasicModules(source:BasicModuleSource,siblings:BasicModuleSibling[]=[]):BasicModuleReview {
 const own={id:source.id,path:source.path,cpcName:source.cpcName};
 const projectSources=[own,...siblings.filter(item=>item.id!==own.id)].slice(0,32);
 const report:BasicModuleReview={version:1,method:MODULE_REVIEW_METHOD,sourceId:source.id,sourcePath:source.path,projectSources,
  flowComplete:false,flowReasons:[],candidates:[],omittedCandidates:0,loads:[],omittedLoads:0,risks:[],sourceLineCount:0,hasMutations:false};
 const risk=(message:string)=>{if(!report.risks.includes(message)&&report.risks.length<32)report.risks.push(message);};
 if(source.source.length>MODULE_REVIEW_LIMITS.characters){risk('Source supérieure à 65535 caractères : audit suspendu.');return report;}
 const lines=source.source.split('\n');if(lines.at(-1)==='')lines.pop();
 report.sourceLineCount=lines.length;
 if(lines.length>MODULE_REVIEW_LIMITS.lines){risk('Plus de 2000 lignes : audit suspendu.');return report;}
 const parsed:{number:number;index:number;raw:string;tokens:Token[]}[]=[];
 let previous=0;
 for(let i=0;i<lines.length;i++){
  const raw=lines[i]!;
  if(!raw.trim())continue;
  if(raw.length>MODULE_REVIEW_LIMITS.perLine){risk('Ligne de plus de 255 caractères : audit suspendu.');return report;}
  const m=/^\s*(\d+)(?=\s|[A-Za-z?'&]|$)/.exec(raw),number=Number(m?.[1]);
  if(!m||number<=previous||number>65535){risk('Numérotation BASIC absente, répétée ou non croissante : audit suspendu.');return report;}
  previous=number;
  const tokens=tokenize(raw,257);
  if(tokens.length>256){risk('Plus de 256 tokens dans une ligne : audit suspendu.');return report;}
  parsed.push({number,index:i,raw,tokens});
  if(tokens.some(t=>t.kind==='string'&&(t.text.length<2||!t.text.endsWith('"'))))risk('Chaîne non terminée : parcours de chargement et dépendances non qualifiés.');
 }
 const allNumbers=new Set(parsed.map(p=>p.number));
 const diagnoses=analyze(source.source).diagnostics.filter(x=>x.severity==='error');
 if(diagnoses.length)risk('Diagnostics BASIC bloquants : revue de modules seulement après correction.');
 for(const row of parsed){
  const tokens=relevant(row.tokens);
  for(let j=0;j<row.tokens.length;j++){
   const token=row.tokens[j]!;
   if(token.kind!=='keyword')continue;
   const name=token.text.toUpperCase();
   if(highRisk.has(name))risk('Instructions à état, disque, événements ou flux non qualifié détectées : extraction automatique interdite.');
   if(!ops.has(name))continue;
   if(report.loads.length>=MODULE_REVIEW_LIMITS.links){report.omittedLoads++;continue;}
   const next=row.tokens[j+1],literal=next?.kind==='string'&&next.text.length>=2&&next.text.endsWith('"')?next.text.slice(1,-1):null;
   const matchingSourceIds=literal===null?[]:projectSources.filter(item=>item.cpcName.toUpperCase()===literal.toUpperCase()||item.cpcName.replace(/\.[^.]*$/,'').toUpperCase()===literal.replace(/\.[^.]*$/,'').toUpperCase()).map(item=>item.id);
   report.loads.push({basicLine:row.number,operation:name,literalName:literal,matchingSourceIds});
  }
  if(tokens.some(t=>t.kind==='identifier'&&/^FN/i.test(t.text)))risk('Appels FN ou noms collés : vérifier les dépendances et les types avant toute extraction.');
 }
 const flow=analyzeControlFlow(source.source);
 report.flowComplete=flow.complete;report.flowReasons=clipped(flow.reasons,12);
 if(!flow.complete)risk('Graphe de contrôle partiel : aucune frontière de module ne peut être qualifiée.');
 const subs=flow.entries.filter(x=>x.kind==='subroutine');
 const names=(subset:typeof parsed)=>new Set(subset.flatMap(row=>row.tokens.filter(t=>t.kind==='identifier').map(t=>t.text.toUpperCase())));
 for(const sub of subs) {
  if(report.candidates.length>=MODULE_REVIEW_LIMITS.candidates){report.omittedCandidates++;continue;}
  const entry=flow.nodes[sub.node]?.basicLine;
  if(!entry||!allNumbers.has(entry))continue;
  const pos=parsed.findIndex(row=>row.number===entry);
  if(pos<0)continue;
  const blockers:string[]=[];
  const block=(message:string)=>{if(!blockers.includes(message))blockers.push(message);};
  if(!flow.complete||report.risks.length)block('Contexte global non qualifié : examiner les risques du rapport.');
  const before=parsed[pos-1];
  if(!before)block('La routine est à la première ligne : le point d’entrée RUN serait déplacé.');
  else {
   const body=relevant(before.tokens).filter(t=>t.kind!=='number'||t.start!==0);
   if(body.length!==1||body[0]!.kind!=='keyword'||!['END','STOP','RETURN'].includes(body[0]!.text.toUpperCase()))block('Pas de barrière de flux simple (END/STOP/RETURN) juste avant la routine.');
  }
  const endIndex=parsed.findIndex((row,i)=>i>=pos&&row.tokens.some(t=>t.kind==='keyword'&&t.text.toUpperCase()==='RETURN')&&
   row.tokens.filter(t=>t.kind!=='number'||t.start!==0).filter(t=>t.kind!=='comment').length===1);
  if(endIndex<pos)block('Aucun RETURN autonome final reconnu pour délimiter la routine.');
  const end=endIndex>=pos?parsed[endIndex]:undefined;
  if(end&&parsed.slice(pos,endIndex+1).some(row=>row.tokens.some(t=>t.kind==='keyword'&&t.text.toUpperCase()==='IF')))block('IF dans la région : fins conditionnelles et portées à vérifier manuellement.');
  const region=end?parsed.slice(pos,endIndex+1):parsed.slice(pos,Math.min(parsed.length,pos+12));
  if(end){
   if(subs.some(other=>other.node!==sub.node&&flow.nodes[other.node]?.basicLine!==undefined&&
     flow.nodes[other.node]!.basicLine>entry&&flow.nodes[other.node]!.basicLine<=end.number))block('Autre entrée de routine imbriquée dans le segment.');
   for(const edge of flow.edges){
    if(edge.to===null)continue;
    const from=flow.nodes[edge.from],to=flow.nodes[edge.to];
    if(!from||!to)continue;
    const insideFrom=from.basicLine>=entry&&from.basicLine<=end.number;
    const insideTo=to.basicLine>=entry&&to.basicLine<=end.number;
    if(!insideFrom&&insideTo && !(edge.kind==='call'&&to.basicLine===entry))block('Liaison entrante non GOSUB vers la région : déplacement dangereux.');
    if(insideFrom&&!insideTo && ['jump','case','handler','recovery','unknown'].includes(edge.kind))block('Liaison sortante vers une autre région : dépendance de flux.');
   }
  }
  const calls=flow.calls.filter(call=>call.callee===sub.node).map(call=>flow.nodes[call.site]?.basicLine).filter((x):x is number=>x!==undefined);
  if(!calls.length)block('Aucun appel GOSUB direct prouvé depuis l’extérieur.');
  const external=parsed.filter(row=>!end||row.number<entry||row.number>end.number);
  const externals=names(external);
  const shared=[...names(region)].filter(x=>externals.has(x)).sort();
  const preview=region.map(x=>x.raw).join('\n');
  const checks=[
   'Documenter les variables partagées, les tableaux et les fonctions avant de choisir un mécanisme de passage d’état.',
   'Qualifier CHAIN/MERGE, les fichiers AMSDOS et les ressources en mémoire sur CPC 6128.',
   'Comparer les essais CPC avant/après sur les vrais listings ; vérifier pile GOSUB, mémoire et timing.'
  ];
  report.candidates.push({entryLine:entry,endLine:end?.number??null,physicalStart:parsed[pos]!.index+1,physicalEnd:end?end.index+1:null,
   sourceLines:region.length,callSites:[...new Set(calls)].sort((a,b)=>a-b).slice(0,24),
   sharedNames:shared.slice(0,MODULE_REVIEW_LIMITS.sharedNames),sharedNamesTruncated:shared.length>MODULE_REVIEW_LIMITS.sharedNames,
   status:blockers.length?'blocked':'review',blockers,checks,
   excerpt:preview.slice(0,MODULE_REVIEW_LIMITS.excerptCharacters),excerptTruncated:preview.length>MODULE_REVIEW_LIMITS.excerptCharacters});
 }
 if(!report.candidates.length)risk('Aucune sous-routine GOSUB qualifiée dans les limites actuelles.');
 return report;
}
