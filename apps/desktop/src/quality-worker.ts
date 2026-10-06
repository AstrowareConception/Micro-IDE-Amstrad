import { analyzeQuality, type QualitySource } from '../../../packages/basic-language/src/quality.ts';
self.onmessage = (event: MessageEvent<{ id: number; sources: QualitySource[] }>) => {
 try { self.postMessage({ id: event.data.id, report: analyzeQuality(event.data.sources) }); }
 catch (error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Analyse de qualité impossible.' }); }
};
