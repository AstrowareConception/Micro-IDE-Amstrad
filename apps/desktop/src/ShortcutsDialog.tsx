import { useEffect, useRef } from 'react';
import { Button, Icon, iconForLabel } from './Icon.tsx';
import type { WorkbenchCommand } from './CommandPalette.tsx';

export function ShortcutsDialog({ commands, onClose }: { commands: WorkbenchCommand[]; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="command-dialog shortcuts-dialog" aria-label="Raccourcis clavier et souris" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <h2>Raccourcis clavier et souris</h2>
    <p className="muted">Ctrl correspond à Cmd sur macOS pour les actions de l’atelier. Les raccourcis d’édition agissent dans le code.</p>
    <table><caption>Commandes de l’atelier et du code</caption><tbody>{commands.filter(command => command.detail).map(command => <tr key={command.id}><td><Icon name={iconForLabel(command.label)} /> {command.label}</td><td><kbd>{command.detail}</kbd></td></tr>)}</tbody></table>
    <table><caption>Souris dans l’éditeur</caption><tbody>{[
      ['Double clic', 'Sélectionner un mot'], ['Triple clic', 'Sélectionner la ligne'], ['Alt + clic', 'Ajouter un curseur'],
      ['Maj + clic', 'Étendre la sélection'], ['Ctrl + molette', 'Zoomer le code'],
      ['Ctrl + clic sur une cible BASIC', 'Aller à la définition'], ['Clic droit', 'Actions du code ou de la source'],
      ['Clic molette sur un onglet', 'Fermer la vue ; buffer conservé dans l’explorateur'],
    ].map(([keys, label]) => <tr key={keys}><td>{label}</td><td><kbd>{keys}</kbd></td></tr>)}</tbody></table>
    <Button autoFocus icon="close" onClick={() => dialog.current?.close()}>Fermer</Button>
  </dialog>;
}
