import { tokenize } from './language.ts';
import { indexSymbols } from './symbols.ts';
import { planRenumber } from './renumber.ts';
import { tokenizeBasic } from '../../cpc-disk/src/basic-codec.ts';
export interface ObfuscationOptions { rename: boolean; comments: boolean; renumber: boolean }
export interface ObfuscationResult { source: string; names: { before: string; after: string }[]; lines: { before: number; after: number }[] }
/** Conservative subset: a complete semantic index is required before any symbol change. */
export function obfuscateBasic(source: string, options: ObfuscationOptions): ObfuscationResult {
  tokenizeBasic(source);
  const lines = source.split('\n'), tokens = lines.flatMap(line => tokenize(line));
  const forbidden = new Set('CALL PEEK POKE MEMORY HIMEM FRE TIME WAIT INP OUT LOAD SAVE MERGE CHAIN RUN CONT NEW CLEAR SYMBOL'.split(' '));
  if (tokens.some(t => (t.kind === 'keyword' && forbidden.has(t.text.toUpperCase())) || t.text === '|' || t.text === '@'))
    throw new Error('Obfuscation refusée : accès machine, mémoire, temps ou programme externe non qualifié. Le mode protégé seul reste possible.');
  const names: ObfuscationResult['names'] = [];
  if (options.rename) {
    const index = indexSymbols({ id: 'export', name: 'export', source });
    if (index.status !== 'indexed') throw new Error('Renommage refusé : ' + index.reasons.join(' '));
    const mapping = new Map<string,string>();
    let count = 0;
    for (const symbol of index.symbols) {
      const bare = symbol.name.replace(/[$%!]+$/, '').toUpperCase();
      if (!mapping.has(bare)) {
        // Same first letter preserves all dynamic DEFINT/DEFSTR/DEFREAL defaults.
        const after = bare[0]! + 'Z' + (++count).toString(36).toUpperCase();
        mapping.set(bare,after); names.push({ before: bare, after });
      }
    }
    // Generated names must not collide with another original name or a keyword.
    if (names.some(n => names.some(other => other.before === n.after && other.before !== n.before))) throw new Error('Collision de renommage ; export refusé.');
    const edits = new Map<number,{ start: number; end: number; value: string }[]>();
    for (const symbol of index.symbols) for (const occurrence of symbol.occurrences) {
      const original = lines[occurrence.line-1]!.slice(occurrence.start,occurrence.end);
      const suffix = /[$%!]$/.exec(original)?.[0] ?? '';
      const edit = { start: occurrence.start, end: occurrence.end, value: mapping.get(original.replace(/[$%!]$/,'').toUpperCase())! + suffix };
      const group=edits.get(occurrence.line)??[];
      if (!group.some(e=>e.start===edit.start)) group.push(edit);
      edits.set(occurrence.line,group);
    }
    for (const [line, editsForLine] of edits) for (const edit of editsForLine.sort((a,b)=>b.start-a.start)) lines[line-1]=lines[line-1]!.slice(0,edit.start)+edit.value+lines[line-1]!.slice(edit.end);
  }
  if (options.comments) for (let i=0;i<lines.length;i++) {
    const comment = tokenize(lines[i]!).find(t=>t.kind==='comment');
    if (comment) lines[i]=lines[i]!.slice(0,comment.start)+(comment.text.startsWith("'") ? "'" : 'REM');
  }
  let result = lines.join('\n'); let mapping: ObfuscationResult['lines'] = [];
  if (options.renumber) { const plan=planRenumber(result,{ start:1,step:1,from:1,to:65535 }); result=plan.after; mapping=plan.mapping; }
  tokenizeBasic(result);
  return { source: result, names, lines: mapping };
}
