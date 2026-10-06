import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnalysisWorker from './analysis-worker.ts?worker';
import { AnalysisCoordinator, type AnalysisResponse, type AnalysisSnapshot } from '../../../packages/basic-language/src/analysis-service.ts';
const empty: AnalysisSnapshot = { entries: [], submitted: 0, accepted: 0, discarded: 0, running: false, suspended: false };
export function useBasicAnalysis(documents: { id: string; source: string }[], activeId: string) {
 const [snapshot, setSnapshot] = useState(empty);
 const coordinator = useRef<AnalysisCoordinator | undefined>(undefined);
 useEffect(() => {
  let worker: Worker;
  const start = () => {
   if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); } worker = new AnalysisWorker();
   worker.onmessage = (event: MessageEvent<{ type: string; result: AnalysisResponse }>) => {
    if (event.data.type === 'result') service.receive(event.data.result); else service.fail('Analyse indisponible. Réessayer dans Problèmes.', true);
   };
   worker.onerror = event => { event.preventDefault(); service.fail('Worker d’analyse indisponible. Réessayer dans Problèmes.', true); };
  };
  const service = new AnalysisCoordinator(request => worker.postMessage(request), setSnapshot, () => { try { start(); } catch { /* Explicit retry only. */ } });
  coordinator.current = service;
  try { start(); } catch { service.fail('Worker d’analyse indisponible. Réessayer dans Problèmes.'); }
  const visibility = () => service.suspend(document.hidden);
  visibility(); document.addEventListener('visibilitychange', visibility);
  return () => { service.dispose(); worker?.terminate(); coordinator.current = undefined; document.removeEventListener('visibilitychange', visibility); };
 }, []);
 useEffect(() => { coordinator.current?.update(documents, activeId); }, [documents, activeId]);
 // Immediately hide old diagnostics during a new render, before its scheduling effect.
 const entries = useMemo(() => snapshot.entries.filter(entry => documents.some(doc => doc.id === entry.id && doc.source === entry.source)), [snapshot.entries, documents]);
 const retry = useCallback(() => coordinator.current?.retry(), []);
 return { ...snapshot, entries, retry };
}
