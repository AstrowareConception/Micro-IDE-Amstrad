import { Button } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';
export interface WorkbenchCommand { id: string; label: string; detail?: string; disabled?: boolean; run(): void }
interface Props { commands: WorkbenchCommand[]; title: string; searchable?: boolean; onClose(): void }
export function CommandPalette({ commands, title, searchable = true, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const filtered = commands.filter(command => command.label.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  useEffect(() => { dialog.current?.showModal(); }, []);
  function execute(command: WorkbenchCommand) {
    if (command.disabled) return;
    dialog.current?.close(); command.run();
  }
  return <dialog ref={dialog} className="command-dialog" aria-label={title} onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}
    onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('.command-results button:not(:disabled)') ?? []);
        if (!buttons.length) return;
        event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
    <h2>{title}</h2>
    {searchable && <input aria-label="Rechercher une action ou une source" autoFocus placeholder="Action, fichier…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
      if (event.key === 'Enter') { const first = filtered.find(command => !command.disabled); if (first) execute(first); }
    }} />}
    <div className="command-results">{filtered.map(command => <Button key={command.id} disabled={command.disabled} onClick={() => execute(command)}><strong>{command.label}</strong>{command.detail && <small>{command.detail}</small>}</Button>)}</div>
    {!filtered.length && <p>Aucune commande correspondante.</p>}
    <Button onClick={() => dialog.current?.close()}>Fermer</Button><p className="muted">Flèches, Entrée, Tab · Échap pour fermer</p>
  </dialog>;
}
