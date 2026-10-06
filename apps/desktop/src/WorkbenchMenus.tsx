import { useEffect, useRef, useState } from 'react';
import type { WorkbenchCommand } from './CommandPalette.tsx';
import { Button, Icon, iconForLabel } from './Icon.tsx';
export interface MenuGroup { label: string; commands: WorkbenchCommand[] }
export function WorkbenchMenus({ groups }: { groups: MenuGroup[] }) {
 const [open, setOpen] = useState<number>();
 const root = useRef<HTMLElement>(null);
 const triggers = useRef(new Map<number, HTMLButtonElement>());
 function close(focus = false) { if (focus && open !== undefined) triggers.current.get(open)?.focus(); setOpen(undefined); }
 function focusItem(last = false) { requestAnimationFrame(() => { const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[role="menu"] button:not(:disabled)'); if (buttons?.length) buttons[last ? buttons.length - 1 : 0]?.focus(); }); }
 useEffect(() => {
  if (open === undefined) return;
  const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(undefined); };
  const blur = () => setOpen(undefined);
  const focus = (event: FocusEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(undefined); };
  const shortcut = (event: KeyboardEvent) => { if (event.ctrlKey || event.metaKey || ['F1', 'F5'].includes(event.key)) setOpen(undefined); };
  window.addEventListener('pointerdown', outside); window.addEventListener('blur', blur); window.addEventListener('focusin', focus); window.addEventListener('keydown', shortcut, true);
  return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur); window.removeEventListener('focusin', focus); window.removeEventListener('keydown', shortcut, true); };
 }, [open]);
 return <nav ref={root} className="menubar" aria-label="Menus de l’atelier" onKeyDown={event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  if (event.key === 'Tab') close();
  if (open !== undefined && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
   event.preventDefault(); const next = (open + (event.key === 'ArrowRight' ? 1 : -1) + groups.length) % groups.length; setOpen(next); triggers.current.get(next)?.focus(); focusItem();
  }
 }}>
 {groups.map((group, index) => <div className="workbench-menu" key={group.label}>
  <button ref={node => { if (node) triggers.current.set(index, node); else triggers.current.delete(index); }} aria-haspopup="menu" aria-expanded={open === index} aria-controls={`menu-${index}`} onClick={() => setOpen(open === index ? undefined : index)} onPointerEnter={() => { if (open !== undefined) setOpen(index); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(index); focusItem(event.key === 'ArrowUp'); } }}>{group.label}</button>
  {open === index && <div id={`menu-${index}`} role="menu" aria-label={group.label} onKeyDown={event => {
   const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
   if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && buttons.length) {
    event.preventDefault(); const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus();
   }
  }}>
   {group.commands.map(command => <button role="menuitem" key={command.id} disabled={command.disabled} title={command.detail} onClick={() => { setOpen(undefined); command.run(); }}><Icon name={iconForLabel(command.label)} /><span>{command.label}</span>{command.detail && <kbd>{command.detail}</kbd>}</button>)}
  </div>}
 </div>)}
 <Button icon="menu" onClick={() => { close(); groups.flatMap(group => group.commands).find(command => command.id === 'palette')?.run(); }}>Commandes <kbd>Ctrl Maj P</kbd></Button>
 </nav>;
}
