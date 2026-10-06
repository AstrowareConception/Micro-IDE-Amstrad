import { Button } from './Icon.tsx';
import { useState } from 'react';
import type { GitDiff, RepositoryStatus, DiffSide, GitInitPlan, IndexAction, GitHistory, GitCommitPlan, GitIdentitySnapshot } from '../../../packages/version-control/src/inspection.ts';
import { files } from './port.ts';
import { GitRemotePanel } from './GitRemotePanel.tsx';
import type { ProjectSnapshot } from '../../../packages/workspace/src/project.ts';

interface Props { sessionId: string; busy: boolean; dirty: boolean; documentCount: number; onBusy(value: boolean): void; onProject(project: ProjectSnapshot): void }
export function GitPanel(props: Props) {
  const [snapshot, setSnapshot] = useState<RepositoryStatus>();
  const [diff, setDiff] = useState<GitDiff>();
  const [notice, setNotice] = useState('Actualisez pour consulter le dépôt local.');
  const [plan, setPlan] = useState<GitInitPlan>();
  const [history, setHistory] = useState<GitHistory>();
  const [commitPlan, setCommitPlan] = useState<GitCommitPlan>();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [message, setMessage] = useState('');
  const [identityProfile, setIdentityProfile] = useState<GitIdentitySnapshot>();
  const [identityNotice, setIdentityNotice] = useState('Aucune identité mémorisée sans votre demande.');
  const port = files.git;
  async function suggestMessage() {
    if (!files.gitOperations || props.busy || props.dirty) return;
    props.onBusy(true); setCommitPlan(undefined);
    try {
      const result = await files.gitOperations.suggestMessage(props.sessionId, { name, email });
      if (!result) setNotice('Suggestion IA annulée ; message conservé.');
      else if ('error' in result) setNotice(result.error);
      else { setMessage(result.message); setNotice('Message proposé par ' + result.model + '. Relisez et modifiez-le avant de préparer le commit.'); }
    } catch { setNotice('Suggestion IA non confirmée ; message conservé.'); }
    finally { props.onBusy(false); }
  }
  async function loadIdentity() {
    if (!port) return;
    const result = await port.identity(props.sessionId);
    if ('error' in result) { setIdentityProfile(undefined); setIdentityNotice(result.error); return; }
    setIdentityProfile(result);
    if (result.identity) { setName(result.identity.name); setEmail(result.identity.email); setCommitPlan(undefined); }
    setIdentityNotice(result.identity ? 'Identité mémorisée chargée ; vous pouvez la modifier pour ce commit.' : 'Aucune identité mémorisée. Les champs courants restent libres.');
  }
  async function identityAction(action: 'load' | 'remember' | 'forget') {
    if (!port || props.busy || action !== 'load' && !identityProfile) return;
    props.onBusy(true);
    try {
      if (action === 'load') { await loadIdentity(); return; }
      const result = action === 'remember' ? await port.rememberIdentity(props.sessionId, identityProfile!.revision, { name, email }) : await port.forgetIdentity(props.sessionId, identityProfile!.revision);
      if ('error' in result) { setIdentityProfile(undefined); setIdentityNotice(result.error); return; }
      setIdentityProfile(result);
      if (result.identity) { setName(result.identity.name); setEmail(result.identity.email); setCommitPlan(undefined); }
      setIdentityNotice(action === 'remember' ? 'Identité mémorisée dans le profil privé CPCéleste pour vos prochains projets et redémarrages.' : 'Identité mémorisée oubliée ; les champs de ce commit restent inchangés.');
    } catch { setIdentityProfile(undefined); setIdentityNotice('Profil non confirmé ; rechargez l’identité avant de reprendre.'); }
    finally { props.onBusy(false); }
  }
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
      if (!identityProfile) {
        try { await loadIdentity(); }
        catch { setIdentityNotice('Profil indisponible ; saisissez librement une identité pour ce commit.'); }
      }
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
    <h2>Git · contrôle de version</h2>
    <p className="muted">Dépôt local, changements, commits, branches et synchronisation. Les publications restent confirmées. Commits locaux non signés, hooks désactivés.</p>
    {props.dirty && <p className="git-dirty">Brouillons non enregistrés : ils ne figurent pas dans le diff Git. Mutations Git bloquées ; aucune sauvegarde automatique.</p>}
    <Button data-git-action="refresh" disabled={props.busy || !port} onClick={() => void refresh()}>Actualiser Git</Button>
    <Button disabled={props.busy || !port} onClick={() => void readHistory()}>Historique Git</Button>
    {snapshot?.state !== 'repository' && <Button data-git-action="init" disabled={props.busy || props.dirty || !port} onClick={() => void prepare()}>Préparer la création Git</Button>}
    <p aria-live="polite" className="git-notice">{notice}</p>
    <details className="git-network-tools"><summary>Branches, remotes et GitHub</summary>
    <GitRemotePanel sessionId={props.sessionId} busy={props.busy} dirty={props.dirty} onBusy={props.onBusy} onProject={props.onProject} />
    </details>
    {plan && <div className="git-init-preview"><h3>Créer dans {plan.rootName} · branche main</h3><p>{plan.version} · {plan.preserveIgnore ? 'exclusions locales, .gitignore existant conservé' : '.gitignore créé sans écrasement'}</p>
      <textarea aria-label="Exclusions Git proposées" readOnly rows={8} value={plan.ignoreText} />
      <p>Aucun fichier ne sera indexé automatiquement. Vérifiez la racine dans la confirmation native.</p>
      <Button disabled={props.busy || props.dirty} onClick={() => void initialize()}>Créer le dépôt Git local</Button>
      <Button disabled={props.busy} onClick={() => { setPlan(undefined); setNotice('Aperçu abandonné ; aucun fichier créé.'); }}>Abandonner l’aperçu Git</Button>
    </div>}
    {props.documentCount > 0 && <p className="muted">Les documents sont privés par défaut. Le manifeste les référence : un futur partage sans leurs originaux ne sera pas un projet complet.</p>}
    {snapshot?.state === 'repository' && <>
      <p>{snapshot.version} · branche {snapshot.branch} · {snapshot.head === '(initial)' ? 'sans premier commit' : snapshot.head.slice(0, 12)}</p>
      <p>{snapshot.changes.length} changement(s) · index / disque</p>
      <div className="git-commit-form"><h3>Commit local · Git 2.48+</h3>
        <p>Identité pour ce commit. Mémorisation facultative dans le profil privé CPCéleste, commune à tous les projets. Aucun changement de configuration Git globale/locale.</p>
        <label>Nom de l’auteur<input aria-label="Nom de l’auteur Git" maxLength={100} disabled={props.busy} value={name} onChange={event => { setName(event.target.value); setCommitPlan(undefined); }} /></label>
        <label>Email de l’auteur<input aria-label="Email de l’auteur Git" maxLength={254} disabled={props.busy} value={email} onChange={event => { setEmail(event.target.value); setCommitPlan(undefined); }} /></label>
        <Button disabled={props.busy || !identityProfile || !name.trim() || !email} onClick={() => void identityAction('remember')}>Mémoriser cette identité</Button>
        <Button disabled={props.busy} onClick={() => void identityAction('load')}>Charger l’identité mémorisée</Button>
        <Button disabled={props.busy || !identityProfile?.identity} onClick={() => void identityAction('forget')}>Oublier l’identité mémorisée</Button>
        <p aria-live="polite" className="muted">{identityNotice}</p>
        <label>Message<textarea aria-label="Message du commit Git" rows={3} maxLength={8192} disabled={props.busy} value={message} onChange={event => { setMessage(event.target.value); setCommitPlan(undefined); }} /></label>
        <Button icon="spark" data-git-action="suggest-message" disabled={props.busy || props.dirty || !files.gitOperations || !name.trim() || !email} onClick={() => void suggestMessage()}>Proposer le message par IA…</Button>
        <Button disabled={props.busy || props.dirty || !name.trim() || !email || !message.trim()} onClick={() => void prepareCommit()}>Préparer le commit de l’index</Button>
        {commitPlan && <div className="git-init-preview"><h3>Aperçu du commit · {commitPlan.branch}</h3>
          <p>{commitPlan.name} &lt;{commitPlan.email}&gt; · parent {commitPlan.head === '(initial)' ? 'premier commit' : commitPlan.head.slice(0, 12)}</p>
          <pre>{commitPlan.message}</pre><ul>{commitPlan.files.map(file => <li key={file.path}>{file.status} {file.path}</li>)}</ul>
          <textarea readOnly rows={12} aria-label="Diff du commit préparé" value={commitPlan.diff} />
          <p>Index examiné uniquement. Les changements hors index restent sur disque. Hooks désactivés, commit non signé, aucun push.</p>
          <Button disabled={props.busy || props.dirty} onClick={() => void commit()}>Créer le commit local</Button>
          <Button disabled={props.busy} onClick={() => setCommitPlan(undefined)}>Abandonner l’aperçu du commit</Button>
        </div>}
      </div>
      {!snapshot.snapshotId && <p className="git-dirty">Indexation indisponible : certaines préconditions disque ne sont pas qualifiées. Statut en lecture seule.</p>}
      <ul className="git-changes">{snapshot.changes.map(change => <li key={change.id}>
        <code>{change.index}{change.worktree}</code> <span>{change.path}</span>
        {change.originalPath && <small> ← {change.originalPath}</small>}
        <Button disabled={props.busy || change.index === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'index')} aria-label={`Diff index ${change.path}`}>Index</Button>
        <Button disabled={props.busy || change.worktree === '.' || change.kind === 'untracked' || change.kind === 'conflict'} onClick={() => void compare(change.id, 'worktree')} aria-label={`Diff disque ${change.path}`}>Disque</Button>
        {change.indexable && <>
          <Button disabled={props.busy || props.dirty || change.worktree === '.'} onClick={() => void changeIndex(change.id, 'stage')} aria-label={`Indexer ${change.path}`}>Indexer</Button>
          <Button disabled={props.busy || props.dirty || change.index === '.' || change.index === '?'} onClick={() => void changeIndex(change.id, 'unstage')} aria-label={`Retirer index ${change.path}`}>Retirer index</Button>
        </>}
      </li>)}</ul>
    </>}
    {diff && <><h3>{diff.path} · {diff.side === 'index' ? 'index' : 'disque'}</h3>
      <textarea aria-label="Diff Git" readOnly rows={12} value={diff.text || 'Aucune différence sur ce côté au moment de la lecture.'} /></>}
    {history && <div aria-label="Historique des commits"><h3>Historique Git</h3><p>{history.head === '(initial)' ? 'Aucun premier commit.' : `HEAD capturé : ${history.head.slice(0, 12)}`}</p>
      <ol className="git-history">{history.commits.map(commit => <li key={commit.oid}><code>{commit.oid.slice(0, 12)}</code><p>{commit.subject}</p><time dateTime={commit.date}>{commit.date}</time></li>)}</ol>
      {history.nextCursor && <Button disabled={props.busy} onClick={() => void readHistory(true)}>20 commits suivants</Button>}
    </div>}
  </section>;
}
