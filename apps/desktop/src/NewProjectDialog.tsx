import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';

export function NewProjectDialog({ busy, onCreate, onClose }: { busy: boolean; onCreate(name: string): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('Mon projet CPC');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="command-dialog" aria-label="Nouveau projet BASIC" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (name.trim() && !busy) { dialog.current?.close(); onCreate(name.trim()); } }}>
      <h2>Nouveau projet BASIC</h2>
      <label>Nom du nouveau projet<input autoFocus required maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <p className="muted">Choisissez ensuite un dossier vide pour enregistrer le projet.</p>
      <Button type="submit" icon="folder" disabled={busy || !name.trim()}>Choisir le dossier et créer</Button>
      <Button type="button" icon="close" onClick={() => dialog.current?.close()}>Annuler</Button>
    </form>
  </dialog>;
}
