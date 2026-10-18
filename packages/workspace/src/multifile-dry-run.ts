import {analyze, tokenize} from '../../basic-language/src/language.ts';
import {addProjectSource, buildProjectDisk, type ProjectManifest, type SourceSnapshot} from './project.ts';
import {EXPRESSION_EXTRACTION_PROFILE,CONDITIONAL_EXTRACTION_PROFILE,validateTerminalExpressions,validateTerminalConditions} from './terminal-expressions.ts';

export const TERMINAL_EXTRACTION_PROFILE='terminal-goto-chain-merge-v1';
export interface TerminalExtractionInput {
 manifest:ProjectManifest; sources:SourceSnapshot[]; sourceId:string; entryLine:number; newFileName:string;
}
export interface TerminalExtractionPreview {
 version:1; profile:typeof TERMINAL_EXTRACTION_PROFILE|typeof EXPRESSION_EXTRACTION_PROFILE|typeof CONDITIONAL_EXTRACTION_PROFILE;
 original:{manifest:ProjectManifest;sources:SourceSnapshot[];disk:Uint8Array};
 proposed:{manifest:ProjectManifest;sources:SourceSnapshot[];disk:Uint8Array};
 sourceId:string; createdId:string; entryLine:number; gotoLine:number; linesMoved:number;
 checks:string[]; warnings:string[];
 applicationEnabled:false; persistentWrites:0; rollback:'no-write-required';
}
const deny=(why:string):never=>{throw Error('Extraction simulée refusée : '+why);};
const assignment=/^[A-Za-z][A-Za-z0-9]*[%!]?\s*=\s*\d{1,5}$/;
const poke=/^POKE\s+&800[0-3]\s*,\s*(?:\d{1,5}|[A-Za-z][A-Za-z0-9]*[%!]?)$/i;
function permitted(body:string,which:'host'|'module'|'end'):boolean {
 if(which==='end')return /^END$/i.test(body);
 if(which==='host'&&/^MEMORY\s+&7FFF$/i.test(body))return true;
 return assignment.test(body)||poke.test(body);
}
/** Strictly advisory. Cannot replace a GOSUB: CHAIN MERGE does not preserve its stack continuation. */
export function previewTerminalExtraction(input:TerminalExtractionInput):TerminalExtractionPreview {
 const {manifest,sources,sourceId,entryLine,newFileName}=input;
 if(manifest.kind==='binary'||manifest.sources.length!==1||sources.length!==1||manifest.assets.length)
  deny('profil réservé à un seul listing BASIC, sans ressource et hors projet binaire.');
 const item=sources[0]!,declaration=manifest.sources[0]!;
 if(item.id!==declaration.id||item.path!==declaration.path||item.cpcName!==declaration.cpcName||item.id!==sourceId)
  deny('identité de source incohérente.');
 if(item.source.length>4096||item.source.includes('\r')||item.source.includes('\0'))
  deny('source de plus de 4096 caractères ou contenant CR/NUL.');
 if(!Number.isInteger(entryLine)||entryLine<=1||entryLine>65535)deny('numéro de routine invalide.');
 if(typeof newFileName!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,7}$/.test(newFileName))
  deny('nom de nouveau fichier hors profil BASIC 8.3.');
 const lines=item.source.split('\n'),nonblank=lines.filter(row=>row.trim());
 if(!nonblank.length||nonblank.length>40)deny('source vide ou trop longue (>40 lignes).');
 if(lines.some((line,i)=>!line.trim()&&i<lines.length-1))deny('lignes physiques vides au milieu du listing.');
 const entries=nonblank.map(raw=>{
  if(raw.length>255)deny('ligne de plus de 255 caractères.');
  const match=/^(\d+) (.+)$/.exec(raw);if(match===null)throw Error('Extraction simulée refusée : format numéroté strict avec un espace obligatoire.');
  return {number:Number(match[1]),raw,body:match[2]!};
 });
 if(entries.some((e,i)=>e.number<1||e.number>65535||i>0&&e.number<=entries[i-1]!.number))
  deny('numéros BASIC absents, dupliqués ou non croissants.');
 if(analyze(item.source).diagnostics.some(x=>x.severity==='error'))
  deny('diagnostics BASIC préexistants.');
 const index=entries.findIndex(x=>x.number===entryLine);
 if(index<2||index>=entries.length-1)deny('suffixe final insuffisant : au moins deux lignes avant et une après l’entrée.');
 const prefix=entries.slice(0,index),suffix=entries.slice(index);
 if(suffix.length>20||suffix.at(-1)!.body.toUpperCase()!=='END')deny('bloc terminal sans END unique ou plus de 20 lignes.');
 const goto=prefix.filter(x=>/^GOTO\s+\d+$/i.test(x.body));
 if(goto.length!==1||Number(/^GOTO\s+(\d+)$/i.exec(goto[0]!.body)?.[1])!==entryLine||prefix.at(-1)!.number!==goto[0]!.number)
  deny('un seul GOTO littéral vers le suffixe, en dernière ligne avant la routine, est requis.');
 const legacy=prefix.slice(0,-1).every(row=>permitted(row.body,'host'))&&suffix.every((row,i)=>permitted(row.body,i===suffix.length-1?'end':'module'));
 const statements=[...prefix.slice(0,-1),...suffix.slice(0,-1)];
 const conditional=statements.some(row=>tokenize(row.body)[0]?.text.toUpperCase()==='IF');
 if(conditional)validateTerminalConditions(statements);
 else if(!legacy)validateTerminalExpressions(statements);
 // A second jump, RETURN, DATA, READ, RESTORE or dynamic firmware state cannot be admitted through the whitelist.
 for(const row of entries){
  const tokens=tokenize(row.raw);
  if(tokens.some(t=>t.kind==='comment'||t.kind==='data'||legacy&&t.kind==='string'))
   deny('formes opaques, commentaires, chaînes ou données non couvertes.');
 }
 const originalSources=structuredClone(sources),originalManifest=structuredClone(manifest);
 const nextManifest=addProjectSource(manifest,newFileName);
 const declared=nextManifest.sources.at(-1)!;
 const rewritten=prefix.slice(0,-1).map(e=>e.raw);
 rewritten.push(goto[0]!.number+' CHAIN MERGE "'+declared.cpcName+'",'+entryLine);
 const newMain=rewritten.join('\n')+'\n',newModule=suffix.map(e=>e.raw).join('\n')+'\n';
 const proposedSources:SourceSnapshot[]=[{...item,source:newMain},{...declared,source:newModule}];
 // Both full DSK builds validate the source-level construction and all filesystem names/quotas.
 const originalDisk=buildProjectDisk(originalManifest,originalSources);
 const proposedDisk=buildProjectDisk(nextManifest,proposedSources);
 return {version:1,profile:legacy?TERMINAL_EXTRACTION_PROFILE:conditional?CONDITIONAL_EXTRACTION_PROFILE:EXPRESSION_EXTRACTION_PROFILE,
  original:{manifest:originalManifest,sources:originalSources,disk:originalDisk},
  proposed:{manifest:nextManifest,sources:proposedSources,disk:proposedDisk},
  sourceId,createdId:declared.id,entryLine,gotoLine:goto[0]!.number,linesMoved:suffix.length,
  checks:['Source unique et identité de manifeste exactes','Un GOTO terminal littéral remplace une entrée de routine sans GOSUB',
   'Suffixe contigu et terminal END',legacy?'Affectations littérales et POKE &8000..&8003':'Scalaires %/$ initialisés, calculs entiers bornés, chaînes et PRINT/MODE/CLS entièrement contrôlés',
   ...(conditional?['Conditions simples : deux branches contrôlées, au plus 6 IF et 64 chemins conservateurs']:[]),
   'Construction et relecture de deux disquettes AMSDOS réussies'],
  warnings:['Simulation sans écriture : les sources originales et le manifeste ne sont jamais modifiés.',
   'CHAIN MERGE ne reproduit pas un RETURN/GOSUB ; ces structures sont explicitement refusées.',
   'Le code avant/après, la mémoire et le timing ne sont pas déclarés équivalents sans essai sur ROM CPC du cas réel.',
   'L’application séparée exige la même révision et une transaction journalisée ; la simulation ne modifie aucun fichier.'],
  applicationEnabled:false,persistentWrites:0,rollback:'no-write-required'};
}
