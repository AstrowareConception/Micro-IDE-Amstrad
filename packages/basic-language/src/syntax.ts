import { analyze, tokenize, type Analysis, type Diagnostic, type Token } from './language.ts';
import { KEYWORDS } from './catalog.ts';
import { expressionError } from './expression.ts';

// Conservative editor grammar. Never interprets comments, DATA or RSX payloads.
// Complex event/file/DEF dialect forms remain opaque; no ROM success is inferred.
const operandCommands = new Set(['MODE', 'MEMORY', 'CALL', 'ERROR', 'GOTO', 'GOSUB', 'OPENIN', 'OPENOUT', 'LOAD', 'WHILE', 'READ', 'INPUT', 'DIM']);
const twoArguments = new Set(['INK', 'LOCATE', 'MOVE', 'MOVER', 'DRAW', 'DRAWR', 'PLOT', 'PLOTR', 'POKE', 'OUT', 'ORIGIN', 'SOUND']);
const binary = new Set(['+', '-', '*', '/', '^', '=', '<', '>', 'AND', 'OR', 'XOR', 'MOD', 'NOT']);
const upper = (token: Token | undefined) => token?.text.toUpperCase() ?? '';

export function analyzeEditor(source: string): Analysis {
 const result = analyze(source);
 const report = (line: number, token: Token, code: string, message: string, severity: Diagnostic['severity'] = 'error') => result.diagnostics.push({ line, start: token.start, end: Math.max(token.end, token.start + 1), code, message, severity });
 source.split('\n').forEach((line, index) => {
  const number = /^\s*\d+/.exec(line); if (!number) return;
  const all = tokenize(line).filter(token => token.start >= number[0].length);
  let statement: Token[] = [];
  const inspect = () => {
   if (!statement.length) return;
   const first = statement[0]!, name = upper(first);
   if (name === 'DATA' || first.text === '|' || first.kind === 'comment') return;
   const stack: Token[] = [];
   for (const token of statement) {
    if (token.kind === 'string' || token.kind === 'data' || token.kind === 'comment') continue;
    if (token.text === '(') stack.push(token);
    if (token.text === ')') { if (stack.length) stack.pop(); else report(index + 1, token, 'syntax-parenthesis', 'Parenthèse fermante sans ouverture.'); }
   }
   for (const token of stack) report(index + 1, token, 'syntax-parenthesis', 'Parenthèse ouvrante sans fermeture.');
   const args = statement.slice(1), last = statement.at(-1)!;
   const checkExpression = (tokens: Token[]) => {
    const error = expressionError(tokens);
    if (error) report(index + 1, error, 'syntax-expression', 'Expression incorrecte ou opérateur manquant.');
   };
   if (first.kind === 'identifier' && !statement.some(token => token.text === '=')) {
    // Native BASIC also accepts compact keyword spellings: leave those opaque.
    if (![...KEYWORDS].some(keyword => name.startsWith(keyword))) report(index + 1, first, 'syntax-statement', `Instruction inconnue « ${first.text} » ou affectation sans signe =.`);
   }
   if (operandCommands.has(name) && !args.length) report(index + 1, first, 'syntax-operand', `${name} attend une expression ou un argument.`);
   if (['MODE', 'MEMORY', 'ERROR', 'WHILE'].includes(name) && args.length) checkExpression(args);
   // Ordinary variable assignment; special MID$ and DEF FN forms stay opaque.
   if (first.kind === 'identifier' || name === 'LET') {
    const equal = statement.findIndex(token => token.text === '=');
    if (equal >= 0) {
     if (equal === statement.length - 1) report(index + 1, last, 'syntax-operand', 'Expression manquante après =.');
     else checkExpression(statement.slice(equal + 1));
    }
   }
   if (twoArguments.has(name)) {
    let depth = 0, commas = 0;
    for (const token of args) { if (token.text === '(') depth++; if (token.text === ')') depth--; if (token.text === ',' && depth === 0) commas++; }
    if (!commas) report(index + 1, first, 'syntax-arguments', `${name} attend au moins deux arguments séparés par une virgule.`);
    if (!args.length || last.text === ',') report(index + 1, last, 'syntax-operand', 'Argument manquant après la virgule.');
   }
   if (name === 'IF') {
    const branch = statement.findIndex(token => ['THEN', 'GOTO'].includes(upper(token)));
    if (branch < 0) report(index + 1, first, 'syntax-if', 'IF attend une condition suivie de THEN ou GOTO.');
    else if (branch === 1) report(index + 1, statement[branch]!, 'syntax-if', 'Condition manquante après IF.');
    else if (branch === statement.length - 1) report(index + 1, last, 'syntax-if', 'Instruction ou cible manquante après THEN/GOTO.');
    if (branch > 1) checkExpression(statement.slice(1, branch));
   }
   if (name === 'FOR') {
    const to = statement.findIndex(token => upper(token) === 'TO');
    if (args[0]?.kind !== 'identifier' || args[1]?.text !== '=' || to < 0) report(index + 1, first, 'syntax-for', 'FOR attend variable = début TO fin, avec STEP facultatif.');
    else if (to === 3 || to === statement.length - 1 || upper(last) === 'STEP') report(index + 1, last, 'syntax-for', 'Borne ou pas de boucle manquant.');
   }
   if (name === 'LET' && (args[0]?.kind !== 'identifier' || !args.some(token => token.text === '='))) report(index + 1, first, 'syntax-assignment', 'LET attend une variable suivie de = et d’une expression.');
   if (binary.has(upper(last)) && statement.length > 1) report(index + 1, last, 'syntax-expression', `Expression incomplète après ${last.text}.`);
   if (name === 'MODE' && args.length === 1 && args[0]?.kind === 'number' && /^\d+$/.test(args[0].text) && Number(args[0].text) > 2) report(index + 1, args[0], 'mode-range', 'Le CPC classique attend MODE 0, 1 ou 2.');
  };
  for (const token of all) {
   if (token.kind === 'comment') break;
   if (token.text === ':' && token.kind === 'operator') { inspect(); statement = []; } else statement.push(token);
  }
  inspect();
 });
 result.diagnostics.sort((a, b) => a.line - b.line || a.start - b.start);
 return result;
}
