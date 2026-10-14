import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiskImportPreview, DiskImportRequest, DiskFileKind } from '../../../packages/cpc-disk/src/import-disk.ts';
import { importCapacity } from '../../../packages/cpc-disk/src/import-disk.ts';
import { FileRecoveryView } from './FileRecoveryView.tsx';
import { Button } from './Icon.tsx';

const LABELS: Record<DiskFileKind, string> = { 'basic-ascii': 'BASIC ASCII éditable', 'basic-tokenized': 'BASIC tokenisé',
  'basic-protected': 'BASIC protégé', binary: 'Binaire présumé', unknown: 'Contenu non reconnu' };
export function DiskImportDialog({ preview, onCreate, onClose }: {
  preview: DiskImportPreview; onCreate(request: DiskImportRequest): Promise<true | string | false>; onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const eligible = preview.files.filter(file => file.source !== undefined);
  const [selected, setSelected] = useState(eligible.map(file => file.id));
  const [binary, setBinary] = useState(!eligible.length);
  const [entry, setEntry] = useState(eligible[0]?.id ?? preview.files.find(file => file.kind === 'binary' && file.entryAddress !== undefined && file.loadAddress !== undefined && file.entryAddress >= file.loadAddress && file.entryAddress < file.loadAddress + (file.payloadBytes ?? 0))?.id ?? preview.files[0]?.id ?? '');
  const [name, setName] = useState(preview.name.replace(/\.dsk$/i, '').slice(0, 100));
  const [active, setActive] = useState(eligible[0]?.id ?? preview.files[0]?.id ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    setSelected(next); if (!next.includes(entry)) setEntry(next[0] ?? '');
  }
  const capacity = useMemo(() => importCapacity(preview.files, binary ? [] : selected), [preview.files, binary, selected]);
  const current = preview.files.find(file => file.id === active);
  return <dialog ref={dialog} className="command-dialog disk-import-dialog" aria-label="Importer une disquette DSK" onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
    <h2>Retrouver les programmes d’une disquette</h2>
    <p><strong>{preview.name}</strong> · {preview.profile} · {preview.files.length} fichier(s)</p>
    <p className="muted">Les BASIC ASCII, tokenisés et protégés reconnus deviennent éditables. Les autres fichiers sont conservés et inclus dans la nouvelle disquette comme ressources.</p>
    {!!preview.warnings?.length && <section role="note" aria-label="Particularités de la disquette">
      <h3>Récupération des fichiers possible, copie du disque différente</h3>
      <ul>{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      <p>Le DSK original reste conservé intégralement dans le projet. Consultez aussi import-report.json après l’import.</p>
    </section>}
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || !binary && !selected.length || !name.trim()) return;
      setBusy(true); setError('');
      try { const result = await onCreate({ id: preview.id, name: name.trim(), sourceIds: binary ? [] : selected, entryId: entry, ...(binary ? { kind: 'binary' as const } : {}) });
        if (result === true) onClose(); else setError(typeof result === 'string' ? result : 'Création annulée ; votre projet courant est conservé.');
      } catch (error) { setError(String(error)); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}><legend>Fichiers de la disquette</legend>
        <label><input type="checkbox" aria-label="Projet binaire" checked={binary} onChange={event => { setBinary(event.target.checked); setEntry(event.target.checked ? preview.files[0]?.id ?? '' : selected[0] ?? ''); }} />Créer un projet binaire pour l’atelier Z80 (tous les fichiers conservés)</label>
        <div className="disk-import-catalog"><table><thead><tr><th>Importer</th><th>Nom CPC</th><th>Octets alloués aux enregistrements</th><th>Contenu</th></tr></thead>
          <tbody>{preview.files.map(file => <tr key={file.id}>
            <td><input type="checkbox" aria-label={`Importer ${file.name}`} checked={selected.includes(file.id)} disabled={binary || file.source === undefined} onChange={() => toggle(file.id)} /></td>
            <td><button type="button" aria-label={`Examiner ${file.name}`} onClick={() => setActive(file.id)}>{file.name}</button></td>
            <td>{file.recordBytes}</td><td>{LABELS[file.kind]}</td>
          </tr>)}</tbody></table></div>
        {!eligible.length && <p role="status">Aucun listing BASIC convertible. Le projet binaire permet de conserver et d’étudier les fichiers dans l’atelier Z80.</p>}
        {current && <section aria-label={`Aperçu de ${current.name}`}><p>{current.reason}</p>{current.source && <pre className="disk-source-preview">{current.source}</pre>}<FileRecoveryView key={current.id} previewId={preview.id} file={current}/></section>}
        <label>Nom du projet importé<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Programme à lancer<select aria-label="Programme à lancer" value={entry} onChange={event => setEntry(event.target.value)}>{(binary ? preview.files : eligible.filter(file => selected.includes(file.id))).map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label>
      </fieldset>
      <p>Le dossier choisi recevra un nouveau sous-dossier de projet. La disquette et tous ses fichiers bruts seront conservés. Les listings sélectionnés seront reconstruits ; les autres fichiers seront inclus sans modification. Les chargeurs dépendant des secteurs du disque original peuvent ne pas fonctionner.</p>
      {!capacity.fits && <p role="status">L’import et l’édition restent possibles, mais la reconstruction ASCII dépasse la capacité DATA : {capacity.blocks}/{capacity.maxBlocks} blocs, {capacity.entries}/{capacity.maxEntries} entrées de catalogue. Sélectionnez moins de BASIC à convertir pour garder les autres en ressources originales, ou répartissez ensuite le projet. F5 et l’export resteront bloqués tant que la copie ne tient pas sur disque.</p>}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !binary && !selected.length || !name.trim() || !(binary ? preview.files.some(file => file.id === entry) : selected.includes(entry))}>{busy ? 'Import en cours…' : 'Choisir le dossier parent et importer'}</Button>
      <Button type="button" disabled={busy} onClick={onClose}>Fermer</Button>
    </form>
  </dialog>;
}
