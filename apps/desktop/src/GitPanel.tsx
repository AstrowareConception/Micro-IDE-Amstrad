import { useState } from 'react';
import type { GitDiff, RepositoryStatus, DiffSide } from '../../../packages/version-control/src/inspection.ts';
import { files } from './port.ts';

interface Props { sessionId: string; busy: boolean; dirty: boolean; onBusy(value: boolean): void }
export function GitPanel(props: Props) {
  const [snapshot, setSnapshot] = useState<RepositoryStatus>();
  const [diff, setDiff] = useState<GitDiff>();
  const [notice, setNotice] = useState('Actualisez pour consulter le dépôt local.');
  const port = files.git;
  async function refresh() {
    if (!port || props.busy) return;
    props.onBusy(true); setDiff(undefined); setSnapshot(undefined);
    try {
      const result = await port.status(props.sessionId);
      if ('error' in result) setNotice(result.error);
      else { setSnapshot(result); setNotice(result.state === 'parent-repository' ? 'Dépôt parent détecté : ouvrez une racine de projet égale à celle du dépôt. Aucun périmètre élargi.' :
        result.state === 'not-repository' ? 'Aucun dépôt à la racine du projet. La création depuis l’IDE viendra ensuite.' : 'Statut sur disque actualisé ; aucun fichier modifié.'); }
    } catch { setNotice('Lecture du dépôt impossible.'); }
    finally { props.onBusy(false); }
  }
  async function compare(id: string, side: DiffSide) {
    if (!port || props.busy) return;
    props.onBusy(true); setDiff(undefined);
    try {
      const result = await port.diff(props.sessionId, id, side);
      if ('error' in result) setNotice(result.error);
      else { setDiff(result); setNotice('Diff des octets enregistrés, lu à la demande ; pas des brouillons Monaco.'); }
    } catch { setNotice('Lecture du diff impossible.'); }
    finally { props.onBusy(false); }
  }
  return <section className="panel git-panel" aria-label="Contrôle de version Git">
    <h2>Git · lecture seule</h2>
    <p className="muted">Statut local, diff index / disque. Aucun commit, stage ou accès réseau ; aucun outil Git pour l’IA.</p>
    {props.dirty && <p className="git-dirty">Brouillons non enregistrés : ils ne figurent pas dans le diff Git.</p>}
    <button disabled={props.busy || !port} onClick={() => void refresh()}>Actualiser Git</button>
    <p aria-live="polite" className="git-notice">{notice}</p>
    {snapshot?.state === 'repository' && <>
      <p>{snapshot.version} · branche {snapshot.branch} · {snapshot.head === '(initial)' ? 'sans premier commit' : snapshot.head.slice(0, 12)}</p>
      <p>{snapshot.changes.length} changement(s) · index / disque</p>
      <ul className="git-changes">{snapshot.changes.map(change => <li key={change.id}>
        <code>{change.index}{change.worktree}</code> <span>{change.path}</span>
        {change.originalPath && <small> ← {change.originalPath}</small>}
        <button disabled={props.busy || change.index === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'index')} aria-label={`Diff index ${change.path}`}>Index</button>
        <button disabled={props.busy || change.worktree === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'worktree')} aria-label={`Diff disque ${change.path}`}>Disque</button>
      </li>)}</ul>
    </>}
    {diff && <><h3>{diff.path} · {diff.side === 'index' ? 'index' : 'disque'}</h3>
      <textarea aria-label="Diff Git" readOnly rows={12} value={diff.text || 'Aucune différence sur ce côté au moment de la lecture.'} /></>}
  </section>;
}
