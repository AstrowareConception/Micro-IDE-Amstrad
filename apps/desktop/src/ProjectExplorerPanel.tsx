import { useEffect, useRef, useState } from 'react';
import type { ProjectManifest } from '../../../packages/workspace/src/project.ts';
import type { ExplorerEntry, ExplorerListing, ExplorerPreview } from '../../../packages/workspace/src/explorer.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';

interface Props {
  sessionId: string; manifest: ProjectManifest; busy: boolean; activeSourceId: string; dirtyIds: string[];
  onSource(id: string): void; onSourceActions(id: string): void; onDocument(id: string): void;
}
export function ProjectExplorerPanel(props: Props) {
  const [listings, setListings] = useState<Record<string, ExplorerListing>>({});
  const [expanded, setExpanded] = useState(new Set(['']));
  const [pending, setPending] = useState(new Set<string>());
  const [showHidden, setShowHidden] = useState(false), [filter, setFilter] = useState(''), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<ExplorerPreview>();
  const [previewBusy, setPreviewBusy] = useState(false);
  const generation = useRef(0), mounted = useRef(true), dialog = useRef<HTMLDialogElement>(null);
  const requests = useRef(new Set<string>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const port = files.explorer;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  async function load(directory: string, epoch = generation.current) {
    if (!port || props.busy || requests.current.has(directory)) return;
    if (!Object.hasOwn(listings, directory) && Object.keys(listings).length >= 32) { setNotice('32 dossiers chargés au maximum ; actualisez pour explorer une autre branche.'); return; }
    requests.current.add(directory); setPending(previous => new Set(previous).add(directory));
    try {
      const result = await port.list(props.sessionId, directory, showHidden);
      if (!mounted.current || epoch !== generation.current) return;
      if ('error' in result) setNotice(result.error);
      else setListings(previous => ({ ...previous, [directory]: result }));
    } catch { if (mounted.current && epoch === generation.current) setNotice('Lecture du dossier impossible.'); }
    finally { if (mounted.current && epoch === generation.current) { requests.current.delete(directory); setPending(previous => { const next = new Set(previous); next.delete(directory); return next; }); } }
  }
  function refresh() { const epoch = ++generation.current; requests.current.clear(); setListings({}); setPending(new Set()); setExpanded(new Set([''])); setNotice(''); setPreview(undefined); void load('', epoch); }
  useEffect(() => { refresh(); }, [showHidden, props.manifest]);
  // A project mounted during a foreground operation becomes readable when it ends.
  useEffect(() => { if (!props.busy && !listings[''] && !pending.has('')) void load(''); }, [props.busy]);
  useEffect(() => {
    if (!preview || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    return () => { requestAnimationFrame(() => returnFocus.current?.focus()); };
  }, [preview]);
  async function openEntry(entry: ExplorerEntry) {
    if (props.busy || previewBusy) return;
    if (entry.kind === 'directory') {
      const next = new Set(expanded); if (next.has(entry.path)) next.delete(entry.path); else { next.add(entry.path); if (!Object.hasOwn(listings, entry.path) && !pending.has(entry.path)) void load(entry.path); } setExpanded(next); return;
    }
    if (entry.kind !== 'file') { setNotice('Lien symbolique ou fichier spécial : contenu non parcouru.'); return; }
    if (entry.sourceId) { props.onSource(entry.sourceId); return; }
    if (entry.documentId) { props.onDocument(entry.documentId); return; }
    if (!port) return;
    const epoch = generation.current; returnFocus.current = document.activeElement as HTMLElement | null; setPreviewBusy(true);
    try {
      const result = await port.preview(props.sessionId, entry.path, entry.revision);
      if (!mounted.current || epoch !== generation.current) return;
      if ('error' in result) setNotice(result.error); else setPreview(result);
    } catch { if (mounted.current && epoch === generation.current) setNotice('Aperçu impossible.'); }
    finally { if (mounted.current) setPreviewBusy(false); }
  }
  function rows(directory: string, depth = 0): React.ReactNode {
    const listing = Object.hasOwn(listings, directory) ? listings[directory] : undefined;
    if (!listing) return <li className="muted">{pending.has(directory) ? 'Chargement…' : <Button disabled={props.busy} onClick={() => void load(directory)}>Réessayer ce dossier</Button>}</li>;
    const query = filter.trim().toLocaleLowerCase('fr');
    const entries = listing.entries.filter(entry => entry.kind === 'directory' || !query || `${entry.path} ${props.manifest.documents.find(item => item.id === entry.documentId)?.originalName ?? ''}`.toLocaleLowerCase('fr').includes(query));
    return <>{entries.map(entry => <li key={entry.path}>
      <div className="explorer-row">
        <Button className={entry.sourceId === props.activeSourceId ? 'selected' : ''} icon={entry.kind === 'directory' ? 'folder' : entry.role === 'document' ? 'book' : entry.kind === 'link' || entry.kind === 'other' ? 'warning' : 'file'}
          disabled={props.busy || previewBusy || pending.size > 0 || entry.kind === 'directory' && depth >= 16}
          aria-expanded={entry.kind === 'directory' ? expanded.has(entry.path) : undefined} aria-current={entry.sourceId === props.activeSourceId ? 'page' : undefined}
          aria-label={entry.kind === 'directory' ? `Dossier ${entry.path}` : entry.sourceId ? `${entry.path}${props.dirtyIds.includes(entry.sourceId) ? ' • modifié' : ''}` : undefined}
          title={entry.path} onClick={() => void openEntry(entry)} onContextMenu={event => { if (entry.sourceId) { event.preventDefault(); props.onSourceActions(entry.sourceId); } }}>
          <span className="explorer-name">{entry.kind === 'directory' ? (expanded.has(entry.path) ? '▾ ' : '▸ ') : ''}{props.manifest.documents.find(item => item.id === entry.documentId)?.originalName ?? entry.name}</span>
          <span className="explorer-role">{entry.kind === 'link' ? 'lien' : entry.role === 'source' ? (props.dirtyIds.includes(entry.sourceId!) ? 'BASIC • modifié' : 'BASIC') : entry.role === 'document' ? 'document' : entry.role === 'manifest' ? 'projet' : entry.kind === 'file' ? 'fichier' : ''}</span>
        </Button>
        {entry.sourceId && <Button aria-label={`Actions de ${entry.path}`} icon="menu" disabled={props.busy} onClick={() => props.onSourceActions(entry.sourceId!)} />}
      </div>
      {entry.kind === 'directory' && expanded.has(entry.path) && <ul aria-label={entry.path}>{rows(entry.path, depth + 1)}</ul>}
    </li>)}
    {!entries.length && <li className="muted">{query ? 'Aucun fichier correspondant dans ce dossier.' : 'Dossier vide.'}</li>}
    {!listing.complete && <li className="muted">Liste partielle : 500 entrées ou 2 000 éléments examinés au maximum.</li>}
    {listing.hiddenCount > 0 && <li className="muted">{listing.hiddenCount} élément(s) privé(s) ou généré(s) masqué(s).</li>}
    </>;
  }
  return <section className="project-explorer" aria-label="Explorateur du projet">
    <label htmlFor="explorer-filter">Filtrer les dossiers chargés</label><input id="explorer-filter" type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Nom ou chemin…" maxLength={200} />
    <div className="explorer-controls"><Button disabled={props.busy || previewBusy || pending.size > 0} onClick={refresh} icon="history">Actualiser les fichiers</Button>
    <label><input type="checkbox" checked={showHidden} disabled={props.busy || previewBusy || pending.size > 0} onChange={event => setShowHidden(event.target.checked)} />Privés et générés</label></div>
    {port ? <ul className="explorer-tree" aria-label="Fichiers et dossiers du projet">{rows('')}</ul> : <nav className="project-files" aria-label="Explorateur de sources">{props.manifest.sources.map(source => <div key={source.id}><Button disabled={props.busy} onClick={() => props.onSource(source.id)}>{source.path}{props.dirtyIds.includes(source.id) ? ' •' : ''}</Button><Button disabled={props.busy} aria-label={`Actions de ${source.path}`} onClick={() => props.onSourceActions(source.id)}>⋯</Button></div>)}</nav>}
    <p className="muted">Dossiers chargés à l’ouverture. Seules les sources marquées BASIC sont sur le DSK. Les autres fichiers s’ouvrent en lecture seule.</p>
    <p role="status">{notice}</p>
    {preview && <dialog ref={dialog} className="explorer-preview-dialog" aria-label={`Aperçu de ${preview.path}`} onCancel={() => setPreview(undefined)} onClose={() => setPreview(undefined)}>
      <h2>{preview.path}</h2><p>{preview.bytes} octets · {preview.notice}</p>
      {preview.text !== undefined && <textarea aria-label="Texte du fichier" readOnly value={preview.text} rows={18} />}
      <Button autoFocus onClick={() => setPreview(undefined)} icon="close">Fermer l’aperçu</Button>
    </dialog>}
  </section>;
}
