/** Literal search over loaded buffers. No filesystem access or BASIC rewriting. */
export interface SearchDocument { id: string; name: string; source: string }
export interface SearchOptions { query: string; matchCase: boolean; wholeWord: boolean }
export interface SearchMatch { documentId: string; name: string; start: number; end: number; line: number; column: number; snippet: string }
export interface SearchSnapshot { documents: SearchDocument[]; options: SearchOptions; matches: SearchMatch[] }
export interface SearchChange { id: string; name: string; before: string; after: string; count: number }
const fold = (text: string) => text.replace(/[a-z]/g, letter => letter.toUpperCase());
const word = (letter: string | undefined) => !!letter && /[\p{L}\p{N}_.$%!]/u.test(letter);

export function searchSources(documents: readonly SearchDocument[], options: SearchOptions): SearchSnapshot {
  if (!options.query || options.query.length > 256 || /[\r\n\0]/.test(options.query)) throw new Error('Recherche requise : 1 à 256 caractères sur une ligne.');
  if (!documents.length || documents.length > 64 || new Set(documents.map(item => item.id)).size !== documents.length) throw new Error('Périmètre requis : 1 à 64 sources distinctes.');
  let bytes = 0;
  const matches: SearchMatch[] = [];
  const needle = options.matchCase ? options.query : fold(options.query);
  for (const document of documents) {
    if (document.source.length > 1024 * 1024) throw new Error('Recherche limitée à 1 Mio par source et 4 Mio au total.');
    const size = new TextEncoder().encode(document.source).length; bytes += size;
    if (size > 1024 * 1024 || bytes > 4 * 1024 * 1024) throw new Error('Recherche limitée à 1 Mio par source et 4 Mio au total.');
    const haystack = options.matchCase ? document.source : fold(document.source);
    let from = 0, line = 1, lineStart = 0, scanned = 0;
    while (from <= haystack.length) {
      const start = haystack.indexOf(needle, from); if (start < 0) break;
      const end = start + needle.length; from = end;
      const previous = [...document.source.slice(Math.max(0, start - 2), start)].at(-1);
      const following = end < document.source.length ? String.fromCodePoint(document.source.codePointAt(end)!) : undefined;
      if (options.wholeWord && (word(previous) || word(following))) continue;
      for (; scanned < start; scanned++) if (document.source[scanned] === '\n') { line++; lineStart = scanned + 1; }
      const lineEnd = document.source.indexOf('\n', start);
      matches.push({ documentId: document.id, name: document.name, start, end, line, column: start - lineStart + 1,
        snippet: document.source.slice(Math.max(lineStart, start - 60), Math.min(lineEnd < 0 ? document.source.length : lineEnd, end + 100)).replace(/\r$/, '') });
      if (matches.length > 1000) throw new Error('Plus de 1 000 occurrences : précisez la recherche. Aucun résultat partiel.');
    }
  }
  return { documents: documents.map(item => ({ ...item })), options: { ...options }, matches };
}

export function verifySearchSnapshot(snapshot: SearchSnapshot, current: readonly SearchDocument[]): void {
  if (snapshot.documents.length !== current.length || snapshot.documents.some(expected => !current.some(item => item.id === expected.id && item.name === expected.name && item.source === expected.source)))
    throw new Error('Sources modifiées depuis la recherche : relancez la recherche.');
}

export function previewReplacement(snapshot: SearchSnapshot, replacement: string): SearchChange[] {
  if (replacement.length > 4096 || /[\r\n\0]/.test(replacement)) throw new Error('Remplacement limité à 4 096 caractères sur une ligne.');
  return snapshot.documents.flatMap(document => {
    const matches = snapshot.matches.filter(item => item.documentId === document.id);
    if (!matches.length) return [];
    let cursor = 0, after = '';
    for (const match of matches) { after += document.source.slice(cursor, match.start) + replacement; cursor = match.end; }
    after += document.source.slice(cursor);
    if (new TextEncoder().encode(after).length > 1024 * 1024) throw new Error('Source résultante supérieure à 1 Mio.');
    return after === document.source ? [] : [{ id: document.id, name: document.name, before: document.source, after, count: matches.length }];
  });
}
