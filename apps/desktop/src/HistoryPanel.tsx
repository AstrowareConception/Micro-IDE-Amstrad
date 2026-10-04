import { useEffect, useRef, useState } from 'react';
import { files } from './port.ts';
import { monaco, language } from './monaco-language.ts';
import type { HistorySnapshot, HistoryVersion } from '../../../packages/workspace/src/history.ts';

interface Props {
  sessionId: string; sourceId: string; path: string; source: string; busy: boolean;
  onApply(before: string, after: string): void; onClose(): void;
}
function HistoryDiff({ before, after }: { before: string; after: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const original = monaco.editor.createModel(before, language), modified = monaco.editor.createModel(after, language);
    const diff = monaco.editor.createDiffEditor(host.current, { theme: 'cpc-workbench', readOnly: true, originalEditable: false,
      automaticLayout: true, renderSideBySide: true, fontSize: 14, minimap: { enabled: false },
      maxComputationTime: 1000, ignoreTrimWhitespace: false, ariaLabel: 'Comparaison historique : buffer actuel à gauche, version choisie à droite' });
    diff.setModel({ original, modified });
    return () => { diff.dispose(); original.dispose(); modified.dispose(); };
  }, [before, after]);
  return <div className="history-diff" ref={host} />;
}
export function HistoryPanel({ sessionId, sourceId, path, source, busy, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);
  const [preview, setPreview] = useState<{ version: HistoryVersion; before: string }>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    alive.current = true; dialog.current?.showModal(); setPending(true);
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return refresh(); })
      .catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Historique indisponible.'); })
      .finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; alive.current = false; };
  }, [sessionId]);
  async function attempt(action: () => Promise<void>) {
    if (busy || pending) return;
    setPending(true); setMessage('');
    try { await action(); }
    catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Historique indisponible.'); }
    finally { if (alive.current) setPending(false); }
  }
  async function refresh() {
    if (!files.history) return;
    const result = await files.history.list(sessionId); if (!alive.current) return;
    if ('error' in result) throw new Error(result.error);
    setSnapshots(result); setPreview(undefined);
    setMessage(result.length ? `${result.length} snapshot(s) local(aux).` : 'Aucune version locale : enregistrez une modification du projet.');
  }
  async function compare(snapshot: HistorySnapshot) {
    if (!files.history) return;
    const result = await files.history.version(sessionId, snapshot.id, sourceId, snapshot.revision); if (!alive.current) return;
    if ('error' in result) throw new Error(result.error);
    setPreview({ version: result, before: source });
  }
  const stale = !!preview && preview.before !== source;
  return <dialog ref={dialog} className="history-dialog" aria-labelledby="local-history-title" onClose={onClose}>
    <h2 id="local-history-title">Historique local · {path}</h2>
    <p>Versions des sauvegardes du projet, indépendantes de Git. Jusqu’à 20 snapshots / 64 Mio ; les plus anciens expirent. Les brouillons non enregistrés et mutations agent ne sont pas archivés.</p>
    <div className="history-actions"><button disabled={busy || pending} onClick={() => void attempt(refresh)}>Actualiser les versions locales</button><button onClick={() => dialog.current?.close()}>Fermer l’historique</button></div>
    <div className="history-versions">{snapshots.filter(snapshot => snapshot.files.some(file => file.id === sourceId && file.path === path)).map(snapshot => <button key={snapshot.id} disabled={busy || pending} aria-pressed={preview?.version.snapshotId === snapshot.id} onClick={() => void attempt(() => compare(snapshot))}>
      {snapshot.reason === 'before-save' ? 'Avant sauvegarde' : 'Après sauvegarde'} · {new Date(snapshot.createdAt).toLocaleString('fr-FR')} · {snapshot.id.slice(0, 8)}
    </button>)}</div>
    {preview && <><p>À gauche : votre buffer au moment de la comparaison. À droite : la version choisie. Restaurer remplace uniquement ce buffer ; Ctrl Z annule. Enregistrez ensuite pour écrire sur disque.</p>
      <HistoryDiff before={preview.before} after={preview.version.source} />
      {stale && <p role="status">Buffer modifié depuis la comparaison : comparez de nouveau avant de restaurer.</p>}
      <button disabled={busy || pending || stale || preview.before === preview.version.source} onClick={() => void attempt(async () => {
        if (!files.history) return;
        const version = preview.version;
        const checked = await files.history.version(sessionId, version.snapshotId, sourceId, version.revision);
        if (!alive.current) return;
        if ('error' in checked) throw new Error(checked.error);
        if (checked.sha256 !== version.sha256 || checked.source !== version.source) throw new Error('Version historique modifiée ; comparez de nouveau.');
        onApply(preview.before, checked.source); setPreview(undefined);
        setMessage('Version restaurée dans le buffer. Non enregistrée ; Ctrl Z pour annuler.');
      })}>Restaurer cette version dans le buffer</button></>}
    {message && <p role="status">{message}</p>}
    {pending && <p role="status">Lecture de l’historique…</p>}
  </dialog>;
}
