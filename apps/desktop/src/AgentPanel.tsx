import { AgentMissionDetails } from './AgentMissionDetails.tsx';
import { AgentChanges } from './AgentChanges.tsx';
import { AgentConversation } from './AgentConversation.tsx';
import { AgentContextDialog } from './AgentContextDialog.tsx';
import type { ProjectManifest, ProjectDocument } from '../../../packages/workspace/src/project.ts';
import { ReadabilityPanel } from './ReadabilityPanel.tsx';
import type { Notify } from './notifications.ts';
import { AgentSettingsDialog } from './AgentSettingsDialog.tsx';
import { MissionLibraryDialog } from './MissionLibraryDialog.tsx';
import { DEFAULT_BUDGET } from '../../../packages/agent/src/consumption.ts';
import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { AgentView, AgentWorkspaceState, ModelCatalog, AgentBudget, PricingProfile } from '../../../packages/agent/src/types.ts';
import { files } from './port.ts';

const TOOL_LABELS: Record<string, string> = { project_tests_list:'Lecture des scénarios du projet CPC', project_tests_run:'Exécution du vrai projet CPC', language_extraction_apply:'Application du découpage BASIC', language_extraction_simulate:'Simulation sans écriture du découpage BASIC', language_chain_merge_review:'Contrôle de l’état CHAIN MERGE', language_loading_contract:'Contrat de chargement CPC multifichier', language_module_review:'Analyse du découpage BASIC (lecture seule)', language_comment_preview:'Préparation du commentaire REM', language_comment_apply:'Insertion du commentaire REM contrôlée', language_readability_review:'Audit de lisibilité BASIC', language_format_preview:'Aperçu du formatage BASIC', language_format_apply:'Application du formatage contrôlé', language_rename_preview:'Prévisualisation du renommage BASIC', language_rename_apply:'Application du renommage BASIC contrôlé', basic_tests_list:'Lecture des suites CPC', basic_tests_run:'Exécution des tests CPC', language_symbols:'Analyse des noms et types possibles', documents_create_note: 'Création d’une note Markdown', documents_replace_note: 'Révision d’une note Markdown', documents_read_text: 'Lecture d’un document', binary_list_regions: 'Exploration des zones Z80', binary_read_region: 'Lecture d’une zone Z80', binary_dialect: 'Consultation du dialecte assembleur', binary_replace_region: 'Enregistrement d’une zone Z80', binary_build: 'Réassemblage et comparaison des octets', project_list_files: 'Exploration du projet', project_read_file: 'Lecture d’une source', reference_search: 'Recherche dans les références BASIC', reference_read: 'Lecture d’une référence BASIC', reference_read_many: 'Lecture groupée des références BASIC', project_replace_source: 'Modification d’une source', project_create_source: 'Création d’une source', language_analyze: 'Analyse des sources', build_project: 'Construction et relecture du DSK', documents_list: 'Liste des documents autorisés', documents_search: 'Recherche documentaire' };

