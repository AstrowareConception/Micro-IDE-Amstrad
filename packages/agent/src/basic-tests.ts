import { basicTestPlan, validBasicTestResult, type BasicTestSource, type BasicTestResult } from '../../emulator/src/basic-tests.ts';
import { validateScenarioBudget } from '../../emulator/src/basic-test-scenario.ts';
import type { BasicTestLibrary, BasicTestReport } from '../../emulator/src/basic-test-suites.ts';
import type { AgentWorkspaceState, ToolDefinition } from './types.ts';
export interface AgentTestPort {
 load(): Promise<BasicTestLibrary>;
 run(source: BasicTestSource, seconds: number, signal: AbortSignal): Promise<BasicTestResult>;
 record(report: BasicTestReport): Promise<void>;
}
export interface AgentTestRun { report: BasicTestReport; workspaceHash: string; suiteRevision: string; stale: boolean; archiveError?: string }
/** A passing fixture with a different project source ID never covers the changed program. */
export interface AgentTestCoverageSource { id: string; path: string; beforeSha256: string | null; afterSha256: string; beforePassed: boolean; afterPassed: boolean }
export interface AgentTestCoverage { sources: AgentTestCoverageSource[]; directlyTested: number; baselined: number }
export const TEST_DEFINITIONS: ToolDefinition[] = [
 { type:'function', name:'basic_tests_list', description:'Liste les suites BASIC enregistrées et leur révision. Chaque listing est autonome, exécuté seul ; aucune couverture implicite du projet.', strict:true, parameters:{type:'object',properties:{},required:[],additionalProperties:false} },
 { type:'function', name:'basic_tests_run', description:'Exécute une suite préalablement lue sur des CPC isolés, ROM locales qualifiées requises. 60 s réelles par suite, 5 suites par mission. Retourne assertions et empreintes, jamais les ROM. Ne modifie pas les sources ni les attentes.', strict:true, parameters:{type:'object',properties:{suiteId:{type:'string'},expectedRevision:{type:'string'}},required:['suiteId','expectedRevision'],additionalProperties:false} },
];
/** No emulator, firmware or disk access belongs to this application service. */
export class AgentBasicTests {
 readonly runs: AgentTestRun[] = [];
 private readRevision: string | null | undefined;
 private attempts = 0;
 private readonly port: AgentTestPort; private readonly hash:(text:string)=>string; private readonly id:()=>string; private readonly signal:()=>AbortSignal;
 constructor(port:AgentTestPort,hash:(text:string)=>string,id:()=>string,signal:()=>AbortSignal){this.port=port;this.hash=hash;this.id=id;this.signal=signal;}
 fingerprint(state:AgentWorkspaceState):string { const {documents:_documents,...manifest}=state.manifest; return this.hash(JSON.stringify({manifest,files:state.files.map(({id,path,cpcName,source})=>({id,path,cpcName,source}))})); }
 views(state:AgentWorkspaceState):AgentTestRun[] { const hash=this.fingerprint(state); return this.runs.map(run=>({...run,stale:run.stale || run.workspaceHash!==hash})); }
 /** Only an exact executed project source can attest a transformation; comparisons are per mission. */
 coverage(initial:AgentWorkspaceState,current:AgentWorkspaceState):AgentTestCoverage {
  const beforeHash=this.fingerprint(initial),afterHash=this.fingerprint(current);
  const successful=(fingerprint:string,id:string,path:string,digest:string,suiteId?:string|null):boolean=>this.runs.some(run=>
   !run.stale && run.workspaceHash===fingerprint && (suiteId===undefined || run.report.suiteId===suiteId) &&
   run.report.sources.length===run.report.results.length && run.report.results.every(result=>result.outcome==='passed') &&
   run.report.sources.some((source,index)=>source.id===id && source.name===path && source.sha256===digest &&
    run.report.results[index]?.sourceId===id && run.report.results[index]?.name===path &&
    run.report.results[index]?.sourceSha256===digest)
  );
  const sources=current.files.flatMap(file=>{
   const old=initial.files.find(item=>item.id===file.id);
   if(old?.source===file.source && old.path===file.path && old.cpcName===file.cpcName)return [];
   const beforeSha256=old?this.hash(old.source):null,afterSha256=this.hash(file.source);
   const finalRuns=this.runs.filter(run=>!run.stale && run.workspaceHash===afterHash &&
    run.report.sources.some((source,index)=>source.id===file.id && source.name===file.path && source.sha256===afterSha256 &&
     run.report.results[index]?.sourceSha256===afterSha256 && run.report.results[index]?.outcome==='passed') &&
    run.report.results.every(result=>result.outcome==='passed'));
   const afterPassed=finalRuns.length>0;
   const beforePassed=!!old && finalRuns.some(run=>successful(beforeHash,old.id,old.path,beforeSha256!,run.report.suiteId));
   return [{id:file.id,path:file.path,beforeSha256,afterSha256,beforePassed,afterPassed}];
  });
  return {sources,directlyTested:sources.filter(source=>source.afterPassed).length,baselined:sources.filter(source=>source.beforePassed).length};
 }
 async validate(state:AgentWorkspaceState):Promise<AgentTestRun[]> {
  if(!this.runs.length)return [];
  let revision:string|null=null;try{revision=(await this.port.load()).revision;}catch{/* Unreadable suite cannot validate a report. */}
  for(const run of this.runs)if(run.suiteRevision!==revision)run.stale=true;
  return this.views(state);
 }
 async list(state:AgentWorkspaceState) {
  const library=await this.port.load(); this.readRevision=library.revision;
  return {...library,suites:library.suites.map(suite=>({...suite,sources:suite.sourceIds.map(id=>{const file=state.files.find(f=>f.id===id);return {id,name:file?.path??null,sha256:file?this.hash(file.source):null};})})),limit:'Listings autonomes uniquement. Une copie de routine dans un test ne vérifie pas la routine du programme principal.'};
 }
 async run(state:AgentWorkspaceState,suiteId:unknown,expectedRevision:unknown):Promise<AgentTestRun> {
  if(typeof suiteId!=='string'||typeof expectedRevision!=='string'||expectedRevision!==this.readRevision) throw Error('stale-read : lire les suites avant exécution.');
  const library=await this.port.load();
  if(library.revision!==expectedRevision) throw Error('stale-read : suites modifiées.');
  const suite=library.suites.find(s=>s.id===suiteId); if(!suite) throw Error('scope-denied : suite absente.');
  const plans=suite.sourceIds.map(id=>{const file=state.files.find(f=>f.id===id);if(!file)throw Error('Source de test absente du projet.');const plan=basicTestPlan({id,name:file.path,source:file.source});validateScenarioBudget(plan.scenario,suite.seconds);return plan;});
  if(this.attempts>=5)throw Error('quota-exceeded : 5 exécutions de suite par mission.');
  this.attempts++;
  const signal=AbortSignal.any([this.signal(),AbortSignal.timeout(60_000)]);
  const report:BasicTestReport={schemaVersion:1,id:this.id(),createdAt:new Date().toISOString(),suiteId:suite.id,suiteName:suite.name,seconds:suite.seconds,sources:plans.map(plan=>({id:plan.source.id,name:plan.source.name,sha256:this.hash(plan.source.source),cases:plan.cases,...(plan.scenario?.checks.length?{checks:plan.scenario.checks.map(({kind,name,line})=>({kind,name,line}))}:{})})),results:[]};
  for(const plan of plans){
   let result:BasicTestResult;
   try {
    signal.throwIfAborted(); result=await this.port.run(plan.source,suite.seconds,signal);
    if(!validBasicTestResult(result,plan)||result.sourceSha256!==undefined&&result.sourceSha256!==this.hash(plan.source.source))throw Error('Réponse CPC invalide ou empreinte périmée.');
   }catch(error){result={sourceId:plan.source.id,name:plan.source.name,outcome:signal.aborted?'cancelled':'blocked',message:signal.aborted?'Exécution arrêtée ou délai de suite atteint.':error instanceof Error?error.message.slice(0,4096):'Tests indisponibles.',cases:[],emulatedSeconds:0};}
   report.results.push(result);
  }
  const run:AgentTestRun={report,workspaceHash:this.fingerprint(state),suiteRevision:expectedRevision,stale:false};this.runs.push(run);
  try{await this.port.record(report);}catch{run.archiveError='Rapport visible dans la mission ; conservation dans l’historique impossible.';}
  await this.validate(state);
  return structuredClone(run);
 }
}
