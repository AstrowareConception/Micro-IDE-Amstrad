import {parseBasicScenario,validateScenarioBudget,type BasicScenario,type BasicScenarioObservation,validScenarioObservations} from './basic-test-scenario.ts';
import {runCommand} from './run.ts';
import {BASIC_TEST_FIRMWARE} from './basic-test-runtime.ts';
export const PROJECT_TEST_LIMITS={scenarios:16,attempts:5,seconds:15,libraryBytes:131072,history:10,historyBytes:2097152} as const;
export type ProjectCheck={kind:'file';name:string;text:string}|{kind:'screen';name:string;x:number;y:number;width:number;height:number;sha256:string};
export interface ProjectScenario {id:string;name:string;seconds:number;inputs:{atMs:number;text:string}[];checks:ProjectCheck[]}
export interface ProjectTestLibrary {revision:string|null;scenarios:ProjectScenario[]}
export interface ProjectTestIdentity {projectSha256:string;diskSha256:string;entry:string;sources:{id:string;path:string;cpcName:string;sha256:string}[];assets:{id:string;path:string;cpcName:string;sha256:string}[]}
export interface ProjectTestImage extends ProjectTestIdentity {disk:Uint8Array}
export interface ProjectTestResult {outcome:'passed'|'failed'|'blocked'|'cancelled';message:string;emulatedSeconds:number;observations:BasicScenarioObservation[];diskSha256?:string;firmware?:Record<'os'|'basic'|'amsdos',string>}
export interface ProjectTestReport {schemaVersion:1;id:string;createdAt:string;libraryRevision:string;scenarioSha256:string;scenario:ProjectScenario;project:ProjectTestIdentity;result:ProjectTestResult}
export type TestHash=(value:string|Uint8Array)=>string;
export const isTestHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function object(value:unknown,keys:string[],optional:string[]=[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Objet de scénario requis.');
 const item=value as Record<string,unknown>;
 if(keys.some(key=>!Object.hasOwn(item,key))||Object.keys(item).some(key=>![...keys,...optional].includes(key)))throw Error('Propriété de scénario absente ou inconnue.');return item;
}
function text(value:unknown,max:number):string{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw Error('Texte de scénario invalide.');return value;}
function id(value:unknown):string{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(value))throw Error('Identifiant de scénario invalide.');return value;}
function integer(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)throw Error('Entier de scénario requis.');return Number(value);}
export function projectScenarioPlan(value:ProjectScenario):BasicScenario{
 // Reuse the existing bounded screen/file/keyboard grammar. These rows are never executed or added to the DSK.
 const rows=[...value.inputs.map(i=>`REM @CPCINPUT ${i.atMs} ${JSON.stringify(i.text)}`),...value.checks.map(c=>c.kind==='file'?`REM @CPCFILE ${c.name} ${JSON.stringify(c.text)}`:`REM @CPCSCREEN ${c.name} ${c.x} ${c.y} ${c.width} ${c.height} ${c.sha256}`)];
 const scenario=parseBasicScenario(rows.map((row,index)=>`${index+1} ${row}`).join('\n'));
 if(!scenario||!scenario.checks.length)throw Error('Au moins une observation écran ou fichier est requise.');
 validateScenarioBudget(scenario,value.seconds);return scenario;
}
export function parseProjectScenario(value:unknown):ProjectScenario{
 const s=object(value,['id','name','seconds','inputs','checks']);
 const seconds=integer(s.seconds);if(seconds<1||seconds>PROJECT_TEST_LIMITS.seconds)throw Error('Budget projet : 1–15 secondes émulées.');
 if(!Array.isArray(s.inputs)||s.inputs.length>8||!Array.isArray(s.checks)||!s.checks.length||s.checks.length>8)throw Error('Scénario : 8 saisies et 1–8 observations maximum.');
 const inputs=s.inputs.map(raw=>{const i=object(raw,['atMs','text']);if(typeof i.text!=='string')throw Error('Saisie invalide.');return {atMs:integer(i.atMs),text:i.text};});
 const checks:ProjectCheck[]=s.checks.map(raw=>{
  const c=object(raw,['kind','name'],['text','x','y','width','height','sha256']);
  if(c.kind==='file'){object(raw,['kind','name','text']);if(typeof c.text!=='string')throw Error('Attente fichier invalide.');return {kind:'file',name:text(c.name,12),text:c.text};}
  if(c.kind!=='screen')throw Error('Observation écran ou fichier requise.');object(raw,['kind','name','x','y','width','height','sha256']);
  if(!isTestHash(c.sha256))throw Error('Empreinte écran invalide.');
  return {kind:'screen',name:text(c.name,40),x:integer(c.x),y:integer(c.y),width:integer(c.width),height:integer(c.height),sha256:c.sha256};
 });
 const scenario={id:id(s.id),name:text(s.name,100),seconds,inputs,checks};projectScenarioPlan(scenario);return scenario;
}
export function parseProjectTests(value:unknown):{schemaVersion:1;scenarios:ProjectScenario[]}{
 const v=object(value,['schemaVersion','scenarios']);if(v.schemaVersion!==1||!Array.isArray(v.scenarios)||v.scenarios.length>PROJECT_TEST_LIMITS.scenarios)throw Error('Version 1 et 16 scénarios maximum requis.');
 const scenarios=v.scenarios.map(parseProjectScenario);if(new Set(scenarios.map(s=>s.id)).size!==scenarios.length)throw Error('Scénario dupliqué.');return {schemaVersion:1,scenarios};
}
export function validProjectTestResult(value:unknown,scenario:ProjectScenario,diskSha256:string,hash:TestHash):value is ProjectTestResult{
 try{
  const r=object(value,['outcome','message','emulatedSeconds','observations'],['diskSha256','firmware']);
  if(!['passed','failed','blocked','cancelled'].includes(String(r.outcome))||typeof r.message!=='string'||r.message.length>1024||typeof r.emulatedSeconds!=='number'||!Number.isFinite(r.emulatedSeconds)||r.emulatedSeconds<0||r.emulatedSeconds>30||!Array.isArray(r.observations))return false;
  if(r.diskSha256!==undefined&&r.diskSha256!==diskSha256)return false;
  if(r.firmware!==undefined){const f=object(r.firmware,['os','basic','amsdos']);if(Object.keys(BASIC_TEST_FIRMWARE).some(role=>f[role]!==BASIC_TEST_FIRMWARE[role as keyof typeof BASIC_TEST_FIRMWARE]))return false;}
  if(r.outcome==='blocked'||r.outcome==='cancelled')return r.observations.length===0;
  if(r.diskSha256!==diskSha256||r.firmware===undefined||r.emulatedSeconds<scenario.seconds+5)return false;
  const checks=projectScenarioPlan(scenario).checks.map(c=>({...c,sha256:c.kind==='screen'?c.sha256:hash(c.text)}));
  if(!validScenarioObservations(r.observations,checks))return false;
  return r.outcome===(r.observations.every(o=>o.outcome==='passed')?'passed':'failed');
 }catch{return false;}
}
export function parseProjectTestReport(value:unknown,hash:TestHash):ProjectTestReport{
 const r=object(value,['schemaVersion','id','createdAt','libraryRevision','scenarioSha256','scenario','project','result']);
 if(r.schemaVersion!==1||!isTestHash(r.libraryRevision)||!isTestHash(r.scenarioSha256)||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||new Date(r.createdAt).toISOString()!==r.createdAt)throw Error('Provenance du rapport projet invalide.');
 const scenario=parseProjectScenario(r.scenario);if(hash(JSON.stringify(scenario))!==r.scenarioSha256)throw Error('Scénario du rapport incohérent.');
 const p=object(r.project,['projectSha256','diskSha256','entry','sources','assets']);
 if(!isTestHash(p.projectSha256)||!isTestHash(p.diskSha256)||typeof p.entry!=='string'||!Array.isArray(p.sources)||!p.sources.length||p.sources.length>64||!Array.isArray(p.assets)||p.assets.length>64)throw Error('Identité du projet testée invalide.');
 runCommand(p.entry);
 const files=(items:unknown[])=>items.map(raw=>{const f=object(raw,['id','path','cpcName','sha256']);if(!isTestHash(f.sha256))throw Error('Empreinte de fichier invalide.');return {id:id(f.id),path:text(f.path,240),cpcName:text(f.cpcName,12),sha256:f.sha256};});
 const project={projectSha256:p.projectSha256,diskSha256:p.diskSha256,entry:p.entry,sources:files(p.sources),assets:files(p.assets)};
 const all=[...project.sources,...project.assets];
 if(!project.sources.some(f=>f.cpcName===project.entry)||['id','path','cpcName'].some(key=>new Set(all.map(f=>f[key as keyof typeof f])).size!==all.length))throw Error('Entrée absente ou identité de fichier dupliquée.');
 if(!validProjectTestResult(r.result,scenario,project.diskSha256,hash))throw Error('Résultat de projet incohérent.');
 return {schemaVersion:1,id:id(r.id),createdAt:r.createdAt,libraryRevision:r.libraryRevision,scenarioSha256:r.scenarioSha256,scenario,project,result:structuredClone(r.result)};
}
