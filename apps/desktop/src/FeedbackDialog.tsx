import { useEffect, useRef, useState } from 'react';
import { feedbackReport, type FeedbackInput } from '../feedback.ts';
import { Button } from './Icon.tsx';
import { files } from './port.ts';

export function FeedbackDialog({ onClose }: { onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState<FeedbackInput>({ kind: 'feature', title: '', usage: '', need: '', expected: '' });
  const [message, setMessage] = useState(''), [opening, setOpening] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const field = (key: 'usage' | 'need' | 'expected', label: string, max: number) => <label>{label}<textarea required={key === 'need'} rows={3} maxLength={max} value={input[key]} onChange={event => setInput(previous => ({ ...previous, [key]: event.target.value }))} /></label>;
  return <dialog ref={dialog} className="command-dialog feedback-dialog" aria-label="Faire évoluer CPCéleste" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <h2>Faire évoluer CPCéleste</h2>
    <p>Racontez votre usage et ce qui vous manque. Le ticket s’ouvre dans votre navigateur ; vous le relisez et l’envoyez sur GitHub avec votre compte.</p>
    <form onSubmit={event => { event.preventDefault(); if (opening || !files.feedback) return; setOpening(true); void files.feedback.open(input).then(result => setMessage('error' in result ? result.error : result.prefilled ? 'Ticket prérempli ouvert. Envoyez-le sur GitHub après relecture.' : 'Ticket ouvert. Copiez la description ci-dessous et collez-la dans GitHub.')).catch(() => setMessage('Ouverture impossible. Copiez votre description et ouvrez les tickets du projet.')).finally(() => setOpening(false)); }}>
      <fieldset disabled={opening}>
        <label>Type de retour<select aria-label="Type de retour" value={input.kind} onChange={event => setInput(previous => ({ ...previous, kind: event.target.value as FeedbackInput['kind'] }))}><option value="feature">Demande d’amélioration</option><option value="bug">Signaler un problème</option></select></label>
        <label>Titre de la demande<input autoFocus required maxLength={100} value={input.title} onChange={event => setInput(previous => ({ ...previous, title: event.target.value }))} /></label>
        {field('usage', 'Mon utilisation de l’IDE', 1000)}{field('need', input.kind === 'feature' ? 'Besoin et difficulté actuelle' : 'Problème et étapes de reproduction', 1500)}{field('expected', 'Résultat souhaité', 1500)}
      </fieldset>
      <p className="muted">Les tickets sont publics. Relisez votre texte et les captures que vous joindrez.</p>
      <div className="settings-actions"><Button type="button" icon="file" disabled={!input.title.trim() || !input.need.trim()} onClick={() => { try { const report = feedbackReport(input); void navigator.clipboard.writeText(report.body).then(() => setMessage('Description copiée.')).catch(() => setMessage('Copie indisponible ; sélectionnez le texte dans l’aperçu.')); } catch (error) { setMessage(error instanceof Error ? error.message : 'Description invalide.'); } }}>Copier la description</Button><Button type="button" icon="close" onClick={() => dialog.current?.close()}>Fermer</Button><Button type="submit" icon="plus" className="primary" disabled={opening || !files.feedback || !input.title.trim() || !input.need.trim()}>Ouvrir le ticket GitHub</Button></div>
    </form>
    <p aria-live="polite">{message}</p>
    {!!input.title.trim() && !!input.need.trim() && <details><summary>Aperçu de la description</summary><textarea aria-label="Description du ticket" readOnly rows={8} value={feedbackReport(input).body} /></details>}
  </dialog>;
}
