import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Button, Icon } from './Icon.tsx';
import { fitPanel, type PanelLayout, type PanelRect } from './panel-layout.ts';

export function DockPanel({ as: Tag = 'div', className, label, name, hidden, layout, onLayout, onHide, children, tabs }: {
  as?: 'aside' | 'div'; className: string; label: string; name: string; hidden: boolean;
  layout: PanelLayout; onLayout(value: PanelLayout): void; onHide(): void; children: ReactNode; tabs?: ReactNode;
}) {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [raised, setRaised] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number; rect: PanelRect; resize: boolean } | undefined>(undefined);
  useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const rect = fitPanel(layout.rect, viewport);
  const shownRect = layout.maximized ? { x: 8, y: 8, width: viewport.width - 16, height: viewport.height - 16 } : rect;
  function start(event: PointerEvent<HTMLElement>, resize: boolean) {
    if (event.button !== 0 || !layout.floating || layout.maximized) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, rect, resize };
  }
  const gestures = {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const initial = drag.current; if (!initial || initial.pointer !== event.pointerId) return;
      const dx = event.clientX - initial.x, dy = event.clientY - initial.y;
      onLayout({ ...layout, rect: fitPanel(initial.resize ? { ...initial.rect, width: initial.rect.width + dx, height: initial.rect.height + dy } : { ...initial.rect, x: initial.rect.x + dx, y: initial.rect.y + dy }, viewport) });
    },
    onPointerUp() { drag.current = undefined; },
    onPointerCancel() { if (drag.current) onLayout({ ...layout, rect: drag.current.rect }); drag.current = undefined; },
    onLostPointerCapture() { drag.current = undefined; },
  };
  function keyboard(event: React.KeyboardEvent<HTMLElement>, resize: boolean) {
    if (event.key === 'Escape' && drag.current) { onLayout({ ...layout, rect: drag.current.rect }); event.currentTarget.releasePointerCapture(drag.current.pointer); drag.current = undefined; event.preventDefault(); return; }
    if (!layout.floating || layout.maximized || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 40 : 10;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    onLayout({ ...layout, rect: fitPanel(resize ? { ...rect, width: rect.width + dx, height: rect.height + dy } : { ...rect, x: rect.x + dx, y: rect.y + dy }, viewport) });
  }
  return <Tag className={`dock-panel ${className} ${layout.floating ? 'floating-panel' : ''} ${layout.maximized ? 'maximized-panel' : ''}`} aria-label={label} hidden={hidden} tabIndex={-1}
    data-floating={layout.floating} style={layout.floating ? { left: shownRect.x, top: shownRect.y, width: shownRect.width, height: shownRect.height, zIndex: raised ? 91 : 90 } as CSSProperties : undefined}
    onFocusCapture={() => setRaised(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRaised(false); }}
    onPointerDownCapture={event => { if (layout.floating && !event.currentTarget.contains(document.activeElement)) event.currentTarget.focus(); setRaised(true); }}>
    <div className="dock-heading">
      <Button className="panel-grip" icon="grip" aria-label={`Déplacer ${name}`} disabled={!layout.floating || layout.maximized}
        title="Glisser pour déplacer · flèches au clavier" onPointerDown={event => start(event, false)} {...gestures} onKeyDown={event => keyboard(event, false)} />
      {tabs ?? <strong className="dock-title">{label}</strong>}
      <div className="dock-actions">
        <Button icon={layout.floating ? 'dock' : 'undock'} aria-label={`${layout.floating ? 'Réancrer' : 'Détacher'} ${name}`} title={layout.floating ? 'Réancrer à sa place' : 'Détacher dans l’IDE'} onClick={() => onLayout({ ...layout, floating: !layout.floating, maximized: false, rect })} />
        <Button icon={layout.maximized ? 'restore' : 'maximize'} aria-label={`${layout.maximized ? 'Restaurer' : 'Agrandir'} ${name}`} title={layout.maximized ? 'Restaurer la taille' : 'Agrandir dans l’IDE'} onClick={() => onLayout({ ...layout, floating: true, maximized: !layout.maximized, rect })} />
        <Button icon="close" aria-label={`Masquer ${name}`} onClick={onHide} />
      </div>
    </div>
    <div className="dock-body">{children}</div>
    <button className="panel-resize" aria-label={`Redimensionner ${name}`} title="Glisser pour redimensionner · flèches au clavier" hidden={!layout.floating || layout.maximized}
      onPointerDown={event => start(event, true)} {...gestures} onKeyDown={event => keyboard(event, true)}><Icon name="resize" /></button>
  </Tag>;
}
