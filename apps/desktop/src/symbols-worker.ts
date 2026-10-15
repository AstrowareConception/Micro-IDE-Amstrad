import { navigateSymbol, type SymbolNavigationQuery } from '../../../packages/basic-language/src/symbol-navigation.ts';
import { analyzeSymbols, type SymbolSource } from '../../../packages/basic-language/src/symbols.ts';
self.onmessage = (event: MessageEvent<{ id: number; sources: SymbolSource[]; query?:SymbolNavigationQuery }>) => {
 try {
  const report=analyzeSymbols(event.data.sources), query=event.data.query;
  const source=query?report.sources.find(s=>s.id===query.sourceId):undefined;
  self.postMessage({id:event.data.id,report,navigation:query&&source?navigateSymbol(source,query):undefined});
 }
 catch(error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Index indisponible.' }); }
};
