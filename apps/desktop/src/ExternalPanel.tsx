import { useEffect, useRef, useState } from 'react';
import { files } from './port.ts';
import { SourceDiff } from './HistoryPanel.tsx';
import type { ExternalChange, ExternalVersion } from '../../../packages/workspace/src/external.ts';
interface Props {
  sessionId: string; documents: { id: string; sourceId: string; source: string }[]; busy: boolean;
  onAccept(version: ExternalVersion, before: string, reload: boolean): void;
}
export function ExternalPanel(props: Props) {
  const latest = useRef(props); latest.current = props;
  const alive = useRef(false), flight = useRef(false);
  const [changes, setChanges] = useState<ExternalChange[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ version: ExternalVersion; before: string }>();
  const previewRef = useRef(preview); previewRef.current = preview;
  async function attempt(action: () => Promise<void>) {
    if (!alive.current || flight.current || latest.current.busy) return;
    flight.current = true; setPending(true);
    try { await action(); }
    catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Inspection externe indisponible.'); }
    finally { flight.current = false; if (alive.current) setPending(false); }
  }
  async function refresh() {
    const result = await files.external!.status(latest.current.sessionId);
    if (!alive.current) return;
    if ('error' in result) throw new Error(result.error);
    setChanges(result); setMessage(result.length ? `${result.length} changement(s) externe(s). Buffers conservés.` : 'Sources disque à jour.');
  }
  useEffect(() => {
    alive.current = true; let cancelled = false;
    const inspect = () => { if (!cancelled && !previewRef.current && !document.hidden) void attempt(refresh); };
    void Promise.resolve().then(inspect);
    const timer = window.setInterval(inspect, 5000); window.addEventListener('focus', inspect);
    return () => { cancelled = true; alive.current = false; clearInterval(timer); window.removeEventListener('focus', inspect); };
  }, [props.sessionId]);
  return <section className="panel" aria-label="Modifications externes">
    <h2>Modifications externes</h2>
    <p>Contrôle toutes les 5 s et au retour dans la fenêtre. Aucun rechargement automatique.</p>
    <button disabled={props.busy || pending || !!preview} onClick={() => void attempt(refresh)}>Vérifier les fichiers disque</button>
    {changes.map(change => <div key={change.id}><p>{change.path}{change.issue ? ` · ${change.issue}` : ' · modifié sur disque'}</p>
      {change.revision && <button disabled={props.busy || pending || !!preview} onClick={() => void attempt(async () => {
        const result = await files.external!.read(props.sessionId, change.id, change.revision!); if (!alive.current) return;
        if ('error' in result) throw new Error(result.error);
        const buffer = latest.current.documents.find(item => item.sourceId === change.id);
        if (!buffer) throw new Error('Buffer indisponible.');
        setPreview({ version: result, before: buffer.source }); setMessage('');
      })}>Comparer {change.path}</button>}
    </div>)}
    {message && <p role="status">{message}</p>}
    {preview && <ExternalPreview version={preview.version} before={preview.before}
      stale={props.documents.find(item => item.sourceId === preview.version.id)?.source !== preview.before}
      pending={pending || props.busy} message={message} onClose={() => setPreview(undefined)} onAccept={reload => void attempt(async () => {
        const result = await files.external!.accept(props.sessionId, preview.version.id, preview.version.revision, preview.version.baseRevision);
        if (!alive.current) return;
        if ('error' in result) throw new Error(result.error);
        latest.current.onAccept(result, preview.before, reload); setPreview(undefined); await refresh();
      })} />}
  </section>;
}
function ExternalPreview({ version, before, stale, pending, message, onClose, onAccept }: {
  version: ExternalVersion; before: string; stale: boolean; pending: boolean; message: string;
  onClose(): void; onAccept(reload: boolean): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="history-dialog" aria-labelledby="external-title" onCancel={event => { if (pending) event.preventDefault(); }} onClose={onClose}>
    <h2 id="external-title">Comparer la version disque · {version.path}</h2>
    <p>Buffer à gauche, disque à droite. Charger remplace le buffer avec Ctrl Z. Conserver le buffer adopte la base disque : une prochaine sauvegarde explicite remplacera cette version disque. Aucun fichier n’est écrit ici.</p>
    <SourceDiff before={before} after={version.source} />
    {stale && <p role="status">Buffer modifié depuis l’aperçu : fermez et comparez de nouveau.</p>}
    {message && <p role="status">{message}</p>}
    <div className="history-actions">
      <button disabled={pending || stale} onClick={() => onAccept(true)}>Charger la version disque dans le buffer</button>
      <button disabled={pending || stale} onClick={() => onAccept(false)}>Conserver mon buffer après comparaison</button>
      <button disabled={pending} onClick={() => dialog.current?.close()}>Fermer la comparaison disque</button>
    </div>
  </dialog>;
}
