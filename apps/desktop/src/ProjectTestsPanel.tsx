import {useCallback,useEffect,useRef,useState} from 'react';
import type {ProjectScenario,ProjectTestReport} from '../../../packages/emulator/src/project-tests.ts';
import type {ProjectTestsSnapshot} from '../../../packages/emulator/src/project-tests-port.ts';
import {files} from './port.ts';
import {scenarioForForm,scenariosFromForm} from './project-scenario-form.ts';
import {ProjectScenarioEditor} from './ProjectScenarioEditor.tsx';
import {ProjectTestReportView,projectOutcome} from './ProjectTestReportView.tsx';
interface Props {sessionId?:string|undefined;buffers:{id:string;source:string}[];visible:boolean;busy:boolean;binary:boolean;onDirty(value:boolean):void;onBusy(value:boolean):void;onConfigure():void}
export function ProjectTestsPanel({sessionId,buffers,visible,busy,binary,onDirty,onBusy,onConfigure}:Props){
 const port=files.projectTests;
 const [snapshot,setSnapshot]=useState<ProjectTestsSnapshot>(),[drafts,setDrafts]=useState<ProjectScenario[]>([]),[selected,setSelected]=useState('');
 const [working,setWorking]=useState(false),[jobId,setJobId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [memoryReports,setMemoryReports]=useState<ProjectTestReport[]>([]),[reportId,setReportId]=useState(''),[inspectedBuffers,setInspectedBuffers]=useState('');
 const dirty=!!snapshot&&JSON.stringify(drafts)!==JSON.stringify(snapshot.library.scenarios.map(scenarioForForm));
 const buffersKey=JSON.stringify(buffers),latestBuffers=useRef(buffers);latestBuffers.current=buffers;
 const generation=useRef(0),mounted=useRef(true),activeJob=useRef('');
 const locked=busy||working||!!jobId;
 const reports=[...memoryReports,...(snapshot?.reports??[]).filter(r=>!memoryReports.some(m=>m.id===r.id))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10);
 const report=reports.find(r=>r.id===reportId)??reports[0];
 const scenario=drafts.find(s=>s.id===selected);
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
 useEffect(()=>{onBusy(working||!!jobId);},[working,jobId,onBusy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;onDirty(false);onBusy(false);if(activeJob.current&&sessionId&&port)void port.cancel(sessionId,activeJob.current);};},[sessionId,port,onDirty,onBusy]);
 const refresh=useCallback(async()=>{
  if(!port||!sessionId)return;
  const epoch=++generation.current,input=latestBuffers.current;setWorking(true);setError('');
  try{
   const result=await port.inspect(sessionId,input);
   if(!mounted.current||epoch!==generation.current)return;
   if('error' in result)throw Error(result.error);
   setSnapshot(result);setDrafts(result.library.scenarios.map(scenarioForForm));setInspectedBuffers(JSON.stringify(input));
   setSelected(id=>result.library.scenarios.some(s=>s.id===id)?id:result.library.scenarios[0]?.id??'');
  }catch(reason){if(mounted.current&&epoch===generation.current){setError(reason instanceof Error?reason.message:'Lecture impossible.');setInspectedBuffers('');}}
  finally{if(mounted.current&&epoch===generation.current)setWorking(false);}
 },[sessionId,port]);
 // Keep unsaved expectations intact. A hidden panel retains its draft and running job.
 useEffect(()=>{if(visible&&!busy&&!dirty&&!activeJob.current&&!binary)void refresh();},[visible,busy,buffersKey,binary,refresh]);
 useEffect(()=>{
  if(!jobId||!port||!sessionId)return;
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const poll=async()=>{
   try{
    const result=await port.status(sessionId,jobId);if(stopped)return;
    if('error' in result&&!('running' in result)){setError(result.error);timer=setTimeout(()=>void poll(),500);return;}
    if(result.running){timer=setTimeout(()=>void poll(),200);return;}
    if(result.report){setMemoryReports(previous=>[result.report!,...previous.filter(r=>r.id!==result.report!.id)].slice(0,10));setReportId(result.report.id);}
    setNotice(result.archiveError??'');activeJob.current='';setJobId('');
    await refresh();if(result.error&&!stopped)setError(result.error);
   }catch(reason){if(!stopped){setError(reason instanceof Error?reason.message:'Lecture de l’essai impossible.');timer=setTimeout(()=>void poll(),500);}}
  };
  void poll();return()=>{stopped=true;if(timer)clearTimeout(timer);};
 },[jobId,port,sessionId,refresh]);
 async function save(){
  if(!port||!sessionId||!snapshot||locked)return;
  setWorking(true);setError('');
  try{
   const scenarios=scenariosFromForm(drafts),saved=await port.save(sessionId,snapshot.library.revision,scenarios);
   if(!mounted.current)return;if('error' in saved)throw Error(saved.error);
   setSnapshot({...snapshot,library:saved});setDrafts(saved.scenarios.map(scenarioForForm));await refresh();setNotice('Scénarios enregistrés. Les prochains essais utiliseront ces attentes.');
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Enregistrement impossible.');}
  finally{if(mounted.current)setWorking(false);}
 }
 async function start(){
  if(!port||!sessionId||!snapshot?.library.revision||!scenario||locked||dirty)return;
  setWorking(true);setError('');setNotice('');
  try{
   const result=await port.start(sessionId,latestBuffers.current,scenario.id,snapshot.library.revision,snapshot.projectSha256);
   if(!mounted.current){if(!('error' in result))void port.cancel(sessionId,result.id);return;}
   if('error' in result)throw Error(result.error);
   activeJob.current=result.id;setJobId(result.id);
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Lancement impossible.');}
  finally{if(mounted.current)setWorking(false);}
 }
 async function exportReport(){
  if(!port||!sessionId||!report||locked)return;setWorking(true);setError('');
  try{const result=await port.export(sessionId,report.id);if(!mounted.current)return;if(result&&'error' in result)throw Error(result.error);setNotice(result?`Rapport exporté : ${result.name}`:'Export annulé.');}
  catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Export impossible.');}
  finally{if(mounted.current)setWorking(false);}
 }
 async function cancel(){if(!port||!sessionId||!jobId)return;try{const result=await port.cancel(sessionId,jobId);if(mounted.current)setNotice('error' in result?result.error:'Arrêt demandé…');}catch{if(mounted.current)setError('Arrêt impossible. Réessayez.');}}
 function reload(){if(!dirty||window.confirm('Abandonner les modifications des scénarios et relire les fichiers ?')){setNotice('');void refresh();}}
 function add(){const id=crypto.randomUUID();setDrafts([...drafts,{id,name:'Nouveau scénario',seconds:8,inputs:[],checks:[{kind:'file',name:'OUT.TXT',text:''}]}]);setSelected(id);}
 function remove(){if(scenario&&window.confirm(`Supprimer le scénario « ${scenario.name} » ? La suppression sera appliquée à l’enregistrement.`)){setDrafts(drafts.filter(s=>s.id!==scenario.id));setSelected(drafts.find(s=>s.id!==scenario.id)?.id??'');}}
 let invalid='';try{scenariosFromForm(drafts);}catch(reason){invalid=reason instanceof Error?reason.message:'Scénario invalide.';}
 const current=report&&snapshot&&inspectedBuffers===buffersKey?(dirty?false:report.project.projectSha256===snapshot.projectSha256&&report.libraryRevision===snapshot.library.revision):undefined;
 return <section className="quality-panel project-tests-panel" aria-label="Tests projet">
  <h3>Scénarios du projet CPC</h3><p>Exécute le DSK complet depuis l’entrée du projet, avec les buffers ouverts et les ressources déclarées. Aucune clé IA nécessaire.</p>
  {!sessionId||!port||binary?<p>Ouvrez un projet BASIC dans l’application desktop pour préparer et exécuter ses scénarios.</p>:<>
   <div className="project-test-actions"><button disabled={locked} onClick={reload}>Actualiser les scénarios et rapports</button><button disabled={locked} onClick={onConfigure}>Configurer les ROM</button></div>
   {snapshot&&<>
    <div className="project-test-actions"><label>Scénario<select aria-label="Scénario" disabled={locked} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choisir un scénario</option>{drafts.map(s=><option key={s.id} value={s.id}>{s.name||'Sans nom'}</option>)}</select></label><button disabled={locked||drafts.length>=16} onClick={add}>Nouveau scénario</button><button disabled={locked||!scenario} onClick={remove}>Supprimer le scénario</button></div>
    {scenario&&<ProjectScenarioEditor scenario={scenario} disabled={locked} onChange={value=>setDrafts(drafts.map(s=>s.id===value.id?value:s))}/>}
    {dirty&&<p role="status">Modifications des scénarios non enregistrées. Enregistrez avant de lancer un essai.</p>}
    {invalid&&<p className="error">{invalid}</p>}
    <div className="project-test-actions"><button disabled={locked||!dirty||!!invalid} onClick={()=>void save()}>Enregistrer les scénarios</button><button disabled={locked||dirty||!scenario||inspectedBuffers!==buffersKey} onClick={()=>void start()}>Exécuter le scénario</button><button disabled={!jobId} onClick={()=>void cancel()}>Arrêter l’essai</button></div>
    {jobId&&<p role="status">Essai CPC en cours… Budget réel maximum : 60 secondes.</p>}
   </>}
   {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}{snapshot?.historyError&&<p role="alert">{snapshot.historyError}</p>}
   <h4>Historique du projet</h4><p>Les dix derniers rapports, y compris ceux des missions agent. Leur consultation ne relance aucun essai.</p>
   {reports.length?<><label>Rapport<select aria-label="Rapport" value={report?.id??''} onChange={e=>setReportId(e.target.value)}>{reports.map(r=><option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleString()} · {r.scenario.name} · {projectOutcome[r.result.outcome]}</option>)}</select></label>{report&&<ProjectTestReportView report={report} current={current} disabled={locked} onExport={()=>void exportReport()}/>}</>:<p>Aucun rapport disponible.</p>}
  </>}
 </section>;
}
