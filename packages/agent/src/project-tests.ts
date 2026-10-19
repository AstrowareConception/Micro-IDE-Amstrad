import {buildProjectDisk} from '../../workspace/src/project.ts';
import {parseProjectTests,parseProjectTestReport,PROJECT_TEST_LIMITS,isTestHash,validProjectTestResult,type ProjectTestLibrary,type ProjectTestReport,type ProjectTestImage,type ProjectTestResult,type ProjectScenario,type TestHash} from '../../emulator/src/project-tests.ts';
import type {AgentWorkspaceState,ToolDefinition} from './types.ts';
export interface AgentProjectTestPort {load():Promise<ProjectTestLibrary>;run(image:ProjectTestImage,scenario:ProjectScenario,signal:AbortSignal):Promise<ProjectTestResult>;record(report:ProjectTestReport):Promise<void>}
export interface AgentProjectTestRun {report:ProjectTestReport;definitionStale:boolean;stale:boolean;archiveError?:string}
export interface ProjectTestAssessment {attempted:boolean;valid:boolean;baselined:number;scenarios:number;message:string}
const s={type:'string'};
export const PROJECT_TEST_DEFINITIONS:ToolDefinition[]=[
 {type:'function',name:'project_tests_list',description:'Lit les scénarios enregistrés du vrai projet CPC, leurs attentes immuables et la révision du projet. Aucun listing autonome ni copie de routine ; aucune modification des attentes par l’agent.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}},
 {type:'function',name:'project_tests_run',description:'Construit et exécute le vrai DSK projet dans un CPC isolé, depuis son entrée. Scénario préalablement lu, révisions exactes requises ; ROM locales qualifiées, 1–15 secondes émulées, 60 secondes réelles, cinq essais par mission. Compare écran/fichiers au terme du budget, sans instrumenter le code ni prouver sa terminaison. Aucun fichier produit n’est écrit dans le projet.',strict:true,parameters:{type:'object',properties:{scenarioId:s,expectedRevision:s,expectedProjectSha256:s},required:['scenarioId','expectedRevision','expectedProjectSha256'],additionalProperties:false}}
];
export function projectTestFingerprint(state:AgentWorkspaceState,hash:TestHash):string{
 const {documents:_documents,...manifest}=state.manifest;
 return hash(JSON.stringify({manifest,files:state.files.map(({id,path,cpcName,source})=>({id,path,cpcName,sha256:hash(source)})),assets:(state.assets??[]).map(({id,bytes})=>({id,sha256:hash(bytes)}))}));
}
export function prepareProjectTest(state:AgentWorkspaceState,hash:TestHash):ProjectTestImage{
 if(state.manifest.kind==='binary'||!state.files.length)throw Error('Tests projet réservés à une entrée BASIC.');
 const disk=buildProjectDisk(state.manifest,state.files,state.assets),entry=state.manifest.sources.find(s=>s.id===state.manifest.entryPoint)!.cpcName;
 return {disk,entry,diskSha256:hash(disk),projectSha256:projectTestFingerprint(state,hash),
  sources:state.files.map(({id,path,cpcName,source})=>({id,path,cpcName,sha256:hash(source)})),
  assets:state.manifest.assets.map(asset=>({...{id:asset.id,path:asset.path,cpcName:asset.cpcName},sha256:hash(state.assets!.find(a=>a.id===asset.id)!.bytes)}))};
}
export class AgentProjectTests {
 readonly runs:AgentProjectTestRun[]=[];
 private readonly requested=new Set<string>();
 private read:{revision:string|null;projectSha256:string}|undefined;
 private attempts=0;
 private readonly port:AgentProjectTestPort;private readonly hash:TestHash;private readonly id:()=>string;private readonly signal:()=>AbortSignal;
 constructor(port:AgentProjectTestPort,hash:TestHash,id:()=>string,signal:()=>AbortSignal){this.port=port;this.hash=hash;this.id=id;this.signal=signal;}
 private async library():Promise<ProjectTestLibrary>{const result=await this.port.load();if(result.revision!==null&&!isTestHash(result.revision)||result.revision===null&&result.scenarios.length)throw Error('Révision de scénarios invalide.');return {revision:result.revision,scenarios:parseProjectTests({schemaVersion:1,scenarios:result.scenarios}).scenarios};}
 async list(state:AgentWorkspaceState){
  const library=await this.library(),projectSha256=projectTestFingerprint(state,this.hash);this.read={revision:library.revision,projectSha256};
  return {...library,projectSha256,scope:'DSK complet du projet, entrée du manifeste ; attentes externes au BASIC et non modifiables par l’agent.',limit:'Observations au terme du budget seulement ; aucune couverture de chaque fichier ni terminaison déduite.'};
 }
 views(state:AgentWorkspaceState):AgentProjectTestRun[]{const now=projectTestFingerprint(state,this.hash);return structuredClone(this.runs.map(run=>({...run,stale:run.definitionStale||run.report.project.projectSha256!==now})));}
 async validate(state:AgentWorkspaceState):Promise<AgentProjectTestRun[]>{
  let library:ProjectTestLibrary={revision:null,scenarios:[]};try{library=await this.library();}catch{/* Unreadable expectations invalidate previous evidence. */}
  for(const run of this.runs)run.definitionStale ||= run.report.libraryRevision!==library.revision||!library.scenarios.some(s=>s.id===run.report.scenario.id&&this.hash(JSON.stringify(s))===run.report.scenarioSha256);
  return this.views(state);
 }
 assessment(initial:AgentWorkspaceState,current:AgentWorkspaceState):ProjectTestAssessment{
  const initialHash=projectTestFingerprint(initial,this.hash),currentHash=projectTestFingerprint(current,this.hash);
  let passed=0,baselined=0;
  for(const id of this.requested){
   const last=this.runs.filter(r=>r.report.scenario.id===id).at(-1);
   if(!last||last.definitionStale||last.report.project.projectSha256!==currentHash||last.report.result.outcome!=='passed')continue;
   passed++;
   const before=this.runs.filter(r=>r.report.scenario.id===id&&r.report.project.projectSha256===initialHash).at(-1);
   if(before&&!before.definitionStale&&before.report.result.outcome==='passed'&&before.report.scenarioSha256===last.report.scenarioSha256&&JSON.stringify(before.report.result.firmware)===JSON.stringify(last.report.result.firmware))baselined++;
  }
  const attempted=this.requested.size>0,valid=attempted&&passed===this.requested.size;
  return {attempted,valid,baselined,scenarios:this.requested.size,message:valid?`Projet CPC testé sur sa révision finale : ${passed} scénario(s) réussi(s), ${baselined} avec référence initiale aux mêmes attentes. Observations seulement ; aucune couverture de tous les fichiers ni équivalence universelle.`:'Tests du projet non concluants, périmés ou absents sur la révision finale ; validation non obtenue.'};
 }
 async run(state:AgentWorkspaceState,scenarioId:unknown,expectedRevision:unknown,expectedProjectSha256:unknown):Promise<AgentProjectTestRun>{
  const snapshot=structuredClone(state),projectSha256=projectTestFingerprint(snapshot,this.hash);
  if(typeof scenarioId!=='string'||typeof expectedRevision!=='string'||typeof expectedProjectSha256!=='string'||this.read?.revision!==expectedRevision||this.read.projectSha256!==expectedProjectSha256||projectSha256!==expectedProjectSha256)throw Error('stale-read : relire les scénarios et le projet avant exécution.');
  const library=await this.library();if(library.revision!==expectedRevision)throw Error('stale-read : scénarios modifiés.');
  const scenario=library.scenarios.find(s=>s.id===scenarioId);if(!scenario)throw Error('scope-denied : scénario de projet absent.');
  if(this.attempts>=PROJECT_TEST_LIMITS.attempts)throw Error('quota-exceeded : cinq essais de projet par mission.');
  this.attempts++;this.requested.add(scenarioId);
  const image=prepareProjectTest(snapshot,this.hash),{disk:_disk,...project}=image;
  const signal=AbortSignal.any([this.signal(),AbortSignal.timeout(60_000)]);
  let result:ProjectTestResult;
  try{signal.throwIfAborted();result=await this.port.run(structuredClone(image),structuredClone(scenario),signal);signal.throwIfAborted();if(!validProjectTestResult(result,scenario,image.diskSha256,this.hash))throw Error('Réponse CPC projet invalide ou empreinte incohérente.');}
  catch(error){result={outcome:signal.aborted?'cancelled':'blocked',message:signal.aborted?'Essai projet arrêté ou délai réel atteint.':error instanceof Error?error.message.slice(0,1024):'Essai projet indisponible.',emulatedSeconds:0,observations:[]};}
  const report=parseProjectTestReport({schemaVersion:1,id:this.id(),createdAt:new Date().toISOString(),libraryRevision:expectedRevision,scenarioSha256:this.hash(JSON.stringify(scenario)),scenario,project,result},this.hash);
  const run:AgentProjectTestRun={report,definitionStale:false,stale:false};this.runs.push(run);
  try{await this.port.record(report);}catch{run.archiveError='Rapport visible dans la mission ; archivage impossible.';}
  await this.validate(state);return this.views(state).at(-1)!;
 }
}
