import { useState } from 'react';
import { searchSources, previewReplacement, verifySearchSnapshot, type SearchDocument, type SearchSnapshot, type SearchChange, type SearchMatch } from '../../../packages/workspace/src/search.ts';

interface Props {
  documents: SearchDocument[]; busy: boolean;
  onNavigate(match: SearchMatch): void; onApply(changes: SearchChange[]): void; onClose(): void;
}
export function SearchPanel({ documents, busy, onNavigate, onApply, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [snapshot, setSnapshot] = useState<SearchSnapshot>();
  const [plan, setPlan] = useState<SearchChange[]>();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const invalidate = () => { setSnapshot(undefined); setPlan(undefined); setMessage(''); };
  const attempt = (action: () => void) => { try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Opération impossible.'); } };
  const stale = !!snapshot && (snapshot.documents.length !== documents.length || snapshot.documents.some(expected => !documents.some(item => item.id === expected.id && item.name === expected.name && item.source === expected.source)));
  return <section className="panel search-panel" aria-label="Recherche dans les sources">
    <h2>Recherche dans les sources</h2><button onClick={onClose}>Fermer la recherche</button>
    <p className="muted">{documents.length} source(s) chargée(s), brouillons compris. Texte littéral ; casse ASCII. Les modifications restent dans les buffers.</p>
    <label>Texte à rechercher<input autoFocus value={query} maxLength={256} onChange={event => { setQuery(event.target.value); invalidate(); }} /></label>
    <label><input type="checkbox" checked={matchCase} onChange={event => { setMatchCase(event.target.checked); invalidate(); }} />Respecter la casse</label>
    <label><input type="checkbox" checked={wholeWord} onChange={event => { setWholeWord(event.target.checked); invalidate(); }} />Mot entier (suffixes BASIC inclus)</label>
    <button disabled={busy || !query} onClick={() => attempt(() => { const found = searchSources(documents, { query, matchCase, wholeWord }); setSnapshot(found); setPlan(undefined); setMessage(`${found.matches.length} occurrence(s).`); })}>Rechercher toutes les sources</button>
    {snapshot && <ul className="search-results">{snapshot.matches.map(match => <li key={`${match.documentId}:${match.start}`}><button disabled={busy || stale} onClick={() => attempt(() => { verifySearchSnapshot(snapshot, documents); onNavigate(match); })}>{match.name} · L{match.line}:{match.column} · {match.snippet}</button></li>)}</ul>}
    <label>Texte de remplacement<input value={replacement} maxLength={4096} onChange={event => { setReplacement(event.target.value); setPlan(undefined); setMessage(''); }} /></label>
    <button disabled={busy || !snapshot || stale} onClick={() => attempt(() => { if (!snapshot) return; verifySearchSnapshot(snapshot, documents); const changes = previewReplacement(snapshot, replacement); setPlan(changes); setSelected(changes.map(item => item.id)); setMessage(`${changes.length} source(s) à modifier.`); })}>Prévisualiser les remplacements</button>
    {plan?.map(change => <div key={change.id}><label><input type="checkbox" checked={selected.includes(change.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, change.id] : ids.filter(id => id !== change.id))} />Remplacer dans {change.name} ({change.count})</label><details><summary>Aperçu de {change.name}</summary><p>Avant / après (premiers 4 000 caractères)</p><pre>{change.before.slice(0, 4000)}</pre><pre>{change.after.slice(0, 4000)}</pre></details></div>)}
    <button disabled={busy || stale || !plan || !selected.length} onClick={() => attempt(() => { if (!snapshot || !plan || busy) return; verifySearchSnapshot(snapshot, documents); const changes = plan.filter(item => selected.includes(item.id)); onApply(changes); setSnapshot(undefined); setPlan(undefined); setMessage(`${changes.length} source(s) modifiée(s) sans enregistrement. Annulation par source : Ctrl Z.`); })}>Appliquer les remplacements sélectionnés</button>
    {stale && <p role="status">Sources modifiées depuis la recherche : relancez la recherche.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
