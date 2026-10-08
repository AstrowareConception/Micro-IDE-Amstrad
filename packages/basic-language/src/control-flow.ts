import { tokenize, type Token } from './language.ts';
import { analyzeEditor } from './syntax.ts';
import { conditionalElse, CONDITIONAL_DEPTH_LIMIT } from './conditional.ts';

export const FLOW_LIMITS = Object.freeze({ characters: 1_048_576, lines: 10_000, lineCharacters: 8192, tokens: 2048, nodes: 8192, totalNodes: 32768, edges: 32768, entries: 128, calls: 8192, visits: 500_000, reasons: 100 });
export interface FlowLocation { line: number; basicLine: number; start: number; end: number }
export interface FlowNode extends FlowLocation { id: number; operation: string; kind: 'line' | 'data' | 'statement' | 'opaque' }
export type FlowEdgeKind = 'next' | 'true' | 'false' | 'jump' | 'case' | 'call' | 'resume' | 'loop' | 'exit' | 'unknown';
export interface FlowEdge { from: number; to: number | null; kind: FlowEdgeKind; ordinal: number }
export interface FlowEntry { node: number; kind: 'main' | 'subroutine'; nodes: number; complexity: number | null; recursive: boolean }
export interface FlowCall { caller: number; callee: number; site: number }
export interface FlowCycle { nodes: number[]; hasExit: boolean; reachable: boolean }
export interface FlowReport {
 version: 1; complete: boolean; reasons: string[]; omittedReasons: number; entry: number | null;
 nodes: FlowNode[]; edges: FlowEdge[]; entries: FlowEntry[]; calls: FlowCall[]; cycles: FlowCycle[];
 unreachable: number[]; reachable: number[];
}
export const FLOW_METHOD = 'Graphe structurel depuis la première ligne, sans CONT ni RUN à une autre ligne. Les conditions ne sont pas évaluées ; les appels supposent un retour possible. La complexité locale vaut 1 + la somme des issues supplémentaires des décisions accessibles, en suivant la continuation des appels sans développer les sous-routines. Aucun total entre points d’entrée : leurs blocs peuvent se recouvrir. FOR/NEXT est normalisé avec un test en tête ; le retour au test ne réinitialise pas la variable. IF est limité à 16 niveaux. Les boucles dans IF doivent rester dans la même branche. Les fermetures intermédiaires de NEXT multiple exigent des bornes entières littérales garantissant l’entrée initiale. Les cycles ne prouvent pas une boucle infinie. Une forme opaque, une erreur de syntaxe ou un quota atteint suspend la complexité et les conclusions d’inaccessibilité. DATA reste lisible par READ même hors du chemin d’exécution. Ce modèle ne prouve ni la validité à l’exécution ni la terminaison.';

const word = (token: Token | undefined) => token?.text.toUpperCase() ?? '';
const isWord = (token: Token | undefined, name: string) => token?.kind === 'keyword' && word(token) === name;
const literal = (tokens: Token[]) => tokens.length === 1 && tokens[0]!.kind === 'number' && /^\d+$/.test(tokens[0]!.text) && Number(tokens[0]!.text) >= 1 && Number(tokens[0]!.text) <= 65535 ? Number(tokens[0]!.text) : undefined;
// Only known statements that cannot transfer control or replace BASIC/machine memory.
const sequential = new Set('PRINT WRITE INPUT LINE READ RESTORE DIM ERASE DEFINT DEFREAL DEFSTR DEG RAD RANDOMIZE MODE INK BORDER PAPER PEN GRAPHICS CLS CLG LOCATE WINDOW ORIGIN MOVE MOVER DRAW DRAWR PLOT PLOTR FILL TAG TAGOFF MASK SYMBOL SOUND ENV ENT RELEASE DI EI FRAME WAIT OPENIN OPENOUT CLOSEIN CLOSEOUT SAVE CAT WIDTH ZONE KEY TRON TROFF DEF MID$'.split(' '));

