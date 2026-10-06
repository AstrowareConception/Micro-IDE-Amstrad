import { createAnalysisEngine, type AnalysisRequest } from '../../../packages/basic-language/src/analysis-service.ts';
const inspect = createAnalysisEngine();
self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
 try { self.postMessage({ type: 'result', result: inspect(event.data) }); }
 catch { self.postMessage({ type: 'error' }); }
};
