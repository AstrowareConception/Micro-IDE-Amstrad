import { memo, useMemo, useState } from 'react';
import { Button } from './Icon.tsx';
import type { Diagnostic } from '../../../packages/basic-language/src/language.ts';
import type { AnalysisEntry } from '../../../packages/basic-language/src/analysis-service.ts';
interface Props {
 documents: { id: string; name: string; source: string }[]; entries: AnalysisEntry[];
 onReveal(id: string, diagnostic: Diagnostic): void; onRetry(): void;
}
export const ProblemsPanel = memo(function ProblemsPanel({ documents, entries, onReveal, onRetry }: Props) {
 const [query, setQuery] = useState(''), [severity, setSeverity] = useState('all'), [file, setFile] = useState('all');
 const [coverageOpen, setCoverageOpen] = useState(false);
 const diagnostics = useMemo(() => documents.flatMap(doc => {
  const entry = entries.find(item => item.id === doc.id);
  const targets = new Map(entry?.result?.analysis.targets.map(target => [target.line, target.number]));
  return (entry?.result?.analysis.diagnostics ?? []).map(diagnostic => ({ doc, diagnostic, basicLine: targets.get(diagnostic.line) }));
 }), [documents, entries]);
 const visible = useMemo(() => {
  const needle = query.toLocaleLowerCase();
  return diagnostics.filter(({ doc, diagnostic }) => (file === 'all' || doc.id === file) && (severity === 'all' || diagnostic.severity === severity) && `${doc.name} ${diagnostic.code} ${diagnostic.message}`.toLocaleLowerCase().includes(needle));
 }, [diagnostics, query, severity, file]);
 const pending = documents.filter(doc => !entries.find(entry => entry.id === doc.id)?.result && !entries.find(entry => entry.id === doc.id)?.error);
 const failures = entries.filter(entry => entry.error);
 return <section className="problems" aria-label="Diagnostics BASIC"><h2>Diagnostics <span>{diagnostics.length}</span></h2>
  <p className="muted">Analyse syntaxique partielle par source. Aucun diagnostic ne garantit l’exécution sur CPC. Export ASCII et syntaxe ont des codes distincts.</p>
  <div className="diagnostic-filters"><label>Rechercher un diagnostic<input aria-label="Rechercher un diagnostic" value={query} onChange={event => setQuery(event.target.value)} /></label>
   <label>Gravité<select aria-label="Gravité" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">Toutes</option><option value="error">Erreurs</option><option value="warning">Avertissements</option></select></label>
   <label>Source<select aria-label="Source" value={file} onChange={event => setFile(event.target.value)}><option value="all">Toutes les sources</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select></label>
  </div>
  {!!pending.length && <p role="status">Analyse en attente · {pending.length} source(s). Les anciens diagnostics sont retirés pendant la saisie.</p>}
  {!!failures.length && <p role="alert">{failures[0]!.error} <Button onClick={onRetry}>Réessayer l’analyse</Button></p>}
  {entries.some(entry => entry.result?.analysis.coverage.limited) && <p className="warning">Analyse limitée : nombre de diagnostics, de lignes, de tokens ou de symboles borné. Consultez Performance.</p>}
  {!!visible.length && <ul>{visible.slice(0, 500).map(({ doc, diagnostic: d, basicLine }, i) => <li key={`${doc.id}-${d.line}-${d.start}-${d.code}-${i}`}><Button onClick={() => onReveal(doc.id, d)}>
   {doc.name} · L{d.line} · {d.severity === 'error' ? 'Erreur' : 'Avertissement'} · {d.message}<small>C{d.start + 1}–{d.end + 1}{basicLine === undefined ? '' : ` · BASIC ${basicLine}`} · {d.code} · {d.code === 'export-ascii' ? 'Export' : 'Inspection statique'}</small>
  </Button></li>)}</ul>}
  {visible.length > 500 && <p>Affichage limité aux 500 premiers résultats filtrés sur {visible.length}. Affinez les filtres.</p>}
  {!pending.length && !failures.length && !diagnostics.length && !entries.some(entry => entry.result?.analysis.coverage.limited) && <p className="success">Aucun problème détecté dans le sous-ensemble analysé.</p>}
  {!!diagnostics.length && !visible.length && <p>Aucun diagnostic ne correspond aux filtres.</p>}
  <details onToggle={event => setCoverageOpen(event.currentTarget.open)}><summary>Zones non couvertes et couverture par source</summary>{coverageOpen && documents.map(doc => {
   const result = entries.find(entry => entry.id === doc.id)?.result?.analysis;
   return <div key={doc.id}><h3>{doc.name}</h3>{result ? <><p>{result.coverage.checked} production(s) inspectée(s) · {result.coverage.opaque} zone(s) partielle(s). Types, arité des fonctions et comportement ROM non certifiés.</p>
    <ul>{result.inspections.map((item, i) => <li key={`${item.line}-${item.start}-${i}`}>L{item.line} · C{item.start + 1} · {item.reason}</li>)}</ul>{result.coverage.opaque > result.inspections.length && <p>Liste bornée aux 100 premières zones.</p>}</> : <p>Résultat indisponible.</p>}</div>;
  })}</details>
 </section>;
});
