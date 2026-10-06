import { useEffect, useRef, useState } from 'react';
import { Button } from './Icon.tsx';
import { canRevealNotification, filterNotifications, LEVEL_LABELS, SOURCE_LABELS, type NotificationFilter, type WorkbenchNotification } from './notifications.ts';
export function NotificationCenter({ items, sessionId, onRead, onRemove, onClear, onReveal, onClose }: {
  items: readonly WorkbenchNotification[]; sessionId: string | undefined;
  onRead(id?: string): void; onRemove(id: string): void; onClear(): void;
  onReveal(item: WorkbenchNotification): void; onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<NotificationFilter>({ query: '', level: 'all', source: 'all', unread: false });
  useEffect(() => { dialog.current?.showModal(); }, []);
  const shown = filterNotifications(items, filter), unread = items.filter(item => !item.read).length;
  return <dialog ref={dialog} className="command-dialog notification-center" aria-label="Centre de notifications" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <h2>Centre de notifications <span>{unread} non lue(s)</span></h2>
    <p className="muted">Les 100 messages les plus récents de cette session. Les détails restent dans leurs panneaux.</p>
    <div className="notification-filters">
      <label>Rechercher<input autoFocus aria-label="Rechercher une notification" value={filter.query} onChange={event => setFilter(previous => ({ ...previous, query: event.target.value }))} /></label>
      <label>Niveau<select aria-label="Niveau des notifications" value={filter.level} onChange={event => setFilter(previous => ({ ...previous, level: event.target.value as NotificationFilter['level'] }))}><option value="all">Tous les niveaux</option>{Object.entries(LEVEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Origine<select aria-label="Origine des notifications" value={filter.source} onChange={event => setFilter(previous => ({ ...previous, source: event.target.value as NotificationFilter['source'] }))}><option value="all">Toutes les origines</option>{Object.entries(SOURCE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="notification-check"><input type="checkbox" checked={filter.unread} onChange={event => setFilter(previous => ({ ...previous, unread: event.target.checked }))} />Non lues seulement</label>
    </div>
    <div className="notification-actions"><Button icon="check" disabled={!unread} onClick={() => onRead()}>Tout marquer comme lu</Button><Button icon="trash" disabled={!items.length} onClick={onClear}>Effacer l’historique de session</Button></div>
    {shown.length ? <ol className="notification-list" aria-label="Notifications de session">{shown.map(item => <li key={item.id} data-level={item.level} data-read={item.read}>
      <div className="notification-meta"><strong>{LEVEL_LABELS[item.level]} · {SOURCE_LABELS[item.source]}</strong><time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleTimeString('fr-FR')}</time>{item.count > 1 && <span>×{item.count}</span>}{!item.read && <span>Non lue</span>}</div>
      <p>{item.message}</p>
      <div className="notification-actions">{item.target && <Button icon="eye" disabled={!canRevealNotification(item, sessionId)} onClick={() => { onRead(item.id); dialog.current?.close(); onReveal(item); }}>Voir les détails</Button>}{!item.read && <Button icon="check" onClick={() => onRead(item.id)}>Marquer comme lu</Button>}<Button icon="trash" onClick={() => onRemove(item.id)}>Retirer ce message</Button></div>
      {item.sessionId !== undefined && item.sessionId !== sessionId && <p className="muted">Le projet associé n’est plus ouvert. Rouvrez-le pour consulter son panneau.</p>}
    </li>)}</ol> : <p role="status">{items.length ? 'Aucune notification ne correspond aux filtres.' : 'Aucune notification dans cette session.'}</p>}
    <div className="settings-actions"><Button icon="close" onClick={() => dialog.current?.close()}>Fermer</Button></div>
  </dialog>;
}
