import { useEffect, useState } from 'react';
import type { GitHistory } from '../../../packages/version-control/src/inspection.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';

export function GitLogPanel({ sessionId, busy, visible }: { sessionId: string; busy: boolean; visible: boolean }) {
  const [history, setHistory] = useState<GitHistory>();
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible || busy) { setLoading(false); return; }
    if (history || !files.git) return;
    let disposed = false; setLoading(true);
    void files.git.history(sessionId).then(result => { if (disposed) return; if ('error' in result) setMessage(result.error); else { setHistory(result); setMessage('Historique chargé.'); } }).catch(() => { if (!disposed) setMessage('Historique indisponible.'); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [sessionId, visible, busy]);
  async function refresh(next = false) {
    if (!files.git || loading || busy) return;
    setLoading(true);
    try { const result = await files.git.history(sessionId, next ? history?.nextCursor : undefined); if ('error' in result) setMessage(result.error); else { setHistory(next && history ? { ...result, commits: [...history.commits, ...result.commits] } : result); setMessage('Historique chargé.'); } }
    catch { setMessage('Historique indisponible.'); }
    finally { setLoading(false); }
  }
  return <section className="panel git-log-panel" aria-label="Journal Git" hidden={!visible}>
    <h2>Journal Git · commits</h2>
    <Button icon="history" disabled={busy || loading || !files.git} onClick={() => void refresh()}>Actualiser le journal Git</Button>
    {!files.git && <p>Journal disponible dans l’application desktop.</p>}
    <p aria-live="polite">{message}</p>
    {history && <><p>{history.head === '(initial)' ? 'Aucun premier commit.' : `HEAD : ${history.head.slice(0, 12)}`}</p>
      <ol className="git-history">{history.commits.map(commit => <li key={commit.oid}><code>{commit.oid.slice(0, 12)}</code> · <time dateTime={commit.date}>{new Date(commit.date).toLocaleString('fr-FR')}</time><p>{commit.subject}</p></li>)}</ol>
      {history.nextCursor && <Button disabled={busy || loading} onClick={() => void refresh(true)}>Charger les commits suivants</Button>}
    </>}
  </section>;
}
