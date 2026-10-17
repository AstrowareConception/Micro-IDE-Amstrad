import { ReadabilityPanel } from './ReadabilityPanel.tsx';
import type { Notify } from './notifications.ts';
import { AgentSettingsDialog } from './AgentSettingsDialog.tsx';
import { MissionLibraryDialog } from './MissionLibraryDialog.tsx';
import { DEFAULT_BUDGET } from '../../../packages/agent/src/consumption.ts';
import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { AgentView, AgentWorkspaceState, ModelCatalog, AgentBudget, PricingProfile } from '../../../packages/agent/src/types.ts';
import { files } from './port.ts';

const TOOL_LABELS: Record<string, string> = { language_extraction_apply:'Application du découpage BASIC', language_extraction_simulate:'Simulation sans écriture du découpage BASIC', language_chain_merge_review:'Contrôle de l’état CHAIN MERGE', language_loading_contract:'Contrat de chargement CPC multifichier', language_module_review:'Analyse du découpage BASIC (lecture seule)', language_comment_preview:'Préparation du commentaire REM', language_comment_apply:'Insertion du commentaire REM contrôlée', language_readability_review:'Audit de lisibilité BASIC', language_format_preview:'Aperçu du formatage BASIC', language_format_apply:'Application du formatage contrôlé', language_rename_preview:'Prévisualisation du renommage BASIC', language_rename_apply:'Application du renommage BASIC contrôlé', basic_tests_list:'Lecture des suites CPC', basic_tests_run:'Exécution des tests CPC', language_symbols:'Analyse des noms et types possibles', documents_create_note: 'Création d’une note Markdown', documents_replace_note: 'Révision d’une note Markdown', documents_read_text: 'Lecture d’un document', binary_list_regions: 'Exploration des zones Z80', binary_read_region: 'Lecture d’une zone Z80', binary_dialect: 'Consultation du dialecte assembleur', binary_replace_region: 'Enregistrement d’une zone Z80', binary_build: 'Réassemblage et comparaison des octets', project_list_files: 'Exploration du projet', project_read_file: 'Lecture d’une source', reference_search: 'Recherche dans les références BASIC', reference_read: 'Lecture d’une référence BASIC', reference_read_many: 'Lecture groupée des références BASIC', project_replace_source: 'Modification d’une source', project_create_source: 'Création d’une source', language_analyze: 'Analyse des sources', build_project: 'Construction et relecture du DSK', documents_list: 'Liste des documents autorisés', documents_search: 'Recherche documentaire' };

