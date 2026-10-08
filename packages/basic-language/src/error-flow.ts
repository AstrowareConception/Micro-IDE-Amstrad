import type { FlowReport } from './control-flow.ts';

export const ERROR_FLOW_LIMITS = Object.freeze({ states: 8192, totalStates: 65536, steps: 131072, links: 4096, callDepth: 16, loopDepth: 16 });
export interface ErrorResumption { retry: number; next: number | null }
export interface ErrorSite { node: number; kind: 'explicit' | 'division-zero'; operator?: '/' | '\\' | 'MOD' }
export const ERROR_SITE_LABELS: Record<ErrorSite['kind'], string> = { explicit: 'ERROR explicite', 'division-zero': 'Division par zéro possible' };
export interface ErrorStackFrame { kind: 'call' | 'for' | 'while'; node: number }
export interface ErrorContext { node: number; handler: number | null; fault: number | null; calls: number[]; stack: ErrorStackFrame[] }
export type ErrorTransferKind = 'raise' | 'retry' | 'next' | 'line' | 'unhandled' | 'nested' | 'rethrow' | 'warning' | 'call' | 'return' | 'loop-enter' | 'loop-skip' | 'loop-repeat' | 'loop-leave';
export interface ErrorTransfer extends ErrorContext { to: number | null; kind: ErrorTransferKind }
export interface ErrorFlowReport {
 version: 4; scope: 'explicit-and-simple-division'; status: 'not-needed' | 'covered' | 'unsupported' | 'limited';
 reason: string | null; states: number; sites: ErrorSite[]; contexts: ErrorContext[]; transfers: ErrorTransfer[];
}
export const ERROR_FLOW_STATUS_LABELS: Record<ErrorFlowReport['status'], string> = { 'not-needed': 'Sans objet', covered: 'Calculés', unsupported: 'Hors périmètre', limited: 'Budget atteint' };
export const ERROR_TRANSFER_LABELS: Record<ErrorTransferKind, string> = { 'loop-enter': 'Entrée dans la boucle', 'loop-skip': 'Boucle ignorée', 'loop-repeat': 'Nouvelle itération possible', 'loop-leave': 'Sortie de boucle possible', call: 'Appel GOSUB dans ce contexte', return: 'Retour vers l’appelant', warning: 'Avertissement possible, puis continuation', raise: 'Vers le gestionnaire', retry: 'Reprendre l’instruction mémorisée', next: 'Suite de l’instruction mémorisée', line: 'Reprise à une ligne', unhandled: 'Erreur sans gestionnaire', nested: 'Erreur pendant le traitement', rethrow: 'Erreur relancée par désactivation' };
export const ERROR_FLOW_METHOD = 'Modèle limité aux ERROR explicites (code décimal littéral de 1 à 255) et aux divisions simples dans une affectation scalaire : variable non suffixée $ ou entier décimal signé de valeur absolue ≤ 32767, opérateur /, \\ ou MOD, puis même forme d’opérande. LET est accepté. Le modèle part du début avec piège désactivé. Une division conserve une issue normale et une erreur 11 possible, sans calculer son diviseur, même littéral. Sans gestionnaire, / émet un avertissement et poursuit l’évaluation ; \\ et MOD arrêtent ce chemin. Types et autres erreurs implicites ne sont pas simulés. Expressions composées, fonctions, tableaux et divisions dans les autres commandes ne sont pas couverts. Dans IF, RESUME peut réévaluer le IF mémorisé ; RESUME NEXT cherche sa suite depuis cette instruction, qui peut différer de l’ERROR. Un deux-points exécuté change l’instruction mémorisée. Les valeurs des conditions ne sont pas simulées. Les contextes décrivent l’état avant chaque instruction, avec gestionnaire, instruction fautive et pile mêlant appels et boucles du plus ancien au plus récent. GOSUB et ON GOSUB empilent un retour ; RETURN dépile l’appel et abandonne les boucles ouvertes depuis cet appel, sans effacer l’erreur active. ON ERROR et les trois reprises RESUME conservent la pile courante. NEXT/WEND recherchent leur ouverture structurelle active sans franchir GOSUB ; les boucles plus récentes sont abandonnées. FOR est initialisé à son entrée seulement ; NEXT poursuit son corps ou sort, sans réinitialisation. Les valeurs, bornes et pas ne sont pas évalués. Les limites de 16 appels imbriqués et 16 boucles actives sont des budgets d’analyse, pas des limites du CPC ; leur dépassement retire les résultats. Fermeture sans ouverture active dans le même appel, réentrée directe dans une boucle active, réutilisation ambiguë d’un compteur FOR, RETURN sans appel, événements asynchrones, formes opaques ou construction tronquée suspendent ce calcul. Les erreurs implicites de pile ne sont pas simulées. Il ne lève pas les limites globales de complexité, de retour et d’inaccessibilité.';
export const emptyErrorFlow = (): ErrorFlowReport => ({ version: 4, scope: 'explicit-and-simple-division', status: 'not-needed', reason: null, states: 0, sites: [], contexts: [], transfers: [] });