// Skipping a FOR closed before the final variable of a NEXT list remains opaque.
// The last variable has the qualified continuation after the whole statement.
function entersLiteralFor(args: Token[]): boolean {
 const integer = (items: Token[]) => {
  const text = items.map(t => t.text).join('');
  if (!/^[+-]?\d+$/.test(text)) return null;
  const value = Number(text); return Math.abs(value) <= 32767 ? value : null;
 };
 const to = args.findIndex(t => isWord(t, 'TO')), stepAt = args.findIndex(t => isWord(t, 'STEP'));
 if (args[0]?.kind !== 'identifier' || args[1]?.text !== '=' || to < 3) return false;
 const start = integer(args.slice(2, to)), end = integer(args.slice(to + 1, stepAt < 0 ? undefined : stepAt));
 const step = stepAt < 0 ? 1 : integer(args.slice(stepAt + 1));
 return start !== null && end !== null && step !== null && (step > 0 && start <= end || step < 0 && start >= end);
}

/** Iterative Kosaraju: bounded graph size, no recursion proportional to listing length. */
function components(ids: number[], adjacency: Map<number, number[]>): number[][] {
 const seen = new Set<number>(), order: number[] = [], reverse = new Map(ids.map(id => [id, [] as number[]]));
 for (const [from, targets] of adjacency) for (const to of targets) reverse.get(to)?.push(from);
 for (const start of ids) {
  if (seen.has(start)) continue;
  seen.add(start); const stack: [number, number][] = [[start, 0]];
  while (stack.length) {
   const frame = stack.at(-1)!, targets = adjacency.get(frame[0]) ?? [];
   if (frame[1] === targets.length) { order.push(frame[0]); stack.pop(); continue; }
   const target = targets[frame[1]++]!;
   if (!seen.has(target)) { seen.add(target); stack.push([target, 0]); }
  }
 }
 seen.clear(); const result: number[][] = [];
 for (const start of order.reverse()) {
  if (seen.has(start)) continue;
  const group: number[] = [], stack = [start]; seen.add(start);
  while (stack.length) { const node = stack.pop()!; group.push(node); for (const previous of reverse.get(node) ?? []) if (!seen.has(previous)) { seen.add(previous); stack.push(previous); } }
  result.push(group.sort((a, b) => a - b));
 }
 return result;
}

