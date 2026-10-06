import { useRef } from 'react';
export function ResizeHandle({ label, orientation, value, min, max, reverse = false, hidden = false, className = '', onChange }: {
  label: string; orientation: 'horizontal' | 'vertical'; value: number; min: number; max: number;
  reverse?: boolean; hidden?: boolean; className?: string; onChange(value: number): void;
}) {
  const drag = useRef<{ pointer: number; coordinate: number; value: number } | undefined>(undefined);
  const bound = (number: number) => Math.round(Math.min(Math.max(min, max), Math.max(min, number)));
  return <div className={`resize-separator ${orientation} ${className}`} role="separator" aria-label={label} aria-orientation={orientation}
    aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={Math.max(min, Math.round(max))} tabIndex={0} hidden={hidden}
    title="Glisser pour redimensionner · flèches au clavier · Échap pour annuler"
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, coordinate: orientation === 'vertical' ? event.clientX : event.clientY, value }; }}
    onPointerMove={event => { const start = drag.current; if (!start || start.pointer !== event.pointerId) return; const coordinate = orientation === 'vertical' ? event.clientX : event.clientY; onChange(bound(start.value + (coordinate - start.coordinate) * (reverse ? -1 : 1))); }}
    onPointerUp={() => { drag.current = undefined; }}
    onPointerCancel={() => { if (drag.current) onChange(drag.current.value); drag.current = undefined; }}
    onLostPointerCapture={() => { drag.current = undefined; }}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) { onChange(drag.current.value); event.currentTarget.releasePointerCapture(drag.current.pointer); drag.current = undefined; event.preventDefault(); return; }
      const decrement = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp', increment = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      if (![decrement, increment, 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      onChange(bound(event.key === 'Home' ? min : event.key === 'End' ? max : value + (event.key === increment ? 1 : -1) * (reverse ? -1 : 1) * (event.shiftKey ? 40 : 10)));
    }} />;
}
