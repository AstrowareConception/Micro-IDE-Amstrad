import { useEffect, useRef, useState } from 'react';
import { files } from './port.ts';
import { SourceDiff } from './HistoryPanel.tsx';
import type { DraftSummary, DraftRecovery } from '../../../packages/workspace/src/drafts.ts';
import type { SearchChange } from '../../../packages/workspace/src/search.ts';

interface Document { id: string; sourceId: string; name: string; source: string; saved: string }
interface Props { sessionId: string; documents: Document[]; busy: boolean; onApply(changes: SearchChange[]): void }
interface Preview { sessionId: string; recovery: DraftRecovery; changes: SearchChange[] }
function DraftPreview({ preview, documents, busy, onClose, onRestore }: { preview: Preview; documents: Document[]; busy: boolean; onClose(): void; onRestore(changes: SearchChange[]): void }) {
  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(true);
  const [selected, setSelected] = useState(preview.changes.map(change => change.id));
  const [active, setActive] = useState(preview.changes[0]!.id);
  const [message, setMessage] = useState(''), [pending, setPending] = useState(false);
  const selectedChange = preview.changes.find(change => change.id === active)!;
  const stale = preview.changes.some(change => !documents.some(document => document.id === change.id && document.source === change.before));
  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);
  return <dialog ref={dialog} className="history-dialog draft-dialog" aria-label="Comparer les brouillons récupérables" onClose={onClose}>
    <h2>Comparer les brouillons récupérables</h2><p>Buffer actuel à gauche, copie de récupération à droite. Choisissez les sources à restaurer ; les fichiers BASIC restent intacts. Ctrl Z annule par source.</p>
    <div className="draft-selection">{preview.changes.map(change => <div key={change.id}><label><input type="checkbox" checked={selected.includes(change.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, change.id] : ids.filter(id => id !== change.id))} />Restaurer {change.name}</label><button aria-pressed={active === change.id} onClick={() => setActive(change.id)}>Comparer {change.name}</button></div>)}</div>
    <SourceDiff before={selectedChange.before} after={selectedChange.after} />
    {stale && <p role="status">Buffers modifiés depuis l’aperçu : comparez de nouveau.</p>}
    <button disabled={busy || pending || stale || !selected.length} onClick={() => {
      setPending(true); setMessage('');
      void files.drafts!.read(preview.sessionId, preview.recovery.revision).then(result => {
        if (!alive.current) return;
        if ('error' in result) throw new Error(result.error);
        if (JSON.stringify(result) !== JSON.stringify(preview.recovery)) throw new Error('Copie modifiée ; comparez de nouveau.');
        onRestore(preview.changes.filter(change => selected.includes(change.id))); dialog.current?.close();
      }).catch(error => { if (alive.current) setMessage(error instanceof Error ? error.message : 'Récupération impossible.'); })
        .finally(() => { if (alive.current) setPending(false); });
    }}>Restaurer les brouillons sélectionnés dans les buffers</button>
    <button onClick={() => dialog.current?.close()}>Fermer la comparaison des brouillons</button>
    {message && <p role="status">{message}</p>}
  </dialog>;
}
export function DraftPanel(props: Props) {
  const [summary, setSummary] = useState<DraftSummary>();
  const [enabled, setEnabled] = useState(false), [owned, setOwned] = useState(false);
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview>();
  const alive = useRef(false), flight = useRef(false);
  const latest = useRef({ ...props, summary, enabled, owned, preview }); latest.current = { ...props, summary, enabled, owned, preview };
  const dirty = props.documents.some(document => document.source !== document.saved);
  async function attempt(action: () => Promise<void>) {
    if (flight.current || latest.current.busy || !files.drafts) return;
    flight.current = true; setPending(true);
    try { await action(); }
    catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Copie de récupération indisponible.'); }
    finally { flight.current = false; if (alive.current) setPending(false); }
  }
  async function refresh() {
    const result = await files.drafts!.status(props.sessionId); if (!alive.current) return;
    if ('error' in result) throw new Error(result.error);
    setSummary(result); setOwned(!result.snapshot); setEnabled(false); setPreview(undefined);
  }
  async function capture() {
    const current = latest.current;
    if (!current.summary || !current.owned || current.preview || !current.documents.some(document => document.source !== document.saved)) return;
    const result = await files.drafts!.capture(current.sessionId, current.documents.map(document => ({ id: document.sourceId, source: document.source })), current.summary.revision);
    if (!alive.current) return;
    if ('error' in result) throw new Error(result.error);
    setSummary(result); setOwned(true); setMessage(`${result.snapshot?.files.length ?? 0} brouillon(s) copié(s) pour récupération, sans enregistrement des sources.`);
  }
  useEffect(() => {
    alive.current = true; let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return attempt(refresh); });
    return () => { cancelled = true; alive.current = false; };
  }, [props.sessionId]);
  useEffect(() => {
    if (!enabled || !owned || props.busy || preview || !dirty) return;
    const timer = setTimeout(() => void attempt(capture), 2000); return () => clearTimeout(timer);
  }, [enabled, owned, props.busy, props.documents, preview, dirty]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const current = latest.current; if (current.owned && !current.preview) void attempt(capture);
    }, 15000); return () => clearInterval(timer);
  }, [enabled]);
  return <section className="panel drafts-panel" aria-label="Brouillons récupérables">
    <h2>Brouillons récupérables</h2>
    <p className="muted">Copie locale séparée des fichiers BASIC. Activation pour cette session ; 2 s après une pause de saisie, vérification toutes les 15 s pendant une saisie continue. Les onglets restent modifiés.</p>
    <label><input type="checkbox" checked={enabled} disabled={!summary || !owned || props.busy || pending} onChange={event => setEnabled(event.target.checked)} />Copie automatique des brouillons</label>
    <button disabled={props.busy || pending} onClick={() => void attempt(refresh)}>Relire la copie de brouillons</button>
    <button disabled={!summary || !owned || !dirty || props.busy || pending || !!preview} onClick={() => void attempt(capture)}>Copier les brouillons maintenant</button>
    {summary?.snapshot && <><p>Copie disponible : <time>{new Date(summary.snapshot.createdAt).toLocaleString('fr-FR')}</time></p><ul>{summary.snapshot.files.map(file => <li key={file.id}>{file.path} · {file.bytes} octets</li>)}</ul>
      {!owned && <p>Copie d’une précédente ouverture conservée. Comparez et restaurez-la, ou effacez-la explicitement avant une nouvelle copie.</p>}
      <button disabled={props.busy || pending} onClick={() => void attempt(async () => {
        const before = latest.current.documents.map(document => ({ ...document }));
        const result = await files.drafts!.read(props.sessionId, summary.revision!); if (!alive.current) return;
        if ('error' in result) throw new Error(result.error);
        const changes = result.files.map(file => {
          const document = before.find(document => document.sourceId === file.id && document.name === file.path);
          if (!document) throw new Error('Source de brouillon absente du buffer courant.');
          return { id: document.id, name: document.name, before: document.source, after: file.source, count: 1 };
        }).filter(change => change.before !== change.after);
        if (!changes.length) { setOwned(true); setMessage('Les buffers correspondent déjà à la copie. Elle reste conservée.'); return; }
        setPreview({ sessionId: props.sessionId, recovery: result, changes });
      })}>Comparer les brouillons récupérables</button>
      <button disabled={props.busy || pending} onClick={() => void attempt(async () => {
        const result = await files.drafts!.forget(props.sessionId, summary.revision!); if (!alive.current) return;
        if ('error' in result) throw new Error(result.error);
        setSummary(result); if (!result.snapshot) { setOwned(true); setEnabled(false); }
        setMessage(result.snapshot ? 'Effacement annulé ; copie conservée.' : 'Copie de récupération effacée ; buffers conservés.');
      })}>Effacer la copie de brouillons</button></>}
    {preview && <DraftPreview key={preview.recovery.revision} preview={preview} documents={props.documents} busy={props.busy} onClose={() => setPreview(undefined)} onRestore={changes => {
      props.onApply(changes);
      const complete = changes.length === preview.changes.length;
      setOwned(complete); if (!complete) setEnabled(false);
      setMessage('Brouillons restaurés dans les buffers ; non enregistrés. Ctrl Z pour annuler par source.');
    }} />}
    {message && <p role="status">{message}</p>}{pending && <p role="status">Copie de récupération : opération en cours…</p>}
  </section>;
}
