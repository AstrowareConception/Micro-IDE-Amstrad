import { COMMANDS, KEYWORDS, type CommandCard } from './catalog.ts';

export interface Token {
  start: number; end: number; text: string;
  kind: 'keyword' | 'identifier' | 'number' | 'string' | 'comment' | 'data' | 'operator';
}
export interface Diagnostic { line: number; start: number; end: number; message: string; code: string; severity: 'error' | 'warning' }
export interface LineTarget { number: number; line: number; start: number; end: number }
export interface LineReference extends LineTarget {}
export interface Analysis { diagnostics: Diagnostic[]; targets: LineTarget[]; references: LineReference[]; variables: string[] }

/** A tolerant single-line lexer, not a full parser. Offsets are UTF-16, zero based. */
export function tokenize(line: string, tokenLimit = Infinity): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < line.length && tokens.length < tokenLimit) {
    if (/\s/.test(line[cursor]!)) { cursor++; continue; }
    const start = cursor;
    const rest = line.slice(cursor);
    let kind: Token['kind'];
    let text: string;
    if (rest[0] === "'") { kind = 'comment'; text = rest; }
    else if (rest[0] === '"') {
      const close = line.indexOf('"', cursor + 1);
      text = close < 0 ? rest : line.slice(cursor, close + 1); kind = 'string';
    } else {
      const number = /^(?:&[xX][01]+|&[hH]?[0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(rest);
      const word = /^[a-zA-Z][a-zA-Z0-9]*[$%!]?/.exec(rest);
      if (number) { text = number[0]; kind = 'number'; }
      else if (word) {
        text = word[0];
        // Legal compact literal targets (THEN100, GOTO100), without splitting arbitrary identifiers.
        const compact = /^(GOTO|GOSUB|THEN|ELSE)(\d+)$/i.exec(text);
        if (compact) text = compact[1]!;
        const upper = text.toUpperCase();
        kind = KEYWORDS.has(upper) ? 'keyword' : 'identifier';
        if (upper === 'REM') { text = rest; kind = 'comment'; }
      } else { text = rest[0]!; kind = 'operator'; }
    }
    cursor += text.length;
    tokens.push({ start, end: cursor, text, kind });
    if (kind === 'keyword' && text.toUpperCase() === 'DATA') {
      // DATA is opaque until an unquoted colon. Keywords, apostrophes and targets inside it are values.
      const dataStart = cursor;
      let quoted = false;
      while (cursor < line.length) {
        if (line[cursor] === '"') quoted = !quoted;
        if (line[cursor] === ':' && !quoted) break;
        cursor++;
      }
      if (cursor > dataStart) tokens.push({ start: dataStart, end: cursor, text: line.slice(dataStart, cursor), kind: 'data' });
    }
  }
  return tokens;
}

function literalReferences(tokens: Token[], physicalLine: number): LineReference[] {
  const refs: LineReference[] = [];
  let inOnList = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'keyword' && token.text.toUpperCase() === 'ON') inOnList = true;
    if (token.kind !== 'keyword' || !['GOTO', 'GOSUB', 'THEN', 'ELSE', 'RESTORE', 'RUN'].includes(token.text.toUpperCase())) continue;
    const onError = tokens[i - 2]?.text.toUpperCase() === 'ON' && tokens[i - 1]?.text.toUpperCase() === 'ERROR';
    let j = i + 1;
    while (j < tokens.length) {
      const target = tokens[j]!;
      const next = tokens[j + 1];
      if (target.kind !== 'number' || !/^\d+$/.test(target.text)) break;
      // Never turn expressions (GOTO n+1) into certain literal-target diagnostics.
      if (next && next.text !== ',' && next.text !== ':' && next.kind !== 'comment' && next.text.toUpperCase() !== 'ELSE') break;
      const number = Number(target.text);
      if (!(onError && number === 0)) refs.push({ number, line: physicalLine, start: target.start, end: target.end });
      if (!inOnList || next?.text !== ',') break;
      j += 2;
    }
  }
  return refs;
}

export function analyze(source: string, tokensForLine: (line: string, index: number) => Token[] = line => tokenize(line), diagnosticLimit = Infinity): Analysis {
  const diagnostics: Diagnostic[] = [];
  const targets: LineTarget[] = [];
  const references: LineReference[] = [];
  const variables = new Set<string>();
  let previous = 0;
  source.split('\n').forEach((line, index) => {
    const physical = index + 1;
    if (!line.trim()) return;
    const report = (start: number, end: number, code: string, message: string, severity: Diagnostic['severity'] = 'error') =>
      diagnostics.length < diagnosticLimit && diagnostics.push({ line: physical, start, end, code, message, severity });
    const prefix = /^\s*(\d+)(?=\s|[a-zA-Z?'&]|$)/.exec(line);
    if (!prefix) report(0, Math.max(1, line.length), 'line-number', 'Le listing doit commencer par un numéro BASIC.');
    else {
      const number = Number(prefix[1]); const start = line.indexOf(prefix[1]!);
      if (number < 1 || number > 65535) report(start, start + prefix[1]!.length, 'line-range', 'Numéro attendu entre 1 et 65535.');
      else {
        if (number <= previous) report(start, start + prefix[1]!.length, 'line-order', 'Les numéros BASIC doivent être strictement croissants.');
        targets.push({ number, line: physical, start, end: start + prefix[1]!.length });
      }
      previous = number;
    }
    const tokens = tokensForLine(line, index);
    for (const token of tokens) {
      if (token.kind === 'identifier') variables.add(token.text.toUpperCase());
      if (token.kind === 'string' && (token.text.length === 1 || !token.text.endsWith('"')))
        report(token.start, token.end, 'unclosed-string', 'Chaîne ouverte : terminaison à vérifier sur ROM ; analyse partielle.', 'warning');
    }
    references.push(...literalReferences(tokens, physical));
    // Export policy, not a blanket claim about CPC character encoding.
    for (let offset = 0; offset < line.length; offset++) {
      const code = line.charCodeAt(offset);
      if (code < 32 || code > 126) report(offset, offset + 1, 'export-ascii', 'L’export actuel accepte uniquement l’ASCII imprimable (32–126).');
    }
  });
  const numbers = new Set(targets.map(t => t.number));
  for (const ref of references) if (!numbers.has(ref.number) && diagnostics.length < diagnosticLimit) diagnostics.push({ ...ref, code: 'missing-target', message: `La ligne BASIC ${ref.number} n’existe pas dans ce listing.`, severity: 'error' });
  return { diagnostics, targets, references, variables: [...variables].sort() };
}

export function completionContext(line: string, offset: number): 'none' | 'target' | 'code' {
  if (line.length > 8192) return 'none';
  const tokens = tokenize(line.slice(0, offset));
  const last = tokens.at(-1);
  if (last?.kind === 'keyword' && last.text.toUpperCase() === 'DATA') return 'none';
  if (last && ['comment', 'data'].includes(last.kind)) return 'none';
  if (last?.kind === 'string' && (last.text.length === 1 || !last.text.endsWith('"'))) return 'none';
  if (/\b(?:GOTO|GOSUB|THEN|ELSE|RESTORE|RUN)\s*\d*$/i.test(line.slice(0, offset))) return 'target';
  return 'code';
}

export function commandAt(line: string, offset: number): CommandCard | undefined {
  if (line.length > 8192) return undefined;
  const token = tokenize(line).find(t => t.start <= offset && offset < t.end && t.kind === 'keyword');
  return COMMANDS.find(card => card.name === token?.text.toUpperCase());
}
