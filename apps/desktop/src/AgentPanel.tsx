import { AgentSettingsDialog } from './AgentSettingsDialog.tsx';
import { DEFAULT_BUDGET } from '../../../packages/agent/src/consumption.ts';
import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { AgentView, AgentWorkspaceState, ModelCatalog, AgentBudget, PricingProfile } from '../../../packages/agent/src/types.ts';
import { files } from './port.ts';

const TOOL_LABELS: Record<string, string> = { project_list_files: 'Exploration du projet', project_read_file: 'Lecture d’une source', reference_search: 'Recherche dans les références BASIC', reference_read: 'Lecture d’une référence BASIC', reference_read_many: 'Lecture groupée des références BASIC', project_replace_source: 'Modification d’une source', project_create_source: 'Création d’une source', language_analyze: 'Analyse des sources', build_project: 'Construction et relecture du DSK', documents_list: 'Liste des documents autorisés', documents_search: 'Recherche documentaire' };

interface Props {
  sessionId: string | undefined; buffers: { id: string; source: string }[]; busy: boolean;
  documentCount: number;
  onRunning(running: boolean): void; onState(state: AgentWorkspaceState): void;
}
export function AgentPanel(props: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false), [budget, setBudget] = useState<AgentBudget>({ ...DEFAULT_BUDGET });
  const [pricing, setPricing] = useState<PricingProfile>(), [pricingNotice, setPricingNotice] = useState('');
  const [pollRevision, setPollRevision] = useState(0);
  const [key, setKey] = useState(''), [model, setModel] = useState('');
  const [catalog, setCatalog] = useState<ModelCatalog>();
  const modelRequest = useRef(false);
  const [configured, setConfigured] = useState(false), [objective, setObjective] = useState('');
  const [view, setView] = useState<AgentView | undefined>(), [taskId, setTaskId] = useState<string | undefined>();
  const [message, setMessage] = useState(''), [requesting, setRequesting] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [documentConsentSession, setDocumentConsentSession] = useState<string | undefined>();
  const includeDocuments = !!props.sessionId && documentConsentSession === props.sessionId && props.documentCount > 0;
  const latest = useRef(props); latest.current = props;
  const adopted = useRef('');
  const port = files.agent;
  useEffect(() => {
    if (!taskId || !port) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const result = await port!.status(taskId!);
        if (disposed) return;
        if ('error' in result) { setMessage(result.error); timer = setTimeout(() => void poll(), 1000); return; }
        setView(result);
        if (result.workspace.sessionId === latest.current.sessionId) {
          const state = JSON.stringify(result.workspace);
          if (state !== adopted.current) {
            const buffers = latest.current.buffers;
            if (buffers.length !== result.workspace.files.length || result.workspace.files.some(file => buffers.find(buffer => buffer.id === file.id)?.source !== file.source)) latest.current.onState(result.workspace);
            adopted.current = state;
          }
          latest.current.onRunning(result.running);
        }
        if (result.running) timer = setTimeout(() => void poll(), 400);
      } catch { if (!disposed) { setMessage('Lecture du journal interrompue. Réessayez ou arrêtez la mission.'); timer = setTimeout(() => void poll(), 1000); } }
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
        if ('error' in result) setMessage(result.error);
        else { setConfigured(false); setView(previous => previous ? { ...previous, resumable: false } : previous); setCatalog(undefined); setModel(''); setPricing(undefined); setMessage('Clé oubliée.'); }
      } else {
        const result = await port.models(key);
        if ('error' in result) setMessage(result.error);
        else { setConfigured(true); setView(previous => previous ? { ...previous, resumable: false } : previous); setCatalog(result); setModel(result.model); setPricing(undefined); setMessage('Clé vérifiée, conservée en mémoire. Choisissez un modèle dans la liste OpenAI.'); }
      }
    } catch { setMessage('Configuration impossible.'); }
    finally { setKey(''); modelRequest.current = false; setRequesting(false); }
  }
  async function selectModel(value: string) {
    if (!port || props.busy || modelRequest.current || !value) return;
    modelRequest.current = true; setRequesting(true);
    try { const result = await port.selectModel(value); if ('error' in result) setMessage(result.error); else { setModel(result.model); setPricing(undefined); setMessage(`Modèle sélectionné : ${result.model}.`); await loadPricing(result.model); } }
    catch { setMessage('Changement de modèle impossible.'); }
    finally { modelRequest.current = false; setRequesting(false); }
  }
  async function loadPricing(value = model) {
    if (!port?.pricing || !value) return;
    setPricingNotice('Lecture du tarif officiel…');
    try { const result = await port.pricing(value); if ('error' in result) { setPricing(undefined); setPricingNotice(result.error); } else { setPricing(result); setPricingNotice('Tarif officiel actualisé.'); } }
    catch { setPricing(undefined); setPricingNotice('Tarif inaccessible ; estimation indisponible.'); }
  }
  async function resume() {
    if (!port?.resume || !taskId || !props.sessionId) return;
    setRequesting(true); props.onRunning(true);
    try { const result = await port.resume(taskId, props.buffers, props.sessionId); if ('error' in result) { setMessage(result.error); props.onRunning(false); } else { setMessage(''); setView(previous => previous ? { ...previous, running: true } : previous); setPollRevision(previous => previous + 1); } }
    catch { setMessage('Reprise impossible ; fichiers conservés.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function start() {
    if (!port || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      if (!pricing || Date.now() - Date.parse(pricing.fetchedAt) >= 60 * 60 * 1000) await loadPricing();
      const result = await port.start(props.sessionId, objective, props.buffers, includeDocuments, budget);
      if ('error' in result) { setMessage(result.error); props.onRunning(false); }
      else { adopted.current = ''; setTaskId(result.taskId); setView(undefined); setMessage(''); }
    } catch { setMessage('Démarrage impossible.'); props.onRunning(false); }
    finally { setRequesting(false); }
  }
  async function restore() {
    if (!port || !taskId || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      const result = await port.restore(taskId, props.buffers, props.sessionId);
      if ('error' in result) setMessage(result.error);
      else { props.onState(result); adopted.current = JSON.stringify(result); setMessage('Checkpoint initial restauré. Les brouillons initiaux sont conservés.'); setView(undefined); setTaskId(undefined); }
    } catch { setMessage('Restauration impossible ; conserver le checkpoint.'); }
    finally { setRequesting(false); props.onRunning(false); }
  }
  return <section className="panel agent-panel" aria-label="Agent OpenAI">
    <div className="agent-heading"><h2>Agent de programmation</h2><Button icon="settings" disabled={props.busy || requesting} onClick={() => setSettingsOpen(true)}>Réglages IA</Button></div>
    <p className="muted">{configured && model ? `Modèle : ${model}` : 'Ouvrez les réglages IA pour connecter votre clé et choisir un modèle.'}</p>
    <p className="muted">Sources et extraits consultés transmis à OpenAI. L’agent enregistre ses modifications avec checkpoint local. API facturée par OpenAI.</p>
    <label htmlFor="agent-objective">Mission de programmation</label><textarea id="agent-objective" value={objective} onChange={event => setObjective(event.target.value)} maxLength={20000} rows={4} placeholder="Crée un écran de titre CPC en MODE 1…" disabled={props.busy || requesting} />
    {settingsOpen && <AgentSettingsDialog onClose={() => setSettingsOpen(false)}>
    <p className="agent-settings-notice" aria-live="polite">{message}</p>
    <fieldset><legend>Connexion OpenAI</legend>
    <label htmlFor="openai-model">Modèle OpenAI</label><select id="openai-model" value={model} disabled={props.busy || requesting || !catalog?.models.length} onChange={event => void selectModel(event.target.value)}>
      <option value="">{configured ? 'Choisir un modèle…' : 'Configurer la clé pour charger les modèles'}</option>
      {catalog?.models.map(item => <option key={item.id} value={item.id}>{item.id}{item.shutdownDate ? ` · retrait ${item.shutdownDate}` : ''}</option>)}
    </select>
    <Button icon="history" disabled={!configured || props.busy || requesting} onClick={() => void refreshModels()}>Actualiser les modèles</Button>
    {catalog && <p className="muted">Liste OpenAI vérifiée le {new Date(catalog.fetchedAt).toLocaleString('fr-FR')} · actualisation toutes les 15 min. Modèles accessibles à votre clé ; prise en charge des outils vérifiée lors de la mission.</p>}

    <label htmlFor="openai-key">Clé API OpenAI</label><input id="openai-key" type="password" autoComplete="off" spellCheck={false} value={key} disabled={props.busy || requesting} onChange={event => setKey(event.target.value)} />
    <Button disabled={!port || props.busy || requesting || !key} onClick={() => void configure()}>Configurer la clé</Button>
    <Button disabled={!configured || props.busy || requesting} onClick={() => void configure(true)}>Oublier la clé</Button></fieldset>
    <fieldset><legend>Budget par lancement ou reprise</legend>
      <p className="muted">À la limite, la mission se met en pause. Une reprise volontaire accorde ce même budget supplémentaire et peut consommer de nouveaux tokens facturés.</p>
      {([{ key: 'maxTurns', label: 'Tours modèle maximum', min: 1, max: 100 }, { key: 'maxCalls', label: 'Appels outils maximum', min: 1, max: 200 }, { key: 'maxTokens', label: 'Tokens maximum', min: 1000, max: 500000 }] as const).map(item => <label key={item.key}>{item.label}<input type="number" min={item.min} max={item.max} step={1} value={budget[item.key]} disabled={props.busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= item.min && value <= item.max) setBudget(previous => ({ ...previous, [item.key]: value })); }} /></label>)}
      <p className="muted">Durée : 15 min par lancement. Le budget tokens est vérifié après la réponse et peut être dépassé par celle-ci.</p>
    </fieldset>
    <fieldset><legend>Estimation API en USD</legend>
      <Button icon="history" disabled={!model || props.busy || requesting} onClick={() => void loadPricing()}>Actualiser le tarif officiel</Button>
      <p className="muted">{pricingNotice}</p>
      {pricing && <p>Par million de tokens : entrée {pricing.input} $ · cache lu {pricing.cached} $ · sortie {pricing.output} $. Tarif vérifié le {new Date(pricing.fetchedAt).toLocaleString('fr-FR')}, valable 1 h pour l’estimation. Source : {pricing.source}</p>}
      <p className="muted">L’estimation exige le détail d’usage et le tarif officiel du modèle effectivement retourné. Hors taxes, conversion et remises de compte. La facture OpenAI fait foi.</p>
    </fieldset>
    </AgentSettingsDialog>}

    <label className="document-consent"><input type="checkbox" checked={includeDocuments} disabled={props.busy || requesting || !props.documentCount} onChange={event => setDocumentConsentSession(event.target.checked ? props.sessionId : undefined)} />Autoriser les documents du projet pour cette mission ({props.documentCount})</label>
    <details className="agent-data-notice"><summary>Données transmises</summary><p className="muted">Si activé, les noms et empreintes, les extraits TXT/MD/PDF lus/recherchés et les aperçus d’images demandés par l’agent sont transmis à OpenAI. Aucun original complet n’est ajouté automatiquement. Modèle vision nécessaire pour les images ; PDF texte uniquement, sans OCR.</p></details>
    <Button className="primary" disabled={!port || !props.sessionId || !configured || !model || !catalog?.models.some(item => item.id === model) || !objective.trim() || props.busy || requesting} onClick={() => void start()}>Lancer l’agent</Button>
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
      {!view.running && <p>{view.summary}</p>}
      {view.resumable && <><p className="muted">Reprendre conserve le contexte, les fichiers et le checkpoint initial, avec {view.budget?.maxTurns} tours et {view.budget?.maxTokens} tokens supplémentaires maximum. De nouveaux appels API peuvent être facturés.</p><Button icon="run" disabled={props.busy || requesting || !port?.resume || props.sessionId !== view.workspace.sessionId} onClick={() => void resume()}>Reprendre la mission</Button></>}
      {view.usage && <dl className="agent-stats"><div><dt>Entrée</dt><dd>{view.usage.input.toLocaleString('fr-FR')}</dd></div><div><dt>Sortie</dt><dd>{view.usage.output.toLocaleString('fr-FR')}</dd></div><div><dt>Cache lu / écrit</dt><dd>{view.usage.cached} / {view.usage.cacheWrite}</dd></div><div><dt>Raisonnement inclus dans la sortie</dt><dd>{view.usage.reasoning}</dd></div></dl>}
      {view.usage && !view.usage.complete && <p className="muted">Détail d’usage incomplet : les sous-totaux ne couvrent que les données reçues.</p>}
      <p>Coût API estimé : {view.costComplete && view.estimatedUsd !== undefined && view.tokens > 0 ? `${view.estimatedUsd.toFixed(6)} USD (hors taxes)` : 'indisponible ou incomplet'}. La facture OpenAI fait foi.</p>
      {view.pricing && <p className="muted">Tarif de la mission : {view.pricing.model}, vérifié le {new Date(view.pricing.fetchedAt).toLocaleString('fr-FR')}.</p>}
      {view.events.filter(event => event.kind === 'message').map((event, index) => <p className="agent-chat" key={index}>{event.text}</p>)}
      {view.events.filter(event => event.kind === 'tool-result' && event.success === false).slice(-3).map((event, index) => <p className="agent-tool-error" key={index}><strong>{event.tool}</strong> : {event.text}</p>)}
      {view.running && <p className="muted">Dernière activité : {TOOL_LABELS[view.events.at(-1)?.tool ?? ''] ?? view.events.at(-1)?.text ?? 'Préparation de la mission…'}</p>}
      <details><summary>Journal technique ({view.events.length} événements récents)</summary><ol className="agent-events">{view.events.map((event, index) => <li key={index} className={event.success === false ? 'agent-tool-error' : ''}><strong>{event.kind === 'tool-result' ? event.success ? 'Réussi' : 'Échec' : event.kind}</strong> {event.tool && event.kind === 'tool-result' ? `${event.tool} : ` : ''}{event.text}</li>)}</ol></details>

      <details><summary>Changements ({view.changed.length})</summary>{view.changed.map(path => {
        const current = view.workspace.files.find(file => file.path === path);
        const before = view.before.find(file => file.id === current?.id);
        return <div key={path}><h3>{path}</h3><p>Avant</p><pre>{before?.source ?? 'Nouveau fichier'}</pre><p>Après</p><pre>{current?.source}</pre></div>;
      })}</details>
      <Button disabled={!view.changed.length || view.running || props.busy || requesting || props.sessionId !== view.workspace.sessionId} onClick={() => void restore()}>Restaurer le checkpoint initial</Button>
    </div>}
  </section>;
}
