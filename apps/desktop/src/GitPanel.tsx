import { useState } from 'react';
import type { GitDiff, RepositoryStatus, DiffSide, GitInitPlan, IndexAction, GitHistory, GitCommitPlan } from '../../../packages/version-control/src/inspection.ts';
import { files } from './port.ts';

interface Props { sessionId: string; busy: boolean; dirty: boolean; documentCount: number; onBusy(value: boolean): void }
export function GitPanel(props: Props) {
  const [snapshot, setSnapshot] = useState<RepositoryStatus>();
  const [diff, setDiff] = useState<GitDiff>();
  const [notice, setNotice] = useState('Actualisez pour consulter le dépôt local.');
  const [plan, setPlan] = useState<GitInitPlan>();
  const [history, setHistory] = useState<GitHistory>();
  const [commitPlan, setCommitPlan] = useState<GitCommitPlan>();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [message, setMessage] = useState('');
  const port = files.git;
  async function prepareCommit() {
    if (!port || props.busy || props.dirty) return;
    props.onBusy(true); setCommitPlan(undefined);
    try {
      const result = await port.prepareCommit(props.sessionId, { name, email, message });
      if ('error' in result) setNotice(result.error);
      else { setCommitPlan(result); setNotice('Aperçu du commit : vérifiez auteur, message et diff de l’index.'); }
    } catch { setNotice('Préparation du commit impossible.'); }
    finally { props.onBusy(false); }
  }
  async function commit() {
    if (!port || !commitPlan || props.busy || props.dirty) return;
    props.onBusy(true);
    try {
      const result = await port.commit(props.sessionId, commitPlan.id);
      if (!result) setNotice('Commit annulé ; branche et index inchangés.');
      else if ('error' in result) { setCommitPlan(undefined); setSnapshot(undefined); setNotice(result.error); }
      else { setCommitPlan(undefined); setSnapshot(result.status); setHistory(undefined); setDiff(undefined); setMessage(''); setNotice(`Commit local créé : ${result.oid.slice(0, 12)} · ${result.branch}.`); }
    } catch { setCommitPlan(undefined); setNotice('Résultat du commit non confirmé ; consultez l’historique avant de reprendre.'); }
    finally { props.onBusy(false); }
  }
  async function readHistory(next = false) {
    if (!port || props.busy) return;
    props.onBusy(true);
    try {
      const result = await port.history(props.sessionId, next ? history?.nextCursor : undefined);
      if ('error' in result) { setNotice(result.error); setHistory(undefined); }
      else { setHistory(previous => next && previous?.head === result.head ? { ...result, commits: [...previous.commits, ...result.commits] } : result); setNotice('Historique du HEAD capturé, en lecture seule.'); }
    } catch { setNotice('Historique indisponible ; recommencez la lecture.'); setHistory(undefined); }
    finally { props.onBusy(false); }
  }
  async function refresh() {
    if (!port || props.busy) return;
    props.onBusy(true); setCommitPlan(undefined); setDiff(undefined); setSnapshot(undefined); setPlan(undefined);
    try {
      const result = await port.status(props.sessionId);
      if ('error' in result) setNotice(result.error);
      else { setSnapshot(result); setNotice(result.state === 'parent-repository' ? 'Dépôt parent détecté : ouvrez une racine de projet égale à celle du dépôt. Aucun périmètre élargi.' :
        result.state === 'not-repository' ? 'Aucun dépôt à la racine du projet. Préparez la création pour consulter les exclusions.' : 'Statut sur disque actualisé ; aucun fichier modifié.'); }
    } catch { setNotice('Lecture du dépôt impossible.'); }
    finally { props.onBusy(false); }
  }
  async function compare(id: string, side: DiffSide) {
    if (!port || props.busy) return;
    props.onBusy(true); setCommitPlan(undefined); setDiff(undefined);
    try {
      const result = await port.diff(props.sessionId, id, side);
      if ('error' in result) setNotice(result.error);
      else { setDiff(result); setNotice('Diff des octets enregistrés, lu à la demande ; pas des brouillons Monaco.'); }
    } catch { setNotice('Lecture du diff impossible.'); }
    finally { props.onBusy(false); }
  }
  async function prepare() {
    if (!port || props.busy || props.dirty) return;
    props.onBusy(true); setCommitPlan(undefined); setDiff(undefined); setPlan(undefined);
    try {
      const result = await port.prepareInit(props.sessionId);
      if ('error' in result) setNotice(result.error);
      else { setPlan(result); setNotice('Aperçu uniquement ; aucun dépôt créé. La confirmation native montrera la racine exacte.'); }
    } catch { setNotice('Préparation impossible.'); }
    finally { props.onBusy(false); }
  }
  async function initialize() {
    if (!port || !plan || props.busy || props.dirty) return;
    props.onBusy(true); setCommitPlan(undefined); setDiff(undefined);
    try {
      const result = await port.init(props.sessionId, plan.id);
      if (!result) setNotice('Création annulée ; aucun dépôt créé.');
      else if ('error' in result) { setPlan(undefined); setSnapshot(undefined); setNotice(result.error); }
      else { setPlan(undefined); setSnapshot(result); setNotice('Dépôt main créé avec exclusions ; aucun fichier indexé et aucun commit.'); }
    } catch { setNotice('Création non confirmée ; actualisez Git avant de reprendre.'); setPlan(undefined); }
    finally { props.onBusy(false); }
  }
  async function changeIndex(id: string, action: IndexAction) {
    if (!port || !snapshot?.snapshotId || props.busy || props.dirty) return;
    props.onBusy(true); setCommitPlan(undefined); setDiff(undefined);
    try {
      const result = await port.changeIndex(props.sessionId, snapshot.snapshotId, id, action);
      if (!result) setNotice('Opération annulée ; index inchangé.');
      else if ('error' in result) { setNotice(result.error); setSnapshot(undefined); }
      else { setSnapshot(result); setNotice(action === 'stage' ? 'Fichier sélectionné indexé ; aucun commit, sources inchangées.' : 'Fichier sélectionné retiré de l’index ; sources inchangées.'); }
    } catch { setNotice('Résultat non confirmé ; actualisez Git avant de reprendre.'); setSnapshot(undefined); }
    finally { props.onBusy(false); }
  }
  return <section className="panel git-panel" aria-label="Contrôle de version Git">
    <h2>Git · dépôt et index locaux</h2>
    <p className="muted">Statut, diff, création main et staging par fichier avec confirmation native. Commits locaux non signés, hooks désactivés. Aucun accès réseau ni outil Git pour l’IA.</p>
    {props.dirty && <p className="git-dirty">Brouillons non enregistrés : ils ne figurent pas dans le diff Git. Mutations Git bloquées ; aucune sauvegarde automatique.</p>}
    <button disabled={props.busy || !port} onClick={() => void refresh()}>Actualiser Git</button>
    <button disabled={props.busy || !port} onClick={() => void readHistory()}>Historique Git</button>
    {snapshot?.state === 'not-repository' && <button disabled={props.busy || props.dirty || !port} onClick={() => void prepare()}>Préparer la création Git</button>}
    <p aria-live="polite" className="git-notice">{notice}</p>
    {plan && <div className="git-init-preview"><h3>Créer dans {plan.rootName} · branche main</h3><p>{plan.version} · .gitignore créé sans écrasement</p>
      <textarea aria-label="Exclusions Git proposées" readOnly rows={8} value={plan.ignoreText} />
      <p>Aucun fichier ne sera indexé automatiquement. Vérifiez la racine dans la confirmation native.</p>
      <button disabled={props.busy || props.dirty} onClick={() => void initialize()}>Créer le dépôt Git local</button>
      <button disabled={props.busy} onClick={() => { setPlan(undefined); setNotice('Aperçu abandonné ; aucun fichier créé.'); }}>Abandonner l’aperçu Git</button>
    </div>}
    {props.documentCount > 0 && <p className="muted">Les documents sont privés par défaut. Le manifeste les référence : un futur partage sans leurs originaux ne sera pas un projet complet.</p>}
    {snapshot?.state === 'repository' && <>
      <p>{snapshot.version} · branche {snapshot.branch} · {snapshot.head === '(initial)' ? 'sans premier commit' : snapshot.head.slice(0, 12)}</p>
      <p>{snapshot.changes.length} changement(s) · index / disque</p>
      <div className="git-commit-form"><h3>Commit local · Git 2.48+</h3>
        <p>Identité pour ce commit, conservée dans le panneau pendant cette session. Aucun changement de configuration Git globale/locale.</p>
        <label>Nom de l’auteur<input aria-label="Nom de l’auteur Git" maxLength={100} disabled={props.busy} value={name} onChange={event => { setName(event.target.value); setCommitPlan(undefined); }} /></label>
        <label>Email de l’auteur<input aria-label="Email de l’auteur Git" maxLength={254} disabled={props.busy} value={email} onChange={event => { setEmail(event.target.value); setCommitPlan(undefined); }} /></label>
        <label>Message<textarea aria-label="Message du commit Git" rows={3} maxLength={8192} disabled={props.busy} value={message} onChange={event => { setMessage(event.target.value); setCommitPlan(undefined); }} /></label>
        <button disabled={props.busy || props.dirty || !name.trim() || !email || !message.trim()} onClick={() => void prepareCommit()}>Préparer le commit de l’index</button>
        {commitPlan && <div className="git-init-preview"><h3>Aperçu du commit · {commitPlan.branch}</h3>
          <p>{commitPlan.name} &lt;{commitPlan.email}&gt; · parent {commitPlan.head === '(initial)' ? 'premier commit' : commitPlan.head.slice(0, 12)}</p>
          <pre>{commitPlan.message}</pre><ul>{commitPlan.files.map(file => <li key={file.path}>{file.status} {file.path}</li>)}</ul>
          <textarea readOnly rows={12} aria-label="Diff du commit préparé" value={commitPlan.diff} />
          <p>Index examiné uniquement. Les changements hors index restent sur disque. Hooks désactivés, commit non signé, aucun push.</p>
          <button disabled={props.busy || props.dirty} onClick={() => void commit()}>Créer le commit local</button>
          <button disabled={props.busy} onClick={() => setCommitPlan(undefined)}>Abandonner l’aperçu du commit</button>
        </div>}
      </div>
      {!snapshot.snapshotId && <p className="git-dirty">Indexation indisponible : certaines préconditions disque ne sont pas qualifiées. Statut en lecture seule.</p>}
      <ul className="git-changes">{snapshot.changes.map(change => <li key={change.id}>
        <code>{change.index}{change.worktree}</code> <span>{change.path}</span>
        {change.originalPath && <small> ← {change.originalPath}</small>}
        <button disabled={props.busy || change.index === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'index')} aria-label={`Diff index ${change.path}`}>Index</button>
        <button disabled={props.busy || change.worktree === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'worktree')} aria-label={`Diff disque ${change.path}`}>Disque</button>
        {change.indexable && <>
          <button disabled={props.busy || props.dirty || change.worktree === '.'} onClick={() => void changeIndex(change.id, 'stage')} aria-label={`Indexer ${change.path}`}>Indexer</button>
          <button disabled={props.busy || props.dirty || change.index === '.' || change.index === '?'} onClick={() => void changeIndex(change.id, 'unstage')} aria-label={`Retirer index ${change.path}`}>Retirer index</button>
        </>}
      </li>)}</ul>
    </>}
    {diff && <><h3>{diff.path} · {diff.side === 'index' ? 'index' : 'disque'}</h3>
      <textarea aria-label="Diff Git" readOnly rows={12} value={diff.text || 'Aucune différence sur ce côté au moment de la lecture.'} /></>}
    {history && <div aria-label="Historique des commits"><h3>Historique Git</h3><p>{history.head === '(initial)' ? 'Aucun premier commit.' : `HEAD capturé : ${history.head.slice(0, 12)}`}</p>
      <ol className="git-history">{history.commits.map(commit => <li key={commit.oid}><code>{commit.oid.slice(0, 12)}</code><p>{commit.subject}</p><time dateTime={commit.date}>{commit.date}</time></li>)}</ol>
      {history.nextCursor && <button disabled={props.busy} onClick={() => void readHistory(true)}>20 commits suivants</button>}
    </div>}
  </section>;
}
