import { useEffect, useRef, useState } from 'react';
import type { RecentProject } from '../../../packages/workspace/src/recent-projects.ts';
import { files } from './port.ts';
import { Button, Icon } from './Icon.tsx';

export function RecentProjectsDialog({ busy, onOpen, onChoose, onClose }: {
  busy: boolean; onOpen(id: string): Promise<boolean | string>; onChoose(): void; onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<RecentProject[]>([]), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    dialog.current?.showModal(); let disposed = false;
    void files.recentProjects?.list().then(result => {
      if (disposed) return;
      if (Array.isArray(result)) setEntries(result); else if (result) setNotice(result.error);
    }).catch(() => { if (!disposed) setNotice('Lecture des projets récents impossible.'); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);
  async function update(action: () => ReturnType<NonNullable<typeof files.recentProjects>['list']>) {
    if (busy || loading) return; setLoading(true); setNotice('');
    try { const result = await action(); if (Array.isArray(result)) setEntries(result); else setNotice(result.error); }
    catch { setNotice('Mise à jour des projets récents impossible ; fichiers conservés.'); }
    finally { setLoading(false); }
  }
  async function open(id: string) {
    if (busy || loading) return; setLoading(true); setNotice('');
    try {
      const opened = await onOpen(id);
      if (opened === true) dialog.current?.close();
      else {
        setNotice(typeof opened === 'string' ? opened : 'Ouverture annulée.');
        if (files.recentProjects) { const result = await files.recentProjects.list(); if (Array.isArray(result)) setEntries(result); }
      }
    }
    catch { setNotice('Ouverture impossible ; le projet courant est conservé.'); }
    finally { setLoading(false); }
  }
  const filtered = entries.filter(entry => `${entry.name} ${entry.path}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  return <dialog ref={dialog} className="command-dialog recent-projects-dialog" aria-label="Projets récents" onClose={onClose}
    onCancel={event => { if (busy) event.preventDefault(); }} onClick={event => { if (event.target === dialog.current && !busy) dialog.current.close(); }}>
    <h2><Icon name="history" /> Projets récents</h2>
    <p className="muted">Les 20 derniers projets ouverts ou créés sur cet ordinateur. Retirer une entrée ne supprime aucun fichier.</p>
    <label>Filtrer les projets<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom ou dossier" /></label>
    {loading && <p role="status">Chargement…</p>}{notice && <p role="alert">{notice}</p>}
    {!loading && !entries.length && !notice && <p>Aucun projet récent. Ouvrez ou créez un projet pour le retrouver ici.</p>}
    {!!entries.length && !filtered.length && <p>Aucun projet ne correspond au filtre.</p>}
    <ul className="recent-projects-list">{filtered.map(entry => <li key={entry.id}>
      <Button icon="folder" disabled={busy || loading} aria-label={`Ouvrir le projet ${entry.name} · ${entry.path}`} onClick={() => void open(entry.id)}>
        <span><strong>{entry.name}</strong><small>{entry.path}</small><small>Dernière ouverture : <time dateTime={entry.lastOpenedAt}>{new Date(entry.lastOpenedAt).toLocaleString('fr-FR')}</time>{!entry.available && ' · Dossier ou manifeste indisponible'}</small></span>
      </Button><Button icon="close" disabled={busy || loading} aria-label={`Retirer ${entry.name} des projets récents`} onClick={() => void update(() => files.recentProjects!.remove(entry.id))} />
    </li>)}</ul>
    <div className="recent-projects-actions"><Button disabled={busy || loading} icon="folder" onClick={() => { dialog.current?.close(); onChoose(); }}>Ouvrir un autre projet…</Button><Button disabled={busy || loading || !entries.length} icon="trash" onClick={() => void update(() => files.recentProjects!.clear())}>Effacer la liste</Button><Button disabled={busy} icon="close" onClick={() => dialog.current?.close()}>Fermer</Button></div>
  </dialog>;
}
