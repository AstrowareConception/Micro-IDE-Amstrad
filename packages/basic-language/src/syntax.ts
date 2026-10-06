import { analyze, tokenize, type Analysis, type Diagnostic, type Token } from './language.ts';
import { KEYWORDS } from './catalog.ts';
import { inspectExpression } from './expression.ts';

export const ANALYSIS_LIMITS = { characters: 1_048_576, lines: 10_000, lineCharacters: 8192, lineTokens: 2048, diagnostics: 500, inspections: 100, variables: 4096 } as const;
export interface Inspection { line: number; start: number; end: number; reason: string }
export interface EditorAnalysis extends Analysis {
 coverage: { checked: number; opaque: number; limited: boolean; lines: number };
 inspections: Inspection[];
}
const upper = (token: Token | undefined) => token?.text.toUpperCase() ?? '';
// Structural grammar only. No runtime type/range or function-arity claim.
const argumentCounts: Record<string, [number, number]> = {
 MODE: [1, 1], MEMORY: [1, 1], ERROR: [1, 1], WHILE: [1, 1], FILL: [1, 1], WIDTH: [1, 1], ZONE: [1, 1], RELEASE: [1, 1],
 BORDER: [1, 2], INK: [2, 3], LOCATE: [2, 2], MOVE: [2, 4], MOVER: [2, 4], DRAW: [2, 4], DRAWR: [2, 4], PLOT: [2, 4], PLOTR: [2, 4],
 POKE: [2, 2], OUT: [2, 2], ORIGIN: [2, 6], SOUND: [2, 7], WAIT: [2, 3], KEY: [2, 2],
 OPENIN: [1, 1], OPENOUT: [1, 1], LOAD: [1, 2], MERGE: [1, 1], CALL: [1, Infinity],
 GOTO: [1, 1], GOSUB: [1, 1], RESTORE: [0, 1], RANDOMIZE: [0, 1],
};
const noArguments = new Set(['END', 'STOP', 'RETURN', 'WEND', 'TRON', 'TROFF', 'FRAME', 'DI', 'EI', 'DEG', 'RAD', 'NEW', 'CAT', 'CONT', 'CLOSEIN', 'CLOSEOUT']);
const compactKeywords = [...KEYWORDS];
function split(tokens: Token[], separator: string): Token[][] {
 const groups: Token[][] = [[]]; let depth = 0;
 for (const token of tokens) {
  if (token.text === '(') depth++; else if (token.text === ')') depth--;
  if (token.text === separator && depth === 0) groups.push([]); else groups.at(-1)!.push(token);
 }
 return groups;
}
function keyword(tokens: Token[], names: string[]): number {
 let depth = 0;
 return tokens.findIndex(token => { if (token.text === '(') depth++; else if (token.text === ')') depth--; return depth === 0 && names.includes(upper(token)); });
}

