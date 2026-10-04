import { analyze, tokenize } from './language.ts';
import type { Token } from './language.ts';
import { COMMANDS } from './catalog.ts';

export interface RenumberOptions { start: number; step: number; from: number; to: number }
export interface RenumberEdit { line: number; start: number; end: number; before: string; after: string; kind: 'definition' | 'reference' }
export interface RenumberPlan { before: string; after: string; edits: RenumberEdit[]; mapping: { before: number; after: number }[]; warnings: string[] }
const REFERENCES = new Set(['GOTO', 'GOSUB', 'THEN', 'ELSE', 'RESTORE', 'RESUME', 'RUN']);
const UNSUPPORTED = new Set(['AUTO', 'DELETE', 'EDIT', 'LIST', 'RENUM', 'MERGE', 'ERL']);
const BRANCH_COMMANDS = new Set([...COMMANDS.filter(card => card.kind === 'command').map(card => card.name),
  'ON', 'EVERY', 'CHAIN', 'RESUME', 'WHILE', 'WEND', 'CLEAR', 'CONT', 'NEW', 'DI', 'EI', 'ERASE', 'DEFINT', 'DEFREAL', 'DEFSTR', 'SYMBOL', 'WINDOW', 'WRITE']);
const upper = (token: Token | undefined) => token?.text.toUpperCase();
const boundary = (token: Token | undefined) => !token || token.kind === 'comment' || token.text === ':' || upper(token) === 'ELSE';

