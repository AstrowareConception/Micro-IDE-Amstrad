import { useEffect, useState } from 'react';
import type { AnalysisSnapshot } from '../../../packages/basic-language/src/analysis-service.ts';
import { Button } from './Icon.tsx';
interface Metrics { seconds: number; longTasks: number; blockingMs: number; lagMs: number }
const empty: Metrics = { seconds: 0, longTasks: 0, blockingMs: 0, lagMs: 0 };
export function PerformancePanel({ visible, snapshot, documents }: { visible: boolean; snapshot: AnalysisSnapshot; documents: { id: string; name: string }[] }) {
 const [metrics, setMetrics] = useState(empty), [epoch, setEpoch] = useState(0), [monitoring, setMonitoring] = useState(false);
 const [longTasksSupported, setLongTasksSupported] = useState(false);
 useEffect(() => {
  let stop = () => undefined;
  const activate = () => {
   stop(); setMonitoring(false);
   if (!visible || document.hidden) return;
   setMonitoring(true);
   let longTasks = 0, blockingMs = 0, lagMs = 0, last = performance.now(); const start = last;
   const supported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask'); setLongTasksSupported(supported);
   const observer = supported ? new PerformanceObserver(list => { for (const item of list.getEntries()) { longTasks++; blockingMs += item.duration; } }) : undefined;
   observer?.observe({ entryTypes: ['longtask'] });
   const timer = setInterval(() => {
    const now = performance.now(); lagMs = Math.max(lagMs, now - last - 1000); last = now;
    setMetrics({ seconds: Math.floor((now - start) / 1000), longTasks, blockingMs, lagMs });
   }, 1000);
   stop = () => { clearInterval(timer); observer?.disconnect(); };
  };
  setMetrics(empty); activate(); document.addEventListener('visibilitychange', activate);
  return () => { stop(); document.removeEventListener('visibilitychange', activate); };
 }, [visible, epoch]);
 return <section className="performance-panel" aria-label="Performance de l’atelier" data-monitoring={monitoring ? 'active' : 'off'}>
  <h2>Performance</h2><p>Mesures locales de session. Le suivi de réactivité fonctionne uniquement lorsque ce panneau et la fenêtre sont visibles. Aucun envoi ni stockage.</p>
  <p>Analyse BASIC : worker unique, pause de frappe de 200 ms, cache lexical borné, aucun sondage au repos.</p>
  <dl><dt>Analyses envoyées / acceptées / périmées</dt><dd data-testid="analysis-counts">{snapshot.submitted} / {snapshot.accepted} / {snapshot.discarded}</dd>
   <dt>État</dt><dd>{snapshot.suspended ? 'Fenêtre masquée : planification suspendue' : snapshot.running ? 'Analyse en cours' : documents.some(doc => !snapshot.entries.find(entry => entry.id === doc.id)?.result && !snapshot.entries.find(entry => entry.id === doc.id)?.error) ? 'Analyse planifiée après la pause' : 'Au repos'}</dd>
   <dt>Observation de l’interface</dt><dd>{monitoring ? `${metrics.seconds} s · retard maximal du minuteur ${Math.max(0, metrics.lagMs).toFixed(1)} ms` : 'Arrêtée'}</dd>
   <dt>Tâches de plus de 50 ms</dt><dd>{longTasksSupported ? `${metrics.longTasks} · durée totale ${metrics.blockingMs.toFixed(1)} ms` : 'API indisponible sur ce moteur'}</dd></dl>
  <Button onClick={() => setEpoch(value => value + 1)}>Recommencer la mesure</Button>
  <p className="muted">Ces valeurs ne mesurent ni le pourcentage CPU du processus, ni sa mémoire totale. Une tâche longue peut provenir d’un autre panneau. Les durées ci-dessous excluent attente et transport du worker.</p>
  <div className="performance-table"><table><thead><tr><th>Source</th><th>Révision</th><th>Analyse</th><th>Cache réutilisé / nouveau</th><th>Couverture</th></tr></thead><tbody>{documents.map(doc => {
   const entry = snapshot.entries.find(item => item.id === doc.id), result = entry?.result;
   return <tr key={doc.id}><th>{doc.name}</th><td>{entry?.revision ?? '—'}</td><td>{result ? `${result.durationMs.toFixed(1)} ms · ${entry!.source.length} caractères UTF-16` : entry?.error ? 'Échec' : 'En attente'}</td><td>{result ? `${result.cacheHits} / ${result.cacheMisses}` : '—'}</td><td>{result ? `${result.analysis.coverage.lines} lignes · ${result.analysis.coverage.opaque} zones partielles${result.analysis.coverage.limited ? ' · limite atteinte' : ''}` : '—'}</td></tr>;
  })}</tbody></table></div>
  <p className="muted">Bornes : 1 Mio de caractères / 10 000 lignes par source ; 500 diagnostics, 100 zones détaillées, 4 096 variables / 10 000 références ; cache lexical partagé de 50 000 tokens / 2 Mio de caractères. Délai maximal d’un travail : 5 s.</p>
 </section>;
}
