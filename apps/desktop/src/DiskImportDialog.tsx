import { useEffect, useRef, useState } from 'react';
import type { DiskImportPreview, DiskImportRequest, DiskFileKind } from '../../../packages/cpc-disk/src/import-disk.ts';
import { Button } from './Icon.tsx';

const LABELS: Record<DiskFileKind, string> = { 'basic-ascii': 'BASIC ASCII éditable', 'basic-tokenized': 'BASIC tokenisé présumé',
  'basic-protected': 'BASIC protégé présumé', binary: 'Binaire présumé', unknown: 'Contenu non reconnu' };
export function DiskImportDialog({ preview, onCreate, onClose }: {
  preview: DiskImportPreview; onCreate(request: DiskImportRequest): Promise<true | string | false>; onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const eligible = preview.files.filter(file => file.kind === 'basic-ascii');
  const [selected, setSelected] = useState(eligible.map(file => file.id));
  const [entry, setEntry] = useState(eligible[0]?.id ?? '');
  const [name, setName] = useState(preview.name.replace(/\.dsk$/i, '').slice(0, 100));
  const [active, setActive] = useState(eligible[0]?.id ?? preview.files[0]?.id ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    setSelected(next); if (!next.includes(entry)) setEntry(next[0] ?? '');
  }
  const current = preview.files.find(file => file.id === active);
  return <dialog ref={dialog} className="command-dialog disk-import-dialog" aria-label="Importer une disquette DSK" onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
    <h2>Retrouver les programmes d’une disquette</h2>
    <p><strong>{preview.name}</strong> · DATA standard · {preview.files.length} fichier(s)</p>
    <p className="muted">Première version : listings BASIC ASCII uniquement. Les fichiers tokenisés, protégés et binaires sont conservés, mais leur conversion et leur inclusion dans le build restent à venir.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || !selected.length || !name.trim()) return;
      setBusy(true); setError('');
      try { const result = await onCreate({ id: preview.id, name: name.trim(), sourceIds: selected, entryId: entry });
        if (result === true) onClose(); else setError(typeof result === 'string' ? result : 'Création annulée ; votre projet courant est conservé.');
      } catch (error) { setError(String(error)); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}><legend>Fichiers de la disquette</legend>
        <div className="disk-import-catalog"><table><thead><tr><th>Importer</th><th>Nom CPC</th><th>Octets alloués aux enregistrements</th><th>Contenu</th></tr></thead>
          <tbody>{preview.files.map(file => <tr key={file.id}>
            <td><input type="checkbox" aria-label={`Importer ${file.name}`} checked={selected.includes(file.id)} disabled={file.kind !== 'basic-ascii'} onChange={() => toggle(file.id)} /></td>
            <td><button type="button" aria-label={`Examiner ${file.name}`} onClick={() => setActive(file.id)}>{file.name}</button></td>
            <td>{file.recordBytes}</td><td>{LABELS[file.kind]}</td>
          </tr>)}</tbody></table></div>
        {!eligible.length && <p role="status">Aucun listing ASCII convertible dans cette disquette. Aucun projet vide ne sera créé.</p>}
        {current && <section aria-label={`Aperçu de ${current.name}`}><p>{current.reason}</p>{current.source && <pre className="disk-source-preview">{current.source}</pre>}</section>}
        <label>Nom du projet importé<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Programme à lancer<select aria-label="Programme à lancer" value={entry} onChange={event => setEntry(event.target.value)}>{eligible.filter(file => selected.includes(file.id)).map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label>
      </fieldset>
      <p>Le dossier choisi recevra un nouveau sous-dossier de projet. La disquette et tous ses fichiers bruts seront conservés. Seuls les listings sélectionnés seront reconstruits à l’exécution : un programme dépendant d’autres fichiers peut ne pas fonctionner.</p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !selected.length || !name.trim() || !selected.includes(entry)}>{busy ? 'Import en cours…' : 'Choisir le dossier parent et importer'}</Button>
      <Button type="button" disabled={busy} onClick={onClose}>Fermer</Button>
    </form>
  </dialog>;
}
