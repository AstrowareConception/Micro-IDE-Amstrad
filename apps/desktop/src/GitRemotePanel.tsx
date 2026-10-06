import type { Notify, NotificationLevel } from './notifications.ts';
import { useState } from 'react';
import type { ProjectSnapshot } from '../../../packages/workspace/src/project.ts';
import type { GitOverview, GitOperationPlan, GitRequest, GitHubPullRequest } from '../../../packages/version-control/src/operations.ts';
import { GIT_ACTION_LABELS } from '../../../packages/version-control/src/operations.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';
export function GitRemotePanel({ sessionId, busy, dirty, onBusy, onProject, onNotify }: {
  sessionId: string; busy: boolean; dirty: boolean; onBusy(value: boolean): void; onProject(project: ProjectSnapshot): void; onNotify?: Notify;
}) {
  const [overview, setOverview] = useState<GitOverview>(), [plan, setPlan] = useState<GitOperationPlan>();
  const [notice, setNoticeText] = useState('Chargez les branches et remotes pour commencer.');
  const [remote, setRemote] = useState('origin'), [url, setUrl] = useState(''), [branch, setBranch] = useState(''), [newBranch, setNewBranch] = useState('');
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [base, setBase] = useState('main'), [title, setTitle] = useState(''), [body, setBody] = useState(''), [draft, setDraft] = useState(true);
  function setNotice(message: string, level: NotificationLevel = 'info') {
    setNoticeText(message); onNotify?.({ source: 'git', target: 'git', sessionId: sessionId, level, message: level === 'error' ? 'Opération Git non confirmée. Consultez le panneau Git avant de reprendre.' : message });
  }
  const port = files.gitOperations;
  const [cancellable, setCancellable] = useState(false);
  async function stop() {
    const result = await port!.cancel();
    setNotice('error' in result ? result.error : result.stopped ? 'Arrêt demandé ; attente du résultat Git.' : 'Aucun transfert Git actif.', 'error' in result ? 'error' : 'info');
  }
  async function action(work: () => Promise<void>, canCancel = false) {
    if (busy || !port) return; onBusy(true); setCancellable(canCancel); setNotice('Opération en cours…');
    try { await work(); } catch (error) { setPlan(undefined); setNotice(error instanceof Error ? error.message : 'Opération Git non confirmée ; actualisez avant de reprendre.', 'error'); }
    finally { setCancellable(false); onBusy(false); }
  }
  async function load() {
    const result = await port!.overview(sessionId); if ('error' in result) { setOverview(undefined); throw new Error(result.error); }
    setOverview(result); return result;
  }
  function prepare(request: GitRequest) {
    if (dirty) return;
    void action(async () => {
      setPlan(undefined); const current = await load();
      const result = await port!.prepare(sessionId, current.revision, request.branch === '' ? { ...request, branch: current.branch } : request);
      if ('error' in result) throw new Error(result.error);
      if (request.action === 'pull') await load();
      setPlan(result); setNotice('Aperçu prêt. Vérifiez la destination et les références avant confirmation.');
    }, true);
  }
  function apply() {
    if (!plan || dirty) return;
    void action(async () => {
      const result = await port!.apply(sessionId, plan.id); setPlan(undefined);
      if (!result) { setNotice('Opération annulée.'); return; } if ('error' in result) throw new Error(result.error);
      setOverview(result.overview); setNotice(result.summary); if (result.project) onProject(result.project);
    }, true);
  }
  function prs(create: boolean) {
    if (!files.github || create && dirty) return;
    void action(async () => {
      const result = create ? await files.github!.createPullRequest(sessionId, remote, base, title, body, draft) : await files.github!.pullRequests(sessionId, remote);
      if (!result) { setNotice('Création de PR annulée.'); return; } if ('error' in result) throw new Error(result.error);
      if (Array.isArray(result)) { setPullRequests(result); setNotice('100 premières PR ouvertes au maximum.'); }
      else { setPullRequests(previous => [result, ...previous.filter(entry => entry.number !== result.number)]); setNotice('PR créée ; elle peut être ouverte pour revue sur GitHub.'); }
    });
  }
  if (!port) return null;
  const blocked = busy || dirty;
  return <div className="git-remote-panel" aria-label="Branches et synchronisation Git">
    <h3>Branches et synchronisation</h3>
    {cancellable && <Button icon="stop" onClick={() => void stop()}>Arrêter l’opération Git</Button>}
    <Button icon="git" data-git-action="branches" disabled={busy} onClick={() => void action(async () => { await load(); setNotice('Branches et remotes chargés. Les compteurs reflètent les références locales.'); })}>Charger branches et remotes</Button>
    {overview && <p className="git-summary"><strong>{overview.branch}</strong> · ↑ {overview.ahead} · ↓ {overview.behind}<br /><small>{overview.fetchedAt ? 'Dernier fetch : ' + new Date(overview.fetchedAt).toLocaleString('fr-FR') : 'Aucun fetch effectué dans cette session.'}</small></p>}
    <label>Remote<select aria-label="Remote Git" disabled={busy} value={remote} onChange={event => { setRemote(event.target.value); setPlan(undefined); }}>
      {!overview?.remotes.length && <option value="origin">origin</option>}{overview?.remotes.map(entry => <option key={entry.name} value={entry.name}>{entry.name}</option>)}
    </select></label>
    {overview?.remotes.find(entry => entry.name === remote) && <code className="git-url">{overview.remotes.find(entry => entry.name === remote)!.url}</code>}
    <label>Branche distante pour synchroniser<input aria-label="Branche distante Git" disabled={busy} value={branch} onChange={event => { setBranch(event.target.value); setPlan(undefined); }} placeholder={overview?.branch ?? 'Branche courante par défaut'} /></label>
    <div className="git-actions">
      <Button icon="download" data-git-action="fetch" disabled={blocked} onClick={() => prepare({ action: 'fetch', remote })}>Fetch</Button>
      <Button icon="download" data-git-action="pull" disabled={blocked} onClick={() => prepare({ action: 'pull', remote, branch })}>Pull · fast-forward</Button>
      <Button icon="upload" data-git-action="push" disabled={blocked} onClick={() => prepare({ action: 'push', remote, branch })}>Push…</Button>
      <Button icon="branch" disabled={blocked} onClick={() => prepare({ action: 'upstream', remote, branch })}>Suivre cette branche</Button>
    </div>
    <details><summary>Gérer les remotes</summary>
      <label>Nom du remote<input aria-label="Nom du remote Git" disabled={busy} value={remote} onChange={event => { setRemote(event.target.value); setPlan(undefined); }} /></label>
      <label>URL HTTPS ou SSH<input aria-label="URL du remote Git" disabled={busy} value={url} onChange={event => { setUrl(event.target.value); setPlan(undefined); }} placeholder="https://github.com/organisation/jeu.git" /></label>
      <Button icon="plus" data-git-action="remote" disabled={blocked || !url} onClick={() => prepare({ action: 'add-remote', remote, url })}>Ajouter le remote</Button>
      <Button icon="settings" disabled={blocked || !url} onClick={() => prepare({ action: 'set-remote', remote, url })}>Modifier l’URL</Button>
      <Button icon="trash" disabled={blocked} onClick={() => prepare({ action: 'remove-remote', remote })}>Retirer le remote</Button>
      <p className="muted">GitHub privé en HTTPS : connectez votre compte depuis le menu Git. SSH utilise les clés et hôtes déjà approuvés du système.</p>
    </details>
    <details><summary>Branches locales et distantes</summary>
      <label>Nouvelle branche<input aria-label="Nouvelle branche Git" disabled={busy} value={newBranch} onChange={event => { setNewBranch(event.target.value); setPlan(undefined); }} placeholder="feature/nouveau-jeu" /></label>
      <Button icon="branch" data-git-action="create-branch" disabled={blocked || !newBranch} onClick={() => prepare({ action: 'create-branch', branch: newBranch })}>Créer la branche</Button>
      <ul className="git-branches">{overview?.branches.map(entry => <li key={(entry.remote ? 'remote:' : 'local:') + entry.name}>
        <span>{entry.current ? '● ' : ''}{entry.name}{entry.remote ? ' · distante' : ''}<small>{entry.upstream && ' → ' + entry.upstream}</small></span>
        {!entry.current && <Button icon="branch" disabled={blocked} aria-label={'Basculer sur ' + entry.name} onClick={() => prepare({ action: 'switch-branch', branch: entry.name })}>Basculer</Button>}
        {!entry.remote && !entry.current && <Button icon="trash" disabled={blocked} aria-label={'Supprimer la branche ' + entry.name} onClick={() => prepare({ action: 'delete-branch', branch: entry.name })}>Supprimer</Button>}
      </li>)}</ul>
      <p className="muted">Bascule et pull exigent un disque propre. Le projet cible est vérifié avant modification, puis ses onglets sont rechargés.</p>
    </details>
    <details><summary>Pull requests GitHub</summary>
      <Button icon="pullRequest" data-git-action="prs" disabled={busy || !files.github} onClick={() => prs(false)}>Charger les PR ouvertes</Button>
      <label>Branche de base<input aria-label="Branche de base PR" disabled={busy} value={base} onChange={event => setBase(event.target.value)} /></label>
      <label>Titre<input aria-label="Titre de la PR" disabled={busy} maxLength={256} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Description<textarea aria-label="Description de la PR" disabled={busy} maxLength={20000} rows={4} value={body} onChange={event => setBody(event.target.value)} /></label>
      <label><input type="checkbox" disabled={busy} checked={draft} onChange={event => setDraft(event.target.checked)} />Créer en brouillon</label>
      <Button icon="pullRequest" disabled={blocked || !title.trim() || !files.github} onClick={() => prs(true)}>Créer la PR de la branche courante…</Button>
      <p className="muted">Publiez d’abord la branche avec Push. La création est confirmée ; aucune fusion automatique.</p>
      <ul>{pullRequests.map(pr => <li key={pr.number}><Button icon="pullRequest" disabled={busy} onClick={() => void action(async () => { const result = await files.github!.open(pr.url); if ('error' in result) throw new Error(result.error); })}>#{pr.number} {pr.title}{pr.draft ? ' · brouillon' : ''}</Button><small>{pr.head} → {pr.base}</small></li>)}</ul>
      <Button icon="github" disabled={busy || !overview?.remotes.some(entry => entry.name === remote && entry.url.startsWith('https://github.com/'))} onClick={() => void action(async () => {
        const entry = overview!.remotes.find(entry => entry.name === remote)!;
        const result = await files.github!.open(entry.url.replace(/\.git$/, '') + '/actions'); if ('error' in result) throw new Error(result.error);
      })}>Ouvrir la CI sur GitHub</Button>
    </details>
    {plan && <div className="git-operation-preview" aria-label="Aperçu de l’opération Git">
      <h4>{GIT_ACTION_LABELS[plan.action]} · {plan.branch}</h4><p>Branche locale : {plan.localBranch} · Cible : {plan.branch}<br />{plan.remote} · <code>{plan.url}</code></p><small>HEAD {plan.head.slice(0, 12)} → {plan.target ? plan.target.slice(0, 12) : 'nouvelle référence'}</small>
      {plan.action === 'pull' && <p className="muted">Le fetch a déjà actualisé les références. Annuler conserve ce fetch et ne modifie pas vos sources.</p>}
      {plan.action === 'push' && <><p>{plan.commits} commit(s) à publier. Analyse des nouveaux commits : aucun contenu privé ou motif de secret détecté ; ce contrôle n’est pas une certification.</p><ul>{plan.files.map(path => <li key={path}>{path}</li>)}</ul></>}
      <Button icon="check" disabled={blocked} onClick={apply}>Confirmer l’opération Git…</Button><Button icon="close" disabled={busy} onClick={() => setPlan(undefined)}>Abandonner l’aperçu</Button>
    </div>}
    <p role="status" className="git-notice">{notice}</p>
  </div>;
}
