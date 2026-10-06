import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QualityWorker from './quality-worker.ts?worker';
import { Button } from './Icon.tsx';
import { QUALITY_LIMITS, qualityMarkdown, type QualitySource, type QualityReport, type QualityFinding } from '../../../packages/basic-language/src/quality.ts';
interface Props {
 documents: QualitySource[]; activeId: string; scopeId: string;
 onReveal(id: string, finding: QualityFinding): void;
}
interface Snapshot { report: QualityReport; documents: QualitySource[]; createdAt: string; scopeId: string }
export const QualityPanel = memo(function QualityPanel({ documents, activeId, scopeId, onReveal }: Props) {
 const [scope, setScope] = useState('active'), [snapshot, setSnapshot] = useState<Snapshot>(), [running, setRunning] = useState(false), [error, setError] = useState(''), [query, setQuery] = useState('');
 const job = useRef<{ worker: Worker; timeout: ReturnType<typeof setTimeout>; id: number } | undefined>(undefined), sequence = useRef(0);
 const stop = useCallback(() => { const current = job.current; job.current = undefined; if (current) { clearTimeout(current.timeout); current.worker.onmessage = null; current.worker.onerror = null; current.worker.terminate(); } }, []);
 useEffect(() => { stop(); setRunning(false); setSnapshot(undefined); setError(''); return stop; }, [scopeId, stop]);
 function run() {
  stop(); setSnapshot(undefined); setError('');
  const sources = documents.filter(doc => scope === 'loaded' || doc.id === activeId).map(doc => ({ id: doc.id, name: doc.name, source: doc.source }));
  if (!sources.length) { setRunning(false); setError('Aucune source à analyser.'); return; }
  if (sources.length > QUALITY_LIMITS.sources || sources.reduce((n, doc) => n + doc.source.length, 0) > QUALITY_LIMITS.totalCharacters) { setRunning(false); setError('Rapport limité à 100 sources et 4 Mio de caractères au total. Choisissez la source active.'); return; }
  const id = ++sequence.current, createdAt = new Date().toISOString(); setRunning(true);
  const fail = (message: string) => { if (job.current?.id !== id) return; stop(); setRunning(false); setError(message); };
  try {
   const worker = new QualityWorker();
   const timeout = setTimeout(() => fail('Analyse interrompue après 15 secondes. Réessayez sur la source active.'), 15_000);
   job.current = { worker, timeout, id };
   worker.onmessage = (event: MessageEvent<{ id: number; report?: QualityReport; error?: string }>) => {
    if (job.current?.id !== id || event.data.id !== id) return;
    if (event.data.error || !event.data.report) { fail(event.data.error || 'Rapport indisponible. Réessayez.'); return; }
    stop(); setRunning(false); setSnapshot({ report: event.data.report, documents: sources, createdAt, scopeId });
   };
   worker.onerror = event => { event.preventDefault(); fail('Analyse de qualité indisponible. Réessayez.'); };
   worker.postMessage({ id, sources });
  } catch { stop(); setRunning(false); setError('Impossible de démarrer l’analyse de qualité. Réessayez.'); }
 }
 const current = useMemo(() => new Map(documents.map(doc => [doc.id, doc])), [documents]);
 const stale = !!snapshot && (snapshot.scopeId !== scopeId || snapshot.documents.some(doc => current.get(doc.id)?.source !== doc.source || current.get(doc.id)?.name !== doc.name));
 const visible = useMemo(() => {
  const needle = query.toLocaleLowerCase();
  return snapshot?.report.sources.flatMap(source => source.findings.map(finding => ({ source, finding }))).filter(({ source, finding }) => `${source.name} ${finding.code} ${finding.message} ${finding.suggestion}`.toLocaleLowerCase().includes(needle)) ?? [];
 }, [snapshot, query]);
 function reveal(id: string, finding: QualityFinding) {
  const before = snapshot?.documents.find(doc => doc.id === id), now = current.get(id);
  if (!before || !now || snapshot?.scopeId !== scopeId || before.source !== now.source || before.name !== now.name) { setError('Cette source a changé ; recalculez le rapport pour naviguer.'); return; }
  onReveal(id, finding);
 }
 function download(format: 'json' | 'md') {
  if (!snapshot) return;
  const contents = format === 'json' ? JSON.stringify({ createdAt: snapshot.createdAt, stale, report: snapshot.report }, null, 2) : `Généré le ${snapshot.createdAt}. État lors de l’export : ${stale ? 'obsolète, sources modifiées' : 'sources inchangées'}.\n\n${qualityMarkdown(snapshot.report)}`;
  const url = URL.createObjectURL(new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `cpceleste-qualite.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 return <section className="quality-panel" aria-label="Qualité du code BASIC" aria-busy={running}>
  <h2>Qualité du code BASIC</h2><p className="muted">Rapport local à la demande sur les buffers, brouillons compris. Les repères de lisibilité sont des pistes de revue adaptées au CPC. Aucune analyse supplémentaire pendant la frappe.</p>
  <div className="quality-actions"><label>Périmètre du rapport<select aria-label="Périmètre du rapport" value={scope} disabled={running} onChange={event => setScope(event.target.value)}><option value="active">Source active</option><option value="loaded">Sources chargées ({documents.length})</option></select></label>
   <Button disabled={running} onClick={run}>Générer le rapport</Button>{running && <Button onClick={() => { stop(); setRunning(false); setError('Analyse annulée.'); }}>Annuler l’analyse</Button>}
   <Button disabled={!snapshot} onClick={() => download('md')}>Exporter Markdown</Button><Button disabled={!snapshot} onClick={() => download('json')}>Exporter JSON</Button></div>
  {running && <p role="status">Analyse de qualité en cours…</p>}{error && <p role="alert">{error}</p>}
  {!snapshot && !running && !error && <p>Choisissez le périmètre puis générez un rapport.</p>}
  {snapshot && <><p className={stale ? 'warning' : 'muted'} role="status">{stale ? 'Rapport obsolète : des sources ont changé. Recalculez pour naviguer.' : 'Rapport sur les sources inchangées.'} · {snapshot.createdAt}</p>
   <details><summary>Méthode, repères et limites</summary><p>{snapshot.report.method}</p><p>Ligne longue : &gt; {snapshot.report.thresholds.lineLength} caractères. Ligne dense : &gt; {snapshot.report.thresholds.statementsPerLine} segments. Conditions : &gt; {snapshot.report.thresholds.ifsPerLine} IF par ligne. Duplication : deux lignes consécutives, au moins {snapshot.report.thresholds.duplicateTokens} tokens ; commentaires et numéros de ligne ignorés, chaînes préservées.</p></details>
   <div className="quality-metrics"><table><caption>Métriques par listing · aucun total de complexité entre programmes</caption><thead><tr><th>Source</th><th>Lignes physiques / code</th><th>Segments</th><th>Longueur max. / moy.</th><th>Complexité estimée</th><th>GOTO / GOSUB</th></tr></thead><tbody>{snapshot.report.sources.map(source => { const m = source.metrics; return <tr key={source.id}><th scope="row">{source.name}{source.coverage.limited && ' · partiel'}</th>{m ? <><td>{m.physicalLines} / {m.codeLines}<small>{m.commentLines} commentaires seuls · {m.blankLines} vides</small></td><td>{m.statements}</td><td>{m.maxLineLength} / {m.averageCodeLineLength}</td><td>{m.estimatedCyclomatic}<small>IF {m.ifs} · FOR {m.fors} · WHILE {m.whiles} · ON {m.selectorBranches}</small></td><td>{m.gotos} / {m.gosubs}</td></> : <td colSpan={5}>Non analysée</td>}</tr>; })}</tbody></table></div>
   {snapshot.report.sources.filter(s => s.coverage.limited || s.coverage.reasons.length).map(source => <p className="warning" key={source.id}>{source.name} · {source.coverage.skippedLines} ligne(s) ignorée(s), {source.coverage.omittedFindings} remarque(s)/occurrence(s) omise(s). {source.coverage.reasons.join(' ')}</p>)}
   <label>Filtrer les remarques<input aria-label="Filtrer les remarques" value={query} onChange={event => setQuery(event.target.value)} /></label><p>{visible.length} remarque(s) dans ce filtre.</p>
   <ul className="quality-findings">{visible.slice(0, 200).map(({ source, finding: f }, i) => <li key={`${source.id}-${f.code}-${f.line}-${i}`}><Button disabled={stale} onClick={() => reveal(source.id, f)}><span>{source.name} · L{f.line} · BASIC {f.basicLine} · {f.message}<small>C{f.start + 1}–{f.end + 1} · {f.code} · {f.confidence === 'observation' ? 'Observation' : 'Piste de revue'}</small></span></Button><p>{f.suggestion}</p>{f.related.map(r => <Button key={`${r.line}-${r.start}`} disabled={stale} onClick={() => reveal(source.id, { ...f, ...r })}>Autre occurrence · L{r.line} · BASIC {r.basicLine}</Button>)}</li>)}</ul>
   {visible.length > 200 && <p>Affichage limité aux 200 premières remarques filtrées. Les exports contiennent toutes les remarques conservées.</p>}
   {!snapshot.report.sources.some(s => s.findings.length) && <p>Aucune remarque produite par ces règles ; cela ne garantit pas la qualité du programme.</p>}
  </>}
 </section>;
});