/** Bounded, conservative inspection. Opaque productions are visible, never certified. */
export function analyzeEditor(source: string, lex: (line: string) => Token[] = tokenize): EditorAnalysis {
 const lines = source.length > ANALYSIS_LIMITS.characters ? [] : source.split('\n');
 const coverage = { checked: 0, opaque: 0, limited: false, lines: lines.length };
 const inspections: Inspection[] = [];
 if (source.length > ANALYSIS_LIMITS.characters || lines.length > ANALYSIS_LIMITS.lines) {
  return { diagnostics: [{ line: 1, start: 0, end: 1, code: 'analysis-limit', severity: 'warning', message: 'Analyse suspendue : limite de 1 Mio ou 10 000 lignes dépassée.' }], targets: [], references: [], variables: [], coverage: { ...coverage, limited: true }, inspections };
 }
 const tokens = lines.map(line => line.length <= ANALYSIS_LIMITS.lineCharacters ? lex(line) : []);
 const result = analyze(source, (_, index) => tokens[index]!, ANALYSIS_LIMITS.diagnostics) as EditorAnalysis;
 result.coverage = coverage; result.inspections = inspections;
 const report = (line: number, token: Token, code: string, message: string, severity: Diagnostic['severity'] = 'error') => {
  if (result.diagnostics.length >= ANALYSIS_LIMITS.diagnostics) { coverage.limited = true; return; }
  result.diagnostics.push({ line, start: token.start, end: Math.max(token.end, token.start + 1), code, message, severity });
 };
 lines.forEach((line, index) => {
  const prefix = /^\s*\d+/.exec(line); if (!prefix) return;
  const physical = index + 1;
  const opaque = (token: Token, reason: string) => { coverage.opaque++; if (inspections.length < ANALYSIS_LIMITS.inspections) inspections.push({ line: physical, start: token.start, end: token.end, reason }); };
  const firstToken = { start: prefix[0].length, end: Math.max(prefix[0].length + 1, line.length), text: '', kind: 'operator' } as Token;
  if (line.length > ANALYSIS_LIMITS.lineCharacters || tokens[index]!.length > ANALYSIS_LIMITS.lineTokens) { coverage.limited = true; opaque(firstToken, 'Ligne trop longue pour l’inspection syntaxique.'); report(physical, firstToken, 'analysis-line-limit', 'Inspection de cette ligne limitée à 8 192 caractères et 2 048 tokens.', 'warning'); return; }
  const all = tokens[index]!.filter(token => token.start >= prefix[0].length);
  const checkExpression = (items: Token[], anchor: Token) => {
   if (!items.length) { report(physical, anchor, 'syntax-operand', 'Expression ou argument manquant.'); return; }
   const checked = inspectExpression(items);
   if (checked.opaque) opaque(items[0]!, 'Expression avec FN, adresse, flux ou profondeur non couverte.');
   if (checked.error) report(physical, checked.error, 'syntax-expression', 'Expression incorrecte ou opérateur manquant.');
  };
  const checkArguments = (items: Token[], anchor: Token, min: number, max: number, omittedOptions = false) => {
   const groups = items.length ? split(items, ',') : [];
   if (groups.length < min || groups.length > max) report(physical, anchor, 'syntax-arguments', `${anchor.text.toUpperCase()} attend ${min === max ? min : `${min} à ${max === Infinity ? 'plusieurs' : max}`} argument(s) séparé(s) par des virgules.`);
   if (!items.length && min) report(physical, anchor, 'syntax-operand', `${anchor.text.toUpperCase()} attend une expression ou un argument.`);
   for (const [index, group] of groups.entries()) {
    if (!group.length && index >= min && omittedOptions) opaque(anchor, 'Argument facultatif omis : valeur par défaut non qualifiée.');
    else checkExpression(group, items.at(-1) ?? anchor);
   }
  };
  const checkVariable = (items: Token[], anchor: Token, arrayRequired = false) => {
   const name = items[0];
   if (name?.kind !== 'identifier') { report(physical, name ?? anchor, 'syntax-assignment', 'Nom de variable attendu.'); return; }
   if (items.length === 1 && !arrayRequired) return;
   if (items[1]?.text !== '(' || items.at(-1)?.text !== ')') { report(physical, name, 'syntax-assignment', arrayRequired ? 'DIM attend un tableau suivi de dimensions entre parenthèses.' : 'Cible d’affectation incorrecte.'); return; }
   checkArguments(items.slice(2, -1), name, 1, Infinity);
  };
  const inspectSequence = (items: Token[], nesting = 0, branch = false) => {
   if (nesting > 16) { if (items[0]) opaque(items[0], 'Imbrication de branches limitée.'); return; }
   for (let cursor = 0; cursor < items.length;) {
    const remaining = items.slice(cursor);
    if (upper(remaining[0]) === 'IF') { inspect(remaining, nesting, branch); return; }
    const colon = remaining.findIndex(token => token.text === ':' && token.kind === 'operator');
    inspect(colon < 0 ? remaining : remaining.slice(0, colon), nesting, branch);
    if (colon < 0) return; cursor += colon + 1;
   }
  };
  const inspect = (raw: Token[], nesting: number, branch: boolean) => {
   const comment = raw.findIndex(token => token.kind === 'comment');
   const statement = upper(raw[0]) === 'IF' || comment < 0 ? raw : raw.slice(0, comment);
   const first = statement[0]; if (!first) return;
   if (first.kind === 'comment') return;
   const name = upper(first), args = statement.slice(1);
   if (name === 'DATA' || first.text === '|') { opaque(first, name === 'DATA' ? 'DATA : valeurs conservées telles quelles.' : 'RSX : grammaire définie par l’extension.'); return; }
   coverage.checked++;
   if (name !== 'IF') {
    const stack: Token[] = []; let unmatched = false;
    for (const token of statement) {
     if (token.text === '(') stack.push(token);
     if (token.text === ')') { if (stack.length) stack.pop(); else { unmatched = true; report(physical, token, 'syntax-parenthesis', 'Parenthèse fermante sans ouverture.'); } }
    }
    for (const token of stack) report(physical, token, 'syntax-parenthesis', 'Parenthèse ouvrante sans fermeture.');
    if (stack.length || unmatched) return;
   }
   if (name === 'IF') {
    const at = keyword(statement, ['THEN', 'GOTO']);
    if (at < 0) { report(physical, first, 'syntax-if', 'IF attend une condition suivie de THEN ou GOTO.'); return; }
    if (at === 1) report(physical, statement[at]!, 'syntax-if', 'Condition manquante après IF.'); else checkExpression(statement.slice(1, at), first);
    const body = statement.slice(at + 1);
    if (!body.length) { report(physical, statement[at]!, 'syntax-if', 'Instruction ou cible manquante après THEN/GOTO.'); return; }
    if (body.some(token => upper(token) === 'IF')) { opaque(first, 'Branches IF imbriquées : association ELSE non qualifiée.'); return; }
    const otherwise = keyword(body, ['ELSE']);
    const yes = otherwise < 0 ? body : body.slice(0, otherwise);
    if (!yes.length) report(physical, body[otherwise]!, 'syntax-if', 'Instruction manquante avant ELSE.'); else inspectSequence(yes, nesting + 1, true);
    if (otherwise >= 0) { const no = body.slice(otherwise + 1); if (!no.length) report(physical, body[otherwise]!, 'syntax-if', 'Instruction ou cible manquante après ELSE.'); else inspectSequence(no, nesting + 1, true); }
   } else if (name === 'FOR') {
    const to = keyword(statement, ['TO']), step = keyword(statement, ['STEP']);
    if (args[0]?.kind !== 'identifier' || args[1]?.text !== '=' || to < 0) report(physical, first, 'syntax-for', 'FOR attend variable = début TO fin, avec STEP facultatif.');
    else {
     checkExpression(statement.slice(3, to), statement[to]!);
     checkExpression(statement.slice(to + 1, step < 0 ? undefined : step), statement[to]!);
     if (step >= 0) checkExpression(statement.slice(step + 1), statement[step]!);
    }
   } else if (name === 'NEXT' || name === 'READ' || name === 'DIM') {
    if (!args.length && name !== 'NEXT') report(physical, first, 'syntax-operand', `${name} attend une liste de variables.`);
    if (args.length) for (const group of split(args, ',')) checkVariable(group, first, name === 'DIM');
   } else if (name === 'LET' || first.kind === 'identifier') {
    const equal = keyword(statement, ['=']);
    if (equal < 0 && first.kind === 'identifier' && compactKeywords.some(word => name.startsWith(word))) { opaque(first, 'Orthographe compacte non désambiguïsée.'); return; }
    if (equal < 0) report(physical, first, name === 'LET' ? 'syntax-assignment' : 'syntax-statement', name === 'LET' ? 'LET attend une variable suivie de = et d’une expression.' : `Instruction inconnue « ${first.text} » ou affectation sans signe =.`);
    else { checkVariable(statement.slice(name === 'LET' ? 1 : 0, equal), first); checkExpression(statement.slice(equal + 1), statement[equal]!); }
   } else if (name === 'ON' || name === 'AFTER' || name === 'EVERY') {
    const at = keyword(statement, ['GOTO', 'GOSUB']);
    if (name === 'ON' && upper(args[0]) === 'BREAK' && ['CONT', 'STOP'].includes(upper(args[1])) && args.length === 2) return;
    if (name === 'ON' && ['SQ', 'BREAK'].includes(upper(args[0]))) { opaque(first, 'Forme événementielle ON : inspection partielle.'); return; }
    if (at < 0) { report(physical, first, 'syntax-branch', `${name} attend ${name === 'ON' ? 'GOTO ou GOSUB' : 'GOSUB'} et une cible.`); return; }
    if (name === 'ON' && upper(args[0]) === 'ERROR') {
     if (at !== 2 || upper(statement[at]) !== 'GOTO') report(physical, first, 'syntax-branch', 'ON ERROR attend GOTO suivi d’une cible.');
    } else checkArguments(statement.slice(1, at), first, 1, name === 'ON' ? 1 : 2);
    if (name !== 'ON' && upper(statement[at]) !== 'GOSUB') report(physical, statement[at]!, 'syntax-branch', `${name} attend GOSUB.`);
    checkArguments(statement.slice(at + 1), statement[at]!, 1, name === 'ON' && upper(args[0]) !== 'ERROR' ? Infinity : 1);
   } else if (name === 'PRINT' || name === 'WRITE') {
    if (args.some(token => ['#', 'USING', 'TAB', 'SPC'].includes(upper(token)))) { opaque(first, 'Sortie formatée ou flux : grammaire non couverte.'); return; }
    if (name === 'WRITE') { if (args.length) checkArguments(args, first, 1, Infinity); }
    else {
     // Adjacent print expressions can be legal without an explicit separator.
     for (const group of split(args, ';').flatMap(part => split(part, ','))) {
      if (group.length && ['+', '-', '*', '/', '\\', '^', '=', '<', '>', 'AND', 'OR', 'XOR', 'MOD', 'NOT'].includes(upper(group.at(-1)))) report(physical, group.at(-1)!, 'syntax-expression', 'Expression de sortie incomplète.');
      else if (group.length) { const error = inspectExpression(group).error; if (error?.kind === 'operator' && error.text !== '(') report(physical, error, 'syntax-expression', 'Opérateur incorrect dans l’expression de sortie.'); }
     }
     if (args.length) opaque(first, 'PRINT : expressions adjacentes acceptées, inspection des terminaisons seulement.');
    }
   } else if (name === 'INPUT' || name === 'LINE' && upper(args[0]) === 'INPUT') {
    if (!args.length || name === 'LINE' && args.length === 1) report(physical, first, 'syntax-operand', 'INPUT attend une variable, avec prompt ou flux facultatif.');
    opaque(first, 'INPUT : prompt, flux et variables restent partiellement inspectés.');
   } else if (name === 'SPEED') {
    const variant = upper(args[0]);
    if (!['INK', 'KEY', 'WRITE'].includes(variant)) report(physical, args[0] ?? first, 'syntax-variant', 'SPEED attend INK, KEY ou WRITE.');
    else checkArguments(args.slice(1), args[0]!, variant === 'WRITE' ? 1 : 2, variant === 'WRITE' ? 1 : 2);
   } else if (noArguments.has(name)) {
    if (args.length) report(physical, args[0]!, 'syntax-arguments', `${name} n’attend aucun argument.`);
   } else if (argumentCounts[name] && !(name === 'KEY' && upper(args[0]) === 'DEF')) {
    let values = args;
    if (name === 'LOCATE' && args[0]?.text === '#') {
     const comma = keyword(args, [',']); checkExpression(args.slice(1, comma < 0 ? undefined : comma), first); values = comma < 0 ? [] : args.slice(comma + 1);
    }
    checkArguments(values, first, ...argumentCounts[name], ['MOVE', 'MOVER', 'DRAW', 'DRAWR', 'PLOT', 'PLOTR', 'SOUND'].includes(name));
    if (name === 'ORIGIN' && ![2, 6].includes(split(values, ',').length)) report(physical, first, 'syntax-arguments', 'ORIGIN attend deux coordonnées ou deux coordonnées et quatre bornes.');
    if (name === 'MODE' && args.length === 1 && args[0]?.kind === 'number' && /^\d+$/.test(args[0].text) && Number(args[0].text) > 2) report(physical, args[0], 'mode-range', 'Le CPC classique attend MODE 0, 1 ou 2.');
   } else if (branch && first.kind === 'number') checkExpression(statement, first);
   else opaque(first, 'Production reconnue mais grammaire non couverte.');
  };
  inspectSequence(all);
 });
 if (result.diagnostics.length >= ANALYSIS_LIMITS.diagnostics) coverage.limited = true;
 if (result.variables.length > ANALYSIS_LIMITS.variables) { result.variables.length = ANALYSIS_LIMITS.variables; coverage.limited = true; }
 result.diagnostics.sort((a, b) => a.line - b.line || a.start - b.start);
 return result;
}
