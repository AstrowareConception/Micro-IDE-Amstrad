import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { AgentView, AgentWorkspaceState, ModelCatalog } from '../../../packages/agent/src/types.ts';
import { files } from './port.ts';

interface Props {
  sessionId: string | undefined; buffers: { id: string; source: string }[]; busy: boolean;
  documentCount: number;
  onRunning(running: boolean): void; onState(state: AgentWorkspaceState): void;
}
export function AgentPanel(props: Props) {
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
          if (state !== adopted.current) { latest.current.onState(result.workspace); adopted.current = state; }
          latest.current.onRunning(result.running);
        }
        if (result.running) timer = setTimeout(() => void poll(), 400);
      } catch { if (!disposed) { setMessage('Lecture du journal interrompue. Réessayez ou arrêtez la mission.'); timer = setTimeout(() => void poll(), 1000); } }
    }
    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [taskId, port]);
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
        else { setConfigured(false); setCatalog(undefined); setModel(''); setMessage('Clé oubliée.'); }
      } else {
        const result = await port.models(key);
        if ('error' in result) setMessage(result.error);
        else { setConfigured(true); setCatalog(result); setModel(result.model); setMessage('Clé vérifiée, conservée en mémoire. Choisissez un modèle dans la liste OpenAI.'); }
      }
    } catch { setMessage('Configuration impossible.'); }
    finally { setKey(''); modelRequest.current = false; setRequesting(false); }
  }
  async function selectModel(value: string) {
    if (!port || props.busy || modelRequest.current || !value) return;
    modelRequest.current = true; setRequesting(true);
    try { const result = await port.selectModel(value); if ('error' in result) setMessage(result.error); else { setModel(result.model); setMessage(`Modèle sélectionné : ${result.model}.`); } }
    catch { setMessage('Changement de modèle impossible.'); }
    finally { modelRequest.current = false; setRequesting(false); }
  }
  async function start() {
    if (!port || !props.sessionId) return; setRequesting(true); props.onRunning(true);
    try {
      const result = await port.start(props.sessionId, objective, props.buffers, includeDocuments);
      if ('error' in result) { setMessage(result.error); props.onRunning(false); }
      else { adopted.current = ''; setTaskId(result.taskId); setView(undefined); setMessage('Mission démarrée.'); }
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
    <h2>Agent de programmation</h2>
    <p className="muted">Sources et extraits consultés transmis à OpenAI. L’agent enregistre ses modifications avec checkpoint local. API facturée par OpenAI.</p>
    <label htmlFor="agent-objective">Mission de programmation</label><textarea id="agent-objective" value={objective} onChange={event => setObjective(event.target.value)} maxLength={20000} rows={4} placeholder="Crée un écran de titre CPC en MODE 1…" disabled={props.busy || requesting} />
    <details className="agent-connection" open><summary>Connexion OpenAI</summary>
    <label htmlFor="openai-model">Modèle OpenAI</label><select id="openai-model" value={model} disabled={props.busy || requesting || !catalog?.models.length} onChange={event => void selectModel(event.target.value)}>
      <option value="">{configured ? 'Choisir un modèle…' : 'Configurer la clé pour charger les modèles'}</option>
      {catalog?.models.map(item => <option key={item.id} value={item.id}>{item.id}{item.shutdownDate ? ` · retrait ${item.shutdownDate}` : ''}</option>)}
    </select>
    <Button icon="history" disabled={!configured || props.busy || requesting} onClick={() => void refreshModels()}>Actualiser les modèles</Button>
    {catalog && <p className="muted">Liste OpenAI vérifiée le {new Date(catalog.fetchedAt).toLocaleString('fr-FR')} · actualisation toutes les 15 min. Modèles accessibles à votre clé ; prise en charge des outils vérifiée lors de la mission.</p>}

    <label htmlFor="openai-key">Clé API OpenAI</label><input id="openai-key" type="password" autoComplete="off" spellCheck={false} value={key} disabled={props.busy || requesting} onChange={event => setKey(event.target.value)} />
    <Button disabled={!port || props.busy || requesting || !key} onClick={() => void configure()}>Configurer la clé</Button>
    <Button disabled={!configured || props.busy || requesting} onClick={() => void configure(true)}>Oublier la clé</Button></details>

    <label className="document-consent"><input type="checkbox" checked={includeDocuments} disabled={props.busy || requesting || !props.documentCount} onChange={event => setDocumentConsentSession(event.target.checked ? props.sessionId : undefined)} />Autoriser les documents du projet pour cette mission ({props.documentCount})</label>
    <details className="agent-data-notice"><summary>Données transmises</summary><p className="muted">Si activé, les noms et empreintes, les extraits TXT/MD/PDF lus/recherchés et les aperçus d’images demandés par l’agent sont transmis à OpenAI. Aucun original complet n’est ajouté automatiquement. Modèle vision nécessaire pour les images ; PDF texte uniquement, sans OCR.</p></details>
    <Button className="primary" disabled={!port || !props.sessionId || !configured || !model || !catalog?.models.some(item => item.id === model) || !objective.trim() || props.busy || requesting} onClick={() => void start()}>Lancer l’agent</Button>
    <Button disabled={!taskId || !view?.running || requesting} onClick={() => { if (port && taskId) void port.cancel(taskId).then(result => setMessage('error' in result ? result.error : 'Arrêt demandé ; écritures terminées conservées.')).catch(() => setMessage('Arrêt impossible.')); }}>Arrêter l’agent</Button>
    {view?.running && <><label htmlFor="agent-steering">Consigne de suivi</label><textarea id="agent-steering" value={instruction} onChange={event => setInstruction(event.target.value)} maxLength={20000} rows={2} />
      <Button disabled={!instruction.trim()} onClick={() => { if (port && taskId) void port.steer(taskId, instruction).then(result => { setMessage('error' in result ? result.error : 'Consigne ajoutée au prochain tour.'); setInstruction(''); }).catch(() => setMessage('Consigne impossible.')); }}>Envoyer la consigne</Button></>}
    <p className="agent-notice" aria-live="polite">{message}</p>
    {!port && <p className="muted">Disponible dans l’application desktop uniquement.</p>}
    {!props.sessionId && <p className="muted">Ouvrez ou créez un projet pour lancer une mission.</p>}
    {view && <div className="agent-result"><p>{view.running ? 'running' : view.status} · {view.turns} tours · {view.calls} outils · {view.tokens} tokens</p>
      <ol className="agent-events">{view.events.map((event, index) => <li key={index}><strong>{event.kind}</strong> {event.text}</li>)}</ol>
      {!view.running && <p>{view.summary}</p>}
      <details><summary>Changements ({view.changed.length})</summary>{view.changed.map(path => {
        const current = view.workspace.files.find(file => file.path === path);
        const before = view.before.find(file => file.id === current?.id);
        return <div key={path}><h3>{path}</h3><p>Avant</p><pre>{before?.source ?? 'Nouveau fichier'}</pre><p>Après</p><pre>{current?.source}</pre></div>;
      })}</details>
      <Button disabled={view.running || props.busy || requesting || props.sessionId !== view.workspace.sessionId} onClick={() => void restore()}>Restaurer le checkpoint initial</Button>
    </div>}
  </section>;
}
