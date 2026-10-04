import { useEffect, useRef, useState } from 'react';
import type { AgentView, AgentWorkspaceState } from '../../../packages/agent/src/types.ts';
import { files } from './port.ts';

interface Props {
  sessionId: string | undefined; buffers: { id: string; source: string }[]; busy: boolean;
  documentCount: number;
  onRunning(running: boolean): void; onState(state: AgentWorkspaceState): void;
}
export function AgentPanel(props: Props) {
  const [key, setKey] = useState(''), [model, setModel] = useState('gpt-5.4-2026-03-05');
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
  async function configure(forget = false) {
    if (!port) return; setRequesting(true);
    try {
      const result = await port.configure(forget ? '' : key, model);
      if ('error' in result) setMessage(result.error);
      else { setConfigured(result.configured); setMessage(result.configured ? 'Clé conservée en mémoire pour cette session. Connexion vérifiée lors de la mission.' : 'Clé oubliée.'); }
    } catch { setMessage('Configuration impossible.'); }
    finally { setKey(''); setRequesting(false); }
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
    <p className="muted">OpenAI · outils locaux · BASIC 1.1. Les sources du projet et extraits du corpus consultés sont transmis à OpenAI. Modifications enregistrées automatiquement ; checkpoint local avant mutation. Appels API facturés par OpenAI.</p>
    <label htmlFor="openai-model">Modèle OpenAI</label><input id="openai-model" value={model} disabled={props.busy || requesting} onChange={event => setModel(event.target.value)} maxLength={80} />
    <label htmlFor="openai-key">Clé API OpenAI</label><input id="openai-key" type="password" autoComplete="off" spellCheck={false} value={key} disabled={props.busy || requesting} onChange={event => setKey(event.target.value)} />
    <button disabled={!port || props.busy || requesting || !key} onClick={() => void configure()}>Configurer la clé</button>
    <button disabled={!configured || props.busy || requesting} onClick={() => void configure(true)}>Oublier la clé</button>
    <label htmlFor="agent-objective">Mission de programmation</label><textarea id="agent-objective" value={objective} onChange={event => setObjective(event.target.value)} maxLength={20000} rows={4} placeholder="Crée un écran de titre CPC en MODE 1…" disabled={props.busy || requesting} />
    <label className="document-consent"><input type="checkbox" checked={includeDocuments} disabled={props.busy || requesting || !props.documentCount} onChange={event => setDocumentConsentSession(event.target.checked ? props.sessionId : undefined)} />Autoriser les documents du projet pour cette mission ({props.documentCount})</label>
    <p className="muted">Si activé, les noms et empreintes des documents ainsi que les extraits lus/recherchés par l’agent sont transmis à OpenAI. Le texte complet n’est pas ajouté automatiquement. Images et PDF à venir.</p>
    <button className="primary" disabled={!port || !props.sessionId || !configured || !objective.trim() || props.busy || requesting} onClick={() => void start()}>Lancer l’agent</button>
    <button disabled={!taskId || !view?.running || requesting} onClick={() => { if (port && taskId) void port.cancel(taskId).then(result => setMessage('error' in result ? result.error : 'Arrêt demandé ; écritures terminées conservées.')).catch(() => setMessage('Arrêt impossible.')); }}>Arrêter l’agent</button>
    {view?.running && <><label htmlFor="agent-steering">Consigne de suivi</label><textarea id="agent-steering" value={instruction} onChange={event => setInstruction(event.target.value)} maxLength={20000} rows={2} />
      <button disabled={!instruction.trim()} onClick={() => { if (port && taskId) void port.steer(taskId, instruction).then(result => { setMessage('error' in result ? result.error : 'Consigne ajoutée au prochain tour.'); setInstruction(''); }).catch(() => setMessage('Consigne impossible.')); }}>Envoyer la consigne</button></>}
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
      <button disabled={view.running || props.busy || requesting || props.sessionId !== view.workspace.sessionId} onClick={() => void restore()}>Restaurer le checkpoint initial</button>
    </div>}
  </section>;
}
