import { Button } from './Icon.tsx';
import { useState } from 'react';
import { planRenumber } from '../../../packages/basic-language/src/renumber.ts';
import type { RenumberPlan } from '../../../packages/basic-language/src/renumber.ts';

export interface RenumberRequest { plan: RenumberPlan; documentId: string; version: number }
interface Props {
  source: string; documentId: string; busy: boolean;
  revision(): number; onApply(request: RenumberRequest): void; onClose(): void;
}
export function RenumberPanel(props: Props) {
  const [start, setStart] = useState('10'), [step, setStep] = useState('10');
  const [from, setFrom] = useState('1'), [to, setTo] = useState('65535');
  const [request, setRequest] = useState<RenumberRequest>(), [message, setMessage] = useState('');
  function preview() {
    try {
      const plan = planRenumber(props.source, { start: Number(start), step: Number(step), from: Number(from), to: Number(to) });
      setRequest({ plan, documentId: props.documentId, version: props.revision() });
      setMessage(`${plan.mapping.length} lignes sélectionnées ; ${plan.edits.length} substitutions.`);
    } catch (error) { setRequest(undefined); setMessage(error instanceof Error ? error.message : 'Renumérotation impossible.'); }
  }
  const field = (label: string, value: string, update: (value: string) => void) => <label>{label}<input type="number" min="1" max="65535" step="1" value={value} disabled={props.busy} onChange={event => { update(event.target.value); setRequest(undefined); }} /></label>;
  return <section className="panel renumber-panel" aria-label="Renumérotation BASIC">
    <h2>Renuméroter le listing actif</h2>
    <p className="muted">Cibles littérales locales seulement. Les chaînes, commentaires et DATA sont conservés. Les formes opaques ou calculées bloquent le refactoring. Vérifiez l’aperçu avant application.</p>
    {field('Premier nouveau numéro', start, setStart)}{field('Pas de numérotation', step, setStep)}
    {field('Ancienne première ligne', from, setFrom)}{field('Ancienne dernière ligne', to, setTo)}
    <Button disabled={props.busy} onClick={preview}>Prévisualiser la renumérotation</Button>
    <p className="renumber-notice" aria-live="polite">{message}</p>
    {request && <><ul>{request.plan.warnings.map(text => <li key={text}>{text}</li>)}</ul>
      <table><caption>Substitutions : {request.plan.edits.length} au total</caption><thead><tr><th>Ligne physique</th><th>Type</th><th>Avant</th><th>Après</th></tr></thead><tbody>
        {request.plan.edits.slice(0, 100).map(edit => <tr key={`${edit.line}:${edit.start}`}><td>{edit.line}</td><td>{edit.kind === 'definition' ? 'Numéro' : 'Cible'}</td><td>{edit.before}</td><td>{edit.after}</td></tr>)}
      </tbody></table>
      {request.plan.edits.length > 100 && <p>Les 100 premières substitutions sont affichées. L’aperçu complet suit.</p>}
      <label>Aperçu du listing renuméroté<textarea readOnly value={request.plan.after} rows={8} /></label>
      <Button disabled={props.busy || !request.plan.edits.length} onClick={() => {
        try { props.onApply(request); setRequest(undefined); setMessage('Renumérotation appliquée au buffer. Ctrl Z pour annuler.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Application impossible.'); }
      }}>Appliquer la renumérotation</Button>
    </>}
    <Button onClick={props.onClose}>Fermer la renumérotation</Button>
  </section>;
}