/** Finite product graph with bounded ordered call/loop frames; no value evaluation. */
export function analyzeErrorFlow(graph: FlowReport, resumptions: Map<number, ErrorResumption>, literalErrors: Set<number>, sites: Map<number, Omit<ErrorSite, 'node'>>, structureComplete: boolean, loopVariables: Map<number, string>, stateBudget: number = ERROR_FLOW_LIMITS.states): ErrorFlowReport {
 const result = emptyErrorFlow();
 const relevant = new Set([...sites.keys(), ...graph.nodes.filter(n => ['ON ERROR', 'RESUME', 'RESUME NEXT'].includes(n.operation)).map(n => n.id)]);
 if (!relevant.size) return result;
 const unsupported = (reason: string) => { result.status = 'unsupported'; result.reason = reason; result.sites = []; result.contexts = []; result.transfers = []; return result; };
 if (!structureComplete) return unsupported('Construction incertaine ou tronquée : aucun contexte d’erreur calculé.');
 const callSites = new Set(graph.edges.filter(e => e.kind === 'call').map(e => e.from));
 if (graph.handlers.some(h => h.event !== 'error')) return unsupported('Événements asynchrones : contextes d’erreur non couverts.');
 for (const node of graph.nodes) if (['RETURN', 'FOR', 'NEXT', 'WHILE', 'WEND'].includes(node.operation) || callSites.has(node.id)) relevant.add(node.id);
 if (graph.nodes.some(n => n.operation === 'ERROR' && !literalErrors.has(n.id))) return unsupported('ERROR doit avoir un code décimal littéral de 1 à 255.');
 const budget = Math.max(0, Math.min(ERROR_FLOW_LIMITS.states, Math.floor(stateBudget) || 0));
 const outgoing = new Map<number, typeof graph.edges>();
 for (const edge of graph.edges) { const list = outgoing.get(edge.from) ?? []; list.push(edge); outgoing.set(edge.from, list); }
 const continuations = new Map([...callSites].map(site => [site, (outgoing.get(site) ?? []).find(e => e.kind === (graph.nodes[site]!.operation === 'GOSUB' ? 'resume' : 'next'))?.to ?? null]));
 const loopHeaders = new Map(graph.edges.filter(e => e.kind === 'loop' && e.to !== null).map(e => [e.from, e.to!]));
 const handlers = new Map(graph.handlers.map(h => [h.site, h]));
 const seen = new Set<string>(), transferKeys = new Set<string>(), queue: ErrorContext[] = [];
 let steps = 0, limited = false;
 const limit = (reason: string) => { limited = true; result.status = 'limited'; result.reason = reason; result.sites = []; result.contexts = []; result.transfers = []; };
 function enqueue(node: number | null, handler: number | null, fault: number | null, stack: ErrorStackFrame[]) {
  if (node === null || limited) return;
  const key = `${node}/${handler}/${fault}/${stack.map(f => f.node).join(',')}`; if (seen.has(key)) return;
  if (seen.size >= budget) { limit(`Budget de ${budget} états d’erreur atteint : résultats contextuels retirés.`); return; }
  seen.add(key); queue.push({ node, handler, fault, stack, calls: stack.filter(f => f.kind === 'call').map(f => f.node) }); result.states = seen.size;
 }
 function transfer(context: ErrorContext, to: number | null, kind: ErrorTransferKind) {
  if (limited) return;
  const key = `${context.node}/${context.handler}/${context.fault}/${context.stack.map(f => f.node).join(',')}/${to}/${kind}`;
  if (transferKeys.has(key)) return;
  if (result.transfers.length >= ERROR_FLOW_LIMITS.links) { limit('Budget de 4096 transferts d’erreur atteint : résultats contextuels retirés.'); return; }
  transferKeys.add(key); result.transfers.push({ ...context, to, kind });
 }
 function follow(context: ErrorContext, links: typeof graph.edges) {
  for (const link of links) {
   if (++steps > ERROR_FLOW_LIMITS.steps) { limit('Budget de 131072 transitions atteint : résultats contextuels retirés.'); break; }
   if (link.kind !== 'handler' && link.kind !== 'unknown' && link.kind !== 'call' && link.kind !== 'resume') enqueue(link.to, context.handler, context.fault, context.stack);
  }
 }
 result.sites = [...sites].map(([node,site])=>({node,...site})).sort((a,b)=>graph.nodes[a.node]!.line-graph.nodes[b.node]!.line || graph.nodes[a.node]!.start-graph.nodes[b.node]!.start);
 result.status = 'covered'; enqueue(graph.entry, null, null, []);
 for (let cursor = 0; cursor < queue.length && !limited; cursor++) {
  const context = queue[cursor]!, { node, handler, fault, calls, stack } = context;
  if (relevant.has(node)) result.contexts.push(context);
  const operation = graph.nodes[node]!.operation, links = outgoing.get(node) ?? [], declaration = handlers.get(node);
  if (declaration) {
   if (declaration.action === 'disable' && fault !== null) { transfer(context, null, 'rethrow'); continue; }
   for (const link of links) if (link.kind === 'next') enqueue(link.to, declaration.target, fault, stack);
  } else if (sites.has(node)) {
   if (fault !== null) transfer(context, null, 'nested');
   else if (handler === null && sites.get(node)?.operator === '/') transfer(context, links.find(link => link.kind === 'next')?.to ?? null, 'warning');
   else if (handler === null) transfer(context, null, 'unhandled');
   else { transfer(context, handler, 'raise'); enqueue(handler, handler, node, stack); }
   if (sites.get(node)?.kind === 'division-zero') follow(context, links);
  } else if (operation === 'RESUME' || operation === 'RESUME NEXT') {
   if (fault === null) { result.sites = []; result.contexts = []; result.transfers = []; return unsupported('RESUME accessible sans erreur couverte active : erreur implicite hors modèle.'); }
   const explicit = links.find(link => link.kind === 'recovery' && link.to !== null);
   const to = explicit ? explicit.to : operation === 'RESUME NEXT' ? resumptions.get(fault)!.next : resumptions.get(fault)!.retry;
   transfer(context, to, explicit ? 'line' : operation === 'RESUME NEXT' ? 'next' : 'retry');
   enqueue(to, handler, null, stack);
  } else if (operation === 'RETURN') {
   const at = stack.findLastIndex(frame => frame.kind === 'call');
   if (at < 0) return unsupported('RETURN accessible sans appel GOSUB actif : erreur implicite hors modèle.');
   const to = continuations.get(stack[at]!.node) ?? null;
   transfer(context, to, 'return'); enqueue(to, handler, fault, stack.slice(0, at));
  } else if (operation === 'FOR' || operation === 'WHILE') {
   const local = stack.slice(stack.findLastIndex(frame => frame.kind === 'call') + 1);
   if (local.some(frame => frame.node === node || operation === 'FOR' && frame.kind === 'for' && loopVariables.get(frame.node) === loopVariables.get(node))) return unsupported('Réentrée dans une boucle active ou réutilisation ambiguë du compteur FOR : contexte hors modèle.');
   if (stack.length - calls.length >= ERROR_FLOW_LIMITS.loopDepth) { limit('Budget de 16 boucles actives atteint : résultats contextuels retirés, sans conclure à un débordement réel du CPC.'); continue; }
   for (const link of links) {
    if (link.kind === 'true') { transfer(context, link.to, 'loop-enter'); enqueue(link.to, handler, fault, [...stack, { kind: operation === 'FOR' ? 'for' : 'while', node }]); }
    else if (link.kind === 'false') { transfer(context, link.to, 'loop-skip'); enqueue(link.to, handler, fault, stack); }
   }
  } else if (operation === 'NEXT' || operation === 'WEND') {
   const header = loopHeaders.get(node);
   let at = stack.length - 1;
   while (at >= 0 && stack[at]!.kind !== 'call' && stack[at]!.node !== header) at--;
   if (at < 0 || stack[at]!.kind === 'call') return unsupported('NEXT/WEND accessible sans son ouverture active dans le même appel : erreur implicite de pile hors modèle.');
   const before = stack.slice(0, at), opening = outgoing.get(header!) ?? [];
   if (operation === 'WEND') { transfer(context, header!, 'loop-repeat'); enqueue(header!, handler, fault, before); }
   else {
    const body = opening.find(link => link.kind === 'true')?.to ?? null, after = opening.find(link => link.kind === 'false')?.to ?? null;
    transfer(context, body, 'loop-repeat'); enqueue(body, handler, fault, stack.slice(0, at + 1));
    transfer(context, after, 'loop-leave'); enqueue(after, handler, fault, before);
   }
  } else if (callSites.has(node)) {
   if (calls.length >= ERROR_FLOW_LIMITS.callDepth) { limit('Budget de 16 appels imbriqués atteint : résultats contextuels retirés, sans conclure à un débordement réel du CPC.'); continue; }
   for (const link of links) if (link.kind === 'call') {
    transfer(context, link.to, 'call'); enqueue(link.to, handler, fault, [...stack, { kind: 'call', node }]);
    if (limited) break;
   }
   follow(context, links); // ON GOSUB also keeps its selector-out-of-list path.
  } else follow(context, links);
 }
 return result;
}