export function analyzeControlFlow(source: string, nodeBudget: number = FLOW_LIMITS.nodes): FlowReport {
 const report: FlowReport = { version: 1, complete: true, reasons: [], omittedReasons: 0, entry: null, nodes: [], edges: [], entries: [], calls: [], cycles: [], unreachable: [], reachable: [] };
 const reasons = new Set<string>();
 function partial(reason: string) {
  report.complete = false;
  if (reasons.has(reason)) return;
  reasons.add(reason);
  if (report.reasons.length < FLOW_LIMITS.reasons) report.reasons.push(reason); else report.omittedReasons++;
 }
 const maxNodes = Math.max(0, Math.min(FLOW_LIMITS.nodes, Math.floor(nodeBudget)));
 if (!maxNodes) { partial('Budget global de 32768 nœuds épuisé : choisir moins de sources.'); return report; }
 if (source.length > FLOW_LIMITS.characters) { partial('Source supérieure à 1 Mio de caractères : graphe non construit.'); return report; }
 const physical = source.split('\n'); if (physical.at(-1) === '') physical.pop();
 if (physical.length > FLOW_LIMITS.lines) { partial('Plus de 10000 lignes physiques : graphe non construit.'); return report; }
 const lines: { location: FlowLocation; tokens: Token[]; anchor: number }[] = [], targets = new Map<number, number>();
 const pending: { from: number; number: number; kind: FlowEdgeKind; ordinal: number }[] = [];
 const loops: { node: number; name: string; variable: string; next: number | null; scope: number; followedByNext: boolean; enters: boolean }[] = [];
 let branchScope = 0;
 const outgoing = new Map<number, FlowEdge[]>();
 function node(location: FlowLocation, operation: string, kind: FlowNode['kind'] = 'statement'): number {
  if (report.nodes.length >= maxNodes) throw new Error(`Budget de ${maxNodes} nœuds atteint : graphe tronqué, conclusions suspendues.`);
  const id = report.nodes.length; report.nodes.push({ ...location, id, operation, kind }); return id;
 }
 function edge(from: number, to: number | null, kind: FlowEdgeKind = 'next', ordinal = 0) {
  if (report.edges.length >= FLOW_LIMITS.edges) throw new Error('Plus de 32768 liaisons : graphe tronqué, conclusions suspendues.');
  const value = { from, to, kind, ordinal }; report.edges.push(value);
  const list = outgoing.get(from) ?? []; list.push(value); outgoing.set(from, list);
 }
 function unknown(id: number, reason: string, next: number | null) {
  report.nodes[id]!.kind = 'opaque'; partial(`BASIC ${report.nodes[id]!.basicLine} : ${reason}`); edge(id, null, 'unknown'); edge(id, next);
 }
 function jump(id: number, tokens: Token[], kind: FlowEdgeKind, ordinal = 0) {
  const number = literal(tokens);
  if (number === undefined) { partial(`BASIC ${report.nodes[id]!.basicLine} : cible non littérale ou invalide.`); edge(id, null, 'unknown'); }
  else pending.push({ from: id, number, kind, ordinal });
 }
 function sequence(tokens: Token[], next: number | null, location: FlowLocation, depth = 0, scope = 0): number | null {
  const parts: Token[][] = [];
  for (let cursor = 0; cursor < tokens.length;) {
   if (tokens[cursor]!.kind === 'comment') break;
   if (isWord(tokens[cursor], 'IF')) { parts.push(tokens.slice(cursor)); break; }
   let end = cursor; while (end < tokens.length && tokens[end]!.kind !== 'comment' && !(tokens[end]!.kind === 'operator' && tokens[end]!.text === ':')) end++;
   if (end > cursor) parts.push(tokens.slice(cursor, end));
   if (tokens[end]?.kind === 'comment') break;
   cursor = end + 1;
  }
  let continuation = next;
  for (const part of parts.reverse()) continuation = statement(part, continuation, location, depth, scope);
  return continuation;
 }
 function statement(tokens: Token[], next: number | null, location: FlowLocation, depth: number, scope: number): number {
  const first = tokens[0]!, name = word(first), args = tokens.slice(1), loc = { ...location, start: first.start, end: tokens.at(-1)!.end };
  const assignment = first.kind === 'identifier' && tokens.some(t => t.text === '=') || isWord(first, 'LET');
  const operation = assignment ? 'AFFECTATION' : first.kind === 'keyword' ? name : first.kind === 'number' ? 'GOTO' : 'INSTRUCTION';
  const id = node(loc, operation, name === 'DATA' ? 'data' : 'statement');
  if (name === 'IF' && first.kind === 'keyword') {
   const at = tokens.findIndex(t => isWord(t, 'THEN') || isWord(t, 'GOTO'));
   if (depth >= CONDITIONAL_DEPTH_LIMIT) { unknown(id, 'Limite de 16 niveaux IF atteinte.', next); return id; }
   if (at <= 1) { unknown(id, 'forme conditionnelle non couverte.', next); return id; }
   const body = tokens.slice(at + 1), otherwise = conditionalElse(body);
   const yes = otherwise < 0 ? body : body.slice(0, otherwise), no = otherwise < 0 ? [] : body.slice(otherwise + 1);
   // Distinct branch identities, not just nesting depth: THEN and ELSE must
   // never pair each other's loop openers/closers, even at the same depth.
   edge(id, sequence(yes, next, location, depth + 1, ++branchScope), 'true'); edge(id, sequence(no, next, location, depth + 1, ++branchScope), 'false');
  } else if (isWord(first, 'GOTO') || depth > 0 && literal(tokens) !== undefined) jump(id, first.kind === 'number' ? tokens : args, 'jump');
  else if (isWord(first, 'GOSUB')) { jump(id, args, 'call'); edge(id, next, 'resume'); }
  else if (isWord(first, 'ON')) {
   const at = tokens.findIndex(t => isWord(t, 'GOTO') || isWord(t, 'GOSUB'));
   if (['ERROR', 'BREAK', 'SQ'].includes(word(args[0])) || at < 2) unknown(id, 'gestionnaire ou sélecteur ON non couvert.', next);
   else {
    const list = tokens.slice(at + 1), kind = word(tokens[at]) === 'GOSUB' ? 'call' : 'case';
    if (!list.length || list.length % 2 === 0 || list.some((t, i) => i % 2 ? t.text !== ',' : literal([t]) === undefined)) unknown(id, 'liste de cibles ON non littérale.', next);
    else { for (let i = 0; i < list.length; i += 2) jump(id, [list[i]!], kind, i / 2 + 1); edge(id, next, 'next'); }
   }
  } else if (['FOR', 'NEXT', 'WHILE', 'WEND'].includes(name) && first.kind === 'keyword') {
   const variable = name === 'FOR' || name === 'NEXT' ? word(args[0]) : '';
   const validNext = !args.length || args.length % 2 === 1 && args.every((t, i) => i % 2 ? t.text === ',' : t.kind === 'identifier');
   if (name === 'NEXT' && !validNext) unknown(id, 'NEXT non reconnu.', next);
   else if (name === 'NEXT' && args.length > 1) {
    const variables = args.filter((_, i) => i % 2 === 0);
    const ids = variables.map((token, i) => i === 0 ? id : node({ ...location, start: token.start, end: token.end }, 'NEXT'));
    report.nodes[id]!.end = variables[0]!.end;
    variables.forEach((token, i) => loops.push({ node: ids[i]!, name, variable: word(token), next: ids[i + 1] ?? next, scope, followedByNext: i < ids.length - 1, enters: false }));
   } else loops.push({ node: id, name, variable, next, scope, followedByNext: false, enters: name === 'FOR' && entersLiteralFor(args) });
  } else if (['RETURN', 'END', 'STOP'].includes(name) && !args.length) edge(id, null, 'exit');
  else if (assignment || name === 'DATA' || sequential.has(name) && first.kind === 'keyword') edge(id, next);
  else unknown(id, 'instruction à effets de contrôle inconnus (machine, événements, chargement ou forme non reconnue).', next);
  return id;
 }
 try {
  let previous = 0;
  for (let index = 0; index < physical.length; index++) {
   const line = physical[index]!.replace(/\r$/, ''); if (!line.trim()) continue;
   if (line.length > FLOW_LIMITS.lineCharacters) { partial(`Ligne ${index + 1} supérieure à 8192 caractères : ignorée.`); continue; }
   const prefix = /^\s*(\d+)(?=\s|[a-zA-Z?'&]|$)/.exec(line), number = Number(prefix?.[1]);
   if (!prefix || number < 1 || number > 65535 || number <= previous) { partial(`Ligne ${index + 1} : numérotation absente, invalide ou non croissante.`); continue; }
   previous = number;
   const tokens = tokenize(line, FLOW_LIMITS.tokens + 1).filter(t => t.start >= prefix[0].length);
   if (tokens.length >= FLOW_LIMITS.tokens) { partial(`BASIC ${number} : limite de tokens atteinte.`); continue; }
   const location = { line: index + 1, basicLine: number, start: prefix[0].length, end: line.length };
   const anchor = node(location, 'LIGNE', 'line'); lines.push({ location, tokens, anchor }); targets.set(number, anchor);
  }
  report.entry = lines[0]?.anchor ?? null;
  // Errors suspend deductions; opaque syntax alone does not imply unknown control (e.g. PRINT USING).
  const syntax = analyzeEditor(source);
  if (syntax.coverage.limited || syntax.diagnostics.some(d => d.severity === 'error' || d.code === 'unclosed-string')) partial('Syntaxe ou couverture du listing à vérifier : conclusions de flux suspendues.');
  for (let index = 0; index < lines.length; index++) {
   const line = lines[index]!, next = lines[index + 1]?.anchor ?? null;
   edge(line.anchor, sequence(line.tokens, next, line.location));
  }
  const stack: typeof loops = [];
  loops.sort((a, b) => report.nodes[a.node]!.line - report.nodes[b.node]!.line || report.nodes[a.node]!.start - report.nodes[b.node]!.start);
  for (const loop of loops) {
   if (loop.name === 'FOR' || loop.name === 'WHILE') {
    if (loop.name === 'FOR' && stack.some(open => open.name === 'FOR' && open.variable === loop.variable)) partial(`BASIC ${report.nodes[loop.node]!.basicLine} : variable FOR déjà active, appariement incertain.`);
    stack.push(loop); continue;
   }
   const open = stack.at(-1);
   if (!open || (loop.name === 'NEXT' ? open.name !== 'FOR' || !!loop.variable && loop.variable !== open.variable : open.name !== 'WHILE')) { unknown(loop.node, 'fermeture de boucle sans ouverture structurée correspondante.', loop.next); continue; }
   if (open.scope !== loop.scope) { unknown(loop.node, 'ouverture et fermeture de boucle dans des branches IF différentes ou au-delà de la branche.', loop.next); continue; }
   stack.pop();
   if (loop.followedByNext && !open.enters) partial(`BASIC ${report.nodes[loop.node]!.basicLine} : fermeture intermédiaire de NEXT multiple avec entrée FOR non garantie par des bornes entières littérales (STEP non nul).`);
   // Normalised loop test: FOR can skip its body; NEXT returns to the test, not to initialisation.
   edge(open.node, open.next, 'true'); edge(open.node, loop.next, 'false'); edge(loop.node, open.node, 'loop');
  }
  for (const open of stack) unknown(open.node, 'boucle non refermée dans le listing.', open.next);
  for (const transfer of pending) {
   const target = targets.get(transfer.number);
   if (target === undefined) { partial(`BASIC ${report.nodes[transfer.from]!.basicLine} : cible ${transfer.number} absente.`); edge(transfer.from, null, 'unknown'); }
   else edge(transfer.from, target, transfer.kind, transfer.ordinal);
  }
 } catch (error) { partial(error instanceof Error ? error.message : 'Construction du graphe interrompue.'); }
 let visits = 0;
 function walk(start: number, includeCalls: boolean): Set<number> {
  const seen = new Set<number>(), stack = [start];
  while (stack.length) {
   const current = stack.pop()!; if (seen.has(current)) continue;
   if (++visits > FLOW_LIMITS.visits) { partial('Budget de parcours atteint : 500000 visites maximum.'); break; }
   seen.add(current);
   for (const link of outgoing.get(current) ?? []) if (link.to !== null && (includeCalls || link.kind !== 'call')) stack.push(link.to);
  }
  return seen;
 }
 const reached = report.entry === null ? new Set<number>() : walk(report.entry, true);
 report.reachable = [...reached].sort((a, b) => a - b);
 const entries = new Set<number>(); if (report.entry !== null) entries.add(report.entry);
 for (const link of report.edges) if (link.kind === 'call' && link.to !== null) entries.add(link.to);
 if (entries.size > FLOW_LIMITS.entries) partial('Plus de 128 points d’entrée : résumés limités aux 128 premiers.');
 for (const entry of [...entries].slice(0, FLOW_LIMITS.entries)) {
  const body = walk(entry, false); let decisions = 0, statements = 0;
  for (const id of body) {
   if (report.nodes[id]!.kind === 'statement' || report.nodes[id]!.kind === 'opaque') statements++;
   const links = outgoing.get(id) ?? [], calls = links.filter(e => e.kind === 'call');
   // ON GOSUB has N possible callees plus selector fall-through; simple GOSUB has one continuation.
   decisions += Math.max(0, links.filter(e => e.kind !== 'call').length - 1) + (report.nodes[id]!.operation === 'ON' ? calls.length : 0);
   for (const call of calls) if (call.to !== null) {
    if (report.calls.length < FLOW_LIMITS.calls) report.calls.push({ caller: entry, callee: call.to, site: id });
    else partial('Plus de 8192 relations d’appel : graphe des appels tronqué.');
   }
  }
  report.entries.push({ node: entry, kind: entry === report.entry ? 'main' : 'subroutine', nodes: statements, complexity: statements ? 1 + decisions : 0, recursive: false });
 }
 const local = new Map(report.nodes.map(n => [n.id, [] as number[]]));
 for (const e of report.edges) if (e.to !== null && e.kind !== 'call') local.get(e.from)!.push(e.to);
 for (const group of components(report.nodes.map(n => n.id), local)) {
  if (group.length === 1 && !local.get(group[0]!)!.includes(group[0]!)) continue;
  const members = new Set(group);
  const hasExit = group.some(id => (outgoing.get(id) ?? []).some(e => e.to === null || e.kind !== 'call' && !members.has(e.to)));
  report.cycles.push({ nodes: group, hasExit, reachable: group.some(id => reached.has(id)) });
 }
 const calls = new Map(report.entries.map(e => [e.node, [] as number[]]));
 for (const call of report.calls) if (calls.has(call.callee)) calls.get(call.caller)!.push(call.callee);
 const recursive = new Set(components([...calls.keys()], calls).filter(g => g.length > 1 || calls.get(g[0]!)!.includes(g[0]!)).flat());
 for (const entry of report.entries) { entry.recursive = recursive.has(entry.node); if (!report.complete) entry.complexity = null; }
 if (report.complete) report.unreachable = report.nodes.filter(n => n.kind === 'statement' && !reached.has(n.id)).map(n => n.id);
 return report;
}
