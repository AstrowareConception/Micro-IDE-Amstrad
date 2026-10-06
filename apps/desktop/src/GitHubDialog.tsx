import { useEffect, useRef, useState } from 'react';
import type { GitHubAccount, GitHubRepository } from '../../../packages/version-control/src/operations.ts';
import { files } from './port.ts';
import { Button, Icon } from './Icon.tsx';
export function GitHubDialog({ busy, onClone, onRemote, onClose }: { busy: boolean; onClone(url: string, name: string): Promise<boolean | string>; onRemote?: (url: string, remote: string) => Promise<boolean | string>; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [working, setWorking] = useState(false), [notice, setNotice] = useState(''), [token, setToken] = useState('');
  const [account, setAccount] = useState<GitHubAccount>(), [repositories, setRepositories] = useState<GitHubRepository[]>([]), [nextPage, setNextPage] = useState<number | null>(null), [query, setQuery] = useState('');
  const [url, setUrl] = useState(''), [folder, setFolder] = useState(''), [name, setName] = useState(''), [isPrivate, setPrivate] = useState(true);
  const [remote, setRemote] = useState('origin');
  const [cloning, setCloning] = useState(false);
  useEffect(() => { dialog.current?.showModal(); let disposed = false;
    void files.github?.account().then(result => { if (disposed) return; if ('error' in result) setNotice(result.error); else setAccount(result); }).catch(() => { if (!disposed) setNotice('Compte GitHub indisponible.'); });
    return () => { disposed = true; };
  }, []);
  const blocked = busy || working;
  async function action(work: () => Promise<void>) {
    if (blocked) return; setWorking(true); setNotice('');
    try { await work(); } catch (error) { setNotice(error instanceof Error ? error.message : 'GitHub non confirmé ; vérifiez le résultat avant de recommencer.'); }
    finally { setWorking(false); }
  }
  function connect(cli: boolean) {
    void action(async () => { const secret = token; setToken(''); const result = cli ? await files.github!.connectCLI() : await files.github!.connect(secret);
      if ('error' in result) throw new Error(result.error); setAccount(result); setRepositories([]); setNextPage(null); setNotice('Compte connecté. Chargez les dépôts accessibles, y compris les dépôts privés autorisés.'); });
  }
  function list(more = false) {
    void action(async () => { const result = await files.github!.repositories(more ? nextPage ?? 1 : 1);
      if ('error' in result) throw new Error(result.error); setRepositories(previous => more ? [...previous, ...result.repositories.filter(entry => !previous.some(old => old.fullName === entry.fullName))] : result.repositories); setNextPage(result.nextPage); });
  }
  function select(repository: GitHubRepository) { setUrl(repository.url); setFolder(repository.fullName.split('/')[1]!); setNotice('URL sélectionnée. Vous pouvez la cloner ou la copier dans les remotes du panneau Git.'); }
  return <dialog ref={dialog} className="command-dialog github-dialog" aria-label="GitHub et clone" onClose={onClose} onCancel={event => { if (blocked) event.preventDefault(); }}
    onClick={event => { if (event.target === dialog.current && !blocked) dialog.current.close(); }}>
    <h2><Icon name="github" /> GitHub et clone</h2>
    <p>Compte : {account?.connected ? account.login : 'non connecté'}. Les jetons restent en mémoire dans CPCéleste jusqu’à déconnexion ou fermeture.</p>
    <details open={!account?.connected}><summary>Connexion au compte GitHub</summary>
      <label>Jeton personnel GitHub<input autoComplete="off" type="password" aria-label="Jeton GitHub" disabled={blocked} value={token} onChange={event => setToken(event.target.value)} /></label>
      <div className="git-actions"><Button icon="key" disabled={blocked || !token || !files.github} onClick={() => connect(false)}>Connecter le compte</Button>
        <Button icon="github" disabled={blocked || !files.github} onClick={() => connect(true)}>Utiliser le compte GitHub CLI</Button>
        <Button icon="plus" disabled={blocked || !files.github} onClick={() => void action(async () => { const result = await files.github!.tokenPage(); if ('error' in result) throw new Error(result.error); })}>Créer un jeton sur GitHub</Button></div>
      <p className="muted">Autorisez uniquement vos dépôts utiles : Contents lecture/écriture pour synchroniser, Pull requests écriture pour créer une PR. La création d’un dépôt requiert Repository creation. Une organisation peut demander une approbation. Avec GitHub CLI, connectez-vous une fois avec <code>gh auth login --web</code>.</p>
    </details>
    {account?.connected && <><div className="git-actions"><Button icon="download" disabled={blocked} onClick={() => list()}>Charger mes dépôts GitHub</Button>
      <Button icon="close" disabled={blocked} onClick={() => void action(async () => { const result = await files.github!.disconnect(); if ('error' in result) throw new Error(result.error); setAccount(result); setRepositories([]); setNextPage(null); setNotice('Connexion oubliée dans CPCéleste. Le compte GitHub CLI reste indépendant.'); })}>Déconnecter GitHub</Button></div>
      <label>Filtrer les dépôts<input type="search" aria-label="Filtrer les dépôts GitHub" disabled={blocked} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <ul className="github-repositories">{repositories.filter(entry => entry.fullName.toLowerCase().includes(query.toLowerCase())).map(entry => <li key={entry.fullName}>
        <Button icon="folder" disabled={blocked} onClick={() => select(entry)}>{entry.fullName} · {entry.private ? 'privé' : 'public'}</Button>
      </li>)}</ul>{nextPage && <Button icon="download" disabled={blocked} onClick={() => list(true)}>Dépôts suivants</Button>}
      <details><summary>Créer un dépôt GitHub</summary><label>Nom du dépôt<input aria-label="Nom du dépôt GitHub" disabled={blocked} maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
        <label><input type="checkbox" checked={isPrivate} disabled={blocked} onChange={event => setPrivate(event.target.checked)} />Dépôt privé</label>
        <Button icon="plus" disabled={blocked || !name} onClick={() => void action(async () => { const result = await files.github!.createRepository(name, isPrivate); if (!result) { setNotice('Création annulée.'); return; } if ('error' in result) throw new Error(result.error); select(result); setRepositories(previous => [result, ...previous]); setNotice('Dépôt créé sans fichiers publiés. Ajoutez son URL comme remote, puis utilisez Push dans le panneau Git.'); })}>Créer le dépôt distant…</Button>
      </details></>}
    <hr /><h3>Cloner et ouvrir un projet</h3><p className="muted">GitHub public/privé ou remote HTTPS/SSH. Choisissez un nouveau sous-dossier ; aucun dossier existant n’est écrasé. Le dépôt doit contenir un manifeste CPCéleste valide.</p>
    <label>URL du dépôt<input aria-label="URL du dépôt à cloner" disabled={blocked} value={url} onChange={event => setUrl(event.target.value)} /></label>
    {onRemote && <><label>Remote du projet courant<input aria-label="Remote à associer GitHub" disabled={blocked} value={remote} onChange={event => setRemote(event.target.value)} /></label>
      <Button icon="git" disabled={blocked || !url || !remote} onClick={() => void action(async () => {
        const result = await onRemote(url, remote); setNotice(result === true ? 'Remote associé. Utilisez Fetch ou Push dans le panneau Git.' : typeof result === 'string' ? result : 'Association annulée.');
      })}>Associer au projet courant…</Button></>}
    <label>Nom du nouveau dossier<input aria-label="Dossier du clone Git" disabled={blocked} value={folder} onChange={event => setFolder(event.target.value)} /></label>
    <div className="git-actions"><Button icon="download" disabled={blocked || !url || !folder || !files.gitOperations} onClick={() => void action(async () => { setCloning(true); try { const result = await onClone(url, folder); if (result === true) dialog.current?.close(); else setNotice(typeof result === 'string' ? result : 'Clone annulé ; projet courant conservé.'); } finally { setCloning(false); } })}>Cloner le projet…</Button>
      {cloning && <Button icon="stop" onClick={() => void files.gitOperations!.cancel().then(result => setNotice('error' in result ? result.error : result.stopped ? 'Arrêt demandé ; dossier partiel conservé pour inspection.' : 'Aucun transfert Git actif.'))}>Arrêter le clone</Button>}
      <Button icon="close" disabled={blocked} onClick={() => dialog.current?.close()}>Fermer</Button></div>
    {notice && <p role="status">{notice}</p>}
  </dialog>;
}
