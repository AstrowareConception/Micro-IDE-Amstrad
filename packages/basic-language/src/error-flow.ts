import type { FlowReport } from './control-flow.ts';

export const ERROR_FLOW_LIMITS = Object.freeze({ states: 8192, totalStates: 65536, steps: 131072, links: 4096 });
export interface ErrorContext { node: number; handler: number | null; fault: number | null }
export type ErrorTransferKind = 'raise' | 'retry' | 'next' | 'line' | 'unhandled' | 'nested' | 'rethrow';
export interface ErrorTransfer extends ErrorContext { to: number | null; kind: ErrorTransferKind }
export interface ErrorFlowReport {
 version: 1; scope: 'explicit-error'; status: 'not-needed' | 'covered' | 'unsupported' | 'limited';
 reason: string | null; states: number; contexts: ErrorContext[]; transfers: ErrorTransfer[];
}
export const ERROR_FLOW_STATUS_LABELS: Record<ErrorFlowReport['status'], string> = { 'not-needed': 'Sans objet', covered: 'Calculés', unsupported: 'Hors périmètre', limited: 'Budget atteint' };
export const ERROR_TRANSFER_LABELS: Record<ErrorTransferKind, string> = { raise: 'Vers le gestionnaire', retry: 'Réessayer ERROR', next: 'Instruction après ERROR', line: 'Reprise à une ligne', unhandled: 'Erreur sans gestionnaire', nested: 'Erreur pendant le traitement', rethrow: 'Erreur relancée par désactivation' };
export const ERROR_FLOW_METHOD = 'Modèle limité aux ERROR explicites hors des branches IF avec code décimal littéral de 1 à 255, depuis le début avec piège désactivé. Les erreurs implicites et les valeurs des conditions ne sont pas simulées. Les contextes décrivent l’état avant chaque instruction et restent séparés par gestionnaire et ERROR interrompu. Appels/RETURN, FOR/NEXT, événements asynchrones, formes opaques ou construction tronquée suspendent ce calcul. Il ne lève pas les limites globales de complexité, de retour et d’inaccessibilité.';
export const emptyErrorFlow = (): ErrorFlowReport => ({ version: 1, scope: 'explicit-error', status: 'not-needed', reason: null, states: 0, contexts: [], transfers: [] });

/** Finite product graph; neither source evaluation nor interpreter stack emulation. */
export function analyzeErrorFlow(graph: FlowReport, continuations: Map<number, number | null>, literalErrors: Set<number>, structureComplete: boolean, stateBudget: number = ERROR_FLOW_LIMITS.states): ErrorFlowReport {
 const result = emptyErrorFlow();
 const relevant = new Set(graph.nodes.filter(n => ['ON ERROR', 'ERROR', 'RESUME', 'RESUME NEXT'].includes(n.operation)).map(n => n.id));
 if (!relevant.size) return result;
 const unsupported = (reason: string) => { result.status = 'unsupported'; result.reason = reason; return result; };
 if (!structureComplete) return unsupported('Construction incertaine ou tronquée : aucun contexte d’erreur calculé.');
 if (graph.handlers.some(h => h.event !== 'error') || graph.edges.some(e => e.kind === 'call') || graph.nodes.some(n => ['RETURN', 'FOR', 'NEXT'].includes(n.operation))) return unsupported('Appels/RETURN, FOR/NEXT ou événements asynchrones : contextes d’erreur non couverts.');
 if (graph.nodes.some(n => n.operation === 'ERROR' && !literalErrors.has(n.id))) return unsupported('ERROR doit être hors branche IF avec un code décimal littéral de 1 à 255.');
 const budget = Math.max(0, Math.min(ERROR_FLOW_LIMITS.states, Math.floor(stateBudget) || 0));
 const outgoing = new Map<number, typeof graph.edges>();
 for (const edge of graph.edges) { const list = outgoing.get(edge.from) ?? []; list.push(edge); outgoing.set(edge.from, list); }
 const handlers = new Map(graph.handlers.map(h => [h.site, h]));
 const seen = new Set<string>(), transferKeys = new Set<string>(), queue: ErrorContext[] = [];
 let steps = 0, limited = false;
 const limit = (reason: string) => { limited = true; result.status = 'limited'; result.reason = reason; result.contexts = []; result.transfers = []; };
 function enqueue(node: number | null, handler: number | null, fault: number | null) {
  if (node === null || limited) return;
  const key = `${node}/${handler}/${fault}`; if (seen.has(key)) return;
  if (seen.size >= budget) { limit(`Budget de ${budget} états d’erreur atteint : résultats contextuels retirés.`); return; }
  seen.add(key); queue.push({ node, handler, fault }); result.states = seen.size;
 }
 function transfer(context: ErrorContext, to: number | null, kind: ErrorTransferKind) {
  const key = `${context.node}/${context.handler}/${context.fault}/${to}/${kind}`;
  if (transferKeys.has(key)) return;
  if (result.transfers.length >= ERROR_FLOW_LIMITS.links) { limit('Budget de 4096 transferts d’erreur atteint : résultats contextuels retirés.'); return; }
  transferKeys.add(key); result.transfers.push({ ...context, to, kind });
 }
 result.status = 'covered'; enqueue(graph.entry, null, null);
 for (let cursor = 0; cursor < queue.length && !limited; cursor++) {
  const context = queue[cursor]!, { node, handler, fault } = context;
  if (relevant.has(node)) result.contexts.push(context);
  const operation = graph.nodes[node]!.operation, links = outgoing.get(node) ?? [], declaration = handlers.get(node);
  if (declaration) {
   if (declaration.action === 'disable' && fault !== null) { transfer(context, null, 'rethrow'); continue; }
   for (const link of links) if (link.kind === 'next') enqueue(link.to, declaration.target, fault);
  } else if (operation === 'ERROR') {
   if (fault !== null) transfer(context, null, 'nested');
   else if (handler === null) transfer(context, null, 'unhandled');
   else { transfer(context, handler, 'raise'); enqueue(handler, handler, node); }
  } else if (operation === 'RESUME' || operation === 'RESUME NEXT') {
   if (fault === null) { result.contexts = []; result.transfers = []; return unsupported('RESUME accessible sans ERROR explicite actif : erreur implicite hors modèle.'); }
   const explicit = links.find(link => link.kind === 'recovery' && link.to !== null);
   const to = explicit ? explicit.to : operation === 'RESUME NEXT' ? continuations.get(fault) ?? null : fault;
   transfer(context, to, explicit ? 'line' : operation === 'RESUME NEXT' ? 'next' : 'retry');
   enqueue(to, handler, null);
  } else {
   for (const link of links) {
    if (++steps > ERROR_FLOW_LIMITS.steps) { limit('Budget de 131072 transitions atteint : résultats contextuels retirés.'); break; }
    if (link.kind !== 'handler' && link.kind !== 'unknown') enqueue(link.to, handler, fault);
   }
  }
 }
 return result;
}
