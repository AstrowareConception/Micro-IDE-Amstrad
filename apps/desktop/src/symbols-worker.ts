import { analyzeSymbols, type SymbolSource } from '../../../packages/basic-language/src/symbols.ts';
self.onmessage = (event: MessageEvent<{ id: number; sources: SymbolSource[] }>) => {
 try { self.postMessage({ id: event.data.id, report: analyzeSymbols(event.data.sources) }); }
 catch(error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Index indisponible.' }); }
};