interface Props {
  binary?: boolean; binaryDirty?: boolean; seed?: { id: string; text: string } | undefined;
  sessionId: string | undefined; buffers: { id: string; source: string }[]; busy: boolean;
  projectDocuments?: ProjectDocument[]; projectName?: string | undefined; onManifest?(manifest:ProjectManifest):void; onImportBusy?(busy:boolean):void;
  documentCount: number; knowledgeCount?: number; documentDirty?: boolean; onNotify?: Notify;
  onDocument?(id:string): void;
  onRunning(running: boolean): void; onState(state: AgentWorkspaceState): void;
}
export function AgentPanel(props: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false), [previousObjective, setPreviousObjective] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false), [budget, setBudget] = useState<AgentBudget>({ ...DEFAULT_BUDGET });
  const [pricing, setPricing] = useState<PricingProfile>(), [pricingNotice, setPricingNotice] = useState('');
  const [pollRevision, setPollRevision] = useState(0);
  const [key, setKey] = useState(''), [model, setModel] = useState('');
  const [catalog, setCatalog] = useState<ModelCatalog>();
  const modelRequest = useRef(false);
  const pricingRequest = useRef(0);
  const [configured, setConfigured] = useState(false), [objective, setObjective] = useState('');
  const [view, setView] = useState<AgentView | undefined>(), [taskId, setTaskId] = useState<string | undefined>();
  const [message, setMessage] = useState(''), [requesting, setRequesting] = useState(false);
  const [contextOpen,setContextOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false);
  const [selectedDocuments,setSelectedDocuments]=useState<string[]>([]);
  const [sentObjective,setSentObjective]=useState('');
  const composer=useRef<HTMLTextAreaElement>(null),scroll=useRef<HTMLDivElement>(null),followScroll=useRef(true);
  const [historyOpen,setHistoryOpen]=useState(false),[archives,setArchives]=useState<{title:string;view:Pick<AgentView,'events'|'summary'>}[]>([]);
  const scope=useRef(props.sessionId);
  useEffect(()=>{
    if(scope.current===props.sessionId)return;
    scope.current=props.sessionId;setTaskId(undefined);setView(undefined);setObjective('');setSentObjective('');setSelectedDocuments([]);setArchives([]);setMessage('');setContextOpen(false);setToolsOpen(false);setHistoryOpen(false);setLibraryOpen(false);setPreviousObjective(undefined);
  },[props.sessionId]);
  useEffect(()=>{
    const el=scroll.current;if(!el)return;
    const place=()=>{
      if(!followScroll.current)return;
      const reply=Array.from(el.querySelectorAll<HTMLElement>('.agent-result .agent-message.assistant')).at(-1);
      if(view&&!view.running&&reply)el.scrollTop+=reply.getBoundingClientRect().top-el.getBoundingClientRect().top-8;
      else el.scrollTop=el.scrollHeight;
    };
    place();const observer=new ResizeObserver(place);observer.observe(el);
    return()=>observer.disconnect();
  },[view?.events.length,view?.running,view?.turns,view?.calls,taskId]);

  const [documentConsentSession, setDocumentConsentSession] = useState<string | undefined>();
  const includeDocuments = !!props.sessionId && documentConsentSession === props.sessionId && props.documentCount > 0;
  const latest = useRef(props); latest.current = props;
  const adopted = useRef('');
  const announced = useRef('');
  const port = files.agent;
  useEffect(() => { if (props.seed) setObjective(props.seed.text); }, [props.seed]);
  function reportError(message: string) {
    setMessage(message);
    latest.current.onNotify?.({ source: 'agent', target: 'agent', sessionId: latest.current.sessionId, level: 'error', message: 'Action IA non confirmée. Consultez le panneau Agent IA.' });
  }
  useEffect(() => {
    if (!taskId || !port) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const result = await port!.status(taskId!);
        if (disposed) return;
        if ('error' in result) { reportError(result.error); timer = setTimeout(() => void poll(), 1000); return; }
        setView(result);
        const transition = `${taskId}:${result.running}:${result.status}`;
        if (announced.current !== transition) {
          announced.current = transition;
          const labels = { completed: 'Mission terminée', blocked: 'Validation non obtenue', failed: 'Mission interrompue par une erreur', cancelled: 'Mission arrêtée', 'paused-limit': 'Mission en pause — limite atteinte' };
          latest.current.onNotify?.({ source: 'agent', target: 'agent', sessionId: result.workspace.sessionId, level: result.running ? 'info' : result.status === 'completed' ? 'success' : result.status === 'failed' ? 'error' : 'warning', message: result.running ? 'Mission IA en cours.' : `${labels[result.status]} · ${result.changed.length} fichier(s) modifié(s) · ${result.tokens} tokens.` });
        }
        if (result.workspace.sessionId === latest.current.sessionId) {
          const state = JSON.stringify(result.workspace);
          if (state !== adopted.current) {
            latest.current.onState(result.workspace);
            adopted.current = state;
          }
          latest.current.onRunning(result.running);
        }
        if (result.running) timer = setTimeout(() => void poll(), 400);
      } catch { if (!disposed) { reportError('Lecture du journal interrompue. Réessayez ou arrêtez la mission.'); timer = setTimeout(() => void poll(), 1000); } }
    }
    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [taskId, port, pollRevision]);
  async function refreshModels() {
    if (!port || !configured || props.busy || modelRequest.current) return;
    modelRequest.current = true; setRequesting(true);
    try {
      const result = await port.models();
      if ('error' in result) setMessage(`${catalog?'Actualisation impossible. Dernière liste conservée':'Clé conservée en mémoire ; connexion à vérifier'}. ${result.error}`);
      else { setCatalog(result); setModel(result.models.some(item => item.id === result.model) ? result.model : ''); setMessage('Liste officielle OpenAI actualisée.'); }
    } catch { setMessage('Actualisation impossible ; dernière liste conservée. Réessayez.'); }
    finally { modelRequest.current = false; setRequesting(false); }
  }
  useEffect(() => {
    if (!configured || props.busy || requesting) return;
    const refresh = () => { if (Date.now() - Date.parse(catalog?.fetchedAt ?? '') >= 15 * 60 * 1000) void refreshModels(); };
    const timer = setInterval(refresh, 60000); window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [configured, props.busy, requesting, catalog?.fetchedAt]);
  async function configure(forget = false) {
    if (!port || modelRequest.current) return; modelRequest.current = true; setRequesting(true);
    try {
      if (forget) {
        const result = await port.configure('', '');
        if ('error' in result) { reportError(result.error); }
        else { pricingRequest.current++; setConfigured(false); setView(previous => previous ? { ...previous, resumable: false, followUpAllowed:false } : previous); setCatalog(undefined); setModel(''); setPricing(undefined); setPricingNotice(''); setMessage('Clé oubliée.'); }
      } else {
        const saved = await port.configure(key.trim(), '');
        if ('error' in saved) { reportError(saved.error); return; }
        pricingRequest.current++; setConfigured(true); setKey(''); setView(previous => previous ? { ...previous, resumable: false, followUpAllowed:false } : previous); setCatalog(undefined); setModel(''); setPricing(undefined); setPricingNotice('');
        setMessage('Clé conservée en mémoire. Chargement des modèles…');
        try {
          const result = await port.models();
          if ('error' in result) setMessage(`Clé conservée en mémoire ; connexion à vérifier. ${result.error} Cliquez sur « Actualiser les modèles » pour réessayer.`);
          else { setCatalog(result); setModel(result.model); setMessage('Connexion vérifiée. Choisissez un modèle dans la liste OpenAI.'); }
        } catch { setMessage('Clé conservée en mémoire ; connexion indisponible. Cliquez sur « Actualiser les modèles » pour réessayer.'); }
      }
    } catch { reportError('Configuration impossible.'); }
    finally { if(forget)setKey(''); modelRequest.current = false; setRequesting(false); }
  }
  async function selectModel(value: string) {
    if (!port || props.busy || modelRequest.current || !value) return;
    modelRequest.current = true; setRequesting(true);
    try { const result = await port.selectModel(value); if ('error' in result) { reportError(result.error); } else { setModel(result.model); setPricing(undefined); setMessage(`Modèle sélectionné : ${result.model}.`); await loadPricing(result.model); } }
    catch { reportError('Changement de modèle impossible.'); }
    finally { modelRequest.current = false; setRequesting(false); }
  }
  async function loadPricing(value = model) {
    if (!port?.pricing || !value) return;
    const request = ++pricingRequest.current;
    setPricingNotice('Lecture du tarif officiel…');
    try { const result = await port.pricing(value); if (request !== pricingRequest.current) return; if ('error' in result) { setPricing(undefined); setPricingNotice(result.error); } else { setPricing(result); setPricingNotice('Tarif officiel actualisé.'); } }
    catch { if (request === pricingRequest.current) { setPricing(undefined); setPricingNotice('Tarif inaccessible ; estimation indisponible.'); } }
  }
  async function resume(text?:string) {
    if (!port?.resume || !taskId || !props.sessionId) return;
    setRequesting(true); props.onRunning(true);
    try { const result = await port.resume(taskId, props.buffers, props.sessionId, text); if ('error' in result) { reportError(result.error); props.onRunning(false); } else { if(text)setObjective('');followScroll.current=true;setMessage(''); setView(previous => previous ? { ...previous, running: true } : previous); setPollRevision(previous => previous + 1); } }
    catch { reportError('Reprise impossible ; fichiers conservés.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function start() {
    if (!port || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      if (!pricing || Date.now() - Date.parse(pricing.fetchedAt) >= 60 * 60 * 1000) await loadPricing();
      const result = await port.start(props.sessionId, objective, props.buffers, includeDocuments, budget, selectedDocuments);
      if ('error' in result) { reportError(result.error); props.onRunning(false); }
      else { announced.current = ''; adopted.current = ''; setSentObjective(objective);setObjective('');setToolsOpen(false);followScroll.current=true;setTaskId(result.taskId); setView(undefined); setMessage(''); }
    } catch { reportError('Démarrage impossible.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function restore() {
    if (!port || !taskId || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      const result = await port.restore(taskId, props.buffers, props.sessionId);
      if ('error' in result) { reportError(result.error); }
      else { props.onState(result); adopted.current = JSON.stringify(result); setMessage('Checkpoint initial restauré. Les brouillons initiaux sont conservés.'); setView(undefined); setTaskId(undefined);setObjective(sentObjective); }
    } catch { reportError('Restauration impossible ; conserver le checkpoint.'); }
    finally { setRequesting(false); props.onRunning(false); }
  }
  function newConversation() {
    if(props.busy||requesting)return;
    if(view)setArchives(previous=>[...previous,{title:sentObjective,view:{events:view.events,summary:view.summary}}].slice(-8));
    setView(undefined);setTaskId(undefined);setSentObjective('');setObjective('');setSelectedDocuments([]);setDocumentConsentSession(undefined);setMessage('Nouvelle conversation. Les fichiers du projet sont conservés.');setToolsOpen(false);composer.current?.focus();
  }
  async function send() {
    const text=objective.trim(); if(!text||requesting)return;
    if(!taskId){await start();return;}
    if(view?.running){
      setRequesting(true);
      try {const result=await port!.steer(taskId,text);if('error' in result)reportError(result.error);else{followScroll.current=true;setObjective('');setMessage('Précision reçue. Elle sera prise en compte au prochain tour.');}}
      catch{reportError('Envoi impossible ; votre message est conservé.');}finally{setRequesting(false);}
    }else if(view?.resumable){await resume(text);}
    else if(view?.followUpAllowed && port?.followUp && props.sessionId){
      setRequesting(true);props.onRunning(true);
      try{const result=await port.followUp(taskId,text,props.buffers,props.sessionId);if('error' in result){reportError(result.error);props.onRunning(false);}else{followScroll.current=true;setObjective('');setMessage('');setView(previous=>previous?{...previous,running:true}:previous);setPollRevision(previous=>previous+1);}}
      catch{reportError('Suite impossible ; votre message est conservé.');props.onRunning(false);}finally{setRequesting(false);}
    }
  }
  const connected=configured&&!!model&&!!catalog?.models.some(item=>item.id===model);
  const canSend=!!port&&!!props.sessionId&&!requesting&&!!objective.trim()&&(view?.running || (!props.busy&&!props.binaryDirty&&!props.documentDirty&&(taskId?!!view?.resumable||!!view?.followUpAllowed&&!!port.followUp:connected)));
  const contextDocuments=(props.projectDocuments??[]).filter(d=>d.knowledge?d.knowledge.access!=='excluded':includeDocuments||selectedDocuments.includes(d.id));
  const lastReply=view?.events.filter(e=>e.kind==='message'&&e.role!=='user'&&e.role!=='system').at(-1)?.text;
  const outcome=lastReply&&view?.summary.startsWith(lastReply)?view.summary.slice(lastReply.length).trim():view?.summary;
  const statusLabel=view?view.running?'Mission en cours':({completed:'Mission terminée',blocked:'Validation non obtenue',failed:'Mission interrompue par une erreur',cancelled:'Mission arrêtée','paused-limit':'Mission en pause — limite atteinte'})[view.status]:'';
  return <section className="panel agent-panel" aria-label="Agent OpenAI">
    <header className="agent-chat-header">
      <div><strong>{props.binary?'Agent Z80':'Agent IA'}</strong><small>{view?.model||model||'Connexion à configurer'}</small></div>
      <Button icon="plus" aria-label="Nouvelle conversation" title="Nouvelle conversation" disabled={props.busy||requesting} onClick={newConversation}/>
      <Button icon="history" aria-label="Historique des conversations" title="Historique de cette session" disabled={!archives.length} onClick={()=>setHistoryOpen(!historyOpen)}/>
      <Button icon="settings" aria-label="Réglages IA" title="Connexion, modèle et budgets" disabled={props.busy||requesting} onClick={()=>setSettingsOpen(true)}/>
    </header>
    <div className="agent-conversation-scroll" ref={scroll}
      onWheel={()=>{followScroll.current=false;}} onTouchMove={()=>{followScroll.current=false;}} onPointerDown={()=>{followScroll.current=false;}}
      onKeyDown={e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))followScroll.current=false;}}
      onScroll={e=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<60)followScroll.current=true;}}>
      {historyOpen&&<section className="agent-history" aria-label="Historique de session"><h3>Conversations précédentes</h3><p className="muted">Lecture seule · conservées jusqu’à la fermeture du projet ou de l’application.</p>{archives.map((item,i)=><details key={i}><summary>{item.title.slice(0,80)}</summary><AgentConversation events={item.view.events}/><p>{item.view.summary}</p></details>)}<Button onClick={()=>setHistoryOpen(false)}>Fermer l’historique</Button></section>}
      {!taskId&&<div className="agent-welcome"><span className="agent-welcome-mark" aria-hidden="true">✦</span><h2>Que souhaitez-vous {props.binary?'explorer':'créer'} ?</h2><p>Décrivez votre idée ou la modification souhaitée. L’agent peut modifier et enregistrer les fichiers du projet.</p>
       <div className="agent-suggestions"><button onClick={()=>{setObjective(props.binary?'Explique cette routine Z80 et ses effets, sans modifier les octets.':'Explique le programme actuel et ses principales routines, sans modifier le code.');composer.current?.focus();}}>Expliquer le code</button><button onClick={()=>{setObjective(props.binary?'Annote les zones Z80 enregistrées en distinguant les faits et les hypothèses.':'Crée un écran de titre en MODE 1 pour mon jeu.');composer.current?.focus();}}>{props.binary?'Documenter les zones':'Créer un écran titre'}</button></div>
       {!connected&&<Button icon="key" className="primary" disabled={props.busy||requesting||!port} onClick={()=>setSettingsOpen(true)}>Connecter OpenAI</Button>}
      </div>}
      {taskId&&!view&&<p role="status">Préparation de votre demande…</p>}
      {view&&<div className="agent-result">
       <AgentConversation events={view.events} initialPrompt={sentObjective}/>
       <p className="agent-status" role="status"><strong>{statusLabel}</strong></p>
       {view.running&&<p className="muted">{TOOL_LABELS[view.events.at(-1)?.tool??'']??'L’agent prépare la suite…'}</p>}
       <p className="muted">{view.changed.length?`${view.changed.length} fichier(s) modifié(s), enregistrés dans le projet.`:'Aucun fichier modifié pour le moment.'} {view.buildVerified?'DSK construit et relu.':'Construction finale non validée.'}</p>
       {view.events.filter(event=>event.kind==='tool-result'&&event.success===false).slice(-1).map((event,i)=><details className="agent-tool-error" key={i}><summary>Dernière difficulté rencontrée</summary><p>{event.tool} : {event.text}</p></details>)}
       {view.resumable&&<div className="agent-resume"><p>Le budget est atteint. Reprenez la mission ou précisez la suite ci-dessous.</p><Button icon="run" disabled={props.busy||requesting||props.binaryDirty||props.documentDirty||!port?.resume||props.sessionId!==view.workspace.sessionId} onClick={()=>void resume()}>Reprendre la mission</Button><small>La reprise accorde un budget supplémentaire facturable.</small></div>}
       <AgentChanges view={view} props={props} requesting={requesting}/>
       <AgentMissionDetails view={view} outcome={outcome}/>
       <Button icon="undo" disabled={!view.changed.length||view.running||props.busy||requesting||props.binaryDirty||props.documentDirty||props.sessionId!==view.workspace.sessionId} onClick={()=>void restore()}>Restaurer le checkpoint initial</Button>
       {!view.running&&!view.resumable&&!view.followUpAllowed&&<p className="muted">Pour une nouvelle demande, ouvrez une nouvelle conversation. Les changements restent dans le projet.</p>}
      </div>}
    </div>
    <div className="agent-composer">
      <button className="agent-context-trigger" onClick={()=>setContextOpen(true)} disabled={!props.sessionId}>Contexte : {props.projectName||'projet'}{contextDocuments.length?` · ${contextDocuments.length} fichier(s)`:''}</button>
      {!!contextDocuments.length&&<div className="agent-attachment-chips" aria-label="Fichiers accessibles à l’agent">{contextDocuments.map(d=><span key={d.id} title={d.originalName}>{d.originalName}{!taskId&&!d.knowledge&&!includeDocuments&&<button aria-label={`Retirer ${d.originalName} du message`} onClick={()=>setSelectedDocuments(ids=>ids.filter(id=>id!==d.id))}>×</button>}</span>)}</div>}
      <label htmlFor="agent-objective">Message à l’agent</label>
      <textarea ref={composer} id="agent-objective" value={objective} onChange={e=>setObjective(e.target.value)} maxLength={20000} rows={4} placeholder={view?.running?'Ajoutez une précision pendant le travail…':taskId?'Décrivez la modification souhaitée…':'Demandez une création, une explication ou une modification…'} disabled={requesting||!!props.busy&&!view?.running} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();if(canSend)void send();}}}/>
      <div className="agent-composer-actions"><Button icon="plus" aria-label="Joindre des fichiers" title="Joindre des fichiers" disabled={!props.sessionId} onClick={()=>setContextOpen(true)}/><Button icon="menu" aria-label="Outils et modèles de mission" title="Outils et modèles de mission" aria-expanded={toolsOpen} disabled={requesting||props.busy} onClick={()=>setToolsOpen(!toolsOpen)}/><span/>{view?.running&&<Button icon="stop" aria-label="Arrêter l’agent" title="Arrêter l’agent" disabled={requesting} onClick={()=>{if(port&&taskId)void port.cancel(taskId).then(result=>setMessage('error' in result?result.error:'Arrêt demandé ; écritures terminées conservées.')).catch(()=>reportError('Arrêt impossible.'));}}/>}<Button className="primary" icon="run" disabled={!canSend} onClick={()=>void send()}>{view?.running?'Envoyer la précision':view?.resumable?'Envoyer et reprendre':'Envoyer'}</Button></div>
      <small className="agent-composer-hint">Ctrl / ⌘ Entrée pour envoyer · Entrée pour une nouvelle ligne<br/>Appels API facturés par OpenAI · modifications restaurables</small>
      {toolsOpen&&<div className="agent-compose-tools"><Button icon="file" disabled={props.busy||requesting} onClick={()=>setLibraryOpen(true)}>Choisir une mission…</Button>{previousObjective!==undefined&&<Button icon="undo" onClick={()=>{setObjective(previousObjective);setPreviousObjective(undefined);}}>Rétablir la mission précédente</Button>}{!props.binary&&<ReadabilityPanel disabled={props.busy||requesting} onUse={text=>{setPreviousObjective(objective);setObjective(text);composer.current?.focus();}}/>}</div>}
      {props.documentDirty&&<p role="status">Enregistrez ou abandonnez le brouillon documentaire avant de lancer une mission.</p>}
      {props.binaryDirty&&<p role="status">Enregistrez l’analyse Z80 avant de lancer, reprendre ou restaurer une mission.</p>}
      {!props.sessionId&&<p className="muted">Ouvrez ou créez un projet pour commencer.</p>}
      {!port&&<p className="muted">Disponible dans l’application desktop uniquement.</p>}
      {!!message&&<p className="agent-notice" role="status">{message}</p>}
    </div>
    {contextOpen&&<AgentContextDialog sessionId={props.sessionId} documents={props.projectDocuments??[]} selected={selectedDocuments} includeAll={includeDocuments} locked={!!taskId||props.busy||requesting||!!props.documentDirty} onSelect={setSelectedDocuments} onIncludeAll={value=>setDocumentConsentSession(value?props.sessionId:undefined)} onManifest={manifest=>props.onManifest?.(manifest)} onBusy={value=>props.onImportBusy?.(value)} onDocument={props.onDocument} onClose={()=>setContextOpen(false)}/>}
    {libraryOpen&&!props.busy&&!requesting&&<MissionLibraryDialog key={`${props.sessionId}:${props.binary}`} kind={props.binary?'binary':'basic'} objective={objective} onClose={()=>setLibraryOpen(false)} onUse={text=>{setPreviousObjective(objective);setObjective(text);}}/>}
    {settingsOpen && <AgentSettingsDialog onClose={() => setSettingsOpen(false)}>
    <fieldset><legend><span className="agent-setting-step" aria-hidden="true">1</span> Connexion OpenAI</legend>
      <p className="agent-connection-status" role="status">{configured ? catalog ? 'Clé configurée pour cette session · connexion vérifiée' : 'Clé mémorisée pour cette session · connexion à vérifier' : 'Clé API à configurer'}</p>
      <div className="agent-setting-field">
        <label htmlFor="openai-key">Clé API OpenAI</label>
        <input id="openai-key" type="password" autoComplete="off" spellCheck={false} aria-describedby="openai-key-help" placeholder={configured ? 'Saisir une autre clé pour la remplacer' : 'Collez votre clé API'} value={key} disabled={props.busy || requesting} onChange={event => setKey(event.target.value)} />
        <p id="openai-key-help" className="muted">La clé reste en mémoire jusqu’à son oubli ou la fermeture de l’application.</p>
      </div>
      <div className="agent-setting-actions">
        <Button icon="key" className="primary" disabled={!port || props.busy || requesting || !key.trim()} onClick={() => void configure()}>Configurer la clé</Button>
        <Button icon="close" disabled={!configured || props.busy || requesting} onClick={() => void configure(true)}>Oublier la clé</Button>
      </div>
    </fieldset>
    <fieldset><legend><span className="agent-setting-step" aria-hidden="true">2</span> Modèle et estimation</legend>
      <div className="agent-setting-field">
        <label htmlFor="openai-model">Modèle OpenAI</label>
        <div className="agent-model-controls">
          <select id="openai-model" aria-describedby="openai-model-help" value={model} disabled={props.busy || requesting || !catalog?.models.length} onChange={event => void selectModel(event.target.value)}>
            <option value="">{configured ? 'Choisir un modèle…' : 'Configurez d’abord votre clé'}</option>
            {catalog?.models.map(item => <option key={item.id} value={item.id}>{item.id}{item.shutdownDate ? ` · retrait ${item.shutdownDate}` : ''}</option>)}
          </select>
          <Button icon="history" disabled={!configured || props.busy || requesting} onClick={() => void refreshModels()}>Actualiser les modèles</Button>
        </div>
        <p id="openai-model-help" className="muted">{catalog ? `Liste OpenAI vérifiée le ${new Date(catalog.fetchedAt).toLocaleString('fr-FR')} · actualisation toutes les 15 min. La compatibilité avec les outils est vérifiée lors de la mission.` : 'Les modèles accessibles à votre clé apparaîtront après sa configuration.'}</p>
      </div>
      <details className="agent-pricing-details">
        <summary>Tarifs et estimation (USD)</summary>
        <p className="muted" aria-live="polite">{pricingNotice || (model ? 'Tarif non chargé.' : 'Choisissez un modèle pour consulter son tarif.')}</p>
        {pricing && <p>Par million de tokens : entrée {pricing.input} $ · cache lu {pricing.cached} $ · sortie {pricing.output} $. Tarif vérifié le {new Date(pricing.fetchedAt).toLocaleString('fr-FR')}, valable 1 h pour l’estimation. Source : {pricing.source}</p>}
        <Button icon="history" disabled={!model || props.busy || requesting} onClick={() => void loadPricing()}>Actualiser le tarif officiel</Button>
        <p className="muted">L’estimation exige le détail d’usage et le tarif officiel du modèle effectivement retourné. Hors taxes, conversion et remises de compte. La facture OpenAI fait foi.</p>
      </details>
    </fieldset>
    <fieldset><legend><span className="agent-setting-step" aria-hidden="true">3</span> Budget par lancement ou reprise</legend>
      <p className="muted">À la limite, la mission se met en pause. Une reprise volontaire accorde ce même budget supplémentaire et peut consommer de nouveaux tokens facturés.</p>
      <div className="agent-budget-fields">
      {([{ key: 'maxTurns', label: 'Tours modèle maximum', min: 1, max: 100 }, { key: 'maxCalls', label: 'Appels outils maximum', min: 1, max: 200 }, { key: 'maxTokens', label: 'Tokens maximum', min: 1000, max: 500000 }] as const).map(item => <label key={item.key}>{item.label}<input type="number" min={item.min} max={item.max} step={1} value={budget[item.key]} disabled={props.busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= item.min && value <= item.max) setBudget(previous => ({ ...previous, [item.key]: value })); }} /></label>)}
      </div>
      <p className="muted">Durée : 15 min par lancement. Le budget tokens est vérifié après la réponse et peut être dépassé par celle-ci.</p>
    </fieldset>
    <p className="agent-settings-notice" aria-live="polite">{message}</p>
    </AgentSettingsDialog>}
  </section>;
}
