import { tokenize, type Token } from './language.ts';

export const LOAD_CONTRACT_LIMITS = Object.freeze({ sources: 64, sourceCharacters: 65535, lines: 2000, links: 64 });
export type LoadOperation = 'CHAIN' | 'CHAIN MERGE' | 'MERGE' | 'RUN FILE' | 'LOAD';
export interface LoadContractSource { id: string; path: string; cpcName: string; source: string }
export interface LoadContractLink {
 sourceId: string; basicLine: number; operation: LoadOperation;
 rawTarget: string | null; resolvedCpcName: string | null; targetId: string | null;
 status: 'local-literal' | 'external-literal' | 'dynamic' | 'unsupported';
 blockers: string[];
}
export interface LoadContractReport {
 schemaVersion: 1; method: string; sources: { id: string; path: string; cpcName: string }[];
 links: LoadContractLink[]; truncated: boolean; risks: string[]; cycles: string[][];
 extractionPermitted: false; executableProof: 'not-run';
}
export const LOAD_CONTRACT_METHOD = 'Contrat lexical conservateur, borné et en lecture seule pour CHAIN, CHAIN MERGE, MERGE, RUN avec nom de fichier et LOAD. Un lien littéral vers une source du projet n’établit pas la validité du chargement sur firmware. Les suffixes BASIC sont résolus pour la navigation uniquement. Les chargements conditionnels, cibles dynamiques, ressources binaires, fusion de numéros, variables persistantes, pile, mémoire et timing ne sont pas qualifiés. La preuve firmware doit être exécutée séparément sur des fixtures connues ; aucune extraction automatique autorisée.';
const CPC_NAME = /^[A-Z0-9_&]{1,8}(?:\.[A-Z0-9_&]{1,3})?$/;
const upper=(t:Token|undefined)=>t?.text.toUpperCase()??'';
function filename(raw:string):string|null {
 const value=raw.toUpperCase();
 if(!CPC_NAME.test(value))return null;
 return value.includes('.')?value:value+'.BAS';
}
function cyclesOf(links:LoadContractLink[]):string[][] {
 const edges=new Map<string,string[]>();
 for(const link of links) if(link.targetId&&(link.operation==='CHAIN'||link.operation==='CHAIN MERGE')){
  const next=edges.get(link.sourceId)??[];next.push(link.targetId);edges.set(link.sourceId,next);
 }
 const found:string[][]=[],visited=new Set<string>(),active=new Map<string,number>(),path:string[]=[];
 const visit=(id:string):void=>{
  if(visited.has(id))return;
  const start=active.get(id);
  if(start!==undefined){
   if(found.length<8)found.push(path.slice(start));
   return;
  }
  active.set(id,path.length);path.push(id);
  for(const to of edges.get(id)??[])visit(to);
  path.pop();active.delete(id);visited.add(id);
 };
 for(const root of edges.keys())visit(root);
 return found;
}
/** A link audit, not a valid BASIC semantics or execution oracle. */
export function inspectLoadContract(sources:LoadContractSource[]):LoadContractReport {
 if(sources.length<1||sources.length>LOAD_CONTRACT_LIMITS.sources||new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('Contrat de chargement : sources absentes, dupliquées ou trop nombreuses.');
 const report:LoadContractReport={schemaVersion:1,method:LOAD_CONTRACT_METHOD,
  sources:sources.map(({id,path,cpcName})=>({id,path,cpcName})),links:[],truncated:false,risks:[],cycles:[],extractionPermitted:false,executableProof:'not-run'};
 const risk=(reason:string)=>{if(!report.risks.includes(reason)&&report.risks.length<32)report.risks.push(reason);};
 const byName=new Map(sources.map(s=>[s.cpcName.toUpperCase(),s.id]));
 for(const source of sources){
  if(source.source.length>LOAD_CONTRACT_LIMITS.sourceCharacters){risk(source.path+' : source supérieure à 65535 caractères, non inspectée.');report.truncated=true;continue;}
  const lines=source.source.split('\n');if(lines.at(-1)==='')lines.pop();
  if(lines.length>LOAD_CONTRACT_LIMITS.lines){risk(source.path+' : plus de 2000 lignes, non inspectée.');report.truncated=true;continue;}
  for(const line of lines){
   if(!line.trim())continue;
   const prefix=/^\s*(\d+)(?=\s|[A-Za-z?'&]|$)/.exec(line);
   if(!prefix){risk(source.path+' : numérotation partiellement inconnue.');report.truncated=true;break;}
   const basicLine=Number(prefix[1]);
   const tokens=tokenize(line,256);
   if(tokens.length>=256){risk(source.path+' : tokens tronqués.');report.truncated=true;continue;}
   // A line number is never an instruction. Ignore quoted, DATA and REM payloads.
   const code=tokens.filter(t=>t.start>=prefix[0].length);
   for(let i=0;i<code.length;i++){
    const t=code[i]!;
    if(t.kind!=='keyword'||!['CHAIN','MERGE','RUN','LOAD'].includes(upper(t)))continue;
    if(report.links.length>=LOAD_CONTRACT_LIMITS.links){report.truncated=true;continue;}
    const chained=upper(t)==='CHAIN'&&upper(code[i+1])==='MERGE';
    const name=chained?'CHAIN MERGE':upper(t)==='RUN'?'RUN FILE':upper(t) as LoadOperation;
    if(chained)i++;
    const at=i+1,next=code[at];
    // RUN with a BASIC line number is an internal transfer, not a disk dependency.
    if(name==='RUN FILE'&&next?.kind==='number')continue;
    const quoted=next?.kind==='string'&&next.text.endsWith('"')&&next.text.length>=2?next.text.slice(1,-1):null;
    const resolved=quoted?filename(quoted):null;
    const targetId=resolved?byName.get(resolved)??null:null;
    const blockers:string[]=[];
    const conditional=code.some(x=>x.kind==='keyword'&&['IF','THEN','ELSE','ON'].includes(upper(x)));
    if(conditional)blockers.push('Chargement conditionnel ou événementiel : contexte inconnu.');
    if(!quoted)blockers.push('Cible dynamique ou absence de chaîne littérale.');
    if(quoted&&!resolved)blockers.push('Nom de fichier hors du profil CPC 8.3.');
    if(resolved&&!targetId)blockers.push('Cible externe ou absente du projet.');
    if(name==='LOAD')blockers.push('LOAD peut désigner du binaire ou des données ; profil mémoire inconnu.');
    // Commas and transfer line parameters are not interpreted as guarantees.
    const tail=code.slice(at+1).filter(x=>x.text!==':');
    if(tail.some(x=>x.kind==='keyword'&&['CHAIN','MERGE','RUN','LOAD'].includes(upper(x))))blockers.push('Plusieurs chargements sur une ligne : ordre et effets à qualifier.');
    const status:LoadContractLink['status']=!quoted?'dynamic':!resolved?'unsupported':!targetId?'external-literal':'local-literal';
    report.links.push({sourceId:source.id,basicLine,operation:name,rawTarget:quoted,resolvedCpcName:resolved,targetId,status,blockers});
   }
  }
 }
 report.cycles=cyclesOf(report.links);
 if(report.cycles.length)risk('Cycle CHAIN entre sources : terminaison et points d’entrée à qualifier.');
 if(report.links.some(link=>link.blockers.length))risk('Au moins un chargement hors profil ou non résolu : aucune conversion autorisée.');
 if(report.links.some(link=>link.operation==='CHAIN MERGE'||link.operation==='MERGE'))risk('Fusion des numéros de ligne et persistance des variables : preuve firmware requise.');
 return report;
}