interface Props {
  binary?: boolean; binaryDirty?: boolean; seed?: { id: string; text: string } | undefined;
  sessionId: string | undefined; buffers: { id: string; source: string }[]; busy: boolean;
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
  const [instruction, setInstruction] = useState('');
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
      if ('error' in result) setMessage(`Actualisation impossible. Dernière liste conservée : ${result.error}`);
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
        else { pricingRequest.current++; setConfigured(false); setView(previous => previous ? { ...previous, resumable: false } : previous); setCatalog(undefined); setModel(''); setPricing(undefined); setPricingNotice(''); setMessage('Clé oubliée.'); }
      } else {
        const result = await port.models(key);
        if ('error' in result) { reportError(result.error); }
        else { pricingRequest.current++; setConfigured(true); setView(previous => previous ? { ...previous, resumable: false } : previous); setCatalog(result); setModel(result.model); setPricing(undefined); setPricingNotice(''); setMessage('Clé vérifiée, conservée en mémoire. Choisissez un modèle dans la liste OpenAI.'); }
      }
    } catch { reportError('Configuration impossible.'); }
    finally { setKey(''); modelRequest.current = false; setRequesting(false); }
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
  async function resume() {
    if (!port?.resume || !taskId || !props.sessionId) return;
    setRequesting(true); props.onRunning(true);
    try { const result = await port.resume(taskId, props.buffers, props.sessionId); if ('error' in result) { reportError(result.error); props.onRunning(false); } else { setMessage(''); setView(previous => previous ? { ...previous, running: true } : previous); setPollRevision(previous => previous + 1); } }
    catch { reportError('Reprise impossible ; fichiers conservés.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function start() {
    if (!port || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      if (!pricing || Date.now() - Date.parse(pricing.fetchedAt) >= 60 * 60 * 1000) await loadPricing();
      const result = await port.start(props.sessionId, objective, props.buffers, includeDocuments, budget);
      if ('error' in result) { reportError(result.error); props.onRunning(false); }
      else { announced.current = ''; adopted.current = ''; setTaskId(result.taskId); setView(undefined); setMessage(''); }
    } catch { reportError('Démarrage impossible.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function restore() {
    if (!port || !taskId || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      const result = await port.restore(taskId, props.buffers, props.sessionId);
      if ('error' in result) { reportError(result.error); }
      else { props.onState(result); adopted.current = JSON.stringify(result); setMessage('Checkpoint initial restauré. Les brouillons initiaux sont conservés.'); setView(undefined); setTaskId(undefined); }
    } catch { reportError('Restauration impossible ; conserver le checkpoint.'); }
    finally { setRequesting(false); props.onRunning(false); }
  }
  return <section className="panel agent-panel" aria-label="Agent OpenAI">
    <div className="agent-heading"><h2>{props.binary ? 'Agent Z80' : 'Agent de programmation'}</h2><Button icon="settings" disabled={props.busy || requesting} onClick={() => setSettingsOpen(true)}>Réglages IA</Button></div>
    <p className="muted">{configured && model ? `Modèle : ${model}` : 'Ouvrez les réglages IA pour connecter votre clé et choisir un modèle.'}</p>
    <p className="muted">{props.binary ? 'Zones enregistrées et notes consultées transmises à OpenAI ; aucun binaire brut ni ROM envoyé.' : 'Sources et extraits consultés transmis à OpenAI.'} L’agent enregistre ses modifications avec checkpoint local. API facturée par OpenAI.</p>
    <label htmlFor="agent-objective">Mission de programmation</label><textarea id="agent-objective" value={objective} onChange={event => setObjective(event.target.value)} maxLength={20000} rows={4} placeholder={props.binary ? 'Explique une routine, annote ses hypothèses ou demande une modification précise…' : 'Crée un écran de titre CPC en MODE 1…'} disabled={props.busy || requesting} />
    <div className="mission-launcher"><Button icon="file" disabled={props.busy || requesting} onClick={() => setLibraryOpen(true)}>Choisir une mission…</Button>{previousObjective !== undefined && <Button icon="undo" disabled={props.busy || requesting} onClick={() => { setObjective(previousObjective); setPreviousObjective(undefined); }}>Rétablir la mission précédente</Button>}</div>
    {!props.binary && <ReadabilityPanel disabled={props.busy || requesting} onUse={text=>{setPreviousObjective(objective);setObjective(text);setMessage('Mission de lisibilité préparée. Relisez ou ajustez le texte avant de lancer l’agent.');}}/>}
    {libraryOpen && !props.busy && !requesting && <MissionLibraryDialog key={`${props.sessionId}:${props.binary}`} kind={props.binary ? 'binary' : 'basic'} objective={objective} onClose={() => setLibraryOpen(false)} onUse={text => { setPreviousObjective(objective); setObjective(text); }} />}
    {settingsOpen && <AgentSettingsDialog onClose={() => setSettingsOpen(false)}>
    <fieldset><legend><span className="agent-setting-step" aria-hidden="true">1</span> Connexion OpenAI</legend>
      <p className="agent-connection-status" role="status">{configured ? 'Clé configurée pour cette session' : 'Clé API à configurer'}</p>
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

    <><p className="muted">Connaissances : {props.knowledgeCount ?? 0} document(s) accessibles automatiquement selon les réglages du projet. Les extraits essentiels sont transmis au démarrage.</p><label className="document-consent"><input type="checkbox" checked={includeDocuments} disabled={props.busy || requesting || !props.documentCount} onChange={event => setDocumentConsentSession(event.target.checked ? props.sessionId : undefined)} />Autoriser les documents du projet pour cette mission ({props.documentCount})</label>
    <details className="agent-data-notice"><summary>Données transmises</summary><p className="muted">Si activé, les noms et empreintes, les extraits TXT/MD/PDF lus/recherchés et les aperçus d’images demandés par l’agent sont transmis à OpenAI. Les documents explicitement exclus restent hors accès. Les extraits essentiels sont bornés ; les autres contenus sont consultés à la demande. Modèle vision nécessaire pour les images ; PDF texte uniquement, sans OCR.</p></details></>
    {props.binary && <p className="muted">Périmètre : toutes les zones déjà enregistrées, origine et taille fixes. Modifications sauvegardées avec checkpoint. La vérification assemble et construit le DSK ; le test CPC reste manuel.</p>}
    <p className="muted">L’agent peut créer des notes Markdown et réviser les notes éditables autorisées. Les références importées restent intactes ; les changements sont comparables et restaurables.</p>
    {props.documentDirty && <p role="status">Enregistrez ou abandonnez le brouillon documentaire avant de lancer une mission.</p>}
    {props.binaryDirty && <p role="status">Enregistrez l’analyse Z80 avant de lancer, reprendre ou restaurer une mission.</p>}
    <Button className="primary" disabled={!port || !props.sessionId || !configured || !model || !catalog?.models.some(item => item.id === model) || !objective.trim() || props.busy || requesting || props.binaryDirty || props.documentDirty} onClick={() => void start()}>Lancer l’agent</Button>
    <Button disabled={!taskId || !view?.running || requesting} onClick={() => { if (port && taskId) void port.cancel(taskId).then(result => setMessage('error' in result ? result.error : 'Arrêt demandé ; écritures terminées conservées.')).catch(() => setMessage('Arrêt impossible.')); }}>Arrêter l’agent</Button>
    {view?.running && <><label htmlFor="agent-steering">Consigne de suivi (facultatif)</label><p className="muted">La mission suffit. Ajoutez ici une précision en cours de travail, par exemple « palette bleue et ivoire ».</p><textarea id="agent-steering" value={instruction} onChange={event => setInstruction(event.target.value)} maxLength={20000} rows={2} />
      <Button disabled={!instruction.trim()} onClick={() => { if (port && taskId) void port.steer(taskId, instruction).then(result => { setMessage('error' in result ? result.error : 'Consigne ajoutée au prochain tour.'); setInstruction(''); }).catch(() => setMessage('Consigne impossible.')); }}>Envoyer la consigne</Button></>}
    <p className="agent-notice" aria-live="polite">{message}</p>
    {!port && <p className="muted">Disponible dans l’application desktop uniquement.</p>}
    {!props.sessionId && <p className="muted">Ouvrez ou créez un projet pour lancer une mission.</p>}
    {view && <div className="agent-result" aria-live="polite">
      <p className="agent-status"><strong>{view.running ? 'Mission en cours' : ({ completed: 'Mission terminée', blocked: 'Validation non obtenue', failed: 'Mission interrompue par une erreur', cancelled: 'Mission arrêtée', 'paused-limit': 'Mission en pause — limite atteinte' })[view.status]}</strong></p>
      <p>{view.model} · {view.turns} tours · {view.calls} outils ({view.failedCalls ?? 0} échecs) · {view.tokens.toLocaleString('fr-FR')} tokens</p>
      <p>{view.changed.length ? `${view.changed.length} fichier(s) modifié(s), enregistrés dans le projet.` : 'Aucun fichier modifié pour le moment.'} {view.buildVerified ? 'DSK construit et relu.' : 'Construction finale non validée.'}</p>
      {!!view.extractionSimulations?.length && <section aria-label="Simulation du découpage BASIC"><h3>Découpage multifichier — aperçu et application</h3><p className="muted">L’aperçu ne modifie aucun fichier. L’agent peut ensuite appliquer ce plan exact si le projet est inchangé. Les deux sources et le manifeste sont journalisés ensemble. Après réouverture, le menu Projet permet de rétablir la dernière modification IA.</p>{view.extractionSimulations.map(item=><details key={item.record.previewId}><summary>{item.record.sourceId} → {item.record.createdCpcName} · {item.record.movedLines} ligne(s) · {item.record.status==='applied'?'appliqué':item.record.status==='failed'?'application interrompue':item.stale||item.record.status==='obsolete'?'aperçu périmé':'aperçu prêt'}</summary><p>Profil : {item.record.profile==='terminal-expressions-chain-merge-v2'?'Expressions et affichage — scalaires %/$':'Initial — affectations littérales et POKE'}.</p><p>GOTO {item.record.entryLine} ligne {item.record.gotoLine} devient CHAIN MERGE ; nouveau fichier {item.record.createdPath}.</p><p>Listing principal initial</p><pre>{item.record.beforeMain}</pre><p>Listing principal envisagé</p><pre>{item.record.afterMain}</pre><p>Fichier supplémentaire simulé</p><pre>{item.record.newPart}</pre><p>DSK initial SHA-256 : {item.record.originalDiskSha256}</p><p>DSK simulé SHA-256 : {item.record.proposedDiskSha256}</p>{item.record.checks.map((check,i)=><p key={i}>Vérification : {check}</p>)}{item.record.warnings.map((warning,i)=><p key={i} className="muted">{warning}</p>)}</details>)}</section>}
      {!!view.overlayReviews?.length && <section aria-label="Risques CHAIN MERGE"><h3>CHAIN MERGE — état et collisions</h3><p className="muted">Rapports documentaires, sans modification du projet. Une variable partagée détectée n'est pas une preuve de persistance. Les témoins sur firmware CPC concernent uniquement leurs sources de test.</p>{view.overlayReviews.map((item,index)=><details key={index}><summary>{item.report.hostId} + {item.report.overlayId} · {item.stale?'rapport périmé':'révision courante'} · {item.report.collisions.length} collision(s)</summary><p>Lignes remplacées potentiellement : {item.report.collisions.join(', ')||'aucune détectée'}. Identifiants communs : {item.report.sharedIdentifiers.join(', ')||'aucun détecté'}.</p><p>DATA hôte : {item.report.hostDataLines.join(', ')||'aucune'} ; module : {item.report.overlayDataLines.join(', ')||'aucune'}.</p><p>Tableaux observés : {item.report.arrayNames.join(', ')||'aucun'} ; chaînes : {item.report.stringNames.join(', ')||'aucune'} ; DELETE : {item.report.hasDeleteClause?'détecté':'non détecté'} ; READ sans RESTORE : {item.report.readWithoutRestore?'risque de réinitialisation':'non détecté'}.</p>{item.report.blockers.map((issue,i)=><p key={i}>Blocage : {issue}</p>)}{item.report.warnings.map((issue,i)=><p key={i} className="muted">{issue}</p>)}<p className="muted">Aucune extraction autorisée ni preuve d'équivalence du projet analysé.</p></details>)}</section>}
      {!!view.loadContracts?.length && <section aria-label="Contrat de chargement BASIC"><h3>Chargements entre fichiers CPC</h3><p className="muted">Rapport lexical du projet, sans mutation ni qualification automatique. CHAIN et MERGE seront comparés à des témoins firmware ; la réussite d'une recette ne prouve pas l'équivalence de votre jeu.</p>{view.loadContracts.map((item,index)=><details key={index}><summary>{item.report.links.length} chargement(s) détecté(s) · {item.stale?'révision périmée':'révision courante'} · {item.report.truncated?'rapport incomplet':'bornes respectées'}</summary>{item.report.risks.map((risk,i)=><p key={i}>Attention : {risk}</p>)}{item.report.links.slice(0,32).map((link,i)=><p key={i}><strong>{link.operation}</strong> · {link.sourceId} ligne {link.basicLine} → {link.rawTarget??'cible dynamique'} · {link.targetId??'aucun fichier source reconnu'} · {link.status}{link.blockers.length?'. '+link.blockers.join(' '):''}</p>)}{item.report.links.length>32&&<p className="muted">Seuls les 32 premiers liens sont affichés dans le panneau.</p>}{item.report.cycles.map((cycle,i)=><p key={i}>Cycle de chargement : {cycle.join(' → ')}</p>)}<p className="muted">{item.report.method}</p></details>)}</section>}
      {!!view.moduleReviews?.length && <section aria-label="Analyse de découpage BASIC"><h3>Découpage en modules — étude uniquement</h3><p className="muted">Les sources et le DSK restent inchangés. Une région proposée exige encore un plan de chargement, une vérification des variables partagées et des tests CPC. Aucun statut ne signifie extraction sûre.</p>{view.moduleReviews.map((snapshot,index)=><details key={snapshot.sourceId+':'+snapshot.sourceSha256+':'+index}><summary>{snapshot.review.sourcePath} · {snapshot.review.candidates.length} région(s) · {snapshot.stale?'analyse périmée':snapshot.review.flowComplete?'graphe disponible':'graphe partiel'}</summary><p className="muted">{snapshot.review.method}</p>{snapshot.review.risks.map((reason,i)=><p key={i}>Risque : {reason}</p>)}{snapshot.review.loads.map((load,i)=><p key={i}>BASIC {load.basicLine} · {load.operation} · {load.literalName??'cible dynamique/inconnue'} · source(s) liée(s) : {load.matchingSourceIds.join(', ')||'non identifiées'}</p>)}<p>Régions omises : {snapshot.review.omittedCandidates}. Chargements omis : {snapshot.review.omittedLoads}.</p>{snapshot.review.candidates.map((candidate,i)=><details key={i}><summary>GOSUB {candidate.entryLine} à {candidate.endLine??'?'} · {candidate.status==='blocked'?'déplacement bloqué':'à étudier'} · {candidate.callSites.length} appel(s)</summary><p>Sites d’appel : {candidate.callSites.join(', ')||'non qualifiés'}. Noms communs observés : {candidate.sharedNames.join(', ')||'aucun détecté'}{candidate.sharedNamesTruncated?' (liste tronquée)':''}.</p>{candidate.blockers.map((issue,j)=><p key={j}>Blocage : {issue}</p>)}<pre>{candidate.excerpt}</pre>{candidate.excerptTruncated&&<p className="muted">Extrait borné à 1200 caractères.</p>}{candidate.checks.map((step,j)=><p key={j} className="muted">{step}</p>)}</details>)}</details>)}</section>}
      {!!view.commentOperations?.length && <section aria-label="Commentaires BASIC contrôlés"><h3>Commentaires REM — avant et après</h3><p className="muted">Les commentaires proposés par l’IA sont des explications à relire : le contrôle n’atteste pas leur exactitude métier. Les lignes BASIC originales et leurs numéros restent inchangés. L’insertion utilise un numéro libre et reste restaurable par le checkpoint initial.</p>{view.commentOperations.map(op=><details key={op.previewId}><summary>{op.path} · {op.basicLine} REM avant {op.beforeBasicLine} · {op.status==='applied'?'appliqué':op.status==='obsolete'?'aperçu périmé':'aperçu non appliqué'}</summary><p>REM {op.comment}</p><p className="muted">{op.warnings.join(' ')}</p><p>Avant</p><pre>{op.before}</pre><p>Après</p><pre>{op.after}</pre>{op.truncated&&<p className="muted">Aperçu limité à 4096 caractères par version ; ouvrir la source pour le listing complet.</p>}</details>)}</section>}
      {!!view.formatOperations?.length && <section aria-label="Mise en forme contrôlée BASIC"><h3>Lisibilité du code — aperçu et bilan</h3><p className="muted">Les modifications sont limitées aux espaces des lignes couvertes et soumises à la vérification lexicale. Les commentaires, données, chaînes et instructions sensibles sont préservés. Les rapports avant/après sont heuristiques, pas des preuves d'équivalence CPC.</p>{view.formatOperations.map(op=><details key={op.previewId}><summary>{op.path} · {op.changedLines} ligne(s) remises en forme · {op.skipped} ignorée(s) · {op.status==='applied'?'appliqué':op.status==='obsolete'?'aperçu périmé':'aperçu non appliqué'}</summary><p className="muted">{op.warnings.join(' ')}</p><p>Avant</p><pre>{op.before}</pre><p>Après</p><pre>{op.after}</pre>{op.truncated&&<p className="muted">Extraits limités à 4096 caractères par version ; ouvrir le fichier pour examiner le reste.</p>}<p>Rapport qualité avant/après : longueur maximale {op.beforeMetrics?.maxLineLength ?? 'indisponible'} → {op.afterMetrics?.maxLineLength ?? 'indisponible'} ; longueur moyenne {op.beforeMetrics?.averageCodeLineLength ?? 'indisponible'} → {op.afterMetrics?.averageCodeLineLength ?? 'indisponible'} ; complexité lexicale estimée {op.beforeMetrics?.estimatedCyclomatic ?? 'indisponible'} → {op.afterMetrics?.estimatedCyclomatic ?? 'indisponible'}.</p></details>)}</section>}
      {!!view.renameOperations?.length && <section aria-label="Renommages déterministes par l’agent"><h3>Renommages BASIC contrôlés</h3><p className="muted">Plan calculé par le même moteur que F2 ; une mutation requiert un aperçu exact et une révision inchangée. Les plans refusés ne modifient aucun fichier. Les changements appliqués sont restaurables avec le checkpoint initial de la mission.</p>{view.renameOperations.map(op=><details key={op.previewId}><summary>{op.path} · {op.originalName} → {op.newName} · {op.occurrences} occurrence(s) · {op.status==='applied'?'appliqué':op.status==='obsolete'?'aperçu périmé':'aperçu non appliqué'}</summary><p>{op.kind} · {op.warnings.join(' ')}</p><p>Avant le renommage</p><pre>{op.before}</pre><p>Après le renommage</p><pre>{op.after}</pre>{op.truncated&&<p className="muted">Aperçu limité à 4096 caractères par version ; consultez le fichier pour vérifier le listing complet.</p>}</details>)}</section>}
      {!!view.testCoverage?.sources.length && <section aria-label="Rattachement des tests aux sources modifiées"><h3>Sources réellement exercées</h3><p className="muted">Preuve : même identifiant de source, empreinte SHA-256 et résultat CPC sur le buffer courant. Une copie sous un autre ID ne couvre pas le fichier original.</p><ul>{view.testCoverage.sources.map(source=><li key={source.id}><strong>{source.path}</strong> : {source.afterPassed?'essai final réussi':'aucun essai direct réussi après modification'} ; {source.beforeSha256 ? source.beforePassed?'référence initiale réussie dans la même suite':'pas de référence initiale dans la même suite' : 'nouveau fichier'}</li>)}</ul><p>{view.testCoverage.directlyTested}/{view.testCoverage.sources.length} fichiers modifiés directement testés ; {view.testCoverage.baselined} avec référence initiale.</p></section>}
      {!!view.testRuns?.length && <section aria-label="Vérifications CPC de la mission"><h3>Tests CPC avant / après</h3><p className="muted">Chaque essai porte sur les listings indiqués, exécutés séparément. Un succès ne prouve pas l’équivalence du projet entier. Les rapports restent consultables dans Tests BASIC → Historique.</p>{view.testRuns.map((run,index)=><details key={run.report.id}><summary>Essai {index+1} · {run.report.suiteName} · {run.stale?'révision antérieure':'révision courante'} · {run.report.results.filter(r=>r.outcome==='passed').length}/{run.report.results.length} listings réussis</summary>{run.archiveError&&<p role="alert">{run.archiveError}</p>}{run.report.results.map(result=><div key={result.sourceId}><strong>{result.name} : {result.outcome}</strong><p>{result.message}</p><ul>{result.cases.map(c=><li key={c.slot}>{c.name} : {c.outcome}</li>)}</ul><small>Source SHA-256 : {result.sourceSha256??'non exécutée'}</small></div>)}</details>)}</section>}
      {!view.running && <p>{view.summary}</p>}
      {view.resumable && <><p className="muted">Reprendre conserve le contexte, les fichiers et le checkpoint initial, avec {view.budget?.maxTurns} tours et {view.budget?.maxTokens} tokens supplémentaires maximum. De nouveaux appels API peuvent être facturés.</p><Button icon="run" disabled={props.busy || requesting || props.binaryDirty || props.documentDirty || !port?.resume || props.sessionId !== view.workspace.sessionId} onClick={() => void resume()}>Reprendre la mission</Button></>}
      {view.usage && <dl className="agent-stats"><div><dt>Entrée</dt><dd>{view.usage.input.toLocaleString('fr-FR')}</dd></div><div><dt>Sortie</dt><dd>{view.usage.output.toLocaleString('fr-FR')}</dd></div><div><dt>Cache lu / écrit</dt><dd>{view.usage.cached} / {view.usage.cacheWrite}</dd></div><div><dt>Raisonnement inclus dans la sortie</dt><dd>{view.usage.reasoning}</dd></div></dl>}
      {view.usage && !view.usage.complete && <p className="muted">Détail d’usage incomplet : les sous-totaux ne couvrent que les données reçues.</p>}
      <p>Coût API estimé : {view.costComplete && view.estimatedUsd !== undefined && view.tokens > 0 ? `${view.estimatedUsd.toFixed(6)} USD (hors taxes)` : 'indisponible ou incomplet'}. La facture OpenAI fait foi.</p>
      {view.pricing && <p className="muted">Tarif de la mission : {view.pricing.model}, vérifié le {new Date(view.pricing.fetchedAt).toLocaleString('fr-FR')}.</p>}
      {view.events.filter(event => event.kind === 'message').map((event, index) => <p className="agent-chat" key={index}>{event.text}</p>)}
      {view.events.filter(event => event.kind === 'tool-result' && event.success === false).slice(-3).map((event, index) => <p className="agent-tool-error" key={index}><strong>{event.tool}</strong> : {event.text}</p>)}
      {view.running && <p className="muted">Dernière activité : {TOOL_LABELS[view.events.at(-1)?.tool ?? ''] ?? view.events.at(-1)?.text ?? 'Préparation de la mission…'}</p>}
      <details><summary>Journal technique ({view.events.length} événements récents)</summary><ol className="agent-events">{view.events.map((event, index) => <li key={index} className={event.success === false ? 'agent-tool-error' : ''}><strong>{event.kind === 'tool-result' ? event.success ? 'Réussi' : 'Échec' : event.kind}</strong> {event.tool && event.kind === 'tool-result' ? `${event.tool} : ` : ''}{event.text}</li>)}</ol></details>

      <details><summary>Changements ({view.changed.length})</summary>{view.workspace.binaryAnalysis ? view.workspace.binaryAnalysis.regions.filter(region => JSON.stringify(region) !== JSON.stringify(view.binaryBefore?.regions.find(old => old.id === region.id))).map(region => { const before = view.binaryBefore?.regions.find(old => old.id === region.id); return <div key={region.id}><h3>Zone {region.id}</h3><p>Avant la mission</p><pre>{`${before?.note ?? ''}\n${before?.listing ?? ''}`.slice(0,16384)}</pre><p>Après la mission</p><pre>{`${region.note}\n${region.listing}`.slice(0,16384)}</pre><p className="muted">Aperçus limités à 16 384 caractères par version. La comparaison des octets reste disponible dans l’atelier.</p></div>; }) : view.changed.filter(path=>view.workspace.files.some(file=>file.path===path)).map(path => {
        const current = view.workspace.files.find(file => file.path === path);
        const before = view.before.find(file => file.id === current?.id);
        return <div key={path}><h3>{path}</h3><p>Avant</p><pre>{before?.source ?? 'Nouveau fichier'}</pre><p>Après</p><pre>{current?.source}</pre></div>;
      })}</details>
      {!!view.documentChanges?.length && <section className="agent-document-changes" aria-label="Documents rédigés par l’agent">
        <h3>Mémoire du projet · {view.documentChanges.length} note(s)</h3>
        <p className="muted">Versions enregistrées dans Connaissances. Le checkpoint initial restaure aussi ces documents.</p>
        {view.documentChanges.map(note=><div className="agent-document-card" key={note.id}>
          <div><strong>{note.title}</strong><span className="agent-document-badge">{note.created?'Créée':'Révisée'}</span></div>
          <Button icon="file" disabled={props.busy || requesting || props.documentDirty || props.sessionId !== view.workspace.sessionId} onClick={()=>props.onDocument?.(note.id)}>Lire {note.title}</Button>
          <details><summary>Comparer le Markdown</summary><p>Avant la mission</p><pre>{note.before??'Nouvelle note'}</pre><p>Après la mission</p><pre>{note.after}</pre>{note.truncated && <p>Aperçus limités à 16 384 caractères. Ouvrez la note pour lire la suite.</p>}</details>
        </div>)}
      </section>}
      <Button disabled={!view.changed.length || view.running || props.busy || requesting || props.binaryDirty || props.documentDirty || props.sessionId !== view.workspace.sessionId} onClick={() => void restore()}>Restaurer le checkpoint initial</Button>
    </div>}
  </section>;
}