/** Textual refactoring of a documented subset, not a CPC interpreter or complete grammar. */
export function planRenumber(source: string, options: RenumberOptions): RenumberPlan {
  if (new TextEncoder().encode(source).length > 1024 * 1024 || source.includes('\r')) throw new Error('Listing LF de 1 Mio maximum requis.');
  if (!options || Object.keys(options).sort().join(',') !== 'from,start,step,to') throw new Error('Paramètres de renumérotation incomplets.');
  for (const value of Object.values(options)) if (!Number.isSafeInteger(value) || value < 1 || value > 65535) throw new Error('Paramètres entiers attendus entre 1 et 65535.');
  if (options.from > options.to) throw new Error('Plage de lignes inversée.');
  const lines = source.split('\n');
  if (lines.length > 10000 || lines.some(line => line.length > 4096)) throw new Error('Renumérotation limitée à 10 000 lignes et 4096 caractères par ligne.');
  const analysis = analyze(source);
  if (analysis.diagnostics.some(item => ['line-number', 'line-range', 'line-order', 'unclosed-string'].includes(item.code)))
    throw new Error('Numérotation ou chaîne ambiguë : corrigez le listing avant renumérotation.');
  const selected = analysis.targets.filter(line => line.number >= options.from && line.number <= options.to);
  if (!selected.length) throw new Error('Aucune ligne BASIC dans la plage.');
  const mapping = selected.map((line, index) => ({ before: line.number, after: options.start + index * options.step }));
  if (mapping.some(item => item.after > 65535)) throw new Error('La renumérotation dépasse 65535.');
  const map = new Map(mapping.map(item => [item.before, item.after]));
  let previous = 0;
  for (const target of analysis.targets) {
    const next = map.get(target.number) ?? target.number;
    if (next <= previous) throw new Error('Collision ou ordre non croissant avec les lignes conservées.');
    previous = next;
  }
  const numbers = new Set(analysis.targets.map(item => item.number)), edits: RenumberEdit[] = [];
  const warnings = new Set<string>();
  const add = (line: number, token: { start: number; end: number; text: string }, kind: RenumberEdit['kind']) => {
    const number = Number(token.text);
    if (kind === 'reference' && !numbers.has(number)) throw new Error(`L${line} : cible BASIC ${number} absente.`);
    const replacement = map.get(number);
    if (replacement !== undefined && replacement !== number) edits.push({ line, start: token.start, end: token.end, before: token.text, after: String(replacement), kind });
  };
  for (const target of analysis.targets) {
    const line = target.line, text = lines[line - 1]!;
    add(line, { ...target, text: text.slice(target.start, target.end) }, 'definition');
    const tokens = tokenize(text).filter(token => token.start >= target.end);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!, word = upper(token)!;
      if (token.kind === 'identifier' && (word === 'GO' && upper(tokens[i + 1]) === 'TO' || /^(GOTO|GOSUB|THEN|ELSE|RESTORE|RESUME|RUN)\d/.test(word)))
        throw new Error(`L${line} : forme compacte non prise en charge.`);
      if (token.kind === 'identifier' && (i === 0 || tokens[i - 1]?.text === ':' || ['THEN', 'ELSE'].includes(upper(tokens[i - 1]) ?? '')) && tokens[i + 1]?.text !== '=')
        throw new Error(`L${line} : instruction ou cible indirecte non reconnue.`);
      if (token.kind === 'operator' && token.text === '|') throw new Error(`L${line} : RSX opaque, renumérotation refusée.`);
      if (token.kind !== 'keyword') continue;
      if (UNSUPPORTED.has(word)) throw new Error(`L${line} : ${word} peut dépendre des numéros ; forme non prise en charge.`);
      if (word === 'CALL' || word === 'POKE') warnings.add('Les accès machine ne sont pas analysés ; vérifier leurs éventuelles dépendances aux numéros.');
      if (word === 'CHAIN' || word === 'RUN' && tokens[i + 1]?.kind === 'string') {
        const file = tokens[i + 1], separator = tokens[i + 2], start = tokens[i + 3];
        if (file?.kind !== 'string' || !(boundary(separator) || word === 'CHAIN' && separator?.text === ',' && start?.kind === 'number' && /^\d+$/.test(start.text) && boundary(tokens[i + 4])))
          throw new Error(`L${line} : référence externe ambiguë ou fusion non prise en charge.`);
        warnings.add('RUN/CHAIN fichier : les numéros du fichier externe sont conservés et sa compatibilité reste à vérifier.');
        i += separator?.text === ',' ? 3 : 1;
        continue;
      }
      if (!REFERENCES.has(word)) continue;
      const first = tokens[i + 1];
      if (['THEN', 'ELSE'].includes(word) && first?.kind !== 'number') {
        if (!first || first.kind === 'string' || first.kind === 'keyword' && !BRANCH_COMMANDS.has(upper(first)!) || first.kind === 'operator' && first.text !== '?' ||
            first.kind === 'identifier' && tokens[i + 2]?.text !== '=') throw new Error(`L${line} : branche ou cible indirecte non reconnue.`);
        continue; // Statement branch; its own GOTO/GOSUB is scanned.
      }
      if (['RESTORE', 'RESUME', 'RUN'].includes(word) && boundary(first)) continue;
      if (word === 'RESUME' && upper(first) === 'NEXT' && boundary(tokens[i + 2])) { i++; continue; }
      let begin = i;
      while (begin > 0 && tokens[begin - 1]?.text !== ':' && !['THEN', 'ELSE'].includes(upper(tokens[begin - 1]) ?? '')) begin--;
      const prefix = tokens.slice(begin, i).map(item => upper(item));
      const errorDisable = word === 'GOTO' && prefix.join(' ') === 'ON ERROR';
      const list = ['GOTO', 'GOSUB'].includes(word) && prefix[0] === 'ON' && !['ERROR', 'BREAK', 'SQ'].includes(prefix[1] ?? '');
      let cursor = i + 1;
      while (true) {
        const reference = tokens[cursor], next = tokens[cursor + 1];
        if (reference?.kind !== 'number' || !/^\d+$/.test(reference.text) || !(boundary(next) || list && next?.text === ','))
          throw new Error(`L${line} : cible calculée ou syntaxe ${word} non prise en charge.`);
        if (!(errorDisable && Number(reference.text) === 0)) add(line, reference, 'reference');
        if (!(list && next?.text === ',')) break;
        cursor += 2;
      }
      i = cursor;
    }
  }
  const byLine = new Map<number, RenumberEdit[]>();
  for (const edit of edits) {
    const group = byLine.get(edit.line) ?? []; group.push(edit); byLine.set(edit.line, group);
  }
  for (let index = 0; index < lines.length; index++) {
    let text = lines[index]!;
    for (const edit of (byLine.get(index + 1) ?? []).sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.after + text.slice(edit.end);
    lines[index] = text;
  }
  return { before: source, after: lines.join('\n'), edits, mapping, warnings: [...warnings] };
}

export function applyRenumber(plan: RenumberPlan, current: string): string {
  if (current !== plan.before) throw new Error('Le listing a changé depuis l’aperçu. Recalculez la renumérotation.');
  return plan.after;
}
