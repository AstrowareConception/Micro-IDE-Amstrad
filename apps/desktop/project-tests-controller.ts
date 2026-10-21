import {createHash,randomUUID} from 'node:crypto';
import {AgentProjectTests,projectTestFingerprint,prepareProjectTest,type AgentProjectTestPort} from '../../packages/agent/src/project-tests.ts';
import {parseProjectCapturePlan,parseScreenRegion,screenReference,validateProjectScreenFrame,type ProjectScreenRunner} from '../../packages/emulator/src/project-screen-reference.ts';
import type {ProjectTestReport} from '../../packages/emulator/src/project-tests.ts';
import type {ProjectTestJob,ProjectTestsSnapshot} from '../../packages/emulator/src/project-tests-port.ts';
import {ProjectTestStore} from './project-test-store.ts';
import type {ProjectStore} from './project-store.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
type Buffers={id:string;source:string}[];
/** A single native CPC job, with main-owned inputs, report provenance and cancellation. */
export class ProjectTestsController {
 private active:{sessionId:string;abort:AbortController;view:ProjectTestJob}|undefined;
 private readonly run:AgentProjectTestPort['run'];
 private readonly captureRun:ProjectScreenRunner|undefined;
 private reports:{sessionId:string;report:ProjectTestReport}[]=[];
 constructor(run:AgentProjectTestPort['run'],captureRun?:ProjectScreenRunner){this.run=run;this.captureRun=captureRun;}
 get running():boolean{return this.active?.view.running===true;}
 async inspect(store:ProjectStore,buffers:Buffers):Promise<ProjectTestsSnapshot>{
  const state=await store.agentState(buffers),tests=new ProjectTestStore(store.root,store.manifest.projectId);
  const snapshot:ProjectTestsSnapshot={library:await tests.load(),projectSha256:projectTestFingerprint(state,hash),reports:[]};
  try{snapshot.reports=await tests.history();}catch{snapshot.historyError='Historique illisible ; fichier conservé. Les nouveaux rapports resteront exportables.';}
  return snapshot;
 }
 async start(store:ProjectStore,buffers:Buffers,scenarioId:unknown,revision:unknown,projectSha256:unknown):Promise<{id:string}>{
  if(this.running)throw Error('Un essai projet est déjà actif.');
  const state=await store.agentState(buffers),storage=new ProjectTestStore(store.root,store.manifest.projectId),abort=new AbortController();
  const tests=new AgentProjectTests({load:()=>storage.load(),run:this.run,record:report=>storage.record(report)},hash,randomUUID,()=>abort.signal);
  const current=await tests.list(state);
  if(revision!==current.revision||projectSha256!==current.projectSha256)throw Error('Le projet ou les scénarios ont changé. Actualisez avant de lancer.');
  if(typeof scenarioId!=='string'||!current.scenarios.some(s=>s.id===scenarioId))throw Error('Scénario enregistré requis.');
  const job={sessionId:store.sessionId,abort,view:{id:randomUUID(),running:true} as ProjectTestJob};this.active=job;
  void tests.run(state,scenarioId,revision,projectSha256).then(result=>{
   job.view.report=result.report;
   this.reports=[{sessionId:store.sessionId,report:structuredClone(result.report)},...this.reports].slice(0,10);
   if(result.archiveError)job.view.archiveError='Rapport non conservé ; vous pouvez l’exporter avant de quitter ce panneau.';
  }).catch(error=>{job.view.error=error instanceof Error?error.message:'Essai projet impossible.';}).finally(()=>{job.view.running=false;});
  return {id:job.view.id};
 }
 async report(store:ProjectStore,id:unknown):Promise<ProjectTestReport>{
  if(typeof id!=='string')throw Error('Identifiant de rapport requis.');
  const memory=this.reports.find(item=>item.sessionId===store.sessionId&&item.report.id===id)?.report;
  const report=memory??(await new ProjectTestStore(store.root,store.manifest.projectId).history()).find(item=>item.id===id);
  if(!report)throw Error('Rapport absent de cette session ou de l’historique du projet.');
  return structuredClone(report);
 }
 async capture(store:ProjectStore,buffers:Buffers,input:unknown,revision:unknown,projectSha256:unknown):Promise<{id:string}>{
  if(this.running)throw Error('Un essai projet est déjà actif.');
  if(!this.captureRun)throw Error('Capture CPC indisponible.');
  const plan=parseProjectCapturePlan(input),job={sessionId:store.sessionId,abort:new AbortController(),view:{id:randomUUID(),running:true,kind:'capture'} as ProjectTestJob};
  this.active=job;
  // Pin the user inputs before crossing an asynchronous boundary.
  const sources=structuredClone(buffers),run=this.captureRun;
  void (async()=>{
   const state=await store.agentState(sources),library=await new ProjectTestStore(store.root,store.manifest.projectId).load();
   if(library.revision!==revision||projectTestFingerprint(state,hash)!==projectSha256)throw Error('Le projet ou les scénarios ont changé. Actualisez avant de capturer.');
   const image=prepareProjectTest(state,hash),signal=AbortSignal.any([job.abort.signal,AbortSignal.timeout(60_000)]);
   signal.throwIfAborted();
   const frame=await run(structuredClone(image),structuredClone(plan),signal);signal.throwIfAborted();
   validateProjectScreenFrame(frame,image.diskSha256,plan.seconds);
   const {disk:_disk,...project}=image;
   job.view.preview=structuredClone({...frame,id:job.view.id,createdAt:new Date().toISOString(),plan,libraryRevision:library.revision,project});
  })().catch(error=>{job.view.error=job.abort.signal.aborted?'Capture arrêtée ; aucune référence adoptée.':error instanceof Error?error.message:'Capture impossible.';}).finally(()=>{job.view.running=false;});
  return {id:job.view.id};
 }
 async adopt(store:ProjectStore,buffers:Buffers,id:unknown,input:unknown,revision:unknown,region:unknown){
  if(this.running)throw Error('Un essai projet est encore actif.');
  const job=this.job(store.sessionId,id),preview=job.view.preview;
  if(!preview||job.view.kind!=='capture')throw Error('Aperçu de capture absent.');
  const plan=parseProjectCapturePlan(input),rectangle=parseScreenRegion(region);
  const state=await store.agentState(buffers),library=await new ProjectTestStore(store.root,store.manifest.projectId).load();
  if(library.revision!==preview.libraryRevision||revision!==preview.libraryRevision||projectTestFingerprint(state,hash)!==preview.project.projectSha256||JSON.stringify(plan)!==JSON.stringify(preview.plan))throw Error('Capture périmée : le projet, les saisies, le budget ou les scénarios ont changé. Capturez de nouveau.');
  // Main hashes its own frame; renderer supplies only geometry and an explicit human action.
  return screenReference(preview,rectangle,hash);
 }
 private job(sessionId:string,id:unknown){if(!this.active||this.active.sessionId!==sessionId||this.active.view.id!==id)throw Error('Essai absent ou autre session de projet.');return this.active;}
 status(sessionId:string,id:unknown):ProjectTestJob{return structuredClone(this.job(sessionId,id).view);}
 cancel(sessionId:string,id:unknown):{stopped:boolean}{const job=this.job(sessionId,id);if(job.view.running)job.abort.abort();return {stopped:job.view.running};}
}
